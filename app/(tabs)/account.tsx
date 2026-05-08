import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { COLORS } from '../../constants/theme'

const ESIM_ORDERS = [
  { id: '1', flag: '🇯🇵', country: 'Japon', plan: '5 GB · 7 jours', expires: '20 mai 2026', status: 'active', data_pct: 24 },
  { id: '2', flag: '🇫🇷', country: 'France', plan: '20 GB · 30 jours', expires: '1 mars 2026', status: 'expired', data_pct: 0 },
]

const INSURANCE_ORDERS = [
  { id: '1', formula: 'AVA Essentiel', destination: 'Japon', dates: '10 - 20 mai 2026', status: 'active' },
]

export default function AccountScreen() {
  const router = useRouter()

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <LinearGradient colors={['#D251D8','#FD7F3C']} start={{x:0,y:0}} end={{x:1,y:1}} style={s.hero}>
        <View style={s.heroRow}>
          <View style={s.avatar}>
            <Text style={s.avatarTxt}>T</Text>
          </View>
          <View style={{flex:1}}>
            <Text style={s.heroName}>Thomas</Text>
            <Text style={s.heroEmail}>thomas@fenuasim.com</Text>
          </View>
          <TouchableOpacity style={s.settingsBtn}>
            <Ionicons name="settings-outline" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>

        <Text style={s.secTitle}>Mes eSIM</Text>
        {ESIM_ORDERS.map(o => (
          <View key={o.id} style={s.card}>
            <View style={s.cardHead}>
              <Text style={s.cardFlag}>{o.flag}</Text>
              <View style={{flex:1}}>
                <Text style={s.cardTitle}>{o.country}</Text>
                <Text style={s.cardSub}>{o.plan}</Text>
              </View>
              <View style={[s.pill, o.status === 'active' ? s.pillActive : s.pillExpired]}>
                <Text style={[s.pillTxt, o.status === 'active' ? s.pillActiveTxt : s.pillExpiredTxt]}>
                  {o.status === 'active' ? 'Actif' : 'Expire'}
                </Text>
              </View>
            </View>
            {o.status === 'active' && (
              <>
                <View style={s.barLabels}>
                  <Text style={s.barLabel}>{o.data_pct}% utilise</Text>
                  <Text style={s.barLabel}>Expire le {o.expires}</Text>
                </View>
                <View style={s.barTrack}>
                  <LinearGradient colors={['#D251D8','#FD7F3C']} start={{x:0,y:0}} end={{x:1,y:0}} style={[s.barFill, {width: o.data_pct + '%'}]} />
                </View>
                <TouchableOpacity style={s.rechargeBtn} onPress={() => router.push('/esim/JP')}>
                  <Text style={s.rechargeTxt}>Recharger</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        ))}

        <Text style={s.secTitle}>Mes assurances</Text>
        {INSURANCE_ORDERS.map(o => (
          <View key={o.id} style={s.card}>
            <View style={s.cardHead}>
              <View style={s.shieldIcon}>
                <Ionicons name="shield-checkmark-outline" size={22} color="#FD7F3C" />
              </View>
              <View style={{flex:1}}>
                <Text style={s.cardTitle}>{o.formula}</Text>
                <Text style={s.cardSub}>{o.destination} · {o.dates}</Text>
              </View>
              <View style={[s.pill, s.pillActive]}>
                <Text style={[s.pillTxt, s.pillActiveTxt]}>Active</Text>
              </View>
            </View>
            <TouchableOpacity style={s.attestBtn}>
              <Ionicons name="document-text-outline" size={16} color={COLORS.violet} />
              <Text style={s.attestTxt}>Voir l'attestation PDF</Text>
            </TouchableOpacity>
          </View>
        ))}

        <Text style={s.secTitle}>Actions rapides</Text>
        <View style={s.actionsGrid}>
          <TouchableOpacity style={s.actionCard} onPress={() => router.push('/(tabs)/explore')}>
            <View style={[s.actionIcon, {backgroundColor:'rgba(210,81,216,0.1)'}]}>
              <Ionicons name="sim-card-outline" size={22} color={COLORS.violet} />
            </View>
            <Text style={s.actionLabel}>Nouvelle eSIM</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.actionCard} onPress={() => router.push('/insurance/form')}>
            <View style={[s.actionIcon, {backgroundColor:'rgba(253,127,60,0.1)'}]}>
              <Ionicons name="shield-outline" size={22} color="#FD7F3C" />
            </View>
            <Text style={s.actionLabel}>Assurance voyage</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.actionCard}>
            <View style={[s.actionIcon, {backgroundColor:'rgba(10,135,84,0.1)'}]}>
              <Ionicons name="headset-outline" size={22} color={COLORS.success} />
            </View>
            <Text style={s.actionLabel}>Support</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.actionCard}>
            <View style={[s.actionIcon, {backgroundColor:'rgba(136,135,128,0.15)'}]}>
              <Ionicons name="log-out-outline" size={22} color="#888" />
            </View>
            <Text style={s.actionLabel}>Deconnexion</Text>
          </TouchableOpacity>
        </View>

        <View style={{height:20}} />
      </ScrollView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe:{flex:1,backgroundColor:COLORS.bg},
  hero:{padding:20,paddingBottom:24},
  heroRow:{flexDirection:'row',alignItems:'center',gap:14},
  avatar:{width:52,height:52,borderRadius:26,backgroundColor:'rgba(255,255,255,0.25)',justifyContent:'center',alignItems:'center'},
  avatarTxt:{color:'#fff',fontSize:22,fontWeight:'800'},
  heroName:{color:'#fff',fontSize:18,fontWeight:'800'},
  heroEmail:{color:'rgba(255,255,255,0.8)',fontSize:13,marginTop:2},
  settingsBtn:{backgroundColor:'rgba(255,255,255,0.2)',borderRadius:20,width:36,height:36,justifyContent:'center',alignItems:'center'},
  scroll:{flex:1,padding:16},
  secTitle:{fontSize:16,fontWeight:'700',color:COLORS.text,marginBottom:12,marginTop:4},
  card:{backgroundColor:'#fff',borderRadius:16,padding:16,marginBottom:10,shadowColor:'#000',shadowOpacity:0.05,shadowRadius:6,elevation:2},
  cardHead:{flexDirection:'row',alignItems:'center',gap:10,marginBottom:4},
  cardFlag:{fontSize:28},
  cardTitle:{fontSize:14,fontWeight:'700',color:COLORS.text},
  cardSub:{fontSize:12,color:COLORS.textMuted,marginTop:2},
  pill:{paddingHorizontal:10,paddingVertical:4,borderRadius:20},
  pillTxt:{fontSize:11,fontWeight:'700'},
  pillActive:{backgroundColor:COLORS.successBg},
  pillActiveTxt:{color:COLORS.success},
  pillExpired:{backgroundColor:'#F0F0F0'},
  pillExpiredTxt:{color:'#999'},
  barLabels:{flexDirection:'row',justifyContent:'space-between',marginTop:10,marginBottom:5},
  barLabel:{fontSize:11,color:COLORS.textMuted},
  barTrack:{backgroundColor:'#F0F0F0',borderRadius:20,height:6,overflow:'hidden'},
  barFill:{height:'100%',borderRadius:20},
  rechargeBtn:{marginTop:10,alignSelf:'flex-start',borderWidth:1.5,borderColor:COLORS.violet,borderRadius:20,paddingHorizontal:14,paddingVertical:6},
  rechargeTxt:{color:COLORS.violet,fontSize:12,fontWeight:'700'},
  shieldIcon:{width:44,height:44,borderRadius:12,backgroundColor:'rgba(253,127,60,0.1)',justifyContent:'center',alignItems:'center'},
  attestBtn:{flexDirection:'row',alignItems:'center',gap:6,marginTop:10,paddingTop:10,borderTopWidth:0.5,borderTopColor:'#f0f0f0'},
  attestTxt:{color:COLORS.violet,fontSize:13,fontWeight:'600'},
  actionsGrid:{flexDirection:'row',flexWrap:'wrap',gap:10},
  actionCard:{backgroundColor:'#fff',borderRadius:16,padding:14,alignItems:'center',width:'47%',shadowColor:'#000',shadowOpacity:0.05,shadowRadius:6,elevation:2},
  actionIcon:{width:44,height:44,borderRadius:12,justifyContent:'center',alignItems:'center',marginBottom:8},
  actionLabel:{fontSize:13,fontWeight:'600',color:COLORS.text,textAlign:'center'},
})
