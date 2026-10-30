
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.3";
import Stripe from "https://esm.sh/stripe@14.21.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const AIRALO_API_URL = "https://partners-api.airalo.com/v2";

// Airalo limite fortement les demandes de token (429 constate le 2026-09-05).
// Le token est mis en cache dans airalo_token_cache (partagee avec
// list-esim-topups / create-topup-checkout), reutilise jusqu'a 60s avant son
// expiration reelle.
async function getAiraloAccessToken(supabase) {
  const { data: cached } = await supabase
    .from("airalo_token_cache")
    .select("access_token, expires_at")
    .eq("id", 1)
    .maybeSingle();

  if (cached && new Date(cached.expires_at).getTime() - Date.now() > 60_000) {
    return cached.access_token;
  }

  const clientId = Deno.env.get("AIRALO_CLIENT_ID")!;
  const clientSecret = Deno.env.get("AIRALO_CLIENT_SECRET")!;
  const res = await fetch(`${AIRALO_API_URL}/token`, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, grant_type: "client_credentials" }),
  });
  if (!res.ok) throw new Error(`Impossible d'obtenir le token Airalo (${res.status})`);
  const data = await res.json();
  const accessToken = data.data.access_token;
  const expiresInSec = typeof data.data.expires_in === "number" ? data.data.expires_in : 1200;
  const expiresAt = new Date(Date.now() + expiresInSec * 1000).toISOString();

  await supabase
    .from("airalo_token_cache")
    .upsert({ id: 1, access_token: accessToken, expires_at: expiresAt, updated_at: new Date().toISOString() });

  return accessToken;
}

// Le bloc "sharing" (lien esims.cloud brande + code d'acces a 4 chiffres) n'est
// pas garanti dans la reponse de POST /orders, mais il l'est sur GET /sims/{iccid}
// -- verifie en direct sur une vraie eSIM le 2026-09-04. C'est ce couple que le
// client saisit sur esims.cloud pour installer son eSIM et suivre sa conso,
// notamment depuis un appareil Android ou le QR ne peut pas etre scanne.
async function fetchAiraloSharing(iccid, accessToken) {
  try {
    const res = await fetch(`${AIRALO_API_URL}/sims/${encodeURIComponent(iccid)}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
    });
    if (!res.ok) return null;
    const body = await res.json().catch(() => ({}));
    const sharing = body?.data?.sharing;
    return sharing && (sharing.link || sharing.access_code) ? sharing : null;
  } catch (e) {
    console.error("⚠️ Recuperation sharing Airalo impossible (non bloquant):", e);
    return null;
  }
}

serve(async (req) => {
  // Gestion des requêtes OPTIONS pour CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Rejeter les méthodes non-POST
  if (req.method !== "POST") {
    console.log(`Méthode non autorisée: ${req.method}`);
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  console.log("======== DÉMARRAGE DU WEBHOOK STRIPE ========");
  console.log("Webhook Stripe reçu à:", new Date().toISOString());

  try {
    // Récupération du body et de la signature
    const body = await req.text();
    const signature = req.headers.get('stripe-signature');
    console.log("Signature Stripe reçue:", !!signature);

    // Vérification des variables d'environnement
    const stripeWebhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!stripeWebhookSecret || !stripeSecretKey) {
      console.error("Configuration Stripe manquante");
      return new Response(JSON.stringify({
        received: true,
        error: "Configuration Stripe incomplète"
      }), { status: 200 });
    }

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("Configuration Supabase manquante");
      return new Response(JSON.stringify({
        received: true,
        error: "Configuration Supabase incomplète"
      }), { status: 200 });
    }

    // Vérification et construction de l'événement Stripe
    let event;

    try {
      const stripe = new Stripe(stripeSecretKey, { apiVersion: '2023-10-16' });

      if (!signature) {
        throw new Error("Signature Stripe manquante dans l'en-tête");
      }

      event = await stripe.webhooks.constructEventAsync(body, signature, stripeWebhookSecret);
      console.log(`❗️ Événement Stripe valide reçu: ${event.type}`);
    } catch (err) {
      console.error(`⚠️ Erreur signature: ${err.message}`);
      return new Response(JSON.stringify({
        received: true,
        error: `Erreur de vérification: ${err.message}`
      }), { status: 200 });
    }

    // Création du client Supabase
    const supabase = createClient(
      supabaseUrl,
      supabaseServiceKey,
      { auth: { persistSession: false } }
    );

    // Traitement des différents événements Stripe
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      if (session.metadata?.source === "mobile_topup") {
        // Phase "recharge eSIM" (2026-08-25) : chemin dédié, autoritaire côté serveur,
        // pour les Checkout Sessions créées par create-topup-checkout. Ne touche pas au
        // chemin historique ci-dessous (achat eSIM), volontairement laissé inchangé.
        await handleTopupCheckoutSession(session, supabase);
      } else if (session.metadata?.source === "mobile_app") {
        // Phase "achat eSIM mobile" (2026-09-04) : même principe que la recharge.
        // Avant cette date, l'app appelait elle-même fenuasim.com/api/create-airalo-order
        // depuis le client, sans en-tête d'autorisation -> 401, paiement encaissé et
        // aucune eSIM livrée. La livraison est désormais déclenchée ici, après
        // vérification serveur du paiement, et jamais par le retour mobile.
        // Le chemin historique du site (else ci-dessous) reste inchangé.
        await handlePurchaseCheckoutSession(session, supabase);
      } else {
        await handleCheckoutSession(session, supabase);
      }
    }
    else if (event.type === "payment_intent.payment_failed") {
      const paymentIntent = event.data.object;
      await handlePaymentFailed(paymentIntent, supabase);
    }
    else if (event.type === "payment_intent.succeeded") {
      const paymentIntent = event.data.object;
      await handlePaymentSucceeded(paymentIntent, supabase);
    }
    else {
      console.log(`ℹ️ Événement non géré: ${event.type}`);
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("⚠️ Erreur critique:", error);
    return new Response(JSON.stringify({
      received: true,
      critical_error: "Une erreur critique s'est produite"
    }), { status: 200 });
  } finally {
    console.log("======== FIN DU WEBHOOK STRIPE ========");
  }
});

// Gestion d'une session de paiement réussie (achat eSIM mobile) — autoritaire,
// idempotente (claim atomique sur stripe_session_id / status). Miroir exact de
// la logique de recharge ci-dessous.
async function handlePurchaseCheckoutSession(session, supabase) {
  const sessionId = session.id;
  const paymentIntent = session.payment_intent || null;

  const { data: paidRows, error: paidErr } = await supabase
    .from('esim_purchase_orders')
    .update({
      status: 'paid',
      stripe_payment_intent: paymentIntent,
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_session_id', sessionId)
    .eq('status', 'pending_payment')
    .select();

  if (paidErr) {
    console.error("⚠️ Erreur transition paid (achat):", paidErr);
    return;
  }

  if (!paidRows || paidRows.length === 0) {
    // Rejeu Stripe, ou ligne déjà au-delà de pending_payment : idempotent.
    console.log(`📝 Achat déjà traité ou introuvable pour session ${sessionId}`);
    return;
  }

  await claimAndProcessPurchase(paidRows[0], supabase);
}

async function claimAndProcessPurchase(order, supabase) {
  // Réclamation atomique : paid -> processing.
  const { data: claimed, error: claimErr } = await supabase
    .from('esim_purchase_orders')
    .update({ status: 'processing', updated_at: new Date().toISOString() })
    .eq('id', order.id)
    .eq('status', 'paid')
    .select();

  if (claimErr || !claimed || claimed.length === 0) {
    console.log(`📝 Achat ${order.id} déjà réclamé par un autre traitement`);
    return;
  }

  const claimedOrder = claimed[0];

  try {
    const accessToken = await getAiraloAccessToken(supabase);
    const formData = new URLSearchParams();
    formData.append('package_id', claimedOrder.package_id);
    formData.append('quantity', '1');
    formData.append('type', 'sim');
    formData.append('description', `FenuaSIM mobile - ${claimedOrder.package_name ?? claimedOrder.package_id}`);

    const res = await fetch(`${AIRALO_API_URL}/orders`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: formData.toString(),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(data?.message || data?.data?.message || `Airalo error ${res.status}`);
    }

    const airaloOrderId = data?.data?.id ? String(data.data.id) : null;
    const sim = Array.isArray(data?.data?.sims) ? data.data.sims[0] : null;

    if (!airaloOrderId || !sim?.iccid) {
      throw new Error("Reponse Airalo sans commande ni SIM exploitable");
    }

    const qrCodeUrl = sim.qrcode_url ?? null;
    const appleUrl = sim.direct_apple_installation_url ?? null;
    // lpa = adresse SM-DP+, matching_id = code d'activation : le couple
    // necessaire a la saisie manuelle sur Android.
    const lpa = sim.lpa ?? null;
    const matchingId = sim.matching_id ?? null;
    const sharing = await fetchAiraloSharing(sim.iccid, accessToken);

    await supabase.from('esim_purchase_orders').update({
      status: 'completed',
      airalo_order_id: airaloOrderId,
      sim_iccid: sim.iccid,
      qr_code_url: qrCodeUrl,
      apple_installation_url: appleUrl,
      sharing_link: sharing?.link ?? null,
      sharing_access_code: sharing?.access_code ? String(sharing.access_code) : null,
      lpa: lpa,
      matching_id: matchingId,
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', claimedOrder.id);

    // airalo_orders est la table que lisent tous les écrans existants de l'app
    // (filtrée par email). On y écrit la commande sous la même forme que celles
    // créées par le site, pour que rien d'autre n'ait à changer.
    // order_id porte une contrainte UNIQUE : ignoreDuplicates protège d'un rejeu.
    const { error: orderInsertError } = await supabase
      .from('airalo_orders')
      .upsert({
        order_id: airaloOrderId,
        email: claimedOrder.email,
        package_id: claimedOrder.package_id,
        sim_iccid: sim.iccid,
        qr_code_url: qrCodeUrl,
        apple_installation_url: appleUrl,
        sharing_link: sharing?.link ?? null,
        sharing_access_code: sharing?.access_code ? String(sharing.access_code) : null,
        lpa: lpa,
        matching_id: matchingId,
        status: 'success',
        data_balance: claimedOrder.data_label ?? null,
        created_at: new Date().toISOString(),
      }, { onConflict: 'order_id', ignoreDuplicates: true });

    if (orderInsertError) {
      console.error("⚠️ Erreur insertion airalo_orders:", orderInsertError);
    }

    // Dashboard fenuasim.com (v_esim_sales / v_dashboard_kpis) : lit exclusivement
    // la table `orders`, jamais esim_purchase_orders ni airalo_orders -- les ventes
    // mobile n'y remontaient donc jamais avant ce correctif (constat du 2026-09-05).
    // La vue lit o.price (pas o.amount) comme montant reel -- amount est laisse en
    // centimes pour coller a la convention des autres lignes de cette table.
    // orders n'a PAS de colonne updated_at (constat direct, la premiere version de
    // ce correctif echouait silencieusement a l'insertion pour cette raison).
    const { error: salesInsertError } = await supabase
      .from('orders')
      .insert({
        stripe_session_id: claimedOrder.stripe_session_id,
        status: 'completed',
        email: claimedOrder.email,
        amount: Math.round(Number(claimedOrder.amount) * 100),
        price: Number(claimedOrder.amount),
        currency: 'EUR',
        package_id: claimedOrder.package_id,
        package_name: claimedOrder.package_name ?? null,
        source: 'mobile_app',
        created_at: claimedOrder.created_at ?? new Date().toISOString(),
      });

    if (salesInsertError) {
      console.error("⚠️ Erreur insertion orders (dashboard ventes):", salesInsertError);
    }

    // Email de confirmation, comme le fait le chemin du site. Volontairement
    // non bloquant et hors du catch principal de livraison : une eSIM réellement
    // livrée ne doit jamais être repassée en 'failed' parce que Brevo a eu un
    // hoquet -- cela déclencherait un second appel Airalo, donc une seconde
    // commande facturée.
    try {
      const { data: pkgRow } = await supabase
        .from('airalo_packages')
        .select('name, region_fr, validity')
        .eq('airalo_id', claimedOrder.package_id)
        .maybeSingle();

      const { error: mailError } = await supabase.functions.invoke('send-esim-confirmation', {
        body: {
          email: claimedOrder.email,
          orderId: airaloOrderId,
          esimDetails: {
            qrCodeData: qrCodeUrl,
            // Code a saisir sur esims.cloud, et non la chaine LPA du profil :
            // c'est ce que le client utilise reellement pour installer et suivre.
            activationCode: sharing?.access_code ?? matchingId ?? null,
            sharingLink: sharing?.link ?? null,
            sharingAccessCode: sharing?.access_code ?? null,
            destination: pkgRow?.region_fr ?? pkgRow?.name ?? '',
            dataPackage: claimedOrder.data_label ?? '',
            validityPeriod: pkgRow?.validity ?? '',
            activationStart: '',
            activationEnd: '',
          },
        },
      });

      if (mailError) {
        console.error("⚠️ Erreur email de confirmation (non bloquant):", mailError);
      } else {
        console.log(`✉️ Email de confirmation envoyé à ${claimedOrder.email} (sharing: ${sharing ? 'oui' : 'non'})`);
      }
    } catch (mailErr) {
      console.error("⚠️ Exception email de confirmation (non bloquant):", mailErr);
    }

    console.log(`✅ eSIM Airalo livrée pour ${claimedOrder.email} (order ${airaloOrderId})`);
  } catch (error) {
    console.error(`⚠️ Erreur livraison eSIM pour ${claimedOrder.id}:`, error);
    await supabase.from('esim_purchase_orders').update({
      status: 'failed',
      retry_count: (claimedOrder.retry_count || 0) + 1,
      last_error: String(error?.message || error).slice(0, 500),
      updated_at: new Date().toISOString(),
    }).eq('id', claimedOrder.id);
  }
}

// Gestion d'une session de paiement réussie (recharge eSIM mobile) — autoritaire,
// idempotente (claim atomique sur stripe_session_id / status), jamais déclenchée par le
// retour mobile lui-même (voir esim_topup_orders + create-topup-checkout).
async function handleTopupCheckoutSession(session, supabase) {
  const sessionId = session.id;
  const paymentIntent = session.payment_intent || null;

  const { data: paidRows, error: paidErr } = await supabase
    .from('esim_topup_orders')
    .update({
      status: 'paid',
      stripe_payment_intent: paymentIntent,
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_session_id', sessionId)
    .eq('status', 'pending_payment')
    .select();

  if (paidErr) {
    console.error("⚠️ Erreur transition paid (topup):", paidErr);
    return;
  }

  if (!paidRows || paidRows.length === 0) {
    // Rejeu Stripe (webhook renvoyé) ou ligne déjà passée au-delà de pending_payment :
    // idempotent, on ne refait rien.
    console.log(`📝 Topup déjà traité ou introuvable pour session ${sessionId}`);
    return;
  }

  await claimAndProcessTopup(paidRows[0], supabase);
}

async function claimAndProcessTopup(order, supabase) {
  // Réclamation atomique : paid -> processing. Si 0 ligne, un autre traitement concurrent
  // (rejeu webhook, ou le job de retry) a déjà pris la main : on abandonne proprement.
  const { data: claimed, error: claimErr } = await supabase
    .from('esim_topup_orders')
    .update({ status: 'processing', updated_at: new Date().toISOString() })
    .eq('id', order.id)
    .eq('status', 'paid')
    .select();

  if (claimErr || !claimed || claimed.length === 0) {
    console.log(`📝 Topup ${order.id} déjà réclamé par un autre traitement`);
    return;
  }

  const claimedOrder = claimed[0];

  try {
    const accessToken = await getAiraloAccessToken(supabase);
    const formData = new URLSearchParams();
    formData.append('package_id', claimedOrder.package_id);
    formData.append('iccid', claimedOrder.iccid);
    formData.append('description', `Recharge FenuaSIM - ${claimedOrder.iccid}`);

    const res = await fetch(`${AIRALO_API_URL}/orders/topups`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: formData.toString(),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(data?.message || data?.data?.message || `Airalo error ${res.status}`);
    }

    const airaloOrderId = data?.data?.id ? String(data.data.id) : null;

    await supabase.from('esim_topup_orders').update({
      status: 'completed',
      airalo_order_id: airaloOrderId,
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', claimedOrder.id);

    if (airaloOrderId) {
      const { error: logError } = await supabase.from('airalo_topups').insert({
        topup_id: airaloOrderId,
        order_id: airaloOrderId,
        package_id: claimedOrder.package_id,
        amount: claimedOrder.amount,
        currency: claimedOrder.currency,
        sim_iccid: claimedOrder.iccid,
      });
      if (logError) console.error("⚠️ Erreur log airalo_topups (non bloquant):", logError);
    }

    // Dashboard fenuasim.com : voir commentaire equivalent dans claimAndProcessPurchase
    // (o.price, pas o.amount ; pas de colonne updated_at sur orders).
    let topupEmail = null;
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('email')
        .eq('id', claimedOrder.user_id)
        .maybeSingle();
      topupEmail = profile?.email ?? null;
    } catch (e) {
      console.error("⚠️ Impossible de récupérer l'email du profil (non bloquant):", e);
    }

    if (topupEmail) {
      const { error: salesInsertError } = await supabase
        .from('orders')
        .insert({
          stripe_session_id: claimedOrder.stripe_session_id,
          status: 'completed',
          email: topupEmail,
          amount: Math.round(Number(claimedOrder.amount) * 100),
          price: Number(claimedOrder.amount),
          currency: 'EUR',
          package_id: claimedOrder.package_id,
          package_name: claimedOrder.data_label ?? null,
          source: 'mobile_topup',
          transaction_type: 'recharge',
          created_at: claimedOrder.created_at ?? new Date().toISOString(),
        });

      if (salesInsertError) {
        console.error("⚠️ Erreur insertion orders (dashboard ventes recharge):", salesInsertError);
      }
    } else {
      console.error(`⚠️ Email introuvable pour user_id ${claimedOrder.user_id} : recharge non remontée au dashboard (non bloquant)`);
    }

    console.log(`✅ Recharge Airalo effectuée pour ${claimedOrder.iccid} (order ${airaloOrderId})`);
  } catch (error) {
    console.error(`⚠️ Erreur recharge Airalo pour ${claimedOrder.id}:`, error);
    await supabase.from('esim_topup_orders').update({
      status: 'failed',
      retry_count: (claimedOrder.retry_count || 0) + 1,
      last_error: String(error?.message || error).slice(0, 500),
      updated_at: new Date().toISOString(),
    }).eq('id', claimedOrder.id);
  }
}

// Gestion d'une session de paiement réussie
async function handleCheckoutSession(session, supabase) {
  console.log("🔍 Session Stripe complète:", session.id);

  const email = session.customer_details?.email || session.customer_email || "";
  const amount = session.amount_total ? session.amount_total / 100 : 0;
  const packageId = session.metadata?.package_id;

  if (!packageId) {
    console.error("⚠️ Pas de package_id dans les métadonnées");
    return;
  }

  try {
    // Vérifier si la commande existe déjà
    const { data: existingOrders } = await supabase
      .from('orders')
      .select('*')
      .eq('stripe_session_id', session.id);

    if (existingOrders && existingOrders.length > 0) {
      console.log(`📝 Commande déjà existante pour session ${session.id}`);

      // Mise à jour du statut
      await supabase
        .from('orders')
        .update({
          status: "paid",
          updated_at: new Date().toISOString()
        })
        .eq('stripe_session_id', session.id);

      return;
    }

    // Créer une nouvelle commande
    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .insert({
        stripe_session_id: session.id,
        status: "paid",
        email: email,
        amount: amount,
        currency: "EUR",
        package_id: packageId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select();

    if (orderError) {
      console.error("⚠️ Erreur d'insertion commande:", orderError);
    } else {
      console.log(`✅ Nouvelle commande créée: ${orderData[0].id}`);

      // Créer une entrée dans la file d'attente pour créer l'eSIM
      await supabase
        .from('sync_queue')
        .insert({
          type: 'new_esim_order',
          entity_id: orderData[0].id,
          status: 'pending',
          data: {
            package_id: packageId,
            customer_email: email,
            order_id: orderData[0].id
          },
          created_at: new Date().toISOString(),
        });
    }
  } catch (error) {
    console.error("⚠️ Erreur traitement paiement:", error);
  }
}

// Gestion d'un paiement échoué
async function handlePaymentFailed(paymentIntent, supabase) {
  try {
    const stripePaymentId = paymentIntent.id;
    const email = paymentIntent.receipt_email || "";
    const amount = paymentIntent.amount ? paymentIntent.amount / 100 : 0;
    const errorMessage = paymentIntent.last_payment_error?.message || "Erreur inconnue";

    console.log(`❌ Échec paiement pour ${email}: ${errorMessage}`);

    await supabase
      .from('orders')
      .insert({
        payment_intent_id: stripePaymentId,
        status: "failed",
        email: email,
        amount: amount,
        currency: paymentIntent.currency?.toUpperCase() || "EUR",
        error: errorMessage,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
  } catch (error) {
    console.error("⚠️ Erreur traitement échec:", error);
  }
}

// Gestion d'un paiement réussi
async function handlePaymentSucceeded(paymentIntent, supabase) {
  console.log(`✅ Paiement réussi: ${paymentIntent.id}`);

  try {
    // Mise à jour du statut de paiement
    await supabase
      .from('payments')
      .update({
        status: 'completed',
        updated_at: new Date().toISOString()
      })
      .eq('payment_intent_id', paymentIntent.id);

    // Récupérer et mettre à jour la commande associée
    const { data: orderData } = await supabase
      .from('orders')
      .select('*')
      .eq('payment_intent_id', paymentIntent.id)
      .maybeSingle();

    if (orderData) {
      await supabase
        .from('orders')
        .update({
          status: 'completed',
          updated_at: new Date().toISOString()
        })
        .eq('id', orderData.id);
    }
  } catch (error) {
    console.error("⚠️ Erreur traitement succès:", error);
  }
}
