// Onglet Assurance -- point d'entree permanent vers le parcours de
// souscription reel (app/insurance/form.tsx). Reste une vraie destination
// d'onglet (pas de bouton retour, comme Accueil/Explorer/Compte) ; le
// formulaire a 6 etapes s'ouvre en ecran empile depuis ici.
import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Image, ImageBackground } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { COLORS, RADIUS, SHADOW, TYPO } from '../../constants/theme'
import { INSURANCE_PRODUCTS } from '../../constants/insurance'

// Visuels embarques plutot que charges depuis le Storage : les originaux sont
// des PNG de 1,8 a 2,2 Mo, et l'endpoint de transformation de Supabase ne les
// convertit en WebP que pour les clients qui l'annoncent. React Native iOS ne
// le fait pas et recevrait 2,3 Mo pour ce seul ecran -- mesure le 2026-09-09.
// Recompresses en JPEG 600px, les trois pesent 205 Ko au total.
const PRODUCT_IMAGES: Record<string, any> = {
  ava_tourist_card: require('../../assets/images/insurance/tourist-card.jpg'),
  ava_carte_sante: require('../../assets/images/insurance/carte-sante.jpg'),
  avantages_pom: require('../../assets/images/insurance/avantages-pom.jpg'),
}
import { useSession } from '../../hooks/useSession'
import { requireAuth } from '../../lib/authGate'

export default function InsuranceTab() {
  const router = useRouter()
  const { session, isGuest } = useSession()

  // Les garanties et les prix restent visibles sans compte ; seule la
  // souscription, qui cree un dossier nominatif chez AVA, en demande un.
  function goToForm() {
    if (!requireAuth(router, session, '/insurance/form')) return
    router.push('/insurance/form')
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <LinearGradient colors={['#D251D8', '#FD7F3C']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.hero}>
        <ImageBackground
          source={require('../../assets/images/hero.jpg')}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
        >
          <LinearGradient
            colors={['rgba(60,10,70,0.38)', 'rgba(60,10,70,0.14)', 'transparent']}
            style={StyleSheet.absoluteFill}
          />
        </ImageBackground>
        <Text style={s.heroLabel}>by FENUASIM · AVA</Text>
        <Text style={s.heroTitle}>Assurance voyage</Text>
        <Text style={s.heroSub}>Souscrivez en quelques minutes, avant ou pendant votre séjour.</Text>
      </LinearGradient>

      <ScrollView style={s.scroll} contentContainerStyle={{ padding: 16, paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
        {INSURANCE_PRODUCTS.map((p) => (
          <TouchableOpacity key={p.id} style={s.productCard} onPress={goToForm} activeOpacity={0.85}>
            <View style={s.productText}>
              <LinearGradient colors={p.colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.productBadge}>
                <Text style={s.productBadgeTxt}>{p.tagline}</Text>
              </LinearGradient>
              <Text style={s.productTitle}>{p.label}</Text>
              <Text style={s.productDesc}>{p.description}</Text>
              {p.highlights.map((h) => (
                <View key={h} style={s.highlightRow}>
                  <Ionicons name="checkmark-circle" size={15} color={p.colors[0]} />
                  <Text style={s.highlightTxt}>{h}</Text>
                </View>
              ))}
            </View>
            <Image source={PRODUCT_IMAGES[p.id]} style={s.productImg} resizeMode="cover" />
          </TouchableOpacity>
        ))}

        <View style={s.noteBox}>
          <Ionicons name="information-circle-outline" size={16} color={COLORS.textMuted} />
          <Text style={s.noteTxt}>Réservé aux résidents de Polynésie française. Assureur AVA.</Text>
        </View>
      </ScrollView>

      <View style={s.ctaBar}>
        <TouchableOpacity style={s.ctaWrap} onPress={goToForm}>
          <LinearGradient colors={['#D251D8', '#FD7F3C']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.cta}>
            <Text style={s.ctaTxt}>Obtenir mon devis</Text>
          </LinearGradient>
        </TouchableOpacity>
        {isGuest && <Text style={s.ctaHint}>Un compte est demandé au moment de souscrire.</Text>}
      </View>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  hero: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 26, borderBottomLeftRadius: RADIUS.xl, borderBottomRightRadius: RADIUS.xl, overflow: 'hidden' },
  heroLabel: { color: 'rgba(255,255,255,0.88)', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },
  heroTitle: { color: '#fff', ...TYPO.hero, marginTop: 4 },
  heroSub: { color: 'rgba(255,255,255,0.92)', fontSize: 13, marginTop: 6, lineHeight: 18 },
  scroll: { flex: 1 },
  productCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: RADIUS.lg, padding: 14, marginBottom: 12, ...SHADOW.card },
  productText: { flex: 1 },
  productImg: { width: 108, height: 128, borderRadius: RADIUS.md },
  productBadge: { alignSelf: 'flex-start', borderRadius: RADIUS.pill, paddingHorizontal: 11, paddingVertical: 5, marginBottom: 9 },
  productBadgeTxt: { color: '#fff', fontSize: 11, fontWeight: '800' },
  productTitle: { ...TYPO.section, color: COLORS.text },
  productDesc: { fontSize: 12, color: COLORS.textMuted, marginTop: 2, marginBottom: 9 },
  highlightRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 5 },
  highlightTxt: { flex: 1, fontSize: 12.5, color: COLORS.text, fontWeight: '500' },
  noteBox: { flexDirection: 'row', gap: 8, backgroundColor: '#fff', borderRadius: RADIUS.md, padding: 13, marginTop: 4, ...SHADOW.card },
  noteTxt: { flex: 1, fontSize: 12, color: COLORS.textMuted, lineHeight: 16 },
  ctaBar: { backgroundColor: '#fff', padding: 16, borderTopWidth: 1, borderTopColor: COLORS.border },
  ctaWrap: { borderRadius: RADIUS.md, overflow: 'hidden', ...SHADOW.raised },
  cta: { padding: 16, alignItems: 'center' },
  ctaTxt: { color: '#fff', fontSize: 15, fontWeight: '800' },
  ctaHint: { textAlign: 'center', fontSize: 12, color: COLORS.textMuted, marginTop: 8 },
})
