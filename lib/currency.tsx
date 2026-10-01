// Devise d'affichage choisie par l'utilisateur (XPF ou EUR). N'affecte jamais
// la devise reelle du paiement (toujours EUR cote Stripe/AVA) : c'est un
// confort d'affichage uniquement. La conversion EUR<->XPF est exacte : le
// XPF est legalement indexe sur l'euro (1 EUR = 119,3317 XPF, taux fixe),
// contrairement au dollar qui aurait necessite un taux de change approximatif
// -- volontairement exclu pour ne jamais afficher un prix invente.
import React, { createContext, useContext, useEffect, useRef, useState } from 'react'
import * as SecureStore from 'expo-secure-store'
import { EUR_TO_XPF } from '../constants/theme'

export type CurrencyCode = 'XPF' | 'EUR'

const STORAGE_KEY = 'fenuasim_display_currency'

interface CurrencyContextValue {
  currency: CurrencyCode
  setCurrency: (c: CurrencyCode) => void
  formatXpf: (xpfAmount: number) => string
}

const CurrencyContext = createContext<CurrencyContextValue | null>(null)

export function formatXpfAs(xpfAmount: number, currency: CurrencyCode): string {
  if (currency === 'EUR') {
    // Meme regle d'arrondi que le site : a l'euro superieur (ex: 2,82€ -> 3€),
    // jamais de decimales -- sinon reconvertir le XPF stocke en EUR par simple
    // division affiche un prix different de celui du site pour le meme forfait.
    const eur = Math.ceil(xpfAmount / EUR_TO_XPF)
    return `${eur.toLocaleString('fr-FR')} €`
  }
  return `${Math.round(xpfAmount).toLocaleString('fr-FR')} XPF`
}

// Montant de base exprime dans la devise d'affichage, avant toute remise.
// A garder distinct du formatage : une remise doit s'appliquer APRES cette
// conversion, jamais avant. Appliquee sur les XPF puis arrondie a l'euro
// superieur, une remise de 5 % disparaissait entierement sur plus de la moitie
// du catalogue -- l'application affichait alors le plein tarif alors que Stripe
// facturait bien le prix remis (constate le 2026-09-09).
export function toDisplayAmount(xpfAmount: number, currency: CurrencyCode): number {
  if (currency === 'EUR') return Math.ceil(xpfAmount / EUR_TO_XPF)
  return Math.round(xpfAmount)
}

// Formate un montant DEJA exprime dans la devise d'affichage. Les centimes
// n'apparaissent que s'il y en a : un prix catalogue reste affiche en euros
// entiers, seul un total remis peut porter des decimales.
export function formatAmount(amount: number, currency: CurrencyCode): string {
  if (currency === 'EUR') {
    const round2 = Math.round(amount * 100) / 100
    const txt = Number.isInteger(round2)
      ? round2.toLocaleString('fr-FR')
      : round2.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    return `${txt} €`
  }
  return `${Math.round(amount).toLocaleString('fr-FR')} XPF`
}

// Applique une remise a un montant deja converti, comme le fait l'edge function
// create-checkout-mobile sur le prix en euros. discount_amount est stocke en
// EUR : il est reconverti si l'affichage est en XPF.
export function applyDiscountTo(
  amount: number,
  currency: CurrencyCode,
  discountPercentage?: number | null,
  discountAmountEur?: number | null
): number {
  if (discountPercentage) return amount * (1 - discountPercentage / 100)
  if (discountAmountEur) {
    const d = currency === 'EUR' ? discountAmountEur : discountAmountEur * EUR_TO_XPF
    return Math.max(0, amount - d)
  }
  return amount
}

export async function getLastCurrency(): Promise<CurrencyCode | null> {
  try {
    const v = await SecureStore.getItemAsync(STORAGE_KEY)
    return v === 'EUR' || v === 'XPF' ? v : null
  } catch {
    return null
  }
}

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [currency, setCurrencyState] = useState<CurrencyCode>('XPF')
  const loaded = useRef(false)

  useEffect(() => {
    getLastCurrency().then((c) => { if (c) setCurrencyState(c); loaded.current = true })
  }, [])

  function setCurrency(c: CurrencyCode) {
    setCurrencyState(c)
    SecureStore.setItemAsync(STORAGE_KEY, c).catch(() => {})
  }

  function formatXpf(xpfAmount: number): string {
    return formatXpfAs(xpfAmount, currency)
  }

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency, formatXpf }}>
      {children}
    </CurrencyContext.Provider>
  )
}

export function useCurrency(): CurrencyContextValue {
  const ctx = useContext(CurrencyContext)
  if (!ctx) throw new Error('useCurrency must be used within CurrencyProvider')
  return ctx
}
