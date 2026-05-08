import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export function useUserData() {
  const [email, setEmail] = useState<string | null>(null)
  const [esimOrders, setEsimOrders] = useState<any[]>([])
  const [insurances, setInsurances] = useState<any[]>([])
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user?.email) { setLoading(false); return }
      const userEmail = session.user.email
      setEmail(userEmail)
      fetchData(userEmail)
    })
  }, [])

  async function fetchData(userEmail: string) {
    setLoading(true)
    const [esimRes, insuranceRes, ordersRes] = await Promise.all([
      supabase.from('airalo_orders').select('*').eq('email', userEmail).order('created_at', { ascending: false }),
      supabase.from('insurances').select('*').eq('user_email', userEmail).order('created_at', { ascending: false }),
      supabase.from('orders').select('*').eq('email', userEmail).order('created_at', { ascending: false }),
    ])
    if (esimRes.data) setEsimOrders(esimRes.data)
    if (insuranceRes.data) setInsurances(insuranceRes.data)
    if (ordersRes.data) setOrders(ordersRes.data)
    setLoading(false)
  }

  return { email, esimOrders, insurances, orders, loading }
}
