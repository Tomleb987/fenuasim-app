import { useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

interface DataUsage {
  remaining: number
  total: number
  status: string
  is_unlimited: boolean
  expired_at: string | null
  // Airalo renvoie ces quatre compteurs pour les forfaits incluant appels et/ou
  // SMS (47 forfaits actifs au catalogue), et les omet pour les forfaits
  // Internet seul. Verifie en direct le 2026-09-09 sur une eSIM
  // "20 Go - 200 SMS - 200 Mins" : remaining_voice 198, total_voice 200,
  // remaining_text 200, total_text 200. Ils etaient jusqu'ici recus puis
  // ignores -- le client payait 200 minutes sans jamais savoir combien il lui
  // en restait.
  remaining_voice?: number | null
  total_voice?: number | null
  remaining_text?: number | null
  total_text?: number | null
}

export type VoiceSmsUsage = {
  voice: { remaining: number; total: number } | null
  sms: { remaining: number; total: number } | null
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

  // Renvoie null pour un forfait Internet seul : rien ne doit alors s'afficher.
  // Un total a 0 est traite comme absent, pour la meme raison que
  // hasReliableUsage ci-dessous -- "0 minute au total" n'a pas de sens et
  // signale une capacite non encore remontee par l'API.
  function getVoiceSmsUsage(iccid: string): VoiceSmsUsage | null {
    const u = usageMap[iccid]
    if (!u) return null
    const hasVoice = typeof u.total_voice === 'number' && u.total_voice > 0
    const hasSms = typeof u.total_text === 'number' && u.total_text > 0
    if (!hasVoice && !hasSms) return null
    return {
      voice: hasVoice ? { remaining: u.remaining_voice ?? 0, total: u.total_voice as number } : null,
      sms: hasSms ? { remaining: u.remaining_text ?? 0, total: u.total_text as number } : null,
    }
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

  return { fetchUsage, isLoading, getPct, getUsedStr, getRemainingStr, getExpiry, hasReliableUsage, getVoiceSmsUsage }
}
