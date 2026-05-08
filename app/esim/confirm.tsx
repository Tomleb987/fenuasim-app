import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { COLORS } from '../../constants/theme'

export default function ConfirmEsim() {
  const router = useRouter()
  return (
    <SafeAreaView style={s.safe}>
      <View style={s.wrap}>
        <LinearGradient colors={['#D251D8','#FD7F3C']} style={s.circle}>
          <Ionicons name="checkmark" size={36} color="#fff" />
        </LinearGradient>
        <Text style={s.title}>eSIM activee !</Text>
        <Text style={s.sub}>Votre eSIM Japon 5 GB est prete.{"\n"}Scannez le QR code pour l'installer.</Text>
        <View style={s.qrBox}>
          <Ionicons name="qr-code-outline" size={80} color="#ddd" />
          <Text style={s.qrHint}>Scanner avec l'appareil photo</Text>
        </View>
        <TouchableOpacity style={s.ctaWrap} onPress={() => router.push('/(tabs)')}>
          <LinearGradient colors={['#D251D8','#FD7F3C']} start={{x:0,y:0}} end={{x:1,y:0}} style={s.cta}>
            <Text style={s.ctaTxt}>Retour a l'accueil</Text>
          </LinearGradient>
        </TouchableOpacity>
        <TouchableOpacity style={s.ghost} onPress={() => router.push('/(tabs)')}>
          <Text style={s.ghostTxt}>Ajouter une assurance voyage</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe:{flex:1,backgroundColor:COLORS.bg},
  wrap:{flex:1,alignItems:'center',justifyContent:'center',padding:32},
  circle:{width:76,height:76,borderRadius:38,justifyContent:'center',alignItems:'center',marginBottom:20},
  title:{fontSize:22,fontWeight:'800',color:COLORS.text},
  sub:{fontSize:14,color:'#888',marginTop:8,lineHeight:22,textAlign:'center'},
  qrBox:{backgroundColor:'#fff',borderRadius:16,padding:24,marginVertical:24,alignItems:'center',shadowColor:'#000',shadowOpacity:0.07,shadowRadius:12,elevation:3},
  qrHint:{fontSize:12,color:'#aaa',marginTop:8},
  ctaWrap:{width:'100%',borderRadius:14,overflow:'hidden'},
  cta:{padding:16,alignItems:'center'},
  ctaTxt:{color:'#fff',fontSize:16,fontWeight:'800'},
  ghost:{width:'100%',padding:14,borderRadius:14,borderWidth:1.5,borderColor:'#FD7F3C',alignItems:'center',marginTop:10},
  ghostTxt:{color:'#FD7F3C',fontSize:14,fontWeight:'600'},
})
