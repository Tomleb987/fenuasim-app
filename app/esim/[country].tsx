import React, { useEffect, useMemo, useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, FlatList, Modal, ScrollView, ImageBackground } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { supabase } from '../../lib/supabase'
import { COLORS, RADIUS, SHADOW, TYPO } from '../../constants/theme'
import { destinationImageUrl } from '../../lib/destinationImage'
import { getFR } from '../../lib/regionNames'
import { getPlanType, getPlanTypeLabel, getPlanTypeIcon, parseVoiceSmsVolume, INTERNET_ONLY_CAPTION, INTERNET_ONLY_EXPLANATION, PlanCoverageType } from '../../hooks/usePackageInfo'
import { useCurrency } from '../../lib/currency'
import { useSession } from '../../hooks/useSession'
import { requireAuth } from '../../lib/authGate'

const GRAD: Record<string, [string, string]> = {
  'Japan': ['#FF6B6B', '#FF8E53'],
  'United States': ['#4776E6', '#8E54E9'],
  'Australia': ['#11998e', '#38ef7d'],
  'France': ['#2980B9', '#6DD5FA'],
  'New Zealand': ['#093028', '#237A57'],
  'United Kingdom': ['#141E30', '#243B55'],
}
function getGrad(regionFr: string): [string, string] { return GRAD[regionFr] ?? ['#D251D8', '#FD7F3C'] }

type Pkg = {
  id: string
  name: string | null
  region_fr: string | null
  data_amount: number | string | null
  data_unit: string | null
  validity_days: number | null
  validity: string | null
  final_price_xpf: number
  is_unlimited: boolean | null
  available_topup: boolean | null
  operator_name: string | null
  includes_voice: boolean | null
  includes_sms: boolean | null
  networks: string | null
  type: string | null
}

function getDataLabel(p: Pkg): string {
  if (p.is_unlimited) return 'Illimité'
  return `${p.data_amount ?? '-'} ${p.data_unit ?? 'Go'}`
}
function getDurationDays(p: Pkg): number {
  if (p.validity_days) return p.validity_days
  if (p.validity) { const n = parseInt(p.validity, 10); return isNaN(n) ? 0 : n }
  return 0
}
function getDurationLabel(p: Pkg): string { return `${getDurationDays(p)} jours` }

function parseNetworks(raw: string | null): string[] {
  if (!raw || !raw.trim()) return []
  return raw.split('·').map(s => s.trim()).filter(Boolean)
}
function formatNetworkEntry(entry: string): string {
  const m = entry.match(/^(.*)\s\(([^)]+)\)\s*$/)
  return m ? `${m[1].trim()} • ${m[2].trim()}` : entry
}

type DataFilter = 'all' | 'low' | 'high' | 'unlimited'
type DurationFilter = 'all' | 'short' | 'medium' | 'long'
const GRID_FILLER = { id: '__filler__' } as Pkg

type TypeFilter = 'all' | 'internet' | 'full'

function matchesTypeFilter(t: PlanCoverageType, f: TypeFilter): boolean {
  if (f === 'all') return true
  if (f === 'internet') return t === 'internet'
  return t !== 'internet' // 'full' : toute offre incluant au moins appels ou SMS
}

export default function CountryDetail() {
  const router = useRouter()
  // Android SDK 35+ impose l'edge-to-edge : la barre de navigation systeme se
  // superpose au bas de l'ecran. Sans cet inset, le bouton principal passe
  // partiellement sous la barre de gestes ou les 3 boutons.
  const insets = useSafeAreaInsets()
  const { formatXpf } = useCurrency()
  const { country: slug } = useLocalSearchParams<{ country: string }>()
  const { session } = useSession()
  const [plans, setPlans] = useState<Pkg[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [countryName, setCountryName] = useState('')
  const [activeTab, setActiveTab] = useState<'forfaits' | 'infos'>('forfaits')
  const [showNetworksModal, setShowNetworksModal] = useState(false)
  const [dataFilter, setDataFilter] = useState<DataFilter>('all')
  const [durationFilter, setDurationFilter] = useState<DurationFilter>('all')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')

  useEffect(() => { if (slug) fetchPlans(String(slug)) }, [slug])

  async function fetchPlans(s: string) {
    setLoading(true)
    setError(false)
    const { data, error: err } = await supabase
      .from('airalo_packages')
      .select('id, name, region_fr, data_amount, data_unit, validity_days, validity, final_price_xpf, is_unlimited, available_topup, operator_name, includes_voice, includes_sms, networks, type')
      .eq('status', 'active')
      .eq('slug', s)
      .gt('final_price_xpf', 0)
      .order('final_price_xpf', { ascending: true })
    if (err) { setError(true); setLoading(false); return }
    if (data && data.length > 0) {
      // Tri commercial : data croissante, puis duree, puis prix. Illimite en dernier.
      const sorted = [...data].sort((a, b) => {
        const da = a.is_unlimited ? Infinity : Number(a.data_amount ?? 0)
        const db = b.is_unlimited ? Infinity : Number(b.data_amount ?? 0)
        if (da !== db) return da - db
        const durA = getDurationDays(a as Pkg)
        const durB = getDurationDays(b as Pkg)
        if (durA !== durB) return durA - durB
        return (a.final_price_xpf ?? 0) - (b.final_price_xpf ?? 0)
      })
      setPlans(sorted as Pkg[])
      // Preselectionne le forfait au prix le plus bas (coherent avec le "Des X
      // XPF" affiche sur l'accueil/explorer), pas simplement le premier de la
      // liste triee par volume de donnees -- sinon le prix mis en avant ici
      // peut etre plus eleve que celui annonce plus tot dans le parcours.
      const cheapest = sorted.reduce((min, p) => (p.final_price_xpf ?? 0) < (min.final_price_xpf ?? 0) ? p : min, sorted[0])
      setSelected(cheapest.id)
      setCountryName(sorted[0].region_fr ?? s)
    } else {
      setPlans([])
    }
    setLoading(false)
  }

  const filteredPlans = useMemo(() => {
    return plans.filter(p => {
      if (dataFilter === 'low' && !(!p.is_unlimited && Number(p.data_amount ?? 0) <= 5)) return false
      if (dataFilter === 'high' && !(!p.is_unlimited && Number(p.data_amount ?? 0) >= 10)) return false
      if (dataFilter === 'unlimited' && !p.is_unlimited) return false
      if (durationFilter !== 'all') {
        const d = getDurationDays(p)
        if (durationFilter === 'short' && !(d <= 7)) return false
        if (durationFilter === 'medium' && !(d > 7 && d < 30)) return false
        if (durationFilter === 'long' && !(d >= 30)) return false
      }
      if (!matchesTypeFilter(getPlanType(p), typeFilter)) return false
      return true
    })
  }, [plans, dataFilter, durationFilter, typeFilter])

  // En grille a 2 colonnes, une derniere ligne a un seul element voit sa carte
  // s'etirer sur toute la largeur (flex: 1 sans voisin) et rompre l'alignement.
  // On complete donc avec un element fantome, rendu comme un espace vide.
  const gridPlans = useMemo(
    () => (filteredPlans.length % 2 === 1 ? [...filteredPlans, GRID_FILLER] : filteredPlans),
    [filteredPlans]
  )

  const showTypeFilter = useMemo(() => new Set(plans.map(getPlanType)).size > 1, [plans])

  const sel = plans.find(p => p.id === selected)
  const destinationName = getFR(countryName, countryName)
  const grad = getGrad(countryName)
  const showFilters = plans.length > 8

  const networks = sel ? parseNetworks(sel.networks) : []
  const isMultiNetwork = networks.length > 1
  const isLocalPackage = sel?.type === 'local'
  const selPlanType = sel ? getPlanType(sel) : null
  const selVolume = sel ? parseVoiceSmsVolume(sel.name) : undefined
  const selIsInternetOnly = selPlanType === 'internet'

  function goToPayment() {
    if (!sel) return
    // Le catalogue est ouvert a tous, le paiement non : livrer une eSIM exige un
    // compte (c'est l'adresse email de livraison). On amene donc le visiteur a la
    // connexion en gardant le chemin de ce forfait, pour le ramener ici -- et non
    // sur l'accueil -- une fois son compte cree.
    if (!requireAuth(router, session, `/esim/${slug}`)) return
    router.push({
      pathname: '/esim/payment',
      params: {
        packageId: sel.id,
        packageName: sel.name ?? destinationName,
        price: String(Math.round(sel.final_price_xpf)),
        days: getDurationLabel(sel),
        data: getDataLabel(sel),
        country: destinationName,
      }
    })
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>

      <LinearGradient colors={grad} style={s.hero}>
        {/* Photo de la destination quand la banque en a une (53,5 % des slugs
            actifs). Le degrade par region reste dessous : un slug non couvert
            garde donc un hero colore plutot qu'un aplat gris. */}
        <ImageBackground
          source={{ uri: destinationImageUrl(String(slug), 900, 480) ?? undefined }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
        >
          <LinearGradient
            colors={['rgba(35,5,45,0.55)', 'rgba(35,5,45,0.28)', 'rgba(35,5,45,0.52)']}
            style={StyleSheet.absoluteFill}
          />
        </ImageBackground>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color="#fff" />
        </TouchableOpacity>
        <View style={s.heroContent}>
          <Text style={s.heroTitle}>{destinationName}</Text>
          {networks.length === 1 && <Text style={s.heroSub}>{formatNetworkEntry(networks[0])}</Text>}
          {isMultiNetwork && (
            <Text style={s.heroSub}>Couverture multi-réseaux · 4G/5G selon disponibilité</Text>
          )}
        </View>
      </LinearGradient>

      <View style={s.tabs}>
        <TouchableOpacity style={[s.tabBtn, activeTab === 'forfaits' && s.tabBtnActive]} onPress={() => setActiveTab('forfaits')}>
          <Text style={[s.tabTxt, activeTab === 'forfaits' && s.tabTxtActive]}>Forfaits ({plans.length})</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.tabBtn, activeTab === 'infos' && s.tabBtnActive]} onPress={() => setActiveTab('infos')}>
          <Text style={[s.tabTxt, activeTab === 'infos' && s.tabTxtActive]}>Infos</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={s.loader}>
          <ActivityIndicator color={COLORS.violet} size="large" />
          <Text style={s.loaderTxt}>Chargement des forfaits…</Text>
        </View>
      ) : error ? (
        <View style={s.loader}>
          <Ionicons name="alert-circle-outline" size={36} color="#FD7F3C" />
          <Text style={s.loaderTxt}>Impossible de charger les offres.</Text>
          <TouchableOpacity style={s.retryBtn} onPress={() => fetchPlans(String(slug))}>
            <Text style={s.retryTxt}>Réessayer</Text>
          </TouchableOpacity>
        </View>
      ) : plans.length === 0 ? (
        <View style={s.loader}>
          <Ionicons name="hardware-chip-outline" size={36} color="#ccc" />
          <Text style={s.loaderTxt}>Aucune offre disponible pour cette destination.</Text>
        </View>
      ) : activeTab === 'infos' ? (
        <ScrollView style={s.infoPage} contentContainerStyle={{ paddingBottom: 120, gap: 10 }}>
          <View style={s.infoCard}>
            <Text style={s.infoSection}>Compatibilite</Text>
            <View style={s.infoRow}><Ionicons name="phone-portrait-outline" size={16} color={COLORS.violet} /><Text style={s.infoTxt}>iPhone XS et versions ulterieures</Text></View>
            <View style={s.infoRow}><Ionicons name="logo-android" size={16} color={COLORS.violet} /><Text style={s.infoTxt}>Android avec support eSIM</Text></View>
          </View>
          <View style={s.infoCard}>
            <Text style={s.infoSection}>Installation</Text>
            {['Achetez votre forfait', 'Appuyez sur Installer mon eSIM', 'Activez dans Réglages › Réseau mobile', "Sélectionnez l'eSIM comme données mobiles"].map((t, i) => (
              <View key={i} style={s.infoRow}>
                <View style={s.stepNum}><Text style={s.stepNumTxt}>{i + 1}</Text></View>
                <Text style={s.infoTxt}>{t}</Text>
              </View>
            ))}
          </View>
          <View style={s.infoCard}>
            <Text style={s.infoSection}>Important</Text>
            <View style={s.infoRow}><Ionicons name="information-circle-outline" size={16} color="#FD7F3C" /><Text style={s.infoTxt}>L'eSIM s'active automatiquement a l'arrivee dans le pays</Text></View>
          </View>
        </ScrollView>
      ) : (
        <FlatList
          style={s.forfaitsPage}
          data={gridPlans}
          keyExtractor={p => p.id}
          numColumns={2}
          columnWrapperStyle={{ gap: 10 }}
          contentContainerStyle={{ paddingBottom: 170 }}
          initialNumToRender={12}
          windowSize={7}
          ListHeaderComponent={
            showFilters || showTypeFilter ? (
              <View style={s.filtersWrap}>
                {showTypeFilter && (
                  <>
                    <Text style={s.filterLabel}>Type de forfait</Text>
                    <View style={s.filterRow}>
                      {([['all', 'Tous'], ['internet', 'Internet'], ['full', 'Internet + appels/SMS']] as [TypeFilter, string][]).map(([key, label]) => (
                        <TouchableOpacity key={key} style={[s.filterChip, typeFilter === key && s.filterChipSel]} onPress={() => setTypeFilter(key)}>
                          <Text style={[s.filterChipTxt, typeFilter === key && s.filterChipTxtSel]}>{label}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </>
                )}
                {showFilters && (
                  <>
                    <Text style={s.filterLabel}>Internet</Text>
                    <View style={s.filterRow}>
                      {([['all', 'Tous'], ['low', '≤ 5 Go'], ['high', '10 Go+'], ['unlimited', 'Illimité']] as [DataFilter, string][]).map(([key, label]) => (
                        <TouchableOpacity key={key} style={[s.filterChip, dataFilter === key && s.filterChipSel]} onPress={() => setDataFilter(key)}>
                          <Text style={[s.filterChipTxt, dataFilter === key && s.filterChipTxtSel]}>{label}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    <Text style={s.filterLabel}>Durée</Text>
                    <View style={s.filterRow}>
                      {([['all', 'Toutes'], ['short', '≤ 7 j'], ['medium', '8-29 j'], ['long', '30 j+']] as [DurationFilter, string][]).map(([key, label]) => (
                        <TouchableOpacity key={key} style={[s.filterChip, durationFilter === key && s.filterChipSel]} onPress={() => setDurationFilter(key)}>
                          <Text style={[s.filterChipTxt, durationFilter === key && s.filterChipTxtSel]}>{label}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </>
                )}
              </View>
            ) : null
          }
          renderItem={({ item: p }) => {
            if (p.id === GRID_FILLER.id) return <View style={s.planFiller} />
            const planType = getPlanType(p)
            const volume = parseVoiceSmsVolume(p.name)
            const isSel = selected === p.id
            return (
              <TouchableOpacity
                style={[s.planCard, isSel && s.planCardSel]}
                onPress={() => setSelected(p.id)}
                activeOpacity={0.85}
              >
                <View style={s.planCardHead}>
                  <Text style={s.planCardData}>{getDataLabel(p)}</Text>
                  {isSel && (
                    <View style={s.planCheck}>
                      <Ionicons name="checkmark" size={12} color="#fff" />
                    </View>
                  )}
                </View>
                <Text style={s.planCardDuration}>{getDurationLabel(p)}</Text>
                <View style={s.planCardTypeWrap}>
                  <Ionicons name={getPlanTypeIcon(planType)} size={13} color={COLORS.violet} />
                  <Text style={s.planCardTypeTxt}>{getPlanTypeLabel(planType, volume)}</Text>
                </View>
                {planType === 'internet' && <Text style={s.planCardCaption}>{INTERNET_ONLY_CAPTION}</Text>}
                <Text style={s.planCardPrice}>{formatXpf(p.final_price_xpf)}</Text>
              </TouchableOpacity>
            )
          }}
          ListEmptyComponent={
            <View style={s.loader}>
              <Text style={s.loaderTxt}>Aucune offre ne correspond a ces filtres.</Text>
            </View>
          }
          ListFooterComponent={sel ? (
            <View>
              <View style={s.recap}>
                <Text style={s.recapTitle}>Votre forfait</Text>
                <View style={s.recapRow}><Text style={s.recapLabel}>Internet</Text><Text style={s.recapVal}>{getDataLabel(sel)}</Text></View>
                <View style={s.recapRow}><Text style={s.recapLabel}>Durée</Text><Text style={s.recapVal}>{getDurationLabel(sel)}</Text></View>
                <View style={s.recapRow}>
                  <Text style={s.recapLabel}>Type</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                    <Ionicons name={getPlanTypeIcon(selPlanType!)} size={13} color={COLORS.violet} />
                    <Text style={s.recapVal}>{getPlanTypeLabel(selPlanType!, selVolume)}</Text>
                  </View>
                </View>
                {!isLocalPackage && (
                  <View style={s.recapRow}><Text style={s.recapLabel}>Couverture</Text><Text style={s.recapVal}>{destinationName}</Text></View>
                )}
                <TouchableOpacity
                  style={s.recapRow}
                  onPress={() => isMultiNetwork && setShowNetworksModal(true)}
                  disabled={!isMultiNetwork}
                >
                  <Text style={s.recapLabel}>{isMultiNetwork ? 'Réseaux' : 'Réseau'}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Text style={s.recapVal}>{isMultiNetwork ? 'Multi-réseaux 4G/5G' : (networks[0] ? formatNetworkEntry(networks[0]) : '-')}</Text>
                    {isMultiNetwork && <Ionicons name="chevron-forward" size={14} color={COLORS.textMuted} />}
                  </View>
                </TouchableOpacity>
                {selIsInternetOnly && (
                  <View style={[s.recapRow, { borderBottomWidth: 0, alignItems: 'flex-start' }]}>
                    <Text style={s.recapLabel}>Applications</Text>
                    <Text style={[s.recapVal, { flex: 1, textAlign: 'right' }]}>{INTERNET_ONLY_EXPLANATION}</Text>
                  </View>
                )}
                <View style={s.recapRow}>
                  <Text style={s.recapLabel}>{selIsInternetOnly ? 'Appels classiques' : 'Appels'}</Text>
                  <Text style={s.recapVal}>
                    {sel.includes_voice ? (selVolume?.minutes != null ? `${selVolume.minutes} min` : 'Inclus') : 'Non inclus'}
                  </Text>
                </View>
                <View style={[s.recapRow, { borderBottomWidth: 0 }]}>
                  <Text style={s.recapLabel}>{selIsInternetOnly ? 'SMS classiques' : 'SMS'}</Text>
                  <Text style={s.recapVal}>
                    {sel.includes_sms ? (selVolume?.sms != null ? `${selVolume.sms} SMS` : 'Inclus') : 'Non inclus'}
                  </Text>
                </View>
              </View>

              <View style={s.features}>
                {['QR code en 2 min', 'Activable avant le départ', 'Rechargeable'].map((f, i) => (
                  <View key={i} style={s.featRow}>
                    <LinearGradient colors={['#D251D8', '#FD7F3C']} style={s.featCheck}>
                      <Ionicons name="checkmark" size={10} color="#fff" />
                    </LinearGradient>
                    <Text style={s.featTxt}>{f}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}
        />
      )}

      {sel && !loading && !error && plans.length > 0 && (
        <View style={[s.ctaBar, { paddingBottom: 16 + insets.bottom }]}>
          <View style={s.selectionSummary}>
            <Text style={s.selectionSummaryTitle}>Votre choix</Text>
            <Text style={s.selectionSummaryTxt}>
              {getDataLabel(sel)} • {getDurationLabel(sel)} · {getPlanTypeLabel(selPlanType!, selVolume)}
            </Text>
          </View>
          <TouchableOpacity style={s.ctaWrap} onPress={goToPayment}>
            <LinearGradient colors={['#D251D8', '#FD7F3C']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.ctaBtn}>
              <Text style={s.ctaTxt}>Acheter · {formatXpf(sel.final_price_xpf)}</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      )}

      <Modal visible={showNetworksModal} animationType="slide" transparent onRequestClose={() => setShowNetworksModal(false)}>
        <View style={s.modalBackdrop}>
          <View style={s.modalSheet}>
            <View style={s.modalHead}>
              <Text style={s.modalTitle}>Réseaux partenaires</Text>
              <TouchableOpacity onPress={() => setShowNetworksModal(false)}>
                <Ionicons name="close" size={22} color={COLORS.text} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={networks}
              keyExtractor={(n, i) => n + i}
              initialNumToRender={20}
              renderItem={({ item }) => (
                <View style={s.modalRow}>
                  <Ionicons name="wifi-outline" size={14} color={COLORS.violet} />
                  <Text style={s.modalRowTxt}>{formatNetworkEntry(item)}</Text>
                </View>
              )}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  hero: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 22, flexDirection: 'row', alignItems: 'center', gap: 12, overflow: 'hidden' },
  backBtn: { backgroundColor: 'rgba(255,255,255,0.26)', borderRadius: 20, width: 38, height: 38, justifyContent: 'center', alignItems: 'center' },
  heroContent: { flex: 1 },
  heroTitle: { color: '#fff', ...TYPO.screenTitle },
  heroSub: { color: 'rgba(255,255,255,0.85)', fontSize: 12, marginTop: 3 },
  tabs: { backgroundColor: '#fff', flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  tabBtn: { flex: 1, paddingVertical: 10, alignItems: 'center' },
  tabBtnActive: { borderBottomWidth: 2.5, borderBottomColor: COLORS.violet },
  tabTxt: { fontSize: 13, fontWeight: '600', color: '#aaa' },
  tabTxtActive: { color: COLORS.violet },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 10, padding: 30 },
  loaderTxt: { fontSize: 14, color: COLORS.textMuted, textAlign: 'center' },
  retryBtn: { backgroundColor: COLORS.violet, borderRadius: 12, paddingHorizontal: 20, paddingVertical: 10, marginTop: 4 },
  retryTxt: { color: '#fff', fontWeight: '700', fontSize: 13 },

  forfaitsPage: { flex: 1, paddingHorizontal: 16, paddingTop: 12 },

  filtersWrap: { marginBottom: 12 },
  filterLabel: { fontSize: 11, fontWeight: '700', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 6, marginTop: 6 },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  filterChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1.5, borderColor: COLORS.border, backgroundColor: '#fff' },
  filterChipSel: { borderColor: COLORS.violet, backgroundColor: 'rgba(210,81,216,0.08)' },
  filterChipTxt: { fontSize: 12, fontWeight: '600', color: '#888' },
  filterChipTxtSel: { color: COLORS.violet },

  // Grille 2 colonnes : flex 1 plutot qu'une largeur en pourcentage, pour que
  // l'ecart soit gere par columnWrapperStyle et reste constant quel que soit
  // l'ecran. minHeight garde les deux cartes d'une meme ligne alignees quand
  // l'une porte une legende "internet uniquement" et pas l'autre.
  planCard: { flex: 1, minHeight: 132, backgroundColor: '#fff', borderRadius: RADIUS.lg, padding: 14, marginBottom: 10, borderWidth: 1.5, borderColor: 'transparent', ...SHADOW.card },
  planCardSel: { borderColor: COLORS.violet, backgroundColor: 'rgba(210,81,216,0.05)' },
  planFiller: { flex: 1 },
  planCardHead: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  planCardData: { flex: 1, fontSize: 20, fontWeight: '800', color: COLORS.text, letterSpacing: -0.3 },
  planCheck: { width: 20, height: 20, borderRadius: 10, backgroundColor: COLORS.violet, alignItems: 'center', justifyContent: 'center' },
  planCardDuration: { fontSize: 13, color: COLORS.textMuted, marginTop: 2 },
  planCardTypeWrap: { flexDirection: 'row', alignItems: 'flex-start', gap: 5, marginTop: 9 },
  planCardTypeTxt: { flex: 1, fontSize: 11.5, fontWeight: '700', color: COLORS.violet, lineHeight: 15 },
  planCardCaption: { fontSize: 11, color: COLORS.textMuted, marginTop: 3, lineHeight: 14 },
  planCardPrice: { fontSize: 19, fontWeight: '800', color: COLORS.violet, marginTop: 10 },

  recap: { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginTop: 6 },
  recapTitle: { fontSize: 13, fontWeight: '700', color: COLORS.text, marginBottom: 8 },
  recapRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: '#f5f5f5' },
  recapLabel: { fontSize: 12, color: COLORS.textMuted },
  recapVal: { fontSize: 13, fontWeight: '600', color: COLORS.text },

  features: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-around', marginTop: 12, backgroundColor: '#fff', borderRadius: 14, padding: 12, gap: 8 },
  featRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  featCheck: { width: 16, height: 16, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  featTxt: { fontSize: 11, color: '#555' },

  infoPage: { flex: 1, padding: 16 },
  infoCard: { backgroundColor: '#fff', borderRadius: RADIUS.lg, padding: 14, ...SHADOW.card },
  infoSection: { fontSize: 11, fontWeight: '700', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 6, borderBottomWidth: 0.5, borderBottomColor: '#f8f8f8' },
  infoTxt: { fontSize: 13, color: '#333', flex: 1, lineHeight: 18 },
  stepNum: { width: 20, height: 20, borderRadius: 10, backgroundColor: COLORS.violet, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  stepNumTxt: { color: '#fff', fontSize: 10, fontWeight: '800' },

  ctaBar: { backgroundColor: '#fff', padding: 14, borderTopWidth: 1, borderTopColor: '#F0F0F0', ...SHADOW.raised },
  selectionSummary: { marginBottom: 8, paddingHorizontal: 2 },
  selectionSummaryTitle: { fontSize: 10, fontWeight: '700', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.4 },
  selectionSummaryTxt: { fontSize: 13, fontWeight: '700', color: COLORS.text, marginTop: 2 },
  ctaWrap: { borderRadius: 14, overflow: 'hidden' },
  ctaBtn: { padding: 15, alignItems: 'center' },
  ctaTxt: { color: '#fff', fontSize: 15, fontWeight: '800' },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '75%', paddingTop: 8 },
  modalHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  modalTitle: { fontSize: 16, fontWeight: '800', color: COLORS.text },
  modalRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 18, paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: '#f5f5f5' },
  modalRowTxt: { fontSize: 13, color: COLORS.text },
})
