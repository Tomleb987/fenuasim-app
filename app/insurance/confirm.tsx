// Phase 4C (audit assurance) : cet ecran affichait auparavant un faux message
// "Assurance souscrite !" avec une destination, des dates et un prix
// entierement fictifs, sans qu'aucun paiement ni aucune souscription reelle
// n'ait jamais eu lieu. Neutralise pour ne jamais laisser croire a un
// utilisateur qu'il a reellement souscrit une assurance. Voir
// PHASE4C_ASSURANCE_STRIPE.md.
export { default } from './form'
