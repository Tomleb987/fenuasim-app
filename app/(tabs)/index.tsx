import { useEffect, useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { supabase } from '../../lib/supabase'
import { COLORS } from '../../constants/theme'
import { useDataUsage } from '../../hooks/useDataUsage'
import dayjs from 'dayjs'

const TOP_DEST = [
  { nameFR: 'Japon', slug: 'japan', c1: '#FF6B6B', c2: '#FF8E53', flag: '🇯🇵' },
  { nameFR: 'Etats-Unis', slug: 'united-states', c1: '#4776E6', c2: '#8E54E9', flag: '🇺🇸' },
  { nameFR: 'Australie', slug: 'australia', c1: '#11998e', c2: '#38ef7d', flag: '🇦🇺' },
  { nameFR: 'France', slug: 'france', c1: '#2980B9', c2: '#6DD5FA', flag: '🇫🇷' },
  { nameFR: 'N.-Zelande', slug: 'new-zealand', c1: '#093028', c2: '#237A57', flag: '🇳🇿' },
  { nameFR: 'Royaume-Uni', slug: 'united-kingdom', c1: '#141E30', c2: '#243B55', flag: '🇬🇧' },
]

export default function HomeScreen() {
  const router = useRouter()
  const [esims, setEsims] = useState<any[]>([])
  const { fetchUsage, getPct, getUsedStr, getRemainingStr, isLoading } = useDataUsage()

  useEffect(() => { loadData() }, [])

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
    }
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>

        <LinearGradient colors={['#D251D8','#FD7F3C']} start={{x:0,y:0}} end={{x:1,y:1}} style={s.header}>
          <View style={s.headerRow}>
            <View>
              <Text style={s.greeting}>Bonjour 👋</Text>
              <Text style={s.name}>Bienvenue sur FENUASIM</Text>
            </View>
            <TouchableOpacity style={s.avatarBtn} onPress={() => router.push('/(tabs)/account')}>
              <Ionicons name="person-outline" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </LinearGradient>

        <View style={s.content}>

          <TouchableOpacity style={s.mainCta} onPress={() => router.push('/(tabs)/explore')}>
            <LinearGradient colors={['#D251D8','#FD7F3C']} start={{x:0,y:0}} end={{x:1,y:0}} style={s.mainCtaGrad}>
              <Ionicons name="search-outline" size={22} color="#fff" />
              <Text style={s.mainCtaTxt}>Trouver une eSIM</Text>
              <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.7)" />
            </LinearGradient>
          </TouchableOpacity>

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
                <LinearGradient colors={[d.c1, d.c2]} style={s.destCard}>
                  <Text style={s.destFlag}>{d.flag}</Text>
                  <Text style={s.destName}>{d.nameFR}</Text>
                </LinearGradient>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {esims.length > 0 && (
            <>
              <View style={s.secHead}>
                <Text style={s.secTitle}>Mes eSIM</Text>
                <TouchableOpacity onPress={() => router.push('/(tabs)/account')}>
                  <Text style={s.secLink}>Voir tout</Text>
                </TouchableOpacity>
              </View>
              {esims.map(e => {
                const iccid = e.sim_iccid
                const pct = iccid ? getPct(iccid) : 0
                const loading = iccid ? isLoading(iccid) : false
                const used = iccid ? getUsedStr(iccid) : null
                const remaining = iccid ? getRemainingStr(iccid) : null
                const isExpired = e.expires_at && dayjs(e.expires_at).isBefore(dayjs())
                const statusColor = isExpired ? '#999' : COLORS.success
                const statusLabel = isExpired ? 'Expiree' : 'Active'

                return (
                  <View key={e.id} style={s.esimCard}>
                    <View style={s.esimHead}>
                      <View style={s.simIcon}>
                        <Ionicons name="wifi-outline" size={20} color={COLORS.violet} />
                      </View>
                      <View style={{flex:1}}>
                        <Text style={s.esimTitle}>{e.package_id ?? 'eSIM'}</Text>
                        <Text style={s.esimSub}>
                          {e.expires_at
                            ? (isExpired ? 'Expiree le ' : 'Expire le ') + dayjs(e.expires_at).format('DD/MM/YYYY')
                            : 'Commandee le ' + dayjs(e.created_at).format('DD/MM/YYYY')
                          }
                        </Text>
                      </View>
                      <View style={[s.pill,{backgroundColor: statusColor + '20'}]}>
                        <Text style={[s.pillTxt,{color: statusColor}]}>{statusLabel}</Text>
                      </View>
                    </View>

                    {loading ? (
                      <View style={s.consoRow}>
                        <ActivityIndicator size="small" color={COLORS.violet} />
                        <Text style={s.consoLoading}>Chargement conso...</Text>
                      </View>
                    ) : used && used !== '-' ? (
                      <View style={s.consoWrap}>
                        <View style={s.consoLabels}>
                          <Text style={s.consoLabel}>Utilise</Text>
                          <Text style={s.consoLabel}>Restant</Text>
                        </View>
                        <View style={s.consoValues}>
                          <Text style={s.consoValUsed}>{used}</Text>
                          <Text style={s.consoValRem}>{remaining}</Text>
                        </View>
                        <View style={s.barTrack}>
                          <LinearGradient
                            colors={pct > 80 ? ['#FD7F3C','#e74c3c'] : ['#D251D8','#FD7F3C']}
                            start={{x:0,y:0}} end={{x:1,y:0}}
                            style={[s.barFill,{width: pct + '%'}]}
                          />
                        </View>
                        <View style={s.consoFooter}>
                          <View style={s.consoGaugeLabels}>
                            <Text style={s.consoGaugeLabel}>0%</Text>
                            <Text style={s.consoGaugeLabel}>50%</Text>
                            <Text style={s.consoGaugeLabel}>100%</Text>
                          </View>
                          <View style={[s.pctBadge, {backgroundColor: pct > 80 ? '#FDECEA' : pct > 50 ? '#FFF3DC' : '#E6F9F2'}]}>
                            <Text style={[s.pctBadgeTxt, {color: pct > 80 ? '#B00020' : pct > 50 ? '#9A6200' : COLORS.success}]}>
                              {pct}% utilise
                            </Text>
                          </View>
                        </View>
                      </View>
                    ) : (
                      <View style={s.forfaitRow}>
                        <View style={s.chip}>
                          <Ionicons name="server-outline" size={13} color={COLORS.violet} />
                          <Text style={s.chipTxt}>{e.data_balance ?? '-'}</Text>
                        </View>
                      </View>
                    )}

                    {e.apple_installation_url && (
                      <TouchableOpacity
                        style={s.installBtn}
                        onPress={() => {
                          const { Linking } = require('react-native')
                          Linking.openURL(e.apple_installation_url)
                        }}
                      >
                        <Ionicons name="download-outline" size={14} color={COLORS.violet} />
                        <Text style={s.installTxt}>Installer l'eSIM</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )
              })}
            </>
          )}

          <View style={s.secHead}>
            <Text style={s.secTitle}>Actions rapides</Text>
          </View>
          <View style={s.grid}>
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
  header:{padding:20,paddingBottom:24},
  headerRow:{flexDirection:'row',justifyContent:'space-between',alignItems:'flex-start'},
  greeting:{color:'rgba(255,255,255,0.85)',fontSize:13},
  name:{color:'#fff',fontSize:20,fontWeight:'800',marginTop:2},
  avatarBtn:{backgroundColor:'rgba(255,255,255,0.2)',borderRadius:20,width:36,height:36,justifyContent:'center',alignItems:'center'},
  content:{padding:16},
  mainCta:{borderRadius:16,overflow:'hidden',marginBottom:20,marginTop:-12,shadowColor:'#D251D8',shadowOpacity:0.3,shadowRadius:8,elevation:4},
  mainCtaGrad:{flexDirection:'row',alignItems:'center',padding:18,gap:12},
  mainCtaTxt:{flex:1,color:'#fff',fontSize:17,fontWeight:'800'},
  secHead:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:12,marginTop:4},
  secTitle:{fontSize:16,fontWeight:'700',color:COLORS.text},
  secLink:{fontSize:13,fontWeight:'600',color:COLORS.violet},
  destScroll:{marginBottom:20},
  destCard:{width:110,height:80,borderRadius:14,marginRight:10,justifyContent:'flex-end',padding:8,alignItems:'center'},
  destFlag:{fontSize:30,marginBottom:2},
  destName:{color:'#fff',fontSize:11,fontWeight:'700',textAlign:'center'},
  esimCard:{backgroundColor:'#fff',borderRadius:16,padding:16,marginBottom:10,shadowColor:'#000',shadowOpacity:0.05,shadowRadius:6,elevation:2},
  esimHead:{flexDirection:'row',alignItems:'center',gap:10,marginBottom:10},
  simIcon:{width:40,height:40,borderRadius:12,backgroundColor:'rgba(210,81,216,0.1)',justifyContent:'center',alignItems:'center'},
  esimTitle:{fontSize:14,fontWeight:'700',color:COLORS.text},
  esimSub:{fontSize:12,color:COLORS.textMuted,marginTop:2},
  pill:{paddingHorizontal:10,paddingVertical:4,borderRadius:20},
  pillTxt:{fontSize:11,fontWeight:'700'},
  consoRow:{flexDirection:'row',alignItems:'center',gap:8,paddingVertical:4},
  consoLoading:{fontSize:12,color:COLORS.textMuted},
  consoWrap:{marginBottom:6},
  consoLabels:{flexDirection:'row',justifyContent:'space-between',marginBottom:6},
  consoLabel:{fontSize:12,color:COLORS.textMuted},
  barTrack:{backgroundColor:'#F0F0F0',borderRadius:20,height:7,overflow:'hidden',marginBottom:4},
  barFill:{height:'100%',borderRadius:20},
  consoValues:{flexDirection:'row',justifyContent:'space-between',marginBottom:8},
  consoValUsed:{fontSize:16,fontWeight:'800',color:COLORS.violet},
  consoValRem:{fontSize:16,fontWeight:'800',color:COLORS.success},
  consoFooter:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginTop:6},
  consoGaugeLabels:{flexDirection:'row',gap:24},
  consoGaugeLabel:{fontSize:10,color:'#ccc',fontWeight:'600'},
  pctBadge:{paddingHorizontal:10,paddingVertical:3,borderRadius:20},
  pctBadgeTxt:{fontSize:11,fontWeight:'700'},
  forfaitRow:{flexDirection:'row',gap:8},
  chip:{flexDirection:'row',alignItems:'center',gap:5,backgroundColor:COLORS.bg,borderRadius:8,paddingHorizontal:10,paddingVertical:5},
  chipTxt:{fontSize:12,fontWeight:'600',color:'#555'},
  installBtn:{flexDirection:'row',alignItems:'center',gap:6,paddingTop:8,borderTopWidth:0.5,borderTopColor:'#f0f0f0',marginTop:6},
  installTxt:{color:COLORS.violet,fontSize:13,fontWeight:'600'},
  grid:{flexDirection:'row',flexWrap:'wrap',gap:10},
  gridCard:{backgroundColor:'#fff',borderRadius:16,padding:14,alignItems:'center',width:'47%',shadowColor:'#000',shadowOpacity:0.05,shadowRadius:6,elevation:2},
  gridIcon:{width:44,height:44,borderRadius:12,justifyContent:'center',alignItems:'center',marginBottom:8},
  gridLabel:{fontSize:13,fontWeight:'600',color:COLORS.text,textAlign:'center'},
})
