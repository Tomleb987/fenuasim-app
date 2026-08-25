// Le retour Stripe (success_url configure cote Edge Function
// create-checkout-mobile) cible fenuasim://payment-success, qui resout vers
// la route racine /payment-success -- pas /esim/payment-success. Ce fichier
// reexporte l'ecran reel (deja complet) pour que le deep link natif aboutisse
// bien dessus, sans dupliquer sa logique.
export { default } from './esim/payment-success'
