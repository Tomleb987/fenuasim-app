// Configuration du support client FenuaSIM.
// Numero WhatsApp confirme par FenuaSIM le 2026-08-23.
export const SUPPORT_WHATSAPP_NUMBER = '33749782101' // format wa.me : international, sans "+", sans espaces
export const SUPPORT_EMAIL = 'contact@fenuasim.com'

export function buildWhatsappUrl(message?: string): string {
  const base = `https://wa.me/${SUPPORT_WHATSAPP_NUMBER}`
  return message ? `${base}?text=${encodeURIComponent(message)}` : base
}

export function buildSupportMailto(subject: string): string {
  return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}`
}

export function buildEsimWhatsappMessage(label: string, last4: string | null): string {
  const ref = last4 ? `\n\nRéférence : eSIM se terminant par ${last4}.` : ''
  return `Bonjour FenuaSIM,\n\nJ'ai besoin d'aide avec mon eSIM ${label}.${ref}`
}

export function buildEsimMailSubject(label: string): string {
  return `Assistance FenuaSIM — ${label}`
}
