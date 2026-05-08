import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Linking } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { COLORS } from '../../constants/theme'
import { useUserData } from '../../hooks/useUserData'
import { supabase } from '../../lib/supabase'
import dayjs from 'dayjs'

export default function AccountScreen() {
  const router = useRouter()
  const { email, esimOrders, insurances, loading } = useUserData()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.replace('/(auth)/login')
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <LinearGradient colors={['#D251D8','#FD7F3C']} start={{x:0,y:0}} end={{x:1,y:1}} style={s.hero}>
        <View style={s.heroRow}>
          <View style={s.avatar}>
            <Text style={s.avatarTxt}>{email ? email[0].toUpperCase() : '?'}</Text>
          </View>
          <View style={{flex:1}}>
            <Text style={s.heroName}>{email ?? 'Mon compte'}</Text>
            <Text style={s.heroEmail}>{email ?? ''}</Text>
          </View>
          <TouchableOpacity style={s.settingsBtn} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>

        <Text style={s.secTitle}>Mes eSIM {loading ? '...' : `(${esimOrders.length})`}</Text>
        {esimOrders.length === 0 && !loading && (
          <View style={s.emptyCard}>
            <Text style={s.emptyTxt}>Aucune eSIM pour le moment</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/explore')}>
              <Text style={s.emptyLink}>Acheter une eSIM →</Text>
            </TouchableOpacity>
          </View>
        )}
        {esimOrders.map(o => (
          <View key={o.id} style={s.card}>
            <View style={s.cardHead}>
              <View style={s.simIcon}>
                <Ionicons name="sim-card-outline" size={22} color={COLORS.violet} />
              </View>
              <View style={{flex:1}}>
                <Text style={s.cardTitle}>{o.package_id ?? 'eSIM'}</Text>
                <Text style={s.cardSub}>
                  {o.expires_at ? 'Expire le ' + dayjs(o.expires_at).format('DD/MM/YYYY') : 'Sans expiration'}
                </Text>
              </View>
              <View style={[s.pill, o.status === 'active' ? s.pillActive : s.pillExpired]}>
                <Text style={[s.pillTxt, o.status === 'active' ? s.pillActiveTxt : s.pillExpiredTxt]}>
                  {o.status === 'active' ? 'Actif' : o.status ?? 'Inconnu'}
                </Text>
              </View>
            </View>
            {o.apple_installation_url && (
              <TouchableOpacity style={s.installBtn} onPress={() => Linking.openURL(o.apple_installation_url)}>
                <Ionicons name="download-outline" size={15} color={COLORS.violet} />
                <Text style={s.installTxt}>Installer l'eSIM</Text>
              </TouchableOpacity>
            )}
          </View>
        ))}

        <Text style={s.secTitle}>Mes assurances {loading ? '...' : `(${insurances.length})`}</Text>
        {insurances.length === 0 && !loading && (
          <View style={s.emptyCard}>
            <Text style={s.emptyTxt}>Aucune assurance pour le moment</Text>
            <TouchableOpacity onPress={() => router.push('/insurance/form')}>
              <Text style={s.emptyLink}>Souscrire une assurance →</Text>
            </TouchableOpacity>
          </View>
        )}
        {insurances.map(o => (
          <View key={o.id} style={s.card}>
            <View style={s.cardHead}>
              <View style={s.shieldIcon}>
                <Ionicons name="shield-checkmark-outline" size={22} color="#FD7F3C" />
              </View>
              <View style={{flex:1}}>
                <Text style={s.cardTitle}>{o.product_type ?? 'AVA'}</Text>
                <Text style={s.cardSub}>
                  {o.start_date && o.end_date
                    ? dayjs(o.start_date).format('DD/MM/YYYY') + ' - ' + dayjs(o.end_date).format('DD/MM/YYYY')
                    : ''}
                </Text>
              </View>
              <View style={[s.pill, o.status === 'active' ? s.pillActive : s.pillExpired]}>
                <Text style={[s.pillTxt, o.status === 'active' ? s.pillActiveTxt : s.pillExpiredTxt]}>
                  {o.status === 'active' ? 'Active' : o.status ?? 'Inconnue'}
                </Text>
              </View>
            </View>
            {o.attestation_url_ava && (
              <TouchableOpacity style={s.installBtn} onPress={() => Linking.openURL(o.attestation_url_ava)}>
                <Ionicons name="document-text-outline" size={15} color="#FD7F3C" />
                <Text style={[s.installTxt, {color:'#FD7F3C'}]}>Voir l'attestation PDF</Text>
              </TouchableOpacity>
            )}
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
          <TouchableOpacity style={s.actionCard} onPress={handleLogout}>
            <View style={[s.actionIcon, {backgroundColor:'rgba(136,135,128,0.15)'}]}>
              <Ionicons name="log-out-outline" size={22} color="#888" />
            </View>
            <Text style={s.actionLabel}>Deconnexion</Text>
          </TouchableOpacity>
        </View>

        <View style={{height:30}} />
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
  heroName:{color:'#fff',fontSize:16,fontWeight:'800'},
  heroEmail:{color:'rgba(255,255,255,0.8)',fontSize:12,marginTop:2},
  settingsBtn:{backgroundColor:'rgba(255,255,255,0.2)',borderRadius:20,width:36,height:36,justifyContent:'center',alignItems:'center'},
  scroll:{flex:1,padding:16},
  secTitle:{fontSize:16,fontWeight:'700',color:COLORS.text,marginBottom:12,marginTop:4},
  emptyCard:{backgroundColor:'#fff',borderRadius:16,padding:16,marginBottom:10,alignItems:'center',shadowColor:'#000',shadowOpacity:0.05,shadowRadius:6,elevation:2},
  emptyTxt:{fontSize:13,color:COLORS.textMuted,marginBottom:8},
  emptyLink:{fontSize:13,fontWeight:'700',color:COLORS.violet},
  card:{backgroundColor:'#fff',borderRadius:16,padding:16,marginBottom:10,shadowColor:'#000',shadowOpacity:0.05,shadowRadius:6,elevation:2},
  cardHead:{flexDirection:'row',alignItems:'center',gap:10},
  simIcon:{width:44,height:44,borderRadius:12,backgroundColor:'rgba(210,81,216,0.1)',justifyContent:'center',alignItems:'center'},
  shieldIcon:{width:44,height:44,borderRadius:12,backgroundColor:'rgba(253,127,60,0.1)',justifyContent:'center',alignItems:'center'},
  cardTitle:{fontSize:14,fontWeight:'700',color:COLORS.text},
  cardSub:{fontSize:12,color:COLORS.textMuted,marginTop:2},
  pill:{paddingHorizontal:10,paddingVertical:4,borderRadius:20},
  pillTxt:{fontSize:11,fontWeight:'700'},
  pillActive:{backgroundColor:COLORS.successBg},
  pillActiveTxt:{color:COLORS.success},
  pillExpired:{backgroundColor:'#F0F0F0'},
  pillExpiredTxt:{color:'#999'},
  installBtn:{flexDirection:'row',alignItems:'center',gap:6,marginTop:10,paddingTop:10,borderTopWidth:0.5,borderTopColor:'#f0f0f0'},
  installTxt:{color:COLORS.violet,fontSize:13,fontWeight:'600'},
  actionsGrid:{flexDirection:'row',flexWrap:'wrap',gap:10},
  actionCard:{backgroundColor:'#fff',borderRadius:16,padding:14,alignItems:'center',width:'47%',shadowColor:'#000',shadowOpacity:0.05,shadowRadius:6,elevation:2},
  actionIcon:{width:44,height:44,borderRadius:12,justifyContent:'center',alignItems:'center',marginBottom:8},
  actionLabel:{fontSize:13,fontWeight:'600',color:COLORS.text,textAlign:'center'},
})
