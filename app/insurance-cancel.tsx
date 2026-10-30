// Retour d'un paiement d'assurance annule (2026-10-25) : cible du cancel_url
// Stripe fenuasim://insurance-cancel, renvoye par /api/insurance-checkout du
// site quand l'app demande returnTo: 'app'. Meme ecran que l'annulation d'un
// achat eSIM (aucun montant debite, retour a l'accueil).
export { default } from './payment-cancel'
