import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { COLORS } from '../../constants/theme'

const DEST_CARDS = [
  { flag: '🇯🇵', label: 'Japon', color1: '#FF6B6B', color2: '#FF8E53' },
  { flag: '🇺🇸', label: 'États-Unis', color1: '#4776E6', color2: '#8E54E9' },
  { flag: '🇦🇺', label: 'Australie', color1: '#11998e', color2: '#38ef7d' },
  { flag: '🇫🇷', label: 'France', color1: '#2980B9', color2: '#6DD5FA' },
  { flag: '🇳🇿', label: 'N.-Zélande', color1: '#093028', color2: '#237A57' },
]

export default function HomeScreen() {
  const router = useRouter()

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Header gradient */}
        <LinearGradient colors={['#D251D8', '#FD7F3C']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.header}>
          <Text style={styles.greeting}>Bonjour 👋</Text>
          <Text style={styles.name}>Thomas</Text>
        </LinearGradient>

        {/* Floating cards */}
        <View style={styles.floatRow}>
          <View style={styles.floatCard}>
            <Text style={styles.fcLabel}>eSIM active</Text>
            <Text style={styles.fcVal}>Japon 🇯🇵</Text>
            <Text style={styles.fcOk}>● Connecté</Text>
          </View>
          <View style={styles.floatCard}>
            <Text style={styles.fcLabel}>Assurance</Text>
            <Text style={styles.fcVal}>AVA Globe</Text>
            <Text style={styles.fcOk}>● Active</Text>
          </View>
        </View>

        <View style={styles.content}>

          {/* Destinations */}
          <View style={styles.secHead}>
            <Text style={styles.secTitle}>Destinations populaires</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/explore')}>
              <Text style={styles.secLink}>Voir tout</Text>
            </TouchableOpacity>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.destScroll}>
            {DEST_CARDS.map((d) => (
              <TouchableOpacity key={d.label} onPress={() => router.push('/screens/esim/DestinationDetail')}>
                <LinearGradient colors={[d.color1, d.color2]} style={styles.destCard}>
                  <Text style={styles.destFlag}>{d.flag}</Text>
                  <Text style={styles.destLabel}>{d.label}</Text>
                </LinearGradient>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* eSIM active */}
          <View style={styles.secHead}>
            <Text style={styles.secTitle}>Mes eSIM</Text>
          </View>
          <View style={styles.esimCard}>
            <View style={styles.esimHead}>
              <Text style={styles.esimFlag}>🇯🇵</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.esimTitle}>Japon</Text>
                <Text style={styles.esimOp}>FENUASIM · 5 GB</Text>
              </View>
              <View style={styles.pillOk}><Text style={styles.pillOkText}>Actif</Text></View>
            </View>
            <View style={styles.barWrap}>
              <View style={styles.barLabels}>
                <Text style={styles.barLabel}>1,2 GB restants</Text>
                <Text style={styles.barLabel}>5 GB</Text>
              </View>
              <View style={styles.barTrack}>
                <LinearGradient colors={['#D251D8', '#FD7F3C']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.barFill, { width: '24%' }]} />
              </View>
            </View>
          </View>

          {/* Assurance banner */}
          <View style={styles.secHead}>
            <Text style={styles.secTitle}>Découvrir</Text>
          </View>
          <TouchableOpacity onPress={() => router.push('/screens/insurance/InsuranceForm')}>
            <View style={styles.discoverCard}>
              <LinearGradient colors={['#FD7F3C', '#D251D8']} style={styles.discoverBanner}>
                <Text style={styles.discoverBannerText}>🛡️  Assurance voyage AVA</Text>
              </LinearGradient>
              <View style={styles.discoverBody}>
                <View>
                  <Text style={styles.discoverTitle}>Protégez votre voyage</Text>
                  <Text style={styles.discoverSub}>Annulation · Médical · Rapatriement</Text>
                </View>
                <Text style={{ color: '#ccc', fontSize: 20 }}>›</Text>
              </View>
            </View>
          </TouchableOpacity>

        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { flex: 1 },
  header: { padding: 20, paddingBottom: 36 },
  greeting: { color: 'rgba(255,255,255,0.85)', fontSize: 13 },
  name: { color: '#fff', fontSize: 22, fontWeight: '800', marginTop: 2 },
  floatRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, marginTop: -20, zIndex: 2 },
  floatCard: { flex: 1, backgroundColor: '#fff', borderRadius: 14, padding: 12, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 8, elevation: 3 },
  fcLabel: { fontSize: 11, color: COLORS.textMuted, marginBottom: 4 },
  fcVal: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  fcOk: { fontSize: 11, color: COLORS.success, marginTop: 3 },
  content: { padding: 16, paddingTop: 20 },
  secHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, marginTop: 4 },
  secTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  secLink: { fontSize: 13, fontWeight: '600', color: COLORS.violet },
  destScroll: { marginBottom: 18 },
  destCard: { width: 120, height: 85, borderRadius: 14, marginRight: 10, justifyContent: 'flex-end', padding: 8 },
  destFlag: { fontSize: 36, textAlign: 'center', marginBottom: 4 },
  destLabel: { color: '#fff', fontSize: 12, fontWeight: '700' },
  esimCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  esimHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  esimFlag: { fontSize: 28 },
  esimTitle: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  esimOp: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  pillOk: { backgroundColor: COLORS.successBg, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  pillOkText: { color: COLORS.success, fontSize: 11, fontWeight: '700' },
  barWrap: { gap: 5 },
  barLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  barLabel: { fontSize: 12, color: COLORS.textMuted },
  barTrack: { backgroundColor: '#F0F0F0', borderRadius: 20, height: 7, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 20 },
  discoverCard: { backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  discoverBanner: { height: 80, justifyContent: 'center', alignItems: 'center' },
  discoverBannerText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  discoverBody: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14 },
  discoverTitle: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  discoverSub: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
})
