import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { Device } from '../types'

export function useDevices() {
  const [devices, setDevices] = useState<Device[]>([])
  const [loading, setLoading] = useState(true)

  const fetchDevices = useCallback(async () => {
    setLoading(true)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setDevices([]); setLoading(false); return }
    const { data } = await supabase
      .from('app_devices')
      .select('*')
      .order('created_at', { ascending: true })
    if (data) setDevices(data)
    setLoading(false)
  }, [])

  useEffect(() => { fetchDevices() }, [fetchDevices])

  async function addDevice(input: { name: string; traveler_id?: string | null; brand?: string; model?: string }) {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) throw new Error('Non connecte')
    const { data, error } = await supabase
      .from('app_devices')
      .insert({
        user_id: session.user.id,
        name: input.name,
        traveler_id: input.traveler_id ?? null,
        brand: input.brand || null,
        model: input.model || null,
      })
      .select()
      .single()
    if (error) throw error
    setDevices(prev => [...prev, data])
    return data as Device
  }

  async function updateDevice(id: string, input: Partial<Pick<Device, 'name' | 'traveler_id' | 'brand' | 'model'>>) {
    const { data, error } = await supabase
      .from('app_devices')
      .update(input)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    setDevices(prev => prev.map(d => d.id === id ? data : d))
    return data as Device
  }

  async function deleteDevice(id: string) {
    const { error } = await supabase.from('app_devices').delete().eq('id', id)
    if (error) throw error
    setDevices(prev => prev.filter(d => d.id !== id))
  }

  function byTraveler(travelerId: string | null): Device[] {
    return devices.filter(d => d.traveler_id === travelerId)
  }

  return { devices, loading, refresh: fetchDevices, addDevice, updateDevice, deleteDevice, byTraveler }
}
