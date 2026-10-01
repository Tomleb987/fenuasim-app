// Catalogue assurance reconstitue depuis le vrai parcours public de
// fenuasim.com/assurance (formulaire a 5 etapes, appels /api/get-quote et
// /api/insurance-checkout verifies reels). Aucune formule ni option
// inventee : tout est repris a l'identique du site (memes ids d'options,
// memes libelles, meme regle d'age, meme frais de service).

export type InsuranceProductId = 'ava_tourist_card' | 'ava_carte_sante' | 'avantages_pom'

export interface InsuranceProduct {
  id: InsuranceProductId
  label: string
  tagline: string
  description: string
  highlights: string[]
  colors: readonly [string, string]
  minAge?: number
  maxAge?: number
  requiresTrip: boolean // false uniquement pour AVAntages POM (pas de destination/prix voyage)
}

export const INSURANCE_PRODUCTS: InsuranceProduct[] = [
  {
    id: 'ava_tourist_card',
    label: 'Tourist Card',
    tagline: 'La plus complète',
    description: 'Assurance voyage tous risques',
    highlights: ['Annulation & bagages', 'Frais médicaux 500k€', 'Aucune limite d’âge'],
    colors: ['#8B5CF6', '#7C3AED'],
    minAge: 18,
    requiresTrip: true,
  },
  {
    id: 'ava_carte_sante',
    label: 'Carte Santé',
    tagline: 'L’essentielle santé',
    description: 'Assurance santé à l’étranger',
    highlights: ['Frais médicaux 500k€', 'Sans franchise', 'Attestation visa 24h'],
    colors: ['#10B981', '#0D9488'],
    minAge: 18,
    maxAge: 65,
    requiresTrip: true,
  },
  {
    id: 'avantages_pom',
    label: 'AVAntages POM',
    tagline: 'Pour les résidents PF',
    description: 'Assurance multirisque annuelle',
    highlights: ['Cotisation annuelle', 'Couvre tous vos voyages'],
    colors: ['#FD7F3C', '#D251D8'],
    minAge: 18,
    requiresTrip: false,
  },
]

export function getInsuranceProduct(id: InsuranceProductId): InsuranceProduct {
  return INSURANCE_PRODUCTS.find((p) => p.id === id) ?? INSURANCE_PRODUCTS[0]
}

// Zones de destination reelles proposees par le site (valeurs numeriques
// attendues telles quelles par /api/get-quote en "destinationRegion").
export const INSURANCE_DESTINATIONS: { value: string; label: string }[] = [
  { value: '102', label: 'Monde entier (hors USA/Canada) 🌍' },
  { value: '58', label: 'USA & Canada 🇺🇸 🇨🇦' },
  { value: '53', label: 'Europe (Schengen) 🇪🇺' },
]

// Lien de parente pour les voyageurs accompagnants (valeur par defaut "13" =
// sans parente, exactement comme sur le site).
export const PARENTAL_LINKS: { value: string; label: string }[] = [
  { value: '13', label: 'Sans parenté' },
  { value: '4', label: 'Conjoint(e)' },
  { value: '6', label: 'Enfant' },
  { value: '1', label: 'Père / Mère' },
  { value: '3', label: 'Frère / Sœur' },
  { value: '17', label: 'Collaborateur / Collègue' },
  { value: '21', label: 'Autre parenté' },
]

export interface InsuranceOptionDef {
  id: string
  label: string
  description: string
  type: 'select' | 'boolean' | 'date-range'
  subOptions?: { id: string; label: string }[]
  defaultSubOptionId?: string
}

// Options de couverture reelles par produit (memes ids que le site — ce sont
// des identifiants du contrat AVA cote serveur, a ne jamais modifier).
export const INSURANCE_OPTIONS: Record<InsuranceProductId, InsuranceOptionDef[]> = {
  ava_tourist_card: [
    {
      id: '339',
      label: 'Augmenter Plafond Annulation',
      description: 'Plafond par assuré (au lieu de 6.000€)',
      type: 'select',
      subOptions: [
        { id: '340', label: 'Plafond 8.000 €' },
        { id: '341', label: 'Plafond 10.000 €' },
        { id: '342', label: 'Plafond 12.000 €' },
      ],
    },
    {
      id: '343',
      label: 'Augmenter Garantie Bagages',
      description: 'Plafond par assuré (au lieu de 1.500€)',
      type: 'select',
      subOptions: [
        { id: '344', label: 'Plafond 2.000 €' },
        { id: '345', label: 'Plafond 2.500 €' },
        { id: '346', label: 'Plafond 3.000 €' },
      ],
    },
    {
      id: '728',
      label: 'Rachat de franchise Véhicule (CDW)',
      description: 'Couverture dommages jusqu’à 150.000€ — dates de location requises',
      type: 'date-range',
      defaultSubOptionId: '458',
    },
    {
      id: '347',
      label: 'Augmenter Capital Accident',
      description: 'Capital décès/invalidité (au lieu de 8.000€)',
      type: 'select',
      subOptions: [
        { id: '459', label: 'Capital 50.000 €' },
        { id: '457', label: 'Capital 100.000 €' },
      ],
    },
    {
      id: '828',
      label: 'AVA SPORT+',
      description: 'Sports extrêmes & Frais de recherche (25k€)',
      type: 'boolean',
      defaultSubOptionId: '828',
    },
    {
      id: '990',
      label: 'AVA TECH+ (Appareils Nomades)',
      description: 'Vol ou casse (Smartphone, Tablette...)',
      type: 'select',
      subOptions: [
        { id: '989', label: 'Couverture 1.500 €' },
        { id: '988', label: 'Couverture 3.000 €' },
      ],
    },
  ],
  ava_carte_sante: [
    {
      id: '456',
      label: 'Individuelle Accident (Décès-Invalidité) 24h/24',
      description: 'Capital en cas de décès ou d’invalidité',
      type: 'select',
      subOptions: [
        { id: '303', label: 'Capital 50.000 €' },
        { id: '301', label: 'Capital 100.000 €' },
        { id: '302', label: 'Capital 150.000 €' },
      ],
    },
    { id: '297', label: 'AVA SNO+ (Sports d’hiver)', description: 'Pack sports de neige inclus', type: 'boolean', defaultSubOptionId: '297' },
    { id: '762', label: 'AVA SPORT+', description: 'Sports extrêmes & Frais de recherche (25k€)', type: 'boolean', defaultSubOptionId: '762' },
    {
      id: '291',
      label: 'Perte, vol ou détérioration de bagages',
      description: 'Plafond par assuré',
      type: 'select',
      subOptions: [
        { id: '292', label: 'Couverture 1.500 €' },
        { id: '293', label: 'Couverture 2.000 €' },
        { id: '294', label: 'Couverture 2.500 €' },
      ],
    },
  ],
  avantages_pom: [
    {
      id: '874',
      label: 'Modification du montant de la garantie bagages',
      description: 'Plafond bagages (au lieu de 1.000 €)',
      type: 'select',
      subOptions: [
        { id: '875', label: 'À concurrence de 2.500 € au lieu de 1.000 €' },
        { id: '876', label: 'À concurrence de 2.000 € au lieu de 1.000 €' },
        { id: '877', label: 'À concurrence de 1.500 € au lieu de 1.000 €' },
      ],
    },
  ],
}

// Frais de service fixe ajoute par le site au-dessus de la prime AVA
// (verifie dans le code source du site : "Total TTC" = premium + 10€).
export const INSURANCE_SERVICE_FEE_EUR = 10

// Meme residence exigee que le site ("Cette assurance est reservee aux
// residents de Polynesie francaise") : pas de selecteur pays, valeur fixe.
export const INSURANCE_SUBSCRIBER_COUNTRY = 'PF'
