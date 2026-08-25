import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { Traveler } from '../types'

export function useTravelers() {
  const [travelers, setTravelers] = useState<Traveler[]>([])
  const [loading, setLoading] = useState(true)

  const fetchTravelers = useCallback(async () => {
    setLoading(true)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setTravelers([]); setLoading(false); return }
    const { data } = await supabase
      .from('app_travelers')
      .select('*')
      .order('created_at', { ascending: true })
    if (data) setTravelers(data)
    setLoading(false)
  }, [])

  useEffect(() => { fetchTravelers() }, [fetchTravelers])

  async function addTraveler(input: { first_name: string; last_name?: string; nickname?: string }) {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) throw new Error('Non connecte')
    const { data, error } = await supabase
      .from('app_travelers')
      .insert({
        user_id: session.user.id,
        first_name: input.first_name,
        last_name: input.last_name || null,
        nickname: input.nickname || null,
      })
      .select()
      .single()
    if (error) throw error
    setTravelers(prev => [...prev, data])
    return data as Traveler
  }

  async function updateTraveler(id: string, input: Partial<Pick<Traveler, 'first_name' | 'last_name' | 'nickname'>>) {
    const { data, error } = await supabase
      .from('app_travelers')
      .update(input)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    setTravelers(prev => prev.map(t => t.id === id ? data : t))
    return data as Traveler
  }

  async function deleteTraveler(id: string) {
    const { error } = await supabase.from('app_travelers').delete().eq('id', id)
    if (error) throw error
    setTravelers(prev => prev.filter(t => t.id !== id))
  }

  return { travelers, loading, refresh: fetchTravelers, addTraveler, updateTraveler, deleteTraveler }
}
