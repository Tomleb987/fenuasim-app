import { useEffect, useState } from 'react'
import { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

// Session reactive partagee. Avant l'ouverture aux visiteurs, chaque ecran
// appelait getSession() une fois dans son propre useEffect : suffisant quand
// l'application entiere etait derriere un mur d'authentification, mais plus du
// tout maintenant qu'un ecran peut etre monte en visiteur puis voir une session
// apparaitre (connexion depuis un CTA). On s'abonne donc a onAuthStateChange
// pour que ces ecrans se remettent a jour seuls.
export function useSession() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!active) return
      setSession(session)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, next) => {
      if (!active) return
      setSession(next)
      setLoading(false)
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  // isGuest n'est vrai qu'une fois la verification terminee : sans ce garde,
  // les ecrans afficheraient brievement leur etat visiteur a chaque demarrage,
  // meme pour un utilisateur deja connecte.
  return { session, loading, isGuest: !loading && !session }
}
