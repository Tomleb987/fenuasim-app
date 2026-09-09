import { useEffect, useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput, ActivityIndicator } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { supabase } from '../../lib/supabase'
import { COLORS, RADIUS, SHADOW } from '../../constants/theme'
import { getFR } from '../../lib/regionNames'
import { useCurrency } from '../../lib/currency'

const TOP = ["France","Canada","Etats-Unis","Australie","Nouvelle-Zelande"]

function normalize(str: string): string {
  return str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9 ]/g,'').trim()
}

function getDays(validity: string | null): number {
  if (!validity) return 0
  const n = parseInt(validity.toString().split(' ')[0])
  return isNaN(n) ? 0 : n
}

export default function ExploreScreen() {
  const router = useRouter()
  const [destinations, setDestinations] = useState<any[]>([])
  const [filtered, setFiltered] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState<'all'|'local'|'global'>('all')

  useEffect(() => { fetchAll() }, [])

  useEffect(() => {
    let list = destinations
    if (typeFilter !== 'all') list = list.filter(d => d.type === typeFilter)
    if (search.trim()) {
      const q = normalize(search)
      list = list.filter(d => normalize(d.nameFR).includes(q))
    }
    setFiltered(list)
  }, [search, destinations, typeFilter])

  async function fetchAll() {
    setLoading(true)
    // Le projet Supabase plafonne chaque requete a 1000 lignes (verifie : 2058
    // forfaits actifs reels au total, content-range renvoie toujours 0-999
    // meme en demandant plus). Sans pagination, les forfaits les plus chers
    // (au-dela des 1000 moins chers, tri croissant) etaient silencieusement
    // absents ici -- d'ou un comptage par destination inferieur a celui de la
    // fiche destination (qui filtre par slug et n'atteint jamais cette limite).
    const PAGE_SIZE = 1000
    let data: any[] = []
    let from = 0
    while (true) {
      const { data: page, error } = await supabase
        .from('airalo_packages')
        .select('id, name, region_fr, region, slug, data_amount, data_unit, validity, validity_days, final_price_xpf, is_unlimited, type, flag_url, status')
        .eq('status', 'active')
        .order('final_price_xpf', { ascending: true })
        .range(from, from + PAGE_SIZE - 1)
      if (error || !page) break
      data = data.concat(page)
      if (page.length < PAGE_SIZE) break
      from += PAGE_SIZE
    }

    if (data.length > 0) {
      const valid = data.filter(p => p.final_price_xpf && p.final_price_xpf > 0)
      // Regroupe par slug (l'identifiant reellement utilise pour naviguer et
      // filtrer la fiche destination : app/esim/[country].tsx fait .eq('slug', s))
      // et non par nom de region traduit -- un regroupement par texte peut se
      // fragmenter si region_fr/region varie (casse, accents) pour un meme
      // slug, ce qui desynchronise le compteur affiche ici du vrai nombre de
      // forfaits trouve sur la fiche destination.
      const map: Record<string, any> = {}
      valid.forEach(p => {
        const key = p.slug
        if (!map[key]) {
          map[key] = {
            nameFR: getFR(p.region_fr, p.region),
            slug: p.slug,
            type: p.type,
            flag_url: p.flag_url,
            minPrice: p.final_price_xpf,
            maxDays: getDays(p.validity),
            count: 1,
          }
        } else {
          if (p.final_price_xpf < map[key].minPrice) map[key].minPrice = p.final_price_xpf
          const d = getDays(p.validity)
          if (d > map[key].maxDays) map[key].maxDays = d
          map[key].count++
        }
      })
      const list = Object.values(map).sort((a,b) => a.nameFR.localeCompare(b.nameFR, 'fr'))
      setDestinations(list)
      setFiltered(list)
    }
    setLoading(false)
  }

  const topList = filtered.filter(d => TOP.includes(d.nameFR))
  const otherList = filtered.filter(d => !TOP.includes(d.nameFR))

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
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} style={s.scroll}>
          {topList.length > 0 && (
            <>
              <Text style={s.secTitle}>Destinations populaires</Text>
              {topList.map(d => <DestCard key={d.nameFR} d={d} router={router} top />)}
            </>
          )}
          {otherList.length > 0 && (
            <>
              <Text style={[s.secTitle,{marginTop:16}]}>Toutes les destinations</Text>
              {otherList.map(d => <DestCard key={d.nameFR} d={d} router={router} />)}
            </>
          )}
          {filtered.length === 0 && (
            <View style={s.empty}>
              <Text style={s.emptyIcon}>🔍</Text>
              <Text style={s.emptyTxt}>Aucune destination trouvée</Text>
              <TouchableOpacity onPress={() => setSearch('')}>
                <Text style={s.emptyLink}>Effacer la recherche</Text>
              </TouchableOpacity>
            </View>
          )}
          <View style={{height:20}} />
        </ScrollView>
      )}
    </SafeAreaView>
  )
}

function DestCard({ d, router, top = false }: { d: any, router: any, top?: boolean }) {
  const { formatXpf } = useCurrency()
  return (
    <TouchableOpacity
      style={[s.card, top && s.cardTop]}
      onPress={() => router.push({ pathname: '/esim/[country]', params: { country: d.slug } })}
    >
      <View style={s.cardHead}>
        <View style={{flex:1}}>
          <View style={{flexDirection:'row',alignItems:'center',gap:6}}>
            <Text style={s.cardName}>{d.nameFR}</Text>
            {top && (
              <LinearGradient colors={['#D251D8','#FD7F3C']} start={{x:0,y:0}} end={{x:1,y:0}} style={s.topBadge}>
                <Text style={s.topBadgeTxt}>TOP</Text>
              </LinearGradient>
            )}
          </View>
          <Text style={s.cardSub}>{d.count} forfait{d.count>1?'s':''} · jusqu'à {d.maxDays} jours</Text>
        </View>
        <View style={{alignItems:'flex-end'}}>
          <Text style={s.priceLabel}>A partir de</Text>
          <Text style={s.priceVal}>{formatXpf(d.minPrice)}</Text>
        </View>
      </View>
      <View style={s.cardFooter}>
        <LinearGradient colors={['#D251D8','#FD7F3C']} start={{x:0,y:0}} end={{x:1,y:0}} style={s.buyBtn}>
          <Text style={s.buyBtnTxt}>Voir les forfaits</Text>
        </LinearGradient>
      </View>
    </TouchableOpacity>
  )
}

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
  scroll:{flex:1,padding:16},
  secTitle:{fontSize:15,fontWeight:'700',color:COLORS.text,marginBottom:10},
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
