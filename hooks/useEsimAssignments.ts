import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { EsimAssignment } from '../types'

export function useEsimAssignments() {
  const [assignments, setAssignments] = useState<EsimAssignment[]>([])
  const [loading, setLoading] = useState(true)

  const fetchAssignments = useCallback(async () => {
    setLoading(true)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setAssignments([]); setLoading(false); return }
    const { data } = await supabase
      .from('app_esim_assignments')
      .select('*')
    if (data) setAssignments(data)
    setLoading(false)
  }, [])

  useEffect(() => { fetchAssignments() }, [fetchAssignments])

  function byIccid(iccid: string | null | undefined): EsimAssignment | undefined {
    if (!iccid) return undefined
    return assignments.find(a => a.iccid === iccid)
  }

  async function assignEsim(input: {
    iccid: string
    airalo_order_id?: string | null
    traveler_id?: string | null
    device_id?: string | null
    label?: string | null
  }) {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) throw new Error('Non connecte')
    // Passe par la RPC serveur (SECURITY DEFINER) qui verifie que l'ICCID
    // appartient reellement a une commande de ce compte avant d'ecrire quoi
    // que ce soit : l'ecriture directe sur la table est desormais refusee par les grants.
    const { data, error } = await supabase.rpc('app_assign_esim', {
      p_iccid: input.iccid,
      p_airalo_order_id: input.airalo_order_id ?? null,
      p_traveler_id: input.traveler_id ?? null,
      p_device_id: input.device_id ?? null,
      p_label: input.label ?? null,
    })
    if (error) throw error
    setAssignments(prev => {
      const exists = prev.some(a => a.iccid === data.iccid)
      return exists ? prev.map(a => a.iccid === data.iccid ? data : a) : [...prev, data]
    })
    return data as EsimAssignment
  }

  async function deleteAssignment(id: string) {
    const { error } = await supabase.from('app_esim_assignments').delete().eq('id', id)
    if (error) throw error
    setAssignments(prev => prev.filter(a => a.id !== id))
  }

  return { assignments, loading, refresh: fetchAssignments, byIccid, assignEsim, deleteAssignment }
}
