export const COLORS = {
  violet: '#D251D8',
  orange: '#FD7F3C',
  bg: '#F5F4F2',
  white: '#FFFFFF',
  text: '#111111',
  textMuted: '#6E6E6E',
  border: '#EBEBEB',
  success: '#0A8754',
  successBg: '#E6F9F2',
}

export const GRADIENT = {
  primary: ['#D251D8', '#FD7F3C'] as const,
  insurance: ['#FD7F3C', '#D251D8'] as const,
}

export const EUR_TO_XPF = 119.33

// ---------------------------------------------------------------------------
// Jetons de style, ajoutes le 2026-09-09 pour la passe visuelle.
//
// Avant : chaque ecran definissait ses propres valeurs dans son StyleSheet, ce
// qui donnait six rayons differents en circulation (8, 10, 12, 14, 16, 20) et
// une ombre a shadowOpacity 0.05 partout -- soit une ombre pratiquement
// invisible, d'ou l'impression de "plat" par rapport aux maquettes. Ces jetons
// existent pour que la prochaine retouche se fasse a un seul endroit au lieu de
// trente.
// ---------------------------------------------------------------------------

export const RADIUS = {
  sm: 10,
  md: 14,
  lg: 20,
  xl: 26,
  pill: 999,
} as const

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const

// Ombres portees. Plus larges et plus diffuses que les anciennes (0.05 / rayon
// 6) : c'est ce qui fait "respirer" les cartes. elevation est l'equivalent
// Android, que RN n'infere pas des proprietes shadow* iOS -- il faut donc bien
// les deux, sinon les cartes restent plates sur Android.
export const SHADOW = {
  card: {
    shadowColor: '#1A1024',
    shadowOpacity: 0.07,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  raised: {
    shadowColor: '#1A1024',
    shadowOpacity: 0.12,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  // Pour un element pose sur un fond colore (barre de recherche du hero) :
  // l'ombre doit rester lisible sans creer de halo sombre sur le degrade.
  onColor: {
    shadowColor: '#5B1B63',
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
} as const

// Echelle typographique. Les titres de section montent de 16 a 18 et les
// titres d'ecran de 22 a 26 : c'est le principal ecart avec les maquettes,
// ou la hierarchie est nettement plus affirmee.
export const TYPO = {
  hero: { fontSize: 26, fontWeight: '800' as const, letterSpacing: -0.4 },
  screenTitle: { fontSize: 22, fontWeight: '800' as const, letterSpacing: -0.3 },
  section: { fontSize: 18, fontWeight: '800' as const, letterSpacing: -0.2 },
  cardTitle: { fontSize: 15, fontWeight: '700' as const },
  body: { fontSize: 14, fontWeight: '500' as const },
  caption: { fontSize: 12, fontWeight: '600' as const },
} as const
