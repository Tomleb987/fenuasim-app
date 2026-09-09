import { useCallback, useEffect, useRef, useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Animated, Easing, ImageBackground } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useRouter, useFocusEffect } from 'expo-router'
import { supabase } from '../../lib/supabase'
import { COLORS, RADIUS, SHADOW, TYPO } from '../../constants/theme'
import { destinationImageUrl } from '../../lib/destinationImage'
import { useDataUsage } from '../../hooks/useDataUsage'
import { useTravelers } from '../../hooks/useTravelers'
import { useDevices } from '../../hooks/useDevices'
import { useEsimAssignments } from '../../hooks/useEsimAssignments'
import { usePackageInfo, looksLikeTechnicalSlug } from '../../hooks/usePackageInfo'
import { getFR } from '../../lib/regionNames'
import { useCurrency } from '../../lib/currency'
import { useSession } from '../../hooks/useSession'
import { requireAuth } from '../../lib/authGate'
import { getEsimStatus } from '../../lib/esimStatus'
import { hasInstallData } from '../../components/EsimInstallBlock'
import dayjs from 'dayjs'

// Ordre d'affichage voulu pour les forfaits regionaux ; seules les regions
// reellement presentes et actives en base (verifie par requete reelle) sont
// gardees au chargement, jamais inventees.
const REGION_KEYS = ['Europe', 'Asia', 'North America', 'Oceania', 'Global']
const REGION_ICON: Record<string, string> = { Europe: '🇪🇺', Asia: '🌏', 'North America': '🌎', Oceania: '🏝️', Global: '🌍' }

const TOP_DEST = [
  { nameFR: 'Japon', slug: 'japan', c1: '#FF6B6B', c2: '#FF8E53', flag: '🇯🇵' },
  { nameFR: 'Etats-Unis', slug: 'united-states', c1: '#4776E6', c2: '#8E54E9', flag: '🇺🇸' },
  { nameFR: 'Australie', slug: 'australia', c1: '#11998e', c2: '#38ef7d', flag: '🇦🇺' },
  { nameFR: 'France', slug: 'france', c1: '#2980B9', c2: '#6DD5FA', flag: '🇫🇷' },
  { nameFR: 'N.-Zelande', slug: 'new-zealand', c1: '#093028', c2: '#237A57', flag: '🇳🇿' },
  { nameFR: 'Royaume-Uni', slug: 'united-kingdom', c1: '#141E30', c2: '#243B55', flag: '🇬🇧' },
]

function ConsoGauge({ pct, used, remaining }: { pct: number; used: string; remaining: string }) {
  const width = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.timing(width, { toValue: pct, duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start()
  }, [pct])

  const barColors = pct > 80 ? (['#FD7F3C', '#e74c3c'] as const) : pct > 50 ? (['#FFB84D', '#FD7F3C'] as const) : (['#D251D8', '#FD7F3C'] as const)
  const statusColor = pct > 80 ? '#B00020' : pct > 50 ? '#9A6200' : COLORS.success
  const badgeBg = pct > 80 ? '#FDECEA' : pct > 50 ? '#FFF3DC' : COLORS.successBg
  const hint = pct > 80 ? 'Pensez à recharger' : pct > 50 ? 'Plus de la moitié utilisée' : 'Consommation faible'
  const widthPct = width.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] })

  return (
    <View style={s.consoWrap}>
      <View style={s.consoValues}>
        <Text style={s.consoValUsed}>{used} <Text style={s.consoValUnit}>utilisé</Text></Text>
        <Text style={s.consoValRem}>{remaining} <Text style={s.consoValUnit}>restant</Text></Text>
      </View>
      <View style={s.barTrack}>
        <Animated.View style={[s.barFillWrap, { width: widthPct }]}>
          <LinearGradient colors={barColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.barFill} />
        </Animated.View>
      </View>
      <View style={s.consoFooter}>
        <Text style={s.consoHint}>{hint}</Text>
        <View style={[s.pctBadge, { backgroundColor: badgeBg }]}>
          <Text style={[s.pctBadgeTxt, { color: statusColor }]}>{pct}%</Text>
        </View>
      </View>
    </View>
  )
}

export default function HomeScreen() {
  const router = useRouter()
  const { formatXpf } = useCurrency()
  const { session, isGuest } = useSession()
  const [esims, setEsims] = useState<any[]>([])
  const [regions, setRegions] = useState<{ nameFR: string; slug: string; minPrice: number; key: string }[]>([])
  const { fetchUsage, getPct, getUsedStr, getRemainingStr, isLoading, hasReliableUsage, getVoiceSmsUsage } = useDataUsage()
  const { travelers } = useTravelers()
  const { devices } = useDevices()
  const { byIccid: getAssignment } = useEsimAssignments()
  const { fetchPackages, getPackageDisplay } = usePackageInfo()

  useEffect(() => { loadRegions() }, [])

  // L'accueil est un onglet : il reste monte en permanence. Un useEffect avec
  // [] ne se rejouait donc jamais, et le retour depuis la recharge
  // (router.replace('/(tabs)')) ramenait sur des donnees figees : le solde
  // affiche restait celui d'avant l'achat, et l'utilisateur en concluait que
  // sa recharge n'avait pas eu lieu. Constate en reel le 2026-09-06 sur une
  // recharge de 200 Mo pourtant bien livree cote Airalo.
  // On recharge donc a chaque prise de focus. Les regions, elles, ne bougent
  // pas d'une navigation a l'autre : elles restent chargees une seule fois.
  useFocusEffect(useCallback(() => { loadData() }, []))

  async function loadRegions() {
    const { data } = await supabase
      .from('airalo_packages')
      .select('region_fr, region, slug, final_price_xpf')
      .eq('status', 'active')
      .gt('final_price_xpf', 0)
      .in('region', REGION_KEYS)
    if (!data) return
    const map: Record<string, { nameFR: string; slug: string; minPrice: number; key: string }> = {}
    data.forEach(p => {
      if (!REGION_KEYS.includes(p.region)) return
      if (!map[p.region] || p.final_price_xpf < map[p.region].minPrice) {
        map[p.region] = { nameFR: getFR(p.region_fr, p.region), slug: p.slug, minPrice: p.final_price_xpf, key: p.region }
      }
    })
    const ordered = REGION_KEYS.map(k => map[k]).filter((r): r is { nameFR: string; slug: string; minPrice: number; key: string } => !!r)
    setRegions(ordered)
  }

  async function loadData() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user?.email) return
    const { data } = await supabase
      .from('airalo_orders')
      .select('*')
      .eq('email', session.user.email)
      .order('created_at', { ascending: false })
      .limit(3)
    if (data) {
      setEsims(data)
      data.forEach(e => { if (e.sim_iccid) fetchUsage(e.sim_iccid) })
      fetchPackages(data.map(e => e.package_id))
    }
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>

        <LinearGradient colors={['#D251D8','#FD7F3C']} start={{x:0,y:0}} end={{x:1,y:1}} style={s.header}>
          {/* Formes decoratives : donnent de la profondeur au degrade sans
              dependre d'une illustration a produire et a embarquer. */}
          <View pointerEvents="none" style={s.heroBlobA} />
          <View pointerEvents="none" style={s.heroBlobB} />

          <View style={s.headerRow}>
            <View style={{flex:1}}>
              <Text style={s.greeting}>Bonjour 👋</Text>
              <Text style={s.name}>Bienvenue sur FENUASIM</Text>
              <Text style={s.heroSub}>Restez connecté partout dans le monde</Text>
            </View>
            <TouchableOpacity style={s.avatarBtn} onPress={() => router.push('/(tabs)/account')}>
              <Ionicons name="person-outline" size={20} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* La recherche etait un bouton en degrade pose sous le hero. Posee
              en blanc sur le degrade, elle se lit comme un champ et devient
              l'action evidente de l'ecran. */}
          <TouchableOpacity style={s.searchBar} onPress={() => router.push('/(tabs)/explore')} activeOpacity={0.9}>
            <Ionicons name="search" size={20} color={COLORS.textMuted} />
            <Text style={s.searchTxt}>Trouver une eSIM</Text>
            <Ionicons name="chevron-forward" size={18} color="#C9C9C9" />
          </TouchableOpacity>
        </LinearGradient>

        <View style={s.content}>

          {isGuest && (
            <TouchableOpacity style={s.guestBanner} onPress={() => router.push('/(auth)/login')}>
              <View style={s.guestBannerIcon}>
                <Ionicons name="person-add-outline" size={18} color={COLORS.violet} />
              </View>
              <View style={{flex:1}}>
                <Text style={s.guestBannerTitle}>Vous naviguez sans compte</Text>
                <Text style={s.guestBannerTxt}>Connectez-vous pour acheter et retrouver vos eSIM.</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#ccc" />
            </TouchableOpacity>
          )}

          <View style={s.secHead}>
            <Text style={s.secTitle}>Destinations populaires</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/explore')}>
              <Text style={s.secLink}>Voir tout</Text>
            </TouchableOpacity>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.destScroll}>
            {TOP_DEST.map(d => (
              <TouchableOpacity
                key={d.slug}
                onPress={() => router.push({ pathname: '/esim/[country]', params: { country: d.slug } })}
              >
                <View style={s.destCard}>
                  {/* La photo vient du bucket public product-images du site.
                      Le degrade reste dessous : si l'image manque ou tarde,
                      la carte est deja lisible plutot que blanche. */}
                  <LinearGradient colors={[d.c1, d.c2]} style={StyleSheet.absoluteFill} />
                  <ImageBackground
                    source={{ uri: destinationImageUrl(d.slug, 420) ?? undefined }}
                    style={StyleSheet.absoluteFill}
                    imageStyle={{ borderRadius: RADIUS.lg }}
                  >
                    <LinearGradient
                      colors={['transparent', 'rgba(0,0,0,0.15)', 'rgba(0,0,0,0.62)']}
                      style={StyleSheet.absoluteFill}
                    />
                  </ImageBackground>
                  <View style={s.destBadge}>
                    <Text style={s.destFlag}>{d.flag}</Text>
                  </View>
                  <View style={s.destFoot}>
                    <Text style={s.destName} numberOfLines={1}>{d.nameFR}</Text>
                    <View style={s.destGo}>
                      <Ionicons name="chevron-forward" size={13} color="#fff" />
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {regions.length > 0 && (
            <>
              <View style={s.secHead}>
                <Text style={s.secTitle}>Forfaits régionaux</Text>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.destScroll}>
                {regions.map(r => (
                  <TouchableOpacity
                    key={r.key}
                    style={s.regionCard}
                    onPress={() => router.push({ pathname: '/esim/[country]', params: { country: r.slug } })}
                  >
                    <Text style={s.regionIcon}>{REGION_ICON[r.key] ?? '🌐'}</Text>
                    <Text style={s.regionName}>{r.nameFR}</Text>
                    <Text style={s.regionPrice}>Dès {formatXpf(r.minPrice)}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </>
          )}

          {esims.length > 0 && (
            <>
              <View style={s.secHead}>
                <Text style={s.secTitle}>Mes eSIM</Text>
                <TouchableOpacity onPress={() => router.push('/esim')}>
                  <Text style={s.secLink}>Voir tout</Text>
                </TouchableOpacity>
              </View>
              {esims.map(e => {
                const iccid = e.sim_iccid
                const pct = iccid ? getPct(iccid) : 0
                const loading = iccid ? isLoading(iccid) : false
                const used = iccid ? getUsedStr(iccid) : null
                const remaining = iccid ? getRemainingStr(iccid) : null
                // null pour un forfait Internet seul : la ligne appels/SMS
                // n'apparait alors pas du tout.
                const voiceSms = iccid ? getVoiceSmsUsage(iccid) : null
                const { label: statusLabel, color: statusColor, isExpired } = getEsimStatus(e)

                const assignment = getAssignment(iccid)
                const traveler = assignment?.traveler_id ? travelers.find(t => t.id === assignment.traveler_id) : undefined
                const device = assignment?.device_id ? devices.find(d => d.id === assignment.device_id) : undefined
                // Un assignment peut exister sans voyageur (ex: voyageur supprime -> traveler_id remis a null) :
                // dans ce cas l'eSIM doit redevenir "non attribuee", pas garder son ancien label.
                const isUnassigned = !assignment?.traveler_id
                const pkgDisplay = getPackageDisplay(e.package_id)
                // Un ancien label peut lui-meme contenir un slug technique (ex: eSIM
                // attribuee avant la correction du fallback) : ne jamais l'afficher tel quel,
                // mais ne jamais toucher non plus a un vrai label choisi par l'utilisateur.
                const rawLabel = assignment?.label
                const labelIsTechnical = rawLabel ? looksLikeTechnicalSlug(rawLabel, e.package_id) : false
                const useLabel = !isUnassigned && !!rawLabel && !labelIsTechnical
                const cardTitle = useLabel
                  ? rawLabel
                  : (traveler ? `${pkgDisplay.destination} • ${traveler.nickname || traveler.first_name}` : pkgDisplay.destination)
                const last4 = iccid ? String(iccid).slice(-4) : null

                return (
                  <View key={e.id} style={s.esimCard}>
                    <View style={s.esimHead}>
                      <View style={s.simIcon}>
                        <Ionicons name="wifi-outline" size={20} color={COLORS.violet} />
                      </View>
                      <View style={{flex:1}}>
                        <Text style={s.esimTitle}>{cardTitle}</Text>
                        <Text style={s.esimSub}>
                          {e.expires_at
                            ? (isExpired ? 'Expirée le ' : 'Expire le ') + dayjs(e.expires_at).format('DD/MM/YYYY')
                            : 'Commandée le ' + dayjs(e.created_at).format('DD/MM/YYYY')
                          }
                        </Text>
                      </View>
                      <View style={[s.pill,{backgroundColor: statusColor + '20'}]}>
                        <Text style={[s.pillTxt,{color: statusColor}]}>{statusLabel}</Text>
                      </View>
                    </View>

                    {(pkgDisplay.subtitle || traveler || device) && (
                      <View style={s.assignRow}>
                        {pkgDisplay.subtitle && (
                          <View style={s.assignChip}>
                            <Ionicons name="server-outline" size={12} color={COLORS.violet} />
                            <Text style={s.assignChipTxt}>{pkgDisplay.subtitle}</Text>
                          </View>
                        )}
                        {traveler && (
                          <View style={s.assignChip}>
                            <Ionicons name="person-outline" size={12} color={COLORS.violet} />
                            <Text style={s.assignChipTxt}>{traveler.nickname || traveler.first_name}</Text>
                          </View>
                        )}
                        {device && (
                          <View style={s.assignChip}>
                            <Ionicons name="phone-portrait-outline" size={12} color={COLORS.violet} />
                            <Text style={s.assignChipTxt}>{device.name}</Text>
                          </View>
                        )}
                      </View>
                    )}

                    {isUnassigned && iccid && (
                      <TouchableOpacity
                        style={s.unassignedRow}
                        onPress={() => router.push({
                          pathname: '/esim/assign',
                          params: {
                            iccid,
                            airaloOrderId: e.id,
                            destination: pkgDisplay.destination,
                            packageLabel: pkgDisplay.subtitle ?? undefined,
                          }
                        })}
                      >
                        <View style={{flex:1}}>
                          <Text style={s.unassignedTxt}>Non attribuée {last4 ? `· ••••${last4}` : ''}</Text>
                        </View>
                        <Text style={s.assignLink}>Attribuer</Text>
                        <Ionicons name="chevron-forward" size={14} color={COLORS.violet} />
                      </TouchableOpacity>
                    )}

                    {loading ? (
                      <View style={s.consoRow}>
                        <ActivityIndicator size="small" color={COLORS.violet} />
                        <Text style={s.consoLoading}>Chargement conso...</Text>
                      </View>
                    ) : used && used !== '-' && !(iccid && hasReliableUsage(iccid)) ? (
                      <View style={s.consoRow}>
                        <Ionicons name="time-outline" size={14} color={COLORS.textMuted} />
                        <Text style={s.consoLoading}>Consommation pas encore disponible</Text>
                      </View>
                    ) : used && used !== '-' ? (
                      <>
                        <ConsoGauge pct={pct} used={used} remaining={remaining ?? '-'} />
                        {voiceSms && (
                          <View style={s.voiceRow}>
                            {voiceSms.voice && (
                              <View style={s.voiceChip}>
                                <Ionicons name="call-outline" size={12} color={COLORS.violet} />
                                <Text style={s.voiceChipTxt}>
                                  {voiceSms.voice.remaining} / {voiceSms.voice.total} min
                                </Text>
                              </View>
                            )}
                            {voiceSms.sms && (
                              <View style={s.voiceChip}>
                                <Ionicons name="chatbubble-outline" size={12} color={COLORS.violet} />
                                <Text style={s.voiceChipTxt}>
                                  {voiceSms.sms.remaining} / {voiceSms.sms.total} SMS
                                </Text>
                              </View>
                            )}
                          </View>
                        )}
                      </>
                    ) : (
                      <View style={s.forfaitRow}>
                        <View style={s.chip}>
                          <Ionicons name="server-outline" size={13} color={COLORS.violet} />
                          <Text style={s.chipTxt}>{e.data_balance ?? '-'}</Text>
                        </View>
                      </View>
                    )}

                    {/* Ce bouton ouvrait auparavant apple_installation_url sur
                        toutes les plateformes : sur Android ce lien Apple
                        n'aboutit a rien. On passe desormais par l'ecran
                        d'installation, qui propose a chaque plateforme la seule
                        methode qu'elle supporte reellement. */}
                    {hasInstallData(e) && (
                      <TouchableOpacity
                        style={s.installBtn}
                        onPress={() => router.push({
                          pathname: '/esim/install',
                          params: { orderId: e.id, destination: pkgDisplay.destination },
                        })}
                      >
                        <Ionicons name="download-outline" size={14} color={COLORS.violet} />
                        <Text style={s.installTxt}>Installer l'eSIM</Text>
                      </TouchableOpacity>
                    )}

                    {iccid && !isExpired && (
                      <TouchableOpacity
                        style={s.installBtn}
                        onPress={() => router.push({
                          pathname: '/esim/topup',
                          params: { iccid, destination: pkgDisplay.destination },
                        })}
                      >
                        <Ionicons name="add-circle-outline" size={14} color={COLORS.violet} />
                        <Text style={s.installTxt}>Recharger mon eSIM</Text>
                      </TouchableOpacity>
                    )}

                    <TouchableOpacity
                      style={s.helpBtn}
                      onPress={() => router.push({
                        pathname: '/support',
                        // Jamais l'ICCID complet dans une route : seuls le libelle deja
                        // resolu et les 4 derniers chiffres suffisent au support.
                        params: { label: cardTitle, last4: last4 ?? '' }
                      })}
                    >
                      <Ionicons name="headset-outline" size={13} color={COLORS.textMuted} />
                      <Text style={s.helpTxt}>Besoin d'aide ?</Text>
                    </TouchableOpacity>
                  </View>
                )
              })}
            </>
          )}

          <View style={s.secHead}>
            <Text style={s.secTitle}>Actions rapides</Text>
          </View>
          <View style={s.grid}>
            <TouchableOpacity style={s.gridCard} onPress={() => router.push('/(tabs)/account')}>
              <View style={[s.gridIcon,{backgroundColor:'rgba(10,135,84,0.1)'}]}>
                <Ionicons name="receipt-outline" size={24} color={COLORS.success} />
              </View>
              <Text style={s.gridLabel}>Mes commandes</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.gridCard} onPress={() => router.push('/support')}>
              <View style={[s.gridIcon,{backgroundColor:'rgba(136,135,128,0.15)'}]}>
                <Ionicons name="headset-outline" size={24} color="#888" />
              </View>
              <Text style={s.gridLabel}>Support</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={s.gridCard}
              onPress={() => { if (requireAuth(router, session, '/insurance/form')) router.push('/insurance/form') }}
            >
              <View style={[s.gridIcon,{backgroundColor:'rgba(253,127,60,0.12)'}]}>
                <Ionicons name="shield-outline" size={24} color="#FD7F3C" />
              </View>
              <Text style={s.gridLabel}>Assurance voyage</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.gridCard} onPress={() => router.push('/(tabs)/account')}>
              <View style={[s.gridIcon,{backgroundColor:'rgba(210,81,216,0.1)'}]}>
                <Ionicons name="person-outline" size={24} color={COLORS.violet} />
              </View>
              <Text style={s.gridLabel}>Mon compte</Text>
            </TouchableOpacity>
          </View>

        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe:{flex:1,backgroundColor:COLORS.bg},
  header:{paddingHorizontal:20,paddingTop:16,paddingBottom:22,borderBottomLeftRadius:RADIUS.xl,borderBottomRightRadius:RADIUS.xl,overflow:'hidden'},
  heroBlobA:{position:'absolute',top:-70,right:-40,width:190,height:190,borderRadius:95,backgroundColor:'rgba(255,255,255,0.13)'},
  heroBlobB:{position:'absolute',bottom:-90,left:-50,width:210,height:210,borderRadius:105,backgroundColor:'rgba(255,255,255,0.09)'},
  headerRow:{flexDirection:'row',justifyContent:'space-between',alignItems:'flex-start'},
  greeting:{color:'rgba(255,255,255,0.9)',fontSize:14,fontWeight:'600'},
  name:{color:'#fff',...TYPO.hero,marginTop:2},
  heroSub:{color:'rgba(255,255,255,0.9)',fontSize:13,marginTop:5},
  avatarBtn:{backgroundColor:'rgba(255,255,255,0.22)',borderRadius:22,width:44,height:44,justifyContent:'center',alignItems:'center'},
  searchBar:{flexDirection:'row',alignItems:'center',gap:12,backgroundColor:'#fff',borderRadius:RADIUS.pill,paddingHorizontal:18,paddingVertical:16,marginTop:20,...SHADOW.onColor},
  searchTxt:{flex:1,fontSize:16,fontWeight:'600',color:COLORS.textMuted},
  content:{padding:16},
  guestBanner:{flexDirection:'row',alignItems:'center',gap:12,backgroundColor:'#fff',borderRadius:RADIUS.md,padding:14,marginTop:14,borderWidth:1,borderColor:'rgba(210,81,216,0.25)',...SHADOW.card},
  guestBannerIcon:{width:38,height:38,borderRadius:19,backgroundColor:'rgba(210,81,216,0.1)',alignItems:'center',justifyContent:'center'},
  guestBannerTitle:{fontSize:14,fontWeight:'800',color:COLORS.text},
  guestBannerTxt:{fontSize:12,color:COLORS.textMuted,marginTop:2},
  secHead:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:12,marginTop:4},
  secTitle:{...TYPO.section,color:COLORS.text},
  secLink:{fontSize:13,fontWeight:'700',color:COLORS.violet},
  destScroll:{marginBottom:22},
  destCard:{width:150,height:190,borderRadius:RADIUS.lg,marginRight:12,overflow:'hidden',justifyContent:'space-between',padding:12,...SHADOW.card},
  destBadge:{alignSelf:'flex-start',backgroundColor:'rgba(255,255,255,0.92)',borderRadius:RADIUS.sm,paddingHorizontal:7,paddingVertical:3},
  destFlag:{fontSize:22},
  destFoot:{flexDirection:'row',alignItems:'center',gap:8},
  destName:{flex:1,color:'#fff',fontSize:15,fontWeight:'800'},
  destGo:{width:26,height:26,borderRadius:13,backgroundColor:'rgba(255,255,255,0.28)',alignItems:'center',justifyContent:'center'},
  regionCard:{width:124,backgroundColor:'#fff',borderRadius:RADIUS.md,marginRight:12,padding:14,alignItems:'flex-start',...SHADOW.card},
  regionIcon:{fontSize:22,marginBottom:6},
  regionName:{fontSize:13,fontWeight:'700',color:COLORS.text},
  regionPrice:{fontSize:11,color:COLORS.textMuted,marginTop:3},
  esimCard:{backgroundColor:'#fff',borderRadius:RADIUS.lg,padding:16,marginBottom:12,...SHADOW.card},
  esimHead:{flexDirection:'row',alignItems:'center',gap:10,marginBottom:10},
  simIcon:{width:40,height:40,borderRadius:12,backgroundColor:'rgba(210,81,216,0.1)',justifyContent:'center',alignItems:'center'},
  esimTitle:{fontSize:14,fontWeight:'700',color:COLORS.text},
  esimSub:{fontSize:12,color:COLORS.textMuted,marginTop:2},
  pill:{paddingHorizontal:10,paddingVertical:4,borderRadius:20},
  pillTxt:{fontSize:11,fontWeight:'700'},
  assignRow:{flexDirection:'row',gap:6,marginBottom:10},
  assignChip:{flexDirection:'row',alignItems:'center',gap:4,backgroundColor:'rgba(210,81,216,0.08)',borderRadius:20,paddingHorizontal:9,paddingVertical:4},
  assignChipTxt:{fontSize:11,fontWeight:'700',color:COLORS.violet},
  unassignedRow:{flexDirection:'row',alignItems:'center',gap:6,backgroundColor:'#FFF8E6',borderRadius:10,paddingHorizontal:10,paddingVertical:9,marginBottom:10},
  unassignedTxt:{fontSize:12,color:'#9A6200',fontWeight:'600'},
  assignLink:{fontSize:12,fontWeight:'700',color:COLORS.violet},
  consoRow:{flexDirection:'row',alignItems:'center',gap:8,paddingVertical:4},
  voiceRow:{flexDirection:'row',gap:6,marginTop:8},
  voiceChip:{flexDirection:'row',alignItems:'center',gap:4,backgroundColor:'rgba(210,81,216,0.08)',borderRadius:20,paddingHorizontal:9,paddingVertical:4},
  voiceChipTxt:{fontSize:11,fontWeight:'700',color:COLORS.violet},
  consoLoading:{fontSize:12,color:COLORS.textMuted},
  consoWrap:{marginBottom:6},
  barTrack:{backgroundColor:'#F0F0F0',borderRadius:20,height:8,overflow:'hidden',marginBottom:8},
  barFillWrap:{height:'100%',borderRadius:20,overflow:'hidden'},
  barFill:{flex:1,height:'100%'},
  consoValues:{flexDirection:'row',justifyContent:'space-between',marginBottom:8},
  consoValUsed:{fontSize:16,fontWeight:'800',color:COLORS.violet},
  consoValRem:{fontSize:16,fontWeight:'800',color:COLORS.success},
  consoValUnit:{fontSize:11,fontWeight:'600',color:COLORS.textMuted},
  consoFooter:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},
  consoHint:{fontSize:12,color:COLORS.textMuted,flex:1,marginRight:8},
  pctBadge:{paddingHorizontal:10,paddingVertical:3,borderRadius:20},
  pctBadgeTxt:{fontSize:11,fontWeight:'700'},
  forfaitRow:{flexDirection:'row',gap:8},
  chip:{flexDirection:'row',alignItems:'center',gap:5,backgroundColor:COLORS.bg,borderRadius:8,paddingHorizontal:10,paddingVertical:5},
  chipTxt:{fontSize:12,fontWeight:'600',color:'#555'},
  installBtn:{flexDirection:'row',alignItems:'center',gap:6,paddingTop:8,borderTopWidth:0.5,borderTopColor:'#f0f0f0',marginTop:6},
  installTxt:{color:COLORS.violet,fontSize:13,fontWeight:'600'},
  helpBtn:{flexDirection:'row',alignItems:'center',gap:5,paddingTop:8,marginTop:2},
  helpTxt:{color:COLORS.textMuted,fontSize:12,fontWeight:'600'},
  grid:{flexDirection:'row',flexWrap:'wrap',gap:10},
  gridCard:{backgroundColor:'#fff',borderRadius:RADIUS.lg,padding:16,alignItems:'center',width:'47%',...SHADOW.card},
  gridIcon:{width:46,height:46,borderRadius:RADIUS.md,justifyContent:'center',alignItems:'center',marginBottom:9},
  gridLabel:{fontSize:13,fontWeight:'600',color:COLORS.text,textAlign:'center'},
})
