import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { COLORS } from '../../constants/theme'

export default function ConfirmInsurance() {
  const router = useRouter()
  return (
    <SafeAreaView style={s.safe}>
      <View style={s.wrap}>
        <LinearGradient colors={['#FD7F3C','#D251D8']} style={s.circle}>
          <Ionicons name="shield-checkmark" size={36} color="#fff" />
        </LinearGradient>
        <Text style={s.title}>Assurance souscrite !</Text>
        <Text style={s.sub}>Votre attestation AVA Essentiel a ete generee.</Text>

        <View style={s.infoBox}>
          <View style={s.infoRow}>
            <Ionicons name="location-outline" size={18} color="#FD7F3C" />
            <Text style={s.infoTxt}>Destination : Japon</Text>
          </View>
          <View style={s.infoRow}>
            <Ionicons name="calendar-outline" size={18} color="#FD7F3C" />
            <Text style={s.infoTxt}>Du 10 au 20 mai 2026</Text>
          </View>
          <View style={s.infoRow}>
            <Ionicons name="shield-checkmark-outline" size={18} color="#FD7F3C" />
            <Text style={s.infoTxt}>Formule Essentiel · 890 XPF</Text>
          </View>
          <View style={[s.infoRow,{borderBottomWidth:0}]}>
            <Ionicons name="mail-outline" size={18} color="#FD7F3C" />
            <Text style={s.infoTxt}>Attestation envoyee par email</Text>
          </View>
        </View>

        <TouchableOpacity style={s.ctaWrap} onPress={() => router.push('/(tabs)')}>
          <LinearGradient colors={['#FD7F3C','#D251D8']} start={{x:0,y:0}} end={{x:1,y:0}} style={s.cta}>
            <Text style={s.ctaTxt}>Retour a l'accueil</Text>
          </LinearGradient>
        </TouchableOpacity>
        <TouchableOpacity style={s.ghost} onPress={() => router.push('/esim/JP')}>
          <Text style={s.ghostTxt}>Acheter une eSIM</Text>
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
  sub:{fontSize:14,color:'#888',marginTop:6,textAlign:'center',marginBottom:24},
  infoBox:{backgroundColor:'#fff',borderRadius:16,padding:16,marginBottom:24,width:'100%',shadowColor:'#000',shadowOpacity:0.05,shadowRadius:6,elevation:2},
  infoRow:{flexDirection:'row',alignItems:'center',gap:10,paddingVertical:9,borderBottomWidth:0.5,borderBottomColor:'#f5f5f5'},
  infoTxt:{fontSize:14,color:COLORS.text,fontWeight:'500'},
  ctaWrap:{width:'100%',borderRadius:14,overflow:'hidden',marginBottom:10},
  cta:{padding:16,alignItems:'center'},
  ctaTxt:{color:'#fff',fontSize:16,fontWeight:'800'},
  ghost:{width:'100%',padding:14,alignItems:'center'},
  ghostTxt:{color:COLORS.textMuted,fontSize:14,fontWeight:'500'},
})
