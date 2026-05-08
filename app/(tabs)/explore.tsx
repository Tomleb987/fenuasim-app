import { View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { COLORS } from '../../constants/theme'

const PACKAGES = [
  { flag: '🇯🇵', country: 'Japon', code: 'JP', data: 'Illimite', days: 30, network: '5G', price: 3900, popular: true },
  { flag: '🇺🇸', country: 'Etats-Unis', code: 'US', data: '10 GB', days: 15, network: '4G LTE', price: 2800, popular: false },
  { flag: '🇦🇺', country: 'Australie', code: 'AU', data: '5 GB', days: 10, network: '4G LTE', price: 2100, popular: false },
  { flag: '🇫🇷', country: 'France', code: 'FR', data: '20 GB', days: 30, network: '5G', price: 1800, popular: false },
  { flag: '🇳🇿', country: 'N.-Zelande', code: 'NZ', data: '5 GB', days: 7, network: '4G LTE', price: 1600, popular: false },
  { flag: '🇬🇧', country: 'Royaume-Uni', code: 'GB', data: '10 GB', days: 15, network: '5G', price: 2200, popular: false },
]

export default function ExploreScreen() {
  const router = useRouter()
  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.topBar}>
        <Text style={s.topLogo}>Explorer</Text>
        <Ionicons name="options-outline" size={22} color="#333" />
      </View>
      <View style={s.searchSection}>
        <View style={s.searchBox}>
          <Ionicons name="search-outline" size={17} color="#999" />
          <TextInput
            style={s.searchInput}
            placeholder="Rechercher une destination..."
            placeholderTextColor="#aaa"
          />
        </View>
      </View>
      <ScrollView showsVerticalScrollIndicator={false} style={s.scroll}>
        <Text style={s.secTitle}>Toutes les destinations</Text>
        {PACKAGES.map((p) => (
          <TouchableOpacity key={p.code} style={s.planCard} onPress={() => router.push('/(tabs)/explore')}>
            <View style={s.planHead}>
              <View>
                <Text style={s.planProvider}>{p.flag}  {p.country}</Text>
                <Text style={s.planName}>Forfait {p.data}</Text>
              </View>
              {p.popular && (
                <LinearGradient colors={['#D251D8','#FD7F3C']} start={{x:0,y:0}} end={{x:1,y:0}} style={s.badge}>
                  <Text style={s.badgeTxt}>Populaire</Text>
                </LinearGradient>
              )}
            </View>
            <View style={s.chips}>
              <View style={s.chip}><Ionicons name="server-outline" size={13} color="#888" /><Text style={s.chipTxt}>{p.data}</Text></View>
              <View style={s.chip}><Ionicons name="calendar-outline" size={13} color="#888" /><Text style={s.chipTxt}>{p.days} jours</Text></View>
              <View style={s.chip}><Ionicons name="wifi-outline" size={13} color="#888" /><Text style={s.chipTxt}>{p.network}</Text></View>
            </View>
            <View style={s.planFooter}>
              <View>
                <Text style={s.priceLabel}>A partir de</Text>
                <Text style={s.priceVal}>{p.price.toLocaleString()} XPF</Text>
              </View>
              <TouchableOpacity>
                <LinearGradient colors={['#D251D8','#FD7F3C']} start={{x:0,y:0}} end={{x:1,y:0}} style={s.buyBtn}>
                  <Text style={s.buyBtnTxt}>Voir</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        ))}
        <View style={{height:20}} />
      </ScrollView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe:{flex:1,backgroundColor:COLORS.bg},
  topBar:{backgroundColor:'#fff',paddingHorizontal:18,paddingVertical:12,flexDirection:'row',justifyContent:'space-between',alignItems:'center'},
  topLogo:{fontSize:20,fontWeight:'800',color:COLORS.violet},
  searchSection:{backgroundColor:'#fff',paddingHorizontal:18,paddingBottom:14},
  searchBox:{flexDirection:'row',alignItems:'center',gap:10,backgroundColor:COLORS.bg,borderRadius:12,paddingHorizontal:14,paddingVertical:11},
  searchInput:{flex:1,fontSize:14,color:'#333'},
  scroll:{flex:1,padding:16},
  secTitle:{fontSize:16,fontWeight:'700',color:COLORS.text,marginBottom:12},
  planCard:{backgroundColor:'#fff',borderRadius:16,padding:16,marginBottom:12,shadowColor:'#000',shadowOpacity:0.05,shadowRadius:6,elevation:2},
  planHead:{flexDirection:'row',justifyContent:'space-between',alignItems:'flex-start',marginBottom:12},
  planProvider:{fontSize:12,fontWeight:'700',color:'#888',textTransform:'uppercase',letterSpacing:0.5},
  planName:{fontSize:15,fontWeight:'700',color:COLORS.text,marginTop:2},
  badge:{paddingHorizontal:10,paddingVertical:4,borderRadius:20},
  badgeTxt:{color:'#fff',fontSize:11,fontWeight:'700'},
  chips:{flexDirection:'row',gap:8,flexWrap:'wrap',marginBottom:12},
  chip:{backgroundColor:COLORS.bg,borderRadius:8,paddingHorizontal:10,paddingVertical:5,flexDirection:'row',alignItems:'center',gap:5},
  chipTxt:{fontSize:12,fontWeight:'600',color:'#444'},
  planFooter:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},
  priceLabel:{fontSize:12,color:'#aaa'},
  priceVal:{fontSize:20,fontWeight:'800',color:COLORS.text},
  buyBtn:{borderRadius:10,paddingHorizontal:20,paddingVertical:10},
  buyBtnTxt:{color:'#fff',fontSize:13,fontWeight:'700'},
})
