import { useState } from 'react'
import { InsuranceProductId, INSURANCE_SUBSCRIBER_COUNTRY, INSURANCE_SERVICE_FEE_EUR } from '../constants/insurance'
import { fetchWithTimeout } from '../lib/http'

// Le vrai backend assurance vit sur le site (fenuasim.com), pas dans Supabase
// -- confirme par appel reel a /api/get-quote (reponse {price, currency}
// obtenue en conditions reelles avant d'ecrire ce hook). Jamais d'appel a
// /api/insurance-checkout hors d'une vraie intention d'achat de l'utilisateur
// (cree une session Stripe reelle).
const ASSURANCE_BASE_URL = 'https://www.fenuasim.com'

export interface InsuranceSubscriber {
  firstName: string
  lastName: string
  birthDate: string // YYYY-MM-DD
  email: string
  address: string
  postalCode: string
  city: string
}

export interface InsuranceCompanion {
  firstName: string
  lastName: string
  birthDate: string
  parental_link: string
}

export interface InsuranceQuoteData {
  productType: InsuranceProductId
  startDate: string
  endDate: string
  destinationRegion?: string
  tripCost?: number
  subscriber: InsuranceSubscriber
  companions: InsuranceCompanion[]
  options: string[]
  optionDateRanges: Record<string, { from_date_option?: string; to_date_option?: string }>
}

export function useInsuranceQuote() {
  const [quoting, setQuoting] = useState(false)
  const [premium, setPremium] = useState<number | null>(null)
  const [checkingOut, setCheckingOut] = useState(false)
  const [promoStatus, setPromoStatus] = useState<'idle' | 'loading' | 'valid' | 'invalid'>('idle')
  const [promoDiscount, setPromoDiscount] = useState(0)

  async function fetchQuote(data: InsuranceQuoteData): Promise<number> {
    setQuoting(true)
    try {
      const res = await fetchWithTimeout(`${ASSURANCE_BASE_URL}/api/get-quote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quoteData: { ...data, subscriberCountry: INSURANCE_SUBSCRIBER_COUNTRY },
        }),
      }, 30_000)
      const json = await res.json()
      if (!res.ok || typeof json.price !== 'number') throw new Error(json.error || 'Devis indisponible')
      setPremium(json.price)
      return json.price
    } finally {
      setQuoting(false)
    }
  }

  async function checkPromoCode(code: string): Promise<number> {
    setPromoStatus('loading')
    try {
      const res = await fetchWithTimeout(`${ASSURANCE_BASE_URL}/api/check-promo-insurance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim() }),
      })
      const json = await res.json()
      if (res.ok && json.valid) {
        // 2026-10-25 -- meme calcul que le site (src/lib/insurancePricing.ts,
        // insuranceFeesAfterPromo) : la remise porte uniquement sur les frais
        // de distribution (10 EUR), en montant OU en pourcentage, bornee a
        // [0, 10]. L'ancien calcul ignorait les codes en pourcentage.
        const fee = INSURANCE_SERVICE_FEE_EUR
        const amount = Number(json.discount_amount) || 0
        const pct = Number(json.discount_percentage) || 0
        let feesAfter = fee
        if (amount > 0) feesAfter = fee - amount
        else if (pct > 0) feesAfter = fee * (1 - pct / 100)
        feesAfter = Math.round(Math.min(fee, Math.max(0, feesAfter)) * 100) / 100
        const discount = Math.round((fee - feesAfter) * 100) / 100
        setPromoDiscount(discount)
        setPromoStatus('valid')
        return discount
      }
      setPromoStatus('invalid')
      setPromoDiscount(0)
      return 0
    } catch {
      setPromoStatus('invalid')
      setPromoDiscount(0)
      return 0
    }
  }

  async function checkout(
    data: InsuranceQuoteData,
    userEmail: string,
    amount: number | null,
    promoCode?: string | null
  ): Promise<string> {
    setCheckingOut(true)
    try {
      // 2026-10-25 :
      //  - promoCode est desormais transmis. Le site ne lit QUE ce champ pour
      //    appliquer une remise (le montant envoye par l'app n'est jamais
      //    utilise comme prix : la prime vient d'AVA). Sans lui, l'ecran
      //    affichait la remise mais Stripe facturait le plein tarif.
      //  - returnTo: 'app' demande au site un retour de paiement vers
      //    fenuasim://insurance-success|cancel au lieu des pages web. Un site
      //    qui ne connait pas encore ce champ l'ignore : aucune regression.
      //  - 70 s de delai : la route cree le contrat AVA et envoie l'e-mail de
      //    devis avant de repondre (maxDuration 60 s cote Vercel).
      const res = await fetchWithTimeout(`${ASSURANCE_BASE_URL}/api/insurance-checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quoteData: { ...data, subscriberCountry: INSURANCE_SUBSCRIBER_COUNTRY },
          userEmail,
          amount,
          ...(promoCode && promoCode.trim() ? { promoCode: promoCode.trim().toUpperCase() } : {}),
          returnTo: 'app',
        }),
      }, 70_000)
      const json = await res.json()
      if (!res.ok || !json.url) throw new Error(json.error || 'Erreur lors de la création du paiement')
      return json.url as string
    } finally {
      setCheckingOut(false)
    }
  }

  return {
    quoting,
    premium,
    fetchQuote,
    checkingOut,
    checkout,
    promoStatus,
    promoDiscount,
    checkPromoCode,
  }
}
