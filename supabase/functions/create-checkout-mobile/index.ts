import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

// Taux fixe du franc pacifique, identique a constants/theme.ts (app) et
// src/lib/currency.ts (site).
const EUR_TO_XPF = 119.33;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // 2026-09-04 : l'identite vient desormais du JWT, plus du corps de la
    // requete. Auparavant customerEmail etait pris tel quel chez le client :
    // n'importe quel compte authentifie pouvait faire livrer une eSIM a
    // l'adresse d'un tiers. L'email de facturation ET celui de livraison sont
    // maintenant celui du compte connecte, et lui seul.
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user || !user.email) {
      return new Response(JSON.stringify({ error: "Non authentifie" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2026-09-08 : promoCode etait envoye par l'application mais n'etait jamais
    // lu ici. Le client voyait donc une remise a l'ecran et payait le plein
    // tarif chez Stripe.
    //
    // 2026-10-29 : facturation en XPF. L'app envoie currency = 'XPF' quand le
    // client a choisi l'affichage XPF. Avant, la carte etait toujours debitee
    // en euros : un client polynesien voyait un prix en XPF, payait en EUR et
    // supportait les frais de change de sa banque. Toute autre valeur, ou
    // l'absence du champ (versions de l'app anterieures), garde le paiement
    // en euros, a l'identique d'avant.
    const { packageId, promoCode, currency } = await req.json();
    if (!packageId) {
      throw new Error("packageId est obligatoire");
    }
    const payInXpf = currency === "XPF";

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2023-10-16" });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } }
    );

    const { data: pkg, error: pkgError } = await supabase
      .from('airalo_packages')
      .select('*')
      .eq('id', packageId)
      .single();

    if (pkgError || !pkg) throw new Error(`Package non trouve: ${pkgError?.message}`);

    // Le prix vient de la base, jamais du client.
    let amountEur = Number(pkg.final_price_eur);
    if (!amountEur || isNaN(amountEur)) throw new Error(`Prix invalide: ${pkg.final_price_eur}`);

    // Prix XPF catalogue, celui que l'app affiche dans la liste des forfaits.
    // Le XPF n'a pas de centimes (devise "zero-decimal" chez Stripe) : on
    // travaille en entiers du debut a la fin, avec le meme arrondi que l'app
    // (app/esim/payment.tsx), pour que l'ecran annonce exactement le debit.
    let amountXpf = Math.round(Number(pkg.final_price_xpf));
    if (payInXpf && (!amountXpf || isNaN(amountXpf))) {
      throw new Error(`Prix XPF invalide: ${pkg.final_price_xpf}`);
    }

    // Le code promo est revalide integralement ici. L'application fait la meme
    // verification de son cote, mais uniquement pour l'affichage : seul ce
    // calcul fait foi, sinon un client pourrait forger sa propre remise.
    let appliedPromo: string | null = null;
    if (promoCode && typeof promoCode === "string" && promoCode.trim()) {
      const { data: promo } = await supabase
        .from("promo_codes")
        .select("*")
        .ilike("code", promoCode.trim())
        .maybeSingle();

      const now = new Date();
      const usable = promo
        && promo.is_active
        && promo.applies_to !== "insurance"
        && (!promo.valid_from  || new Date(promo.valid_from)  <= now)
        && (!promo.valid_until || new Date(promo.valid_until) >= now)
        && (!promo.usage_limit || (promo.times_used ?? 0) < promo.usage_limit);

      if (usable) {
        if (promo.discount_percentage) {
          amountEur = amountEur * (1 - Number(promo.discount_percentage) / 100);
          amountXpf = Math.round(amountXpf * (1 - Number(promo.discount_percentage) / 100));
        } else if (promo.discount_amount) {
          // discount_amount est stocke en EUR, comme final_price_eur. En XPF il
          // est converti au taux fixe (1 EUR = 119,33 XPF, comme partout dans
          // l'app et le site) puis arrondi a l'unite.
          amountEur = Math.max(0, amountEur - Number(promo.discount_amount));
          amountXpf = Math.max(0, amountXpf - Math.round(Number(promo.discount_amount) * EUR_TO_XPF));
        }
        appliedPromo = promo.code;
      }
      // Un code invalide n'est pas une erreur : la commande se poursuit au
      // plein tarif, comme sur le site.
    }

    const priceInCents = Math.round(amountEur * 100);
    // Stripe refuse tout paiement sous 0,50 EUR (60 XPF au taux fixe).
    if (payInXpf ? amountXpf < 60 : priceInCents < 50) throw new Error("Montant trop faible apres remise");

    // Montant envoye a Stripe : unites mineures en EUR (centimes), unites
    // entieres en XPF (pas de centimes).
    const stripeCurrency = payInXpf ? 'xpf' : 'eur';
    const unitAmount = payInXpf ? amountXpf : priceInCents;

    const session = await stripe.checkout.sessions.create({
      customer_email: user.email,
      line_items: [{
        price_data: {
          currency: stripeCurrency,
          product_data: {
            name: pkg.name || `eSIM ${pkg.slug}`,
            description: `${pkg.data_amount || ''} - ${pkg.validity || ''} jours`,
          },
          unit_amount: unitAmount,
        },
        quantity: 1,
      }],
      metadata: {
        package_id: packageId,
        data_amount: pkg.data_amount,
        validity: pkg.validity,
        source: 'mobile_app',
        user_id: user.id,
        promo_code: appliedPromo ?? '',
      },
      mode: 'payment',
      success_url: `fenuasim://payment-success?session_id={CHECKOUT_SESSION_ID}&package_id=${packageId}`,
      cancel_url: `fenuasim://payment-cancel`,
    });

    // La commande est enregistree AVANT le paiement, en pending_payment. C'est
    // elle que le webhook fera avancer apres verification serveur du paiement :
    // l'app ne declenche plus aucune livraison elle-meme.
    // amount est le montant reellement demande a Stripe (remise deduite) : y
    // laisser le plein tarif fausserait la comptabilite. Il est exprime dans
    // la devise de la colonne currency ('eur' ou 'xpf') ; stripe-webhook la
    // reprend telle quelle dans orders (voir patch du 2026-10-29).
    const { error: insertError } = await supabase
      .from('esim_purchase_orders')
      .insert({
        user_id: user.id,
        email: user.email,
        package_id: String(pkg.airalo_id ?? pkg.id),
        package_name: pkg.name ?? null,
        data_label: [pkg.data_amount, pkg.data_unit].filter(Boolean).join(' ') || null,
        amount: payInXpf ? amountXpf : amountEur,
        currency: stripeCurrency,
        stripe_session_id: session.id,
        status: 'pending_payment',
      });

    if (insertError) throw insertError;

    // currency est renvoyee pour que l'app puisse verifier la devise reellement
    // retenue (une ancienne version de cette fonction l'ignorerait).
    return new Response(JSON.stringify({ url: session.url, sessionId: session.id, currency: stripeCurrency.toUpperCase() }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    console.error("Erreur checkout mobile:", error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : "Erreur inconnue"
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
