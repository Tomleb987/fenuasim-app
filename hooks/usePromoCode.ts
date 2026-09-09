// Reproduit exactement la logique de validation de code promo du site
// (fenuasim.com/shop/[region]) : lecture directe de la table Supabase
// "promo_codes" (meme projet, meme cle anon deja utilisee par l'app -- verifie
// reel : lecture anonyme confirmee, codes actifs reels observes). Le site ne
// passe par aucune API pour cette etape, juste une requete Supabase cote
// client -- reproduit a l'identique ici, jamais invente.
import { supabase } from '../lib/supabase'
import { EUR_TO_XPF } from '../constants/theme'

export interface PromoCodeResult {
  isValid: boolean
  discountedPriceXpf: number
  // Detail de la remise, pour pouvoir la rejouer sur le montant deja converti
  // dans la devise d'affichage -- l'appliquer sur les XPF puis arrondir a
  // l'euro superieur la faisait disparaitre sur les petits montants.
  discountPercentage?: number | null
  discountAmountEur?: number | null
  error?: string
}

export async function validateEsimPromoCode(code: string, priceXpf: number): Promise<PromoCodeResult> {
  try {
    const { data, error } = await supabase.from('promo_codes').select('*').eq('code', code).single()

    if (!error && data && data.applies_to === 'insurance') {
      return { isValid: false, discountedPriceXpf: priceXpf, error: 'Code promo invalide pour les eSIM' }
    }
    if (error || !data) {
      return { isValid: false, discountedPriceXpf: priceXpf, error: 'Code promo invalide' }
    }
    if (!data.is_active) {
      return { isValid: false, discountedPriceXpf: priceXpf, error: "Ce code promo n'est plus actif" }
    }
    const now = new Date()
    if ((data.valid_from && new Date(data.valid_from) > now) || (data.valid_until && new Date(data.valid_until) < now)) {
      return { isValid: false, discountedPriceXpf: priceXpf, error: "Ce code promo n'est plus valide" }
    }
    if (data.usage_limit && data.times_used >= data.usage_limit) {
      return { isValid: false, discountedPriceXpf: priceXpf, error: 'Ce code promo a atteint sa limite d\'utilisation' }
    }

    let discounted = priceXpf
    if (data.discount_percentage) {
      discounted = priceXpf * (1 - data.discount_percentage / 100)
    } else if (data.discount_amount) {
      // discount_amount est stocke en EUR cote site (ex: code "SAVE5EUR" = 5.00)
      discounted = Math.max(0, priceXpf - data.discount_amount * EUR_TO_XPF)
    }
    return {
      isValid: true,
      discountedPriceXpf: discounted,
      discountPercentage: data.discount_percentage ?? null,
      discountAmountEur: data.discount_amount ?? null,
    }
  } catch {
    return { isValid: false, discountedPriceXpf: priceXpf, error: 'Erreur de connexion, veuillez réessayer.' }
  }
}
