import { useEffect, useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { supabase } from '../../lib/supabase'
import { COLORS } from '../../constants/theme'
import dayjs from 'dayjs'

export default function HomeScreen() {
  const router = useRouter()
  const [email, setEmail] = useState<string | null>(null)
  const [esims, setEsims] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user?.email) return
    setEmail(session.user.email)
    const { data } = await supabase
      .from('airalo_orders')
      .select('*')
      .eq('email', session.user.email)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(2)
    if (data) setEsims(data)
    setLoading(false)
  }

  const firstName = email?.split('@')[0] ?? ''

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <LinearGradient colors={['#D251D8','#FD7F3C']} start={{x:0,y:0}} end={{x:1,y:1}} style={s.header}>
          <View style={s.headerRow}>
            <View>
              <Text style={s.greeting}>Bonjour 👋</Text>
              <Text style={s.name}>{firstName}</Text>
            </View>
            <TouchableOpacity style={s.notifBtn} onPress={() => router.push('/(tabs)/account')}>
              <Ionicons name="person-outline" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </LinearGradient>

        <View style={s.content}>
          {/* Bouton principal */}
          <TouchableOpacity style={s.mainCta} onPress={() => router.push('/(tabs)/explore')}>
            <LinearGradient colors={['#D251D8','#FD7F3C']} start={{x:0,y:0}} end={{x:1,y:0}} style={s.mainCtaGrad}>
              <Ionicons name="search-outline" size={22} color="#fff" />
              <Text style={s.mainCtaTxt}>Trouver mon eSIM</Text>
              <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.7)" />
            </LinearGradient>
          </TouchableOpacity>

          {/* eSIM actives */}
          {esims.length > 0 && (
            <>
              <View style={s.secHead}>
                <Text style={s.secTitle}>Mes eSIM actives</Text>
                <TouchableOpacity onPress={() => router.push('/(tabs)/account')}>
                  <Text style={s.secLink}>Voir tout</Text>
                </TouchableOpacity>
              </View>
              {esims.map(e => (
                <View key={e.id} style={s.esimCard}>
                  <View style={s.esimHead}>
                    <View style={s.simIcon}>
                      <Ionicons name="sim-card-outline" size={22} color={COLORS.violet} />
                    </View>
                    <View style={{flex:1}}>
                      <Text style={s.esimTitle}>{e.package_id ?? 'eSIM'}</Text>
                      <Text style={s.esimSub}>
                        {e.expires_at ? 'Expire le ' + dayjs(e.expires_at).format('DD/MM/YYYY') : 'Active'}
                      </Text>
                    </View>
                    <View style={s.pillOk}><Text style={s.pillOkTxt}>Actif</Text></View>
                  </View>
                </View>
              ))}
            </>
          )}

          {/* Actions rapides */}
          <View style={s.secHead}>
            <Text style={s.secTitle}>Actions rapides</Text>
          </View>
          <View style={s.grid}>
            <TouchableOpacity style={s.gridCard} onPress={() => router.push('/(tabs)/explore')}>
              <View style={[s.gridIcon,{backgroundColor:'rgba(210,81,216,0.1)'}]}>
                <Ionicons name="sim-card-outline" size={24} color={COLORS.violet} />
              </View>
              <Text style={s.gridLabel}>Nouvelle eSIM</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.gridCard} onPress={() => router.push('/insurance/form')}>
              <View style={[s.gridIcon,{backgroundColor:'rgba(253,127,60,0.1)'}]}>
                <Ionicons name="shield-outline" size={24} color="#FD7F3C" />
              </View>
              <Text style={s.gridLabel}>Assurance voyage</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.gridCard} onPress={() => router.push('/(tabs)/account')}>
              <View style={[s.gridIcon,{backgroundColor:'rgba(10,135,84,0.1)'}]}>
                <Ionicons name="receipt-outline" size={24} color={COLORS.success} />
              </View>
              <Text style={s.gridLabel}>Mes commandes</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.gridCard}>
              <View style={[s.gridIcon,{backgroundColor:'rgba(136,135,128,0.15)'}]}>
                <Ionicons name="headset-outline" size={24} color="#888" />
              </View>
              <Text style={s.gridLabel}>Support</Text>
            </TouchableOpacity>
          </View>

          {/* Banner assurance */}
          <TouchableOpacity onPress={() => router.push('/insurance/form')}>
            <View style={s.discoverCard}>
              <LinearGradient colors={['#FD7F3C','#D251D8']} style={s.discoverBanner}>
                <Text style={s.discoverBannerTxt}>Assurance voyage AVA</Text>
              </LinearGradient>
              <View style={s.discoverBody}>
                <View>
                  <Text style={s.discoverTitle}>Protegez votre voyage</Text>
                  <Text style={s.discoverSub}>Annulation · Medical · Rapatriement</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#ccc" />
              </View>
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe:{flex:1,backgroundColor:COLORS.bg},
  header:{padding:20,paddingBottom:24},
  headerRow:{flexDirection:'row',justifyContent:'space-between',alignItems:'flex-start'},
  greeting:{color:'rgba(255,255,255,0.85)',fontSize:13},
  name:{color:'#fff',fontSize:22,fontWeight:'800',marginTop:2},
  notifBtn:{backgroundColor:'rgba(255,255,255,0.2)',borderRadius:20,width:36,height:36,justifyContent:'center',alignItems:'center'},
  content:{padding:16},
  mainCta:{borderRadius:16,overflow:'hidden',marginBottom:20,marginTop:-12,shadowColor:'#D251D8',shadowOpacity:0.3,shadowRadius:8,elevation:4},
  mainCtaGrad:{flexDirection:'row',alignItems:'center',padding:18,gap:12},
  mainCtaTxt:{flex:1,color:'#fff',fontSize:17,fontWeight:'800'},
  secHead:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:12,marginTop:4},
  secTitle:{fontSize:16,fontWeight:'700',color:COLORS.text},
  secLink:{fontSize:13,fontWeight:'600',color:COLORS.violet},
  esimCard:{backgroundColor:'#fff',borderRadius:16,padding:16,marginBottom:10,shadowColor:'#000',shadowOpacity:0.05,shadowRadius:6,elevation:2},
  esimHead:{flexDirection:'row',alignItems:'center',gap:10},
  simIcon:{width:44,height:44,borderRadius:12,backgroundColor:'rgba(210,81,216,0.1)',justifyContent:'center',alignItems:'center'},
  esimTitle:{fontSize:14,fontWeight:'700',color:COLORS.text},
  esimSub:{fontSize:12,color:COLORS.textMuted,marginTop:2},
  pillOk:{backgroundColor:COLORS.successBg,paddingHorizontal:10,paddingVertical:4,borderRadius:20},
  pillOkTxt:{color:COLORS.success,fontSize:11,fontWeight:'700'},
  grid:{flexDirection:'row',flexWrap:'wrap',gap:10,marginBottom:16},
  gridCard:{backgroundColor:'#fff',borderRadius:16,padding:14,alignItems:'center',width:'47%',shadowColor:'#000',shadowOpacity:0.05,shadowRadius:6,elevation:2},
  gridIcon:{width:44,height:44,borderRadius:12,justifyContent:'center',alignItems:'center',marginBottom:8},
  gridLabel:{fontSize:13,fontWeight:'600',color:COLORS.text,textAlign:'center'},
  discoverCard:{backgroundColor:'#fff',borderRadius:16,overflow:'hidden',shadowColor:'#000',shadowOpacity:0.05,shadowRadius:6,elevation:2},
  discoverBanner:{height:80,justifyContent:'center',alignItems:'center'},
  discoverBannerTxt:{color:'#fff',fontSize:14,fontWeight:'800'},
  discoverBody:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',padding:14},
  discoverTitle:{fontSize:14,fontWeight:'700',color:COLORS.text},
  discoverSub:{fontSize:12,color:COLORS.textMuted,marginTop:2},
})
