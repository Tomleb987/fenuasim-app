import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { COLORS } from '../../constants/theme'

const DEST_CARDS = [
  { flag: '\u{1F1EF}\u{1F1F5}', label: 'Japon', c1: '#FF6B6B', c2: '#FF8E53' },
  { flag: '\u{1F1FA}\u{1F1F8}', label: 'Etats-Unis', c1: '#4776E6', c2: '#8E54E9' },
  { flag: '\u{1F1E6}\u{1F1FA}', label: 'Australie', c1: '#11998e', c2: '#38ef7d' },
  { flag: '\u{1F1EB}\u{1F1F7}', label: 'France', c1: '#2980B9', c2: '#6DD5FA' },
  { flag: '\u{1F1F3}\u{1F1FF}', label: 'N.-Zelande', c1: '#093028', c2: '#237A57' },
]

export default function HomeScreen() {
  const router = useRouter()
  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <LinearGradient colors={['#D251D8','#FD7F3C']} start={{x:0,y:0}} end={{x:1,y:1}} style={s.header}>
          <Text style={s.greeting}>Bonjour</Text>
          <Text style={s.name}>Thomas</Text>
        </LinearGradient>
        <View style={s.floatRow}>
          <View style={s.floatCard}>
            <Text style={s.fcLabel}>eSIM active</Text>
            <Text style={s.fcVal}>Japon</Text>
            <Text style={s.fcOk}>Connecte</Text>
          </View>
          <View style={s.floatCard}>
            <Text style={s.fcLabel}>Assurance</Text>
            <Text style={s.fcVal}>AVA Globe</Text>
            <Text style={s.fcOk}>Active</Text>
          </View>
        </View>
        <View style={s.content}>
          <View style={s.secHead}>
            <Text style={s.secTitle}>Destinations populaires</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/explore')}>
              <Text style={s.secLink}>Voir tout</Text>
            </TouchableOpacity>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {DEST_CARDS.map(d => (
              <TouchableOpacity key={d.label}>
                <LinearGradient colors={[d.c1,d.c2]} style={s.destCard}>
                  <Text style={s.destFlag}>{d.flag}</Text>
                  <Text style={s.destLabel}>{d.label}</Text>
                </LinearGradient>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <View style={[s.secHead,{marginTop:20}]}>
            <Text style={s.secTitle}>Mes eSIM</Text>
          </View>
          <View style={s.esimCard}>
            <View style={s.esimHead}>
              <Text style={{fontSize:28}}>🇯🇵</Text>
              <View style={{flex:1,marginLeft:10}}>
                <Text style={s.esimTitle}>Japon</Text>
                <Text style={s.esimOp}>FENUASIM · 5 GB</Text>
              </View>
              <View style={s.pillOk}><Text style={s.pillOkTxt}>Actif</Text></View>
            </View>
            <View style={s.barLabels}>
              <Text style={s.barLabel}>1,2 GB restants</Text>
              <Text style={s.barLabel}>5 GB</Text>
            </View>
            <View style={s.barTrack}>
              <LinearGradient colors={['#D251D8','#FD7F3C']} start={{x:0,y:0}} end={{x:1,y:0}} style={[s.barFill,{width:'24%'}]} />
            </View>
          </View>
          <View style={[s.secHead,{marginTop:20}]}>
            <Text style={s.secTitle}>Decouvrir</Text>
          </View>
          <TouchableOpacity onPress={() => router.push('/(tabs)/account')}>
            <View style={s.discoverCard}>
              <LinearGradient colors={['#FD7F3C','#D251D8']} style={s.discoverBanner}>
                <Text style={s.discoverBannerTxt}>Assurance voyage AVA</Text>
              </LinearGradient>
              <View style={s.discoverBody}>
                <View>
                  <Text style={s.discoverTitle}>Protegez votre voyage</Text>
                  <Text style={s.discoverSub}>Annulation · Medical · Rapatriement</Text>
                </View>
                <Text style={{color:'#ccc',fontSize:20}}>›</Text>
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
  header:{padding:20,paddingBottom:36},
  greeting:{color:'rgba(255,255,255,0.85)',fontSize:13},
  name:{color:'#fff',fontSize:22,fontWeight:'800',marginTop:2},
  floatRow:{flexDirection:'row',gap:10,paddingHorizontal:16,marginTop:-20,zIndex:2},
  floatCard:{flex:1,backgroundColor:'#fff',borderRadius:14,padding:12,shadowColor:'#000',shadowOpacity:0.08,shadowRadius:8,elevation:3},
  fcLabel:{fontSize:11,color:COLORS.textMuted,marginBottom:4},
  fcVal:{fontSize:14,fontWeight:'700',color:COLORS.text},
  fcOk:{fontSize:11,color:COLORS.success,marginTop:3},
  content:{padding:16,paddingTop:20},
  secHead:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:12},
  secTitle:{fontSize:16,fontWeight:'700',color:COLORS.text},
  secLink:{fontSize:13,fontWeight:'600',color:COLORS.violet},
  destCard:{width:120,height:85,borderRadius:14,marginRight:10,justifyContent:'flex-end',padding:8},
  destFlag:{fontSize:32,textAlign:'center',marginBottom:4},
  destLabel:{color:'#fff',fontSize:12,fontWeight:'700'},
  esimCard:{backgroundColor:'#fff',borderRadius:16,padding:16,shadowColor:'#000',shadowOpacity:0.05,shadowRadius:6,elevation:2},
  esimHead:{flexDirection:'row',alignItems:'center',marginBottom:12},
  esimTitle:{fontSize:15,fontWeight:'700',color:COLORS.text},
  esimOp:{fontSize:12,color:COLORS.textMuted,marginTop:2},
  pillOk:{backgroundColor:COLORS.successBg,paddingHorizontal:10,paddingVertical:4,borderRadius:20},
  pillOkTxt:{color:COLORS.success,fontSize:11,fontWeight:'700'},
  barLabels:{flexDirection:'row',justifyContent:'space-between',marginBottom:5},
  barLabel:{fontSize:12,color:COLORS.textMuted},
  barTrack:{backgroundColor:'#F0F0F0',borderRadius:20,height:7,overflow:'hidden'},
  barFill:{height:'100%',borderRadius:20},
  discoverCard:{backgroundColor:'#fff',borderRadius:16,overflow:'hidden',shadowColor:'#000',shadowOpacity:0.05,shadowRadius:6,elevation:2},
  discoverBanner:{height:80,justifyContent:'center',alignItems:'center'},
  discoverBannerTxt:{color:'#fff',fontSize:14,fontWeight:'800'},
  discoverBody:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',padding:14},
  discoverTitle:{fontSize:14,fontWeight:'700',color:COLORS.text},
  discoverSub:{fontSize:12,color:COLORS.textMuted,marginTop:2},
})
