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
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const response = await fetch(
        'https://hptbhujyrhjsquckzckc.supabase.co/functions/v1/airalo-proxy',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + session.access_token,
            'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhwdGJodWp5cmhqc3F1Y2t6Y2tjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI4MzA0MTYsImV4cCI6MjA1ODQwNjQxNn0.SxQDUGu2tR_XewHc-3zVRmSIvCtbfr-E4jKzax1ze84',
          },
          body: JSON.stringify({ endpoint: '/sims/' + iccid + '/usage', method: 'GET' })
        }
      )

      const data = await response.json()
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
    if (u.is_unlimited) return 'Illimite'
    return formatMo(u.remaining)
  }

  function getExpiry(iccid: string): string | null {
    return usageMap[iccid]?.expired_at ?? null
  }

  return { fetchUsage, isLoading, getPct, getUsedStr, getRemainingStr, getExpiry }
}
