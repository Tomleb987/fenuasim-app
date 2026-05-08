import { useEffect, useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput, ActivityIndicator } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { supabase } from '../../lib/supabase'
import { COLORS } from '../../constants/theme'

const FR: Record<string, string> = {
  'Afghanistan': 'Afghanistan', 'Albania': 'Albanie', 'Algeria': 'Algerie',
  'Argentina': 'Argentine', 'Armenia': 'Armenie', 'Australia': 'Australie',
  'Austria': 'Autriche', 'Azerbaijan': 'Azerbaidjan', 'Bahrain': 'Bahrein',
  'Bangladesh': 'Bangladesh', 'Belarus': 'Bielorussie', 'Belgium': 'Belgique',
  'Bolivia': 'Bolivie', 'Bosnia': 'Bosnie', 'Brazil': 'Bresil',
  'Bulgaria': 'Bulgarie', 'Cambodia': 'Cambodge', 'Canada': 'Canada',
  'Chile': 'Chili', 'China': 'Chine', 'Colombia': 'Colombie',
  'Costa Rica': 'Costa Rica', 'Croatia': 'Croatie', 'Cyprus': 'Chypre',
  'Czech Republic': 'Republique Tcheque', 'Denmark': 'Danemark',
  'Ecuador': 'Equateur', 'Egypt': 'Egypte', 'Estonia': 'Estonie',
  'Ethiopia': 'Ethiopie', 'Finland': 'Finlande', 'France': 'France',
  'Georgia': 'Georgie', 'Germany': 'Allemagne', 'Ghana': 'Ghana',
  'Greece': 'Grece', 'Guatemala': 'Guatemala', 'Hong Kong': 'Hong Kong',
  'Hungary': 'Hongrie', 'Iceland': 'Islande', 'India': 'Inde',
  'Indonesia': 'Indonesie', 'Ireland': 'Irlande', 'Israel': 'Israel',
  'Italy': 'Italie', 'Japan': 'Japon', 'Jordan': 'Jordanie',
  'Kazakhstan': 'Kazakhstan', 'Kenya': 'Kenya', 'Kuwait': 'Koweit',
  'Kyrgyzstan': 'Kirghizistan', 'Laos': 'Laos', 'Latvia': 'Lettonie',
  'Lithuania': 'Lituanie', 'Luxembourg': 'Luxembourg', 'Macau': 'Macao',
  'Malaysia': 'Malaisie', 'Malta': 'Malte', 'Mexico': 'Mexique',
  'Moldova': 'Moldavie', 'Mongolia': 'Mongolie', 'Montenegro': 'Montenegro',
  'Morocco': 'Maroc', 'Myanmar': 'Myanmar', 'Nepal': 'Nepal',
  'Netherlands': 'Pays-Bas', 'New Zealand': 'Nouvelle-Zelande',
  'Nigeria': 'Nigeria', 'Norway': 'Norvege', 'Oman': 'Oman',
  'Pakistan': 'Pakistan', 'Panama': 'Panama', 'Paraguay': 'Paraguay',
  'Peru': 'Perou', 'Philippines': 'Philippines', 'Poland': 'Pologne',
  'Portugal': 'Portugal', 'Qatar': 'Qatar', 'Romania': 'Roumanie',
  'Russia': 'Russie', 'Saudi Arabia': 'Arabie Saoudite', 'Serbia': 'Serbie',
  'Singapore': 'Singapour', 'Slovakia': 'Slovaquie', 'Slovenia': 'Slovenie',
  'South Africa': 'Afrique du Sud', 'South Korea': 'Coree du Sud',
  'Spain': 'Espagne', 'Sri Lanka': 'Sri Lanka', 'Sweden': 'Suede',
  'Switzerland': 'Suisse', 'Taiwan': 'Taiwan', 'Tajikistan': 'Tadjikistan',
  'Tanzania': 'Tanzanie', 'Thailand': 'Thailande', 'Tunisia': 'Tunisie',
  'Turkey': 'Turquie', 'Uganda': 'Ouganda', 'Ukraine': 'Ukraine',
  'United Arab Emirates': 'Emirats Arabes Unis', 'United Kingdom': 'Royaume-Uni',
  'United States': 'Etats-Unis', 'Uruguay': 'Uruguay', 'Uzbekistan': 'Ouzbekistan',
  'Venezuela': 'Venezuela', 'Vietnam': 'Vietnam', 'Zimbabwe': 'Zimbabwe',
}

function toFR(name: string) {
  return FR[name] ?? name
}

export default function ExploreScreen() {
  const router = useRouter()
  const [destinations, setDestinations] = useState<any[]>([])
  const [filtered, setFiltered] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchDestinations() }, [])

  useEffect(() => {
    if (!search.trim()) { setFiltered(destinations); return }
    const q = search.toLowerCase()
    setFiltered(destinations.filter(d =>
      d.nameFR.toLowerCase().includes(q) ||
      d.region_fr?.toLowerCase().includes(q)
    ))
  }, [search, destinations])

  async function fetchDestinations() {
    setLoading(true)
    const { data } = await supabase
      .from('airalo_packages')
      .select('id, name, region_fr, slug, data_amount, data_unit, validity_days, final_price_xpf, is_unlimited, networks, type, status')
      .eq('status', 'active')
      .eq('type', 'local')
      .order('region_fr', { ascending: true })

    if (data) {
      const map: Record<string, any> = {}
      data.forEach(p => {
        if (!p.region_fr) return
        if (!map[p.region_fr] || p.final_price_xpf < map[p.region_fr].minPrice) {
          map[p.region_fr] = {
            region_fr: p.region_fr,
            nameFR: toFR(p.region_fr),
            slug: p.slug,
            minPrice: p.final_price_xpf,
            count: (map[p.region_fr]?.count ?? 0) + 1,
          }
        } else {
          map[p.region_fr].count++
        }
      })
      const list = Object.values(map).sort((a, b) => a.nameFR.localeCompare(b.nameFR))
      setDestinations(list)
      setFiltered(list)
    }
    setLoading(false)
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.topBar}>
        <Text style={s.topLogo}>Explorer</Text>
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
      </View>

      {loading ? (
        <View style={s.loader}>
          <ActivityIndicator color={COLORS.violet} size="large" />
          <Text style={s.loaderTxt}>Chargement des destinations...</Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} style={s.scroll}>
          <Text style={s.secTitle}>{filtered.length} destinations disponibles</Text>
          {filtered.map(d => (
            <TouchableOpacity
              key={d.region_fr}
              style={s.planCard}
              onPress={() => router.push({ pathname: '/esim/[country]', params: { country: d.slug ?? d.region_fr } })}
            >
              <View style={s.planHead}>
                <View style={{flex:1}}>
                  <Text style={s.planName}>{d.nameFR}</Text>
                  <Text style={s.planSub}>{d.count} forfait{d.count > 1 ? 's' : ''} disponible{d.count > 1 ? 's' : ''}</Text>
                </View>
                <View style={{alignItems:'flex-end'}}>
                  <Text style={s.priceLabel}>A partir de</Text>
                  <Text style={s.priceVal}>{Math.round(d.minPrice).toLocaleString()} XPF</Text>
                </View>
              </View>
              <View style={s.planFooter}>
                <LinearGradient colors={['#D251D8','#FD7F3C']} start={{x:0,y:0}} end={{x:1,y:0}} style={s.buyBtn}>
                  <Text style={s.buyBtnTxt}>Voir les forfaits</Text>
                </LinearGradient>
              </View>
            </TouchableOpacity>
          ))}
          <View style={{height:20}} />
        </ScrollView>
      )}
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe:{flex:1,backgroundColor:COLORS.bg},
  topBar:{backgroundColor:'#fff',paddingHorizontal:18,paddingVertical:12},
  topLogo:{fontSize:20,fontWeight:'800',color:COLORS.violet},
  searchSection:{backgroundColor:'#fff',paddingHorizontal:18,paddingBottom:14},
  searchBox:{flexDirection:'row',alignItems:'center',gap:10,backgroundColor:COLORS.bg,borderRadius:12,paddingHorizontal:14,paddingVertical:11},
  searchInput:{flex:1,fontSize:14,color:'#333'},
  loader:{flex:1,justifyContent:'center',alignItems:'center',gap:12},
  loaderTxt:{fontSize:14,color:COLORS.textMuted},
  scroll:{flex:1,padding:16},
  secTitle:{fontSize:14,fontWeight:'600',color:COLORS.textMuted,marginBottom:12},
  planCard:{backgroundColor:'#fff',borderRadius:16,padding:16,marginBottom:10,shadowColor:'#000',shadowOpacity:0.05,shadowRadius:6,elevation:2},
  planHead:{flexDirection:'row',justifyContent:'space-between',alignItems:'flex-start',marginBottom:12},
  planName:{fontSize:16,fontWeight:'700',color:COLORS.text},
  planSub:{fontSize:12,color:COLORS.textMuted,marginTop:2},
  priceLabel:{fontSize:11,color:'#aaa',textAlign:'right'},
  priceVal:{fontSize:18,fontWeight:'800',color:COLORS.text},
  planFooter:{flexDirection:'row',justifyContent:'flex-end'},
  buyBtn:{borderRadius:10,paddingHorizontal:16,paddingVertical:9},
  buyBtnTxt:{color:'#fff',fontSize:13,fontWeight:'700'},
})
