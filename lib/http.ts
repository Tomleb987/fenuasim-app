// Appels HTTP vers le site fenuasim.com avec un delai maximal.
//
// 2026-10-25 -- fetch() n'a aucun delai par defaut dans React Native : sur un
// reseau faible (arrivee a l'aeroport, roaming, wifi d'hotel), une requete
// peut rester pendante plusieurs minutes et l'ecran affiche une roue de
// chargement sans fin. Le client finit par fermer l'app, souvent au moment du
// paiement. Ce helper coupe l'appel apres `timeoutMs` et leve une erreur au
// message lisible, que les ecrans affichent deja via leurs Alert / etats
// d'erreur existants.
//
// Delais retenus (voir les appelants) : 20 s par defaut, 70 s pour la creation
// du paiement assurance -- la route /api/insurance-checkout du site cree le
// contrat AVA et envoie l'e-mail de devis AVANT de repondre (maxDuration 60 s
// cote Vercel) ; un delai plus court ferait echouer des souscriptions reussies.

export const DEFAULT_TIMEOUT_MS = 20_000

export const TIMEOUT_MESSAGE =
  'Le serveur ne répond pas. Vérifiez votre connexion internet puis réessayez.'

export class TimeoutError extends Error {
  constructor() {
    super(TIMEOUT_MESSAGE)
    this.name = 'TimeoutError'
  }
}

export async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } catch (e: any) {
    // AbortError = notre delai a expire (aucun autre code n'annule ce signal).
    if (e?.name === 'AbortError') throw new TimeoutError()
    throw e
  } finally {
    clearTimeout(timer)
  }
}
