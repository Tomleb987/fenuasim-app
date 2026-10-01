// Forfaits ORA FLY (Polynésie française) : eSIM de l'opérateur polynésien ORA,
// vendues depuis un stock acheté par FENUA SIM, sans API Airalo.
//
// Toute la logique ORA vit sur le site fenuasim.com (interrupteur de vente,
// stock, livraison, e-mail). L'app appelle ses routes, avec le JWT Supabase de
// la session quand il faut identifier le client. Rien ne passe par
// airalo_packages, create-checkout-mobile ni airalo_orders.
import { supabase } from './supabase'

export const SITE_URL = 'https://www.fenuasim.com'
export const POLYNESIA_SLUG = 'polynesie-francaise'
export const POLYNESIA_NAME = 'Polynésie française'
// La recharge se fait chez ORA, jamais dans l'app.
export const ORA_RECHARGE_URL = 'https://www.ora.pf/offres-mobile/ora-fly/'
export const ORA_COVERAGE = '5 archipels · 5G à Tahiti, 4G dans les îles'

export type OraPackage = {
  id: string
  name: string
  data_amount: number
  data_unit: string
  validity_days: number
  voice_desc: string | null
  sms_desc: string | null
  final_price_xpf: number
  final_price_eur: number
  available: number
}

export type OraCatalog = { salesOpen: boolean; packages: OraPackage[] }

export function isOraPackageId(id: unknown): boolean {
  return typeof id === 'string' && id.startsWith('orafly-')
}

/** Libellé du bouton quand un forfait ne peut pas être acheté, sinon null. */
export function oraUnavailableLabel(catalog: OraCatalog | null, pkg: { id: string }): string | null {
  if (!catalog) return null
  if (!catalog.salesOpen) return 'Prochainement'
  const found = catalog.packages.find(p => p.id === pkg.id)
  if (!found || found.available <= 0) return 'Épuisé'
  return null
}

async function authHeader(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}
}

async function readJson(res: Response) {
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data?.error || data?.message || `Erreur ${res.status}`)
  return data
}

export async function fetchOraCatalog(): Promise<OraCatalog> {
  const data = await readJson(await fetch(`${SITE_URL}/api/ora/packages`))
  return { salesOpen: !!data.salesOpen, packages: data.packages ?? [] }
}

/**
 * Crée la session Stripe ; renvoie l'URL de paiement.
 * Les codes promo ne s'appliquent pas aux forfaits ORA FLY : ils sont vendus
 * depuis un stock achete d'avance, a prix ferme.
 */
export async function createOraCheckout(packageId: string): Promise<string> {
  const data = await readJson(await fetch(`${SITE_URL}/api/ora/mobile-checkout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
    body: JSON.stringify({ packageId }),
  }))
  if (!data.url) throw new Error('Lien de paiement manquant')
  return data.url
}

export type OraOrderResult =
  | { status: 'pending' }
  | { status: 'error'; error: string }
  | { status: 'awaiting_stock' }
  | {
      status: 'success'
      packageName: string
      qrCodeUrl: string | null
      iccid: string | null
      smdpAddress: string
      matchingCode: string
      voiceDesc: string | null
      smsDesc: string | null
    }

/**
 * Résultat d'un achat, vérifié côté serveur (paiement Stripe + livraison par
 * le webhook du site). L'app ne déclenche jamais la livraison elle-même.
 */
export async function fetchOraResult(sessionId: string): Promise<OraOrderResult> {
  const res = await fetch(`${SITE_URL}/api/checkout/result`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id: sessionId }),
  })
  const data = await res.json().catch(() => ({}))
  if (data.status === 'success') {
    return {
      status: 'success',
      packageName: data.order?.package_name ?? 'ORA FLY',
      qrCodeUrl: data.esim?.qr_code_url ?? null,
      iccid: data.esim?.sim_iccid ?? null,
      smdpAddress: data.ora?.smdp_address ?? '',
      matchingCode: data.ora?.matching_code ?? '',
      voiceDesc: data.ora?.voice_desc ?? null,
      smsDesc: data.ora?.sms_desc ?? null,
    }
  }
  if (data.status === 'awaiting_stock') return { status: 'awaiting_stock' }
  if (data.status === 'error') return { status: 'error', error: data.error ?? 'Erreur' }
  return { status: 'pending' }
}

export type MyOraEsim = {
  id: string
  package_name: string
  data_amount: number | null
  validity_days: number | null
  iccid: string
  smdp_address: string
  matching_code: string
  assigned_at: string | null
  qr_code_url: string
}

/** eSIM ORA FLY du compte connecté (vide si non connecté ou en cas d'erreur). */
export async function fetchMyOraEsims(): Promise<MyOraEsim[]> {
  try {
    const headers = await authHeader()
    if (!headers.Authorization) return []
    const res = await fetch(`${SITE_URL}/api/account/ora-esims`, { headers })
    if (!res.ok) return []
    const data = await res.json()
    return data.data ?? []
  } catch {
    return []
  }
}
