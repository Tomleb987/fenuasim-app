import { useState } from 'react'
import { InsuranceProductId, INSURANCE_SUBSCRIBER_COUNTRY } from '../constants/insurance'

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
      const res = await fetch(`${ASSURANCE_BASE_URL}/api/get-quote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quoteData: { ...data, subscriberCountry: INSURANCE_SUBSCRIBER_COUNTRY },
        }),
      })
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
      const res = await fetch(`${ASSURANCE_BASE_URL}/api/check-promo-insurance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim() }),
      })
      const json = await res.json()
      if (res.ok && json.valid) {
        const discount = json.discount_amount >= 10 ? 10 : json.discount_amount
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

  async function checkout(data: InsuranceQuoteData, userEmail: string, amount: number | null): Promise<string> {
    setCheckingOut(true)
    try {
      const res = await fetch(`${ASSURANCE_BASE_URL}/api/insurance-checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quoteData: { ...data, subscriberCountry: INSURANCE_SUBSCRIBER_COUNTRY },
          userEmail,
          amount,
        }),
      })
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
