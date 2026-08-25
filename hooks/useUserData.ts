import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export function useUserData() {
  const [email, setEmail] = useState<string | null>(null)
  const [insurances, setInsurances] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user?.email) { setLoading(false); return }
      const userEmail = session.user.email
      setEmail(userEmail)
      fetchData(userEmail)
    })
  }, [])

  // Les commandes eSIM (airalo_orders) et commandes site (orders) ne sont plus
  // affichees sur l'ecran Compte (deja disponibles sur l'accueil) : on evite de
  // les charger ici pour ne faire qu'une seule requete (insurances).
  async function fetchData(userEmail: string) {
    setLoading(true)
    const { data } = await supabase
      .from('insurances')
      .select('*')
      .eq('user_email', userEmail)
      .order('created_at', { ascending: false })
    if (data) setInsurances(data)
    setLoading(false)
  }

  return { email, insurances, loading }
}
