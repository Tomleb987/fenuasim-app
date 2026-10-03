import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import { View, Text, SectionList, TouchableOpacity, StyleSheet, TextInput, ActivityIndicator, RefreshControl } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { COLORS, RADIUS, SHADOW } from '../../constants/theme'
import { useCurrency } from '../../lib/currency'
import { getCachedDestinations, loadDestinations, normalize, type Destination } from '../../lib/catalog'

const TOP = ["France","Canada","Etats-Unis","Australie","Nouvelle-Zelande"]
const GRADIENT = ['#D251D8','#FD7F3C'] as const
const GRAD_START = {x:0,y:0}
const GRAD_END = {x:1,y:0}

export default function ExploreScreen() {
  const router = useRouter()
  const { formatXpf } = useCurrency()
  // Affichage immediat de la derniere liste connue, rafraichie en arriere-plan.
  const [destinations, setDestinations] = useState<Destination[]>(() => getCachedDestinations() ?? [])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(() => !getCachedDestinations())
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState(false)
  const [typeFilter, setTypeFilter] = useState<'all'|'local'|'global'>('all')

  const fetchAll = useCallback(async (force = false) => {
    setError(false)
    try {
      const list = await loadDestinations(force)
      setDestinations(list)
    } catch {
      // On garde la liste deja affichee ; l'erreur n'est montree que s'il n'y a rien.
      setError(true)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  const onRefresh = useCallback(() => { setRefreshing(true); fetchAll(true) }, [fetchAll])

  const filtered = useMemo(() => {
    let list = destinations
    if (typeFilter !== 'all') list = list.filter(d => d.type === typeFilter)
    const q = normalize(search)
    if (q) list = list.filter(d => d.searchKey.includes(q))
    return list
  }, [destinations, typeFilter, search])

  const sections = useMemo(() => {
    const top = filtered.filter(d => TOP.includes(d.nameFR))
    const other = filtered.filter(d => !TOP.includes(d.nameFR))
    const out: { key: string; title: string; top: boolean; data: Destination[] }[] = []
    if (top.length > 0) out.push({ key: 'top', title: 'Destinations populaires', top: true, data: top })
    if (other.length > 0) out.push({ key: 'all', title: 'Toutes les destinations', top: false, data: other })
    return out
  }, [filtered])

  const onOpen = useCallback((slug: string) => {
    router.push({ pathname: '/esim/[country]', params: { country: slug } })
  }, [router])

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.topBar}>
        <Text style={s.topLogo}>Explorer</Text>
        <Text style={s.topCount}>{filtered.length} destinations</Text>
      </View>
      <View style={s.searchSection}>
        <View style={s.searchBox}>
          <Ionicons name="search-outline" size={17} color="#999" />
          <TextInput
            style={s.searchInput}
            placeholder="Rechercher une destination..."
            placeholderTextColor="#aaa"
            value={search}
            onChangeText={setSearch}
            autoCorrect={false}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={17} color="#ccc" />
            </TouchableOpacity>
          )}
        </View>
        <View style={s.filterRow}>
          {(['all','local','global'] as const).map(t => (
            <TouchableOpacity
              key={t}
              style={[s.filterBtn, typeFilter === t && s.filterBtnActive]}
              onPress={() => setTypeFilter(t)}
            >
              <Text style={[s.filterTxt, typeFilter === t && s.filterTxtActive]}>
                {t === 'all' ? 'Tous' : t === 'local' ? 'Régional' : 'Monde'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {loading ? (
        <View style={s.loader}>
          <ActivityIndicator color={COLORS.violet} size="large" />
          <Text style={s.loaderTxt}>Chargement...</Text>
        </View>
      ) : error && destinations.length === 0 ? (
        <View style={s.empty}>
          <Text style={s.emptyTxt}>Impossible de charger les destinations</Text>
          <TouchableOpacity onPress={() => { setLoading(true); fetchAll(true) }}>
            <Text style={s.emptyLink}>Réessayer</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <SectionList
          style={s.scroll}
          contentContainerStyle={s.listContent}
          sections={sections}
          keyExtractor={d => d.slug}
          renderSectionHeader={({ section }) => (
            <Text style={[s.secTitle, !section.top && s.secTitleSpaced]}>{section.title}</Text>
          )}
          renderItem={({ item, section }) => (
            <DestCard d={item} top={section.top} price={formatXpf(item.minPrice)} onOpen={onOpen} />
          )}
          stickySectionHeadersEnabled={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
          initialNumToRender={8}
          maxToRenderPerBatch={8}
          windowSize={7}
          removeClippedSubviews
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.violet} />}
          ListEmptyComponent={
            <View style={s.empty}>
              <Text style={s.emptyIcon}>🔍</Text>
              <Text style={s.emptyTxt}>Aucune destination trouvée</Text>
              <TouchableOpacity onPress={() => setSearch('')}>
                <Text style={s.emptyLink}>Effacer la recherche</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}
    </SafeAreaView>
  )
}

const DestCard = memo(function DestCard({ d, top, price, onOpen }: { d: Destination, top: boolean, price: string, onOpen: (slug: string) => void }) {
  return (
    <TouchableOpacity style={[s.card, top && s.cardTop]} onPress={() => onOpen(d.slug)}>
      <View style={s.cardHead}>
        <View style={{flex:1}}>
          <View style={s.nameRow}>
            <Text style={s.cardName}>{d.nameFR}</Text>
            {top && (
              <LinearGradient colors={GRADIENT} start={GRAD_START} end={GRAD_END} style={s.topBadge}>
                <Text style={s.topBadgeTxt}>TOP</Text>
              </LinearGradient>
            )}
            {d.comingSoon && (
              <LinearGradient colors={GRADIENT} start={GRAD_START} end={GRAD_END} style={s.topBadge}>
                <Text style={s.topBadgeTxt}>PROCHAINEMENT</Text>
              </LinearGradient>
            )}
          </View>
          <Text style={s.cardSub}>{d.count} forfait{d.count>1?'s':''} · jusqu'à {d.maxDays} jours</Text>
        </View>
        <View style={{alignItems:'flex-end'}}>
          <Text style={s.priceLabel}>A partir de</Text>
          <Text style={s.priceVal}>{price}</Text>
        </View>
      </View>
      <View style={s.cardFooter}>
        <LinearGradient colors={GRADIENT} start={GRAD_START} end={GRAD_END} style={s.buyBtn}>
          <Text style={s.buyBtnTxt}>Voir les forfaits</Text>
        </LinearGradient>
      </View>
    </TouchableOpacity>
  )
})

const s = StyleSheet.create({
  safe:{flex:1,backgroundColor:COLORS.bg},
  topBar:{backgroundColor:'#fff',paddingHorizontal:18,paddingVertical:12,flexDirection:'row',justifyContent:'space-between',alignItems:'center'},
  topLogo:{fontSize:20,fontWeight:'800',color:COLORS.violet},
  topCount:{fontSize:13,color:COLORS.textMuted,fontWeight:'600'},
  searchSection:{backgroundColor:'#fff',paddingHorizontal:18,paddingBottom:12},
  searchBox:{flexDirection:'row',alignItems:'center',gap:10,backgroundColor:COLORS.bg,borderRadius:RADIUS.md,paddingHorizontal:14,paddingVertical:11,marginBottom:10},
  searchInput:{flex:1,fontSize:14,color:'#333'},
  filterRow:{flexDirection:'row',gap:8},
  filterBtn:{paddingHorizontal:14,paddingVertical:6,borderRadius:20,borderWidth:1.5,borderColor:COLORS.border,backgroundColor:'#fff'},
  filterBtnActive:{borderColor:COLORS.violet,backgroundColor:'rgba(210,81,216,0.08)'},
  filterTxt:{fontSize:12,fontWeight:'600',color:'#888'},
  filterTxtActive:{color:COLORS.violet},
  loader:{flex:1,justifyContent:'center',alignItems:'center',gap:12},
  loaderTxt:{fontSize:14,color:COLORS.textMuted},
  scroll:{flex:1},
  listContent:{padding:16,paddingBottom:36},
  secTitle:{fontSize:15,fontWeight:'700',color:COLORS.text,marginBottom:10},
  secTitleSpaced:{marginTop:16},
  nameRow:{flexDirection:'row',alignItems:'center',gap:6},
  card:{backgroundColor:'#fff',borderRadius:16,padding:16,marginBottom:10,...SHADOW.card,borderWidth:1,borderColor:COLORS.border},
  cardTop:{borderColor:'rgba(210,81,216,0.25)'},
  cardHead:{flexDirection:'row',justifyContent:'space-between',alignItems:'flex-start',marginBottom:12},
  cardName:{fontSize:15,fontWeight:'700',color:COLORS.text},
  cardSub:{fontSize:12,color:COLORS.textMuted,marginTop:3},
  topBadge:{borderRadius:20,paddingHorizontal:7,paddingVertical:2},
  topBadgeTxt:{color:'#fff',fontSize:9,fontWeight:'800'},
  priceLabel:{fontSize:11,color:'#aaa',textAlign:'right'},
  priceVal:{fontSize:17,fontWeight:'800',color:COLORS.text},
  cardFooter:{flexDirection:'row',justifyContent:'flex-end'},
  buyBtn:{borderRadius:10,paddingHorizontal:16,paddingVertical:9},
  buyBtnTxt:{color:'#fff',fontSize:13,fontWeight:'700'},
  empty:{alignItems:'center',padding:40,gap:8},
  emptyIcon:{fontSize:32},
  emptyTxt:{fontWeight:'600',color:COLORS.textMuted},
  emptyLink:{color:COLORS.violet,fontWeight:'700',fontSize:13},
})
