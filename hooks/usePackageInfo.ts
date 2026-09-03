import { useState, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { getFR, REGION_TRANSLATIONS } from '../lib/regionNames'

export type PackageInfo = {
  id: string
  region_fr: string | null
  region: string | null
  name: string | null
  data_amount: number | string | null
  data_unit: string | null
  validity: string | null
  validity_days: number | null
  is_unlimited: boolean | null
}

type CatalogRow = { id: string; region_fr: string | null; region: string | null }

export type PackageDisplay = {
  destination: string
  subtitle: string | null
  resolved: boolean
}

// Marqueurs purement techniques : ne doivent jamais apparaitre dans un nom de destination.
const NOISE_TOKENS = new Set(['in', 'day', 'days', 'gb', 'mb', 'unlimited', 'local', 'regional', 'global', 'px'])

// Extrait le "prefixe de marque" d'un slug historique, ex: "elan-in-15days-2gb" -> "elan",
// "peace-mobile-7days-1gb" -> "peace-mobile". S'arrete au premier segment commencant par un chiffre.
function extractBrandPrefix(packageId: string): string {
  const segments = packageId.split('-')
  const kept: string[] = []
  for (const raw of segments) {
    const seg = raw.replace(/\+/g, '').trim()
    if (!seg) continue
    if (/^\d/.test(seg)) break
    if (NOISE_TOKENS.has(seg.toLowerCase())) continue
    kept.push(seg)
  }
  return kept.join('-').toLowerCase()
}

function parseDataDurationFromSlug(packageId: string): { data: string | null; duration: string | null } {
  const durationMatch = packageId.match(/(\d+)\s?-?\s?days?/i)
  const dataMatch = packageId.match(/(\d+)\s?(gb|mb)\b/i)
  const unlimited = /unlimited/i.test(packageId)
  return {
    data: unlimited ? 'Illimité' : dataMatch ? `${dataMatch[1]} ${dataMatch[2].toLowerCase() === 'gb' ? 'Go' : 'Mo'}` : null,
    duration: durationMatch ? `${durationMatch[1]} jours` : null,
  }
}

function formatDataDuration(pkg: PackageInfo): string | null {
  const dataPart = pkg.is_unlimited
    ? 'Illimité'
    : pkg.data_amount != null ? `${pkg.data_amount} ${pkg.data_unit || 'Go'}` : null
  const days = pkg.validity_days ?? (pkg.validity ? parseInt(pkg.validity, 10) : null)
  const durationPart = days && !isNaN(days) ? `${days} jours` : null
  return [dataPart, durationPart].filter(Boolean).join(' • ') || null
}

// Cherche, parmi un instantane leger du catalogue, les forfaits "freres" partageant le
// meme prefixe de marque qu'un package_id disparu. Utilise uniquement si TOUS les
// freres trouves s'accordent sur la meme destination (aucune supposition en cas de doute).
function resolveViaSiblings(prefix: string, catalog: CatalogRow[]): string | null {
  if (!prefix) return null
  const siblings = catalog.filter(p => p.id.toLowerCase().startsWith(prefix))
  if (siblings.length === 0) return null
  const distinct = new Set(siblings.map(p => (p.region_fr || p.region || '').trim()).filter(Boolean))
  if (distinct.size !== 1) return null
  return Array.from(distinct)[0]
}

// Dernier recours avant le libelle generique : le prefixe nomme-t-il explicitement
// une destination deja connue (ex: "france-in-7days-1gb" -> "france") ?
function resolveViaKnownToken(prefix: string): string | null {
  if (!prefix) return null
  const lower = prefix.toLowerCase()
  for (const [enName, frName] of Object.entries(REGION_TRANSLATIONS)) {
    if (enName.toLowerCase() === lower || frName.toLowerCase() === lower) return enName
  }
  return null
}

const GENERIC_FALLBACK = 'Forfait voyage'

// --- Type de couverture (Internet seul vs +appels/SMS) ---
// Base uniquement sur includes_voice/includes_sms, les seules colonnes reelles
// de airalo_packages qui portent cette information (verifie avant implementation :
// en pratique seules 2 combinaisons existent reellement, (false,false) et (true,true),
// mais la logique reste correcte pour les 4 cas au cas ou).
export type PlanCoverageType = 'internet' | 'internet_calls' | 'internet_sms' | 'internet_calls_sms'

export function getPlanType(p: { includes_voice?: boolean | null; includes_sms?: boolean | null }): PlanCoverageType {
  if (p.includes_voice && p.includes_sms) return 'internet_calls_sms'
  if (p.includes_voice) return 'internet_calls'
  if (p.includes_sms) return 'internet_sms'
  return 'internet'
}

// Le volume d'appels/SMS n'a pas sa propre colonne dans airalo_packages
// (seulement includes_voice/includes_sms, des booleens) -- mais il est deja
// present, de facon fiable, dans le champ `name` du forfait, verifie reel sur
// les 47 forfaits concernes : format constant "{data} Go - {sms} SMS -
// {mins} Mins - {jours} jours". Jamais invente : si le format ne correspond
// pas, on affiche juste "Inclus" comme avant plutot qu'un chiffre incorrect.
export interface VoiceSmsVolume {
  minutes: number | null
  sms: number | null
}

export function parseVoiceSmsVolume(name: string | null | undefined): VoiceSmsVolume {
  if (!name) return { minutes: null, sms: null }
  const smsMatch = name.match(/(\d+)\s*SMS/i)
  const minMatch = name.match(/(\d+)\s*Mins?\b/i)
  return {
    sms: smsMatch ? parseInt(smsMatch[1], 10) : null,
    minutes: minMatch ? parseInt(minMatch[1], 10) : null,
  }
}

export function getPlanTypeLabel(t: PlanCoverageType, volume?: VoiceSmsVolume): string {
  const mins = volume?.minutes
  const sms = volume?.sms
  switch (t) {
    case 'internet_calls_sms':
      if (mins != null && sms != null) return `Internet + ${mins} min + ${sms} SMS`
      return 'Internet + appels + SMS'
    case 'internet_calls':
      return mins != null ? `Internet + ${mins} min d'appels` : 'Internet + appels'
    case 'internet_sms':
      return sms != null ? `Internet + ${sms} SMS` : 'Internet + SMS'
    default: return 'Internet uniquement'
  }
}

export function getPlanTypeIcon(t: PlanCoverageType): 'globe-outline' | 'call-outline' {
  return t === 'internet' ? 'globe-outline' : 'call-outline'
}

export const INTERNET_ONLY_CAPTION = 'WhatsApp, Messenger, Maps…'
export const INTERNET_ONLY_EXPLANATION = "WhatsApp, Messenger, réseaux sociaux et navigation fonctionnent via l'enveloppe Internet du forfait."

// --- Detection d'un label d'attribution qui est en realite un slug technique ---
// Prudent par construction : un label sans tiret, ou avec un tiret mais sans
// marqueur technique (jours/volume/illimite), n'est JAMAIS considere technique.
export function looksLikeTechnicalSlug(label: string, packageId?: string | null): boolean {
  const norm = label.trim().toLowerCase()
  if (!norm) return false
  if (packageId) {
    const pkgNorm = packageId.toLowerCase()
    if (norm === pkgNorm || norm.startsWith(pkgNorm + ' ')) return true
  }
  const firstSegment = norm.split(' • ')[0].trim()
  const hasDashStructure = firstSegment.includes('-')
  const hasTechnicalMarker = /\b\d+\s?-?\s?(day|days|gb|mb)\b|unlimited/i.test(firstSegment)
  return hasDashStructure && hasTechnicalMarker
}

export function usePackageInfo() {
  const [packages, setPackages] = useState<Record<string, PackageInfo>>({})
  const [loading, setLoading] = useState(false)
  const catalogRef = useRef<CatalogRow[] | null>(null)

  // 1 requete pour les correspondances exactes, puis (seulement si necessaire, et une
  // seule fois par session de l'app) 1 requete legere pour permettre la recherche de
  // forfaits "freres" sur les package_id disparus de airalo_packages.
  const fetchPackages = useCallback(async (packageIds: (string | null | undefined)[]) => {
    const ids = Array.from(new Set(packageIds.filter((id): id is string => !!id)))
    if (ids.length === 0) return
    setLoading(true)

    const { data } = await supabase
      .from('airalo_packages')
      .select('id, region_fr, region, name, data_amount, data_unit, validity, validity_days, is_unlimited')
      .in('id', ids)

    const map: Record<string, PackageInfo> = {}
    if (data) data.forEach(p => { map[p.id] = p })
    setPackages(prev => ({ ...prev, ...map }))

    const missing = ids.filter(id => !map[id])
    if (missing.length > 0 && !catalogRef.current) {
      const { data: catalog } = await supabase.from('airalo_packages').select('id, region_fr, region')
      catalogRef.current = catalog || []
    }

    setLoading(false)
  }, [])

  function getPackageDisplay(packageId: string | null | undefined): PackageDisplay {
    const id = packageId || ''
    const pkg = id ? packages[id] : undefined

    // 1. Le forfait existe encore dans airalo_packages : source la plus fiable.
    if (pkg) {
      return {
        destination: getFR(pkg.region_fr, pkg.region),
        subtitle: formatDataDuration(pkg),
        resolved: true,
      }
    }

    const slugInfo = parseDataDurationFromSlug(id)
    const prefix = extractBrandPrefix(id)
    const catalog = catalogRef.current || []

    // 2. Forfaits "freres" encore presents dans le catalogue, meme marque, destination unanime.
    const siblingRegion = resolveViaSiblings(prefix, catalog)
    if (siblingRegion) {
      return {
        destination: getFR(siblingRegion, siblingRegion),
        subtitle: [slugInfo.data, slugInfo.duration].filter(Boolean).join(' • ') || null,
        resolved: false,
      }
    }

    // 3. Le slug nomme explicitement une destination deja connue.
    const knownToken = resolveViaKnownToken(prefix)
    if (knownToken) {
      return {
        destination: getFR(knownToken, knownToken),
        subtitle: [slugInfo.data, slugInfo.duration].filter(Boolean).join(' • ') || null,
        resolved: false,
      }
    }

    // 4. Aucun signal fiable : formulation generique plutot qu'une destination inventee.
    return {
      destination: GENERIC_FALLBACK,
      subtitle: [slugInfo.data, slugInfo.duration].filter(Boolean).join(' • ') || null,
      resolved: false,
    }
  }

  return { fetchPackages, getPackageDisplay, loading }
}
