// Statut d'affichage d'une eSIM (airalo_orders). Utilise en priorite la
// colonne `status`, deja maintenue cote serveur avec de vraies valeurs
// observees (verifie reel sur les 355 commandes : "success", "expired",
// "expiring_soon") -- ne jamais la recalculer depuis expires_at, qui est
// souvent absent (147 des 165 commandes "success" n'ont pas de date connue)
// et donnerait "Active" par defaut la ou le serveur a deja l'information
// fiable. Le calcul par date ne sert plus qu'en repli si un statut inconnu
// apparait un jour.
import dayjs from 'dayjs'
import { COLORS } from '../constants/theme'

export interface EsimStatusInfo {
  label: string
  color: string
  isExpired: boolean
}

export function getEsimStatus(order: { status?: string | null; expires_at?: string | null }): EsimStatusInfo {
  if (order.status === 'expired') {
    return { label: 'Expirée', color: COLORS.textMuted, isExpired: true }
  }
  if (order.status === 'expiring_soon') {
    return { label: 'Expire bientôt', color: COLORS.orange, isExpired: false }
  }
  if (order.status === 'success') {
    return { label: 'Active', color: COLORS.success, isExpired: false }
  }
  const fallbackExpired = !!(order.expires_at && dayjs(order.expires_at).isBefore(dayjs()))
  return {
    label: fallbackExpired ? 'Expirée' : 'Active',
    color: fallbackExpired ? COLORS.textMuted : COLORS.success,
    isExpired: fallbackExpired,
  }
}
