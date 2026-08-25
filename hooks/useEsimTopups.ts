import { useCallback, useState } from 'react'
import { supabase } from '../lib/supabase'
import { EsimTopupOption, EsimTopupOrder } from '../types'

export function useEsimTopups() {
  const [loading, setLoading] = useState(false)
  const [options, setOptions] = useState<EsimTopupOption[]>([])
  const [compatible, setCompatible] = useState<boolean | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Le catalogue de recharges vient toujours en direct d'Airalo (via la fonction
  // serveur list-esim-topups) -- jamais d'un catalogue local suppose compatible.
  const fetchTopups = useCallback(async (iccid: string) => {
    setLoading(true)
    setError(null)
    try {
      const { data, error: fnError } = await supabase.functions.invoke('list-esim-topups', {
        body: { iccid },
      })
      if (fnError || !data?.success) {
        throw new Error(data?.error ?? fnError?.message ?? 'Impossible de recuperer les recharges')
      }
      setCompatible(!!data.data?.compatible)
      setOptions(data.data?.topups ?? [])
    } catch (e: any) {
      setError(e.message)
      setCompatible(false)
      setOptions([])
    } finally {
      setLoading(false)
    }
  }, [])

  // Le prix et la compatibilite sont revérifiés côté serveur avant creation du
  // Checkout Stripe -- packageId n'est qu'une intention, jamais une source de verite.
  async function createCheckout(iccid: string, packageId: string) {
    const { data, error: fnError } = await supabase.functions.invoke('create-topup-checkout', {
      body: { iccid, packageId },
    })
    if (fnError || !data?.url) {
      throw new Error(data?.error ?? fnError?.message ?? 'Impossible de creer le paiement')
    }
    return data as { url: string; topupOrderId: string }
  }

  return { loading, options, compatible, error, fetchTopups, createCheckout }
}

// L'état d'une recharge n'est jamais déduit du retour Stripe : toujours relu depuis
// esim_topup_orders (RLS : uniquement les lignes du compte connecté), source de vérité
// mise à jour côté serveur par le webhook Stripe / le job de reprise.
export async function fetchTopupOrderBySession(sessionId: string) {
  const { data, error } = await supabase
    .from('esim_topup_orders')
    .select('id, status, iccid, package_id, data_label, amount, currency, last_error, completed_at')
    .eq('stripe_session_id', sessionId)
    .maybeSingle()
  if (error) throw error
  return data as Pick<EsimTopupOrder, 'id' | 'status' | 'iccid' | 'package_id' | 'data_label' | 'amount' | 'currency' | 'last_error' | 'completed_at'> | null
}
