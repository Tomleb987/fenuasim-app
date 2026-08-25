import { useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

interface DataUsage {
  remaining: number
  total: number
  status: string
  is_unlimited: boolean
  expired_at: string | null
}

function formatMo(mo: number): string {
  if (mo <= 0) return '0 Mo'
  if (mo >= 1024) return String((mo / 1024).toFixed(1).replace('.0', '')) + ' Go'
  return String(mo) + ' Mo'
}

export function useDataUsage() {
  const [usageMap, setUsageMap] = useState<Record<string, DataUsage>>({})
  const [loadingMap, setLoadingMap] = useState<Record<string, boolean>>({})

  const fetchUsage = useCallback(async (iccid: string) => {
    if (!iccid) return
    setLoadingMap(prev => ({ ...prev, [iccid]: true }))
    try {
      // Passe par le client Supabase configure (lib/supabase.ts) plutot que par un
      // fetch manuel : evite de dupliquer la cle anon en dur ici, et attache
      // automatiquement la session courante.
      const { data } = await supabase.functions.invoke('airalo-proxy', {
        body: { endpoint: '/sims/' + iccid + '/usage', method: 'GET' },
      })
      if (data?.success && data?.data?.data) {
        setUsageMap(prev => ({ ...prev, [iccid]: data.data.data }))
      }
    } catch (e) {
      console.error('fetchUsage error:', e)
    } finally {
      setLoadingMap(prev => ({ ...prev, [iccid]: false }))
    }
  }, [])

  function isLoading(iccid: string): boolean {
    return loadingMap[iccid] ?? false
  }

  function getPct(iccid: string): number {
    const u = usageMap[iccid]
    if (!u || !u.total || u.total === 0) return 0
    if (u.is_unlimited) return Math.round(((u.total - u.remaining) / u.total) * 100)
    return Math.min(100, Math.round(((u.total - u.remaining) / u.total) * 100))
  }

  function getUsedStr(iccid: string): string {
    const u = usageMap[iccid]
    if (!u) return '-'
    if (u.is_unlimited) return formatMo(u.total - u.remaining) + ' utilises'
    return formatMo(u.total - u.remaining)
  }

  function getRemainingStr(iccid: string): string {
    const u = usageMap[iccid]
    if (!u) return '-'
    if (u.is_unlimited) return 'Illimité'
    return formatMo(u.remaining)
  }

  function getExpiry(iccid: string): string | null {
    return usageMap[iccid]?.expired_at ?? null
  }

  // Un total a 0 Mo pour un forfait limite ne veut jamais dire "0 Mo achetes" :
  // ca signifie que l'API n'a pas encore remonte la vraie capacite (ex: eSIM pas
  // encore activee). Permet au rendu de distinguer "vraiment epuise" de "pas encore connu".
  function hasReliableUsage(iccid: string): boolean {
    const u = usageMap[iccid]
    if (!u) return false
    if (u.is_unlimited) return true
    return u.total > 0
  }

  return { fetchUsage, isLoading, getPct, getUsedStr, getRemainingStr, getExpiry, hasReliableUsage }
}
