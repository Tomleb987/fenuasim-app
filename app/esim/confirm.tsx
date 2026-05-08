import { View, Text, TouchableOpacity, StyleSheet, Linking } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { COLORS } from '../../constants/theme'

export default function ConfirmEsim() {
  const router = useRouter()
  const activationLink = 'https://esims.cloud/fenua-sim/demo'
  const accessCode = '4872'

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.wrap}>
        <LinearGradient colors={['#D251D8','#FD7F3C']} style={s.circle}>
          <Ionicons name="checkmark" size={36} color="#fff" />
        </LinearGradient>
        <Text style={s.title}>eSIM commandee !</Text>
        <Text style={s.sub}>Votre eSIM Japon 5 GB est confirmee.</Text>

        <View style={s.infoBox}>
          <View style={s.infoRow}>
            <Ionicons name="flag-outline" size={18} color={COLORS.violet} />
            <Text style={s.infoTxt}>Destination : Japon</Text>
          </View>
          <View style={s.infoRow}>
            <Ionicons name="server-outline" size={18} color={COLORS.violet} />
            <Text style={s.infoTxt}>Forfait : 5 GB · 7 jours</Text>
          </View>
          <View style={[s.infoRow, {borderBottomWidth:0}]}>
            <Ionicons name="mail-outline" size={18} color={COLORS.violet} />
            <Text style={s.infoTxt}>QR code envoye par email</Text>
          </View>
        </View>

        <View style={s.installBox}>
          <Text style={s.installTitle}>Installation directe</Text>
          <Text style={s.installSub}>Appuyez sur le bouton pour installer votre eSIM sans QR code. Un code d'acces vous sera demande.</Text>
          <View style={s.codeWrap}>
            <Text style={s.codeLabel}>Votre code d'acces</Text>
            <View style={s.codeRow}>
              {accessCode.split('').map((d, i) => (
                <View key={i} style={s.codeBox}>
                  <Text style={s.codeDigit}>{d}</Text>
                </View>
              ))}
            </View>
          </View>
          <TouchableOpacity style={s.ctaWrap} onPress={() => Linking.openURL(activationLink)}>
            <LinearGradient colors={['#D251D8','#FD7F3C']} start={{x:0,y:0}} end={{x:1,y:0}} style={s.cta}>
              <Ionicons name="download-outline" size={20} color="#fff" style={{marginRight:8}} />
              <Text style={s.ctaTxt}>Installer mon eSIM</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={() => router.push('/insurance/form')}>
          <Text style={s.insuranceTxt}>+ Ajouter une assurance voyage</Text>
        </TouchableOpacity>

        <TouchableOpacity style={s.ghost} onPress={() => router.push('/(tabs)')}>
          <Text style={s.ghostTxt}>Retour a l'accueil</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe:{flex:1,backgroundColor:COLORS.bg},
  wrap:{flex:1,padding:24,paddingTop:40},
  circle:{width:72,height:72,borderRadius:36,justifyContent:'center',alignItems:'center',marginBottom:16,alignSelf:'center'},
  title:{fontSize:22,fontWeight:'800',color:COLORS.text,textAlign:'center'},
  sub:{fontSize:14,color:'#888',marginTop:6,textAlign:'center',marginBottom:20},
  infoBox:{backgroundColor:'#fff',borderRadius:16,padding:16,marginBottom:12,width:'100%',shadowColor:'#000',shadowOpacity:0.05,shadowRadius:6,elevation:2},
  infoRow:{flexDirection:'row',alignItems:'center',gap:10,paddingVertical:9,borderBottomWidth:0.5,borderBottomColor:'#f5f5f5'},
  infoTxt:{fontSize:14,color:COLORS.text,fontWeight:'500'},
  installBox:{backgroundColor:'#fff',borderRadius:16,padding:16,marginBottom:16,width:'100%',shadowColor:'#000',shadowOpacity:0.05,shadowRadius:6,elevation:2},
  installTitle:{fontSize:15,fontWeight:'700',color:COLORS.text,marginBottom:6},
  installSub:{fontSize:13,color:'#888',lineHeight:20,marginBottom:16},
  codeWrap:{alignItems:'center',marginBottom:16},
  codeLabel:{fontSize:12,color:'#999',fontWeight:'600',textTransform:'uppercase',letterSpacing:0.5,marginBottom:10},
  codeRow:{flexDirection:'row',gap:10},
  codeBox:{width:52,height:60,backgroundColor:COLORS.bg,borderRadius:12,justifyContent:'center',alignItems:'center',borderWidth:1.5,borderColor:'rgba(210,81,216,0.3)'},
  codeDigit:{fontSize:28,fontWeight:'800',color:COLORS.violet},
  ctaWrap:{borderRadius:14,overflow:'hidden'},
  cta:{padding:14,alignItems:'center',flexDirection:'row',justifyContent:'center'},
  ctaTxt:{color:'#fff',fontSize:15,fontWeight:'800'},
  insuranceTxt:{color:'#FD7F3C',fontSize:14,fontWeight:'700',marginBottom:8,textAlign:'center'},
  ghost:{width:'100%',padding:14,alignItems:'center',marginTop:4},
  ghostTxt:{color:COLORS.textMuted,fontSize:14,fontWeight:'500'},
})
