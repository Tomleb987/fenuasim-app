// Catalogue des destinations (onglet Explorer).
//
// Performance : l'ancien chargement enchainait 3 pages de 1000 forfaits l'une
// apres l'autre (plafond Supabase de 1000 lignes par requete, ~2060 forfaits
// actifs), puis seulement ensuite l'appel ORA FLY au site, le tout a chaque
// ouverture de l'ecran. Depuis Tahiti, chaque aller-retour compte.
// Ici :
//   - la 1re page renvoie aussi le total (count: 'exact'), les pages suivantes
//     partent en parallele ;
//   - l'appel ORA FLY part en meme temps que Supabase, borne par un timeout ;
//   - seules les colonnes utiles a l'ecran sont demandees ;
//   - le resultat est garde en memoire (TTL) et une requete en cours est
//     partagee, ce qui permet aussi de le precharger depuis l'accueil.
import { supabase } from './supabase'
import { getFR } from './regionNames'
import { fetchOraCatalog, POLYNESIA_NAME, POLYNESIA_SLUG, type OraCatalog } from './oraFly'

export type Destination = {
  nameFR: string
  slug: string
  type: string | null
  flag_url: string | null
  minPrice: number
  maxDays: number
  count: number
  comingSoon?: boolean
  aliases?: string[]
  /** Nom + alias normalises, calcules une fois pour la recherche. */
  searchKey: string
}

const PAGE_SIZE = 1000
const CACHE_TTL_MS = 10 * 60 * 1000
const ORA_TIMEOUT_MS = 6000
const COLUMNS = 'slug, region_fr, region, type, flag_url, final_price_xpf, validity'

type Row = {
  slug: string
  region_fr: string | null
  region: string | null
  type: string | null
  flag_url: string | null
  final_price_xpf: number
  validity: string | null
}

let cache: { at: number; list: Destination[] } | null = null
let inflight: Promise<Destination[]> | null = null

export function normalize(str: string): string {
  return str.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, '').trim()
}

function getDays(validity: string | null): number {
  if (!validity) return 0
  const n = parseInt(validity.toString().split(' ')[0])
  return isNaN(n) ? 0 : n
}

function pageQuery(from: number, withCount: boolean) {
  return supabase
    .from('airalo_packages')
    .select(COLUMNS, withCount ? { count: 'exact' } : undefined)
    .eq('status', 'active')
    .gt('final_price_xpf', 0)
    // Tri stable indispensable pour que des pages paralleles ne se recouvrent pas.
    .order('id', { ascending: true })
    .range(from, from + PAGE_SIZE - 1)
}

async function fetchAllRows(): Promise<Row[]> {
  const first = await pageQuery(0, true)
  if (first.error) throw first.error
  const rows = (first.data ?? []) as Row[]
  const total = first.count ?? rows.length
  if (total <= PAGE_SIZE) return rows

  const offsets: number[] = []
  for (let from = PAGE_SIZE; from < total; from += PAGE_SIZE) offsets.push(from)
  const pages = await Promise.all(offsets.map(from => pageQuery(from, false)))
  for (const p of pages) {
    if (p.error) throw p.error
    rows.push(...((p.data ?? []) as Row[]))
  }
  return rows
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([
    p.catch(() => null),
    new Promise<null>(resolve => setTimeout(() => resolve(null), ms)),
  ])
}

function build(rows: Row[], ora: OraCatalog | null): Destination[] {
  // Regroupement par slug : c'est l'identifiant utilise par la fiche
  // destination (app/esim/[country].tsx fait .eq('slug', s)), le compteur
  // affiche reste donc aligne avec le nombre de forfaits de la fiche.
  const map: Record<string, Destination> = {}
  for (const p of rows) {
    const d = getDays(p.validity)
    const cur = map[p.slug]
    if (!cur) {
      const nameFR = getFR(p.region_fr, p.region)
      map[p.slug] = {
        nameFR,
        slug: p.slug,
        type: p.type,
        flag_url: p.flag_url,
        minPrice: p.final_price_xpf,
        maxDays: d,
        count: 1,
        searchKey: normalize(nameFR),
      }
    } else {
      if (p.final_price_xpf < cur.minPrice) cur.minPrice = p.final_price_xpf
      if (d > cur.maxDays) cur.maxDays = d
      cur.count++
    }
  }
  if (ora && ora.packages.length > 0) {
    const aliases = ['polynesie', 'tahiti', 'moorea', 'bora bora', 'fenua', 'papeete', 'french polynesia']
    map[POLYNESIA_NAME] = {
      nameFR: POLYNESIA_NAME,
      slug: POLYNESIA_SLUG,
      type: 'local',
      flag_url: null,
      minPrice: Math.min(...ora.packages.map(p => p.final_price_xpf)),
      maxDays: Math.max(...ora.packages.map(p => p.validity_days)),
      count: ora.packages.length,
      comingSoon: !ora.salesOpen,
      aliases,
      searchKey: [normalize(POLYNESIA_NAME), ...aliases].join(' '),
    }
  }
  return Object.values(map).sort((a, b) => a.nameFR.localeCompare(b.nameFR, 'fr'))
}

/** Liste des destinations : depuis le cache s'il est frais, sinon depuis le reseau. */
export function loadDestinations(force = false): Promise<Destination[]> {
  if (!force && cache && Date.now() - cache.at < CACHE_TTL_MS) return Promise.resolve(cache.list)
  if (inflight) return inflight
  inflight = (async () => {
    // Polynésie française : forfaits ORA FLY servis par le site. Une erreur ou
    // une lenteur du site ne doit ni bloquer ni priver l'utilisateur du reste.
    const [rows, ora] = await Promise.all([fetchAllRows(), withTimeout(fetchOraCatalog(), ORA_TIMEOUT_MS)])
    const list = build(rows, ora)
    if (list.length > 0) cache = { at: Date.now(), list }
    return list
  })().finally(() => { inflight = null })
  return inflight
}

/** Derniere liste connue, meme perimee (affichage immediat avant rafraichissement). */
export function getCachedDestinations(): Destination[] | null {
  return cache?.list ?? null
}

/** Precharge sans bloquer ni remonter d'erreur (appele depuis l'accueil). */
export function prefetchDestinations(): void {
  loadDestinations().catch(() => {})
}
