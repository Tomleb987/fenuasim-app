import { Href, Router } from 'expo-router'
import { Session } from '@supabase/supabase-js'

// Le catalogue est consultable sans compte : le mur d'authentification n'est
// plus a l'entree de l'application mais devant les actions qui ont reellement
// besoin d'un compte (acheter une eSIM, souscrire une assurance) -- c'est aussi
// ce qu'exige la regle 5.1.1(v) d'Apple, qui interdit d'imposer un compte pour
// des fonctionnalites qui n'en ont pas besoin.
//
// `redirect` est le chemin sur lequel revenir une fois connecte. On le passe en
// parametre plutot que de compter sur router.back() : le visiteur peut passer
// de la connexion a l'inscription, et un simple retour arriere le ramenerait
// alors sur l'ecran de connexion au lieu de son achat.
export function requireAuth(
  router: Router,
  session: Session | null,
  redirect: string
): boolean {
  if (session) return true
  router.push({ pathname: '/(auth)/login', params: { redirect } } as Href)
  return false
}
