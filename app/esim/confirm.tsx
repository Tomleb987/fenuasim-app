import { View, Text, TouchableOpacity, StyleSheet, Linking } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { COLORS } from '../../constants/theme'

export default function ConfirmEsim() {
  const router = useRouter()
  const activationLink = 'https://esims.cloud/fenua-sim/demo'

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.wrap}>
        <LinearGradient colors={['#D251D8','#FD7F3C']} style={s.circle}>
          <Ionicons name="checkmark" size={36} color="#fff" />
        </LinearGradient>
        <Text style={s.title}>eSIM commandee !</Text>
        <Text style={s.sub}>Votre eSIM Japon 5 GB est prete a installer sur votre telephone.</Text>

        <View style={s.infoBox}>
          <View style={s.infoRow}>
            <Ionicons name="flag-outline" size={18} color={COLORS.violet} />
            <Text style={s.infoTxt}>Destination : Japon</Text>
          </View>
          <View style={s.infoRow}>
            <Ionicons name="server-outline" size={18} color={COLORS.violet} />
            <Text style={s.infoTxt}>Forfait : 5 GB · 7 jours</Text>
          </View>
          <View style={s.infoRow}>
            <Ionicons name="mail-outline" size={18} color={COLORS.violet} />
            <Text style={s.infoTxt}>Confirmation envoyee par email</Text>
          </View>
        </View>

        <View style={s.stepBox}>
          <Text style={s.stepTitle}>Comment installer votre eSIM</Text>
          <View style={s.step}>
            <View style={s.stepNum}><Text style={s.stepNumTxt}>1</Text></View>
            <Text style={s.stepTxt}>Appuyez sur le bouton ci-dessous</Text>
          </View>
          <View style={s.step}>
            <View style={s.stepNum}><Text style={s.stepNumTxt}>2</Text></View>
            <Text style={s.stepTxt}>Suivez les instructions a l'ecran</Text>
          </View>
          <View style={s.step}>
            <View style={s.stepNum}><Text style={s.stepNumTxt}>3</Text></View>
            <Text style={s.stepTxt}>Activez l'eSIM dans Reglages > Reseau</Text>
          </View>
        </View>

        <TouchableOpacity style={s.ctaWrap} onPress={() => Linking.openURL(activationLink)}>
          <LinearGradient colors={['#D251D8','#FD7F3C']} start={{x:0,y:0}} end={{x:1,y:0}} style={s.cta}>
            <Ionicons name="download-outline" size={20} color="#fff" style={{marginRight:8}} />
            <Text style={s.ctaTxt}>Installer mon eSIM</Text>
          </LinearGradient>
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
  sub:{fontSize:14,color:'#888',marginTop:8,lineHeight:22,textAlign:'center',marginBottom:20},
  infoBox:{backgroundColor:'#fff',borderRadius:16,padding:16,marginBottom:16,width:'100%',shadowColor:'#000',shadowOpacity:0.05,shadowRadius:6,elevation:2},
  infoRow:{flexDirection:'row',alignItems:'center',gap:10,paddingVertical:8,borderBottomWidth:0.5,borderBottomColor:'#f5f5f5'},
  infoTxt:{fontSize:14,color:COLORS.text,fontWeight:'500'},
  stepBox:{backgroundColor:'#fff',borderRadius:16,padding:16,marginBottom:24,width:'100%',shadowColor:'#000',shadowOpacity:0.05,shadowRadius:6,elevation:2},
  stepTitle:{fontSize:14,fontWeight:'700',color:COLORS.text,marginBottom:12},
  step:{flexDirection:'row',alignItems:'center',gap:12,marginBottom:10},
  stepNum:{width:24,height:24,borderRadius:12,backgroundColor:COLORS.violet,justifyContent:'center',alignItems:'center'},
  stepNumTxt:{color:'#fff',fontSize:12,fontWeight:'800'},
  stepTxt:{fontSize:13,color:'#555',flex:1},
  ctaWrap:{width:'100%',borderRadius:14,overflow:'hidden',marginBottom:10},
  cta:{padding:16,alignItems:'center',flexDirection:'row',justifyContent:'center'},
  ctaTxt:{color:'#fff',fontSize:16,fontWeight:'800'},
  ghost:{width:'100%',padding:14,alignItems:'center'},
  ghostTxt:{color:COLORS.textMuted,fontSize:14,fontWeight:'500'},
})
