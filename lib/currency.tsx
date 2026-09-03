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
