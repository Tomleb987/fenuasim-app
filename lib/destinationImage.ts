// Photos de destination servies depuis le Storage Supabase du site.
//
// Le bucket `product-images` est public et suit la convention
// `esim-<slug>.jpg`, ou <slug> est exactement le slug utilise par
// airalo_packages et par les destinations de l'accueil. Constate le
// 2026-09-09 : 143 fichiers, et 115 des 215 slugs actifs couverts (53,5 %).
// Les 6 destinations de l'accueil le sont toutes.
//
// Deux precautions, verifiees en direct avant d'ecrire ce fichier :
//
//  1. Les originaux pesent 1 a 5 Mo. Servis tels quels, six vignettes
//     d'accueil representeraient une dizaine de Mo a chaque ouverture. On
//     passe donc par l'endpoint de transformation de Supabase, qui ramene
//     esim-japan.jpg de 398 Ko a 100 Ko en largeur 600 / qualite 70.
//     Verifie : les deux URL repondent bien 200.
//
//  2. La couverture n'est que partielle. L'appelant doit donc toujours
//     prevoir un repli -- aujourd'hui le degrade de couleur deja en place.
//     Rien ici ne garantit qu'une image existe pour un slug donne.

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? ''
const BUCKET = 'product-images'

/**
 * URL d'une photo de destination, redimensionnee cote serveur.
 * `width` est la largeur de rendu souhaitee en pixels (pas en points) :
 * prevoir environ 2x la taille d'affichage pour rester net sur un ecran dense.
 */
export function destinationImageUrl(slug: string | null | undefined, width = 600): string | null {
  if (!slug || !SUPABASE_URL) return null
  const base = SUPABASE_URL.replace(/\/+$/, '')
  return `${base}/storage/v1/render/image/public/${BUCKET}/esim-${slug}.jpg?width=${width}&quality=70`
}
