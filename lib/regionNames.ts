// Extrait de app/(tabs)/explore.tsx pour être partage avec hooks/usePackageInfo.ts
// sans dupliquer la table de traduction. Comportement inchange.
export const REGION_TRANSLATIONS: Record<string, string> = {
  "Discover Global":"Monde","Asia":"Asie","Europe":"Europe","Japan":"Japon",
  "Japon":"Japon","Canary Islands":"Iles Canaries","South Korea":"Coree du Sud",
  "Hong Kong":"Hong Kong","United States":"Etats-Unis","Australia":"Australie",
  "New Zealand":"Nouvelle-Zelande","Mexico":"Mexique","Fiji":"Fidji",
  "Thailand":"Thailande","Singapore":"Singapour","Malaysia":"Malaisie",
  "Indonesia":"Indonesie","Philippines":"Philippines","Vietnam":"Viet Nam",
  "India":"Inde","China":"Chine","Taiwan":"Taiwan","United Kingdom":"Royaume-Uni",
  "Germany":"Allemagne","Spain":"Espagne","Italy":"Italie","Greece":"Grece",
  "Portugal":"Portugal","Netherlands":"Pays-Bas","Belgium":"Belgique",
  "Switzerland":"Suisse","Austria":"Autriche","Poland":"Pologne",
  "Czech Republic":"Republique tcheque","Turkey":"Turquie","Egypt":"Egypte",
  "Morocco":"Maroc","South Africa":"Afrique du Sud","Brazil":"Bresil",
  "Argentina":"Argentine","Chile":"Chili","Colombia":"Colombie","Peru":"Perou",
  "UAE":"Emirats arabes unis","United Arab Emirates":"Emirats arabes unis",
  "Saudi Arabia":"Arabie saoudite","Israel":"Israel","Jordan":"Jordanie",
  "Qatar":"Qatar","Kuwait":"Koweit","Bahrain":"Bahrein","Oman":"Oman",
  "Azerbaijan":"Azerbaidjan","Jamaica":"Jamaique","Albania":"Albanie",
  "Algeria":"Algerie","Angola":"Angola","Armenia":"Armenie",
  "Bangladesh":"Bangladesh","Belarus":"Bielorussie","Bolivia":"Bolivie",
  "Bosnia and Herzegovina":"Bosnie-Herzegovine","Bulgaria":"Bulgarie",
  "Cambodia":"Cambodge","Cameroon":"Cameroun","Chad":"Tchad","Croatia":"Croatie",
  "Cuba":"Cuba","Cyprus":"Chypre","Denmark":"Danemark",
  "Dominican Republic":"Republique dominicaine","Ecuador":"Equateur",
  "Estonia":"Estonie","Ethiopia":"Ethiopie","Finland":"Finlande","France":"France",
  "Georgia":"Georgie","Ghana":"Ghana","Guatemala":"Guatemala","Honduras":"Honduras",
  "Hungary":"Hongrie","Iceland":"Islande","Ireland":"Irlande",
  "Ivory Coast":"Cote d Ivoire","Kazakhstan":"Kazakhstan","Kenya":"Kenya",
  "Kyrgyzstan":"Kirghizistan","Laos":"Laos","Latvia":"Lettonie",
  "Lithuania":"Lituanie","Luxembourg":"Luxembourg","Madagascar":"Madagascar",
  "Maldives":"Maldives","Mali":"Mali","Malta":"Malte","Mauritius":"Maurice",
  "Moldova":"Moldavie","Mongolia":"Mongolie","Montenegro":"Montenegro",
  "Myanmar":"Myanmar","Namibia":"Namibie","Nepal":"Nepal","Nicaragua":"Nicaragua",
  "Nigeria":"Nigeria","North Macedonia":"Macedoine du Nord","Norway":"Norvege",
  "Pakistan":"Pakistan","Panama":"Panama","Paraguay":"Paraguay",
  "Romania":"Roumanie","Russia":"Russie","Rwanda":"Rwanda","Senegal":"Senegal",
  "Serbia":"Serbie","Slovakia":"Slovaquie","Slovenia":"Slovenie",
  "Sri Lanka":"Sri Lanka","Sweden":"Suede","Tanzania":"Tanzanie",
  "Tunisia":"Tunisie","Ukraine":"Ukraine","Uruguay":"Uruguay",
  "Uzbekistan":"Ouzbekistan","Venezuela":"Venezuela","Zambia":"Zambie",
  "Zimbabwe":"Zimbabwe","Canada":"Canada","Faroe Islands":"Iles Feroe",
  "Oceania":"Oceanie","North America":"Amerique du Nord",
  "Middle East and North Africa":"Moyen-Orient et Afrique du Nord",
}

export function getFR(regionFr: string | null | undefined, region: string | null | undefined): string {
  if (regionFr?.trim()) {
    const t = regionFr.trim()
    if (REGION_TRANSLATIONS[t]) return REGION_TRANSLATIONS[t]
    return t
  }
  if (region?.trim()) {
    const t = region.trim()
    if (REGION_TRANSLATIONS[t]) return REGION_TRANSLATIONS[t]
    const lower = t.toLowerCase()
    for (const [k, v] of Object.entries(REGION_TRANSLATIONS)) {
      if (k.toLowerCase() === lower) return v
    }
    return t
  }
  return "Autres"
}
