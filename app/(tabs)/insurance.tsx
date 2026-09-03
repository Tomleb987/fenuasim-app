// Onglet Assurance -- point d'entree permanent vers le parcours de
// souscription reel (app/insurance/form.tsx). Reste une vraie destination
// d'onglet (pas de bouton retour, comme Accueil/Explorer/Compte) ; le
// formulaire a 5 etapes s'ouvre en ecran empile depuis ici.
import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { COLORS } from '../../constants/theme'
import { INSURANCE_PRODUCTS } from '../../constants/insurance'

export default function InsuranceTab() {
  const router = useRouter()

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <LinearGradient colors={['#D251D8', '#FD7F3C']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.hero}>
        <Text style={s.heroLabel}>by FENUASIM · AVA</Text>
        <Text style={s.heroTitle}>Assurance voyage</Text>
        <Text style={s.heroSub}>Souscrivez en quelques minutes, avant ou pendant votre séjour.</Text>
      </LinearGradient>

      <ScrollView style={s.scroll} contentContainerStyle={{ padding: 16, paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
        {INSURANCE_PRODUCTS.map((p) => (
          <View key={p.id} style={s.productCard}>
            <LinearGradient colors={p.colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.productBadge}>
              <Text style={s.productBadgeTxt}>{p.tagline}</Text>
            </LinearGradient>
            <Text style={s.productTitle}>{p.label}</Text>
            <Text style={s.productDesc}>{p.description}</Text>
            {p.highlights.map((h) => (
              <View key={h} style={s.highlightRow}>
                <Ionicons name="checkmark-circle" size={14} color={COLORS.violet} />
                <Text style={s.highlightTxt}>{h}</Text>
              </View>
            ))}
          </View>
        ))}

        <View style={s.noteBox}>
          <Ionicons name="information-circle-outline" size={16} color={COLORS.textMuted} />
          <Text style={s.noteTxt}>Réservé aux résidents de Polynésie française. Assureur AVA.</Text>
        </View>
      </ScrollView>

      <View style={s.ctaBar}>
        <TouchableOpacity style={s.ctaWrap} onPress={() => router.push('/insurance/form')}>
          <LinearGradient colors={['#D251D8', '#FD7F3C']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.cta}>
            <Text style={s.ctaTxt}>Souscrire une assurance</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  hero: { padding: 20, paddingTop: 16, paddingBottom: 24 },
  heroLabel: { color: 'rgba(255,255,255,0.75)', fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  heroTitle: { color: '#fff', fontSize: 22, fontWeight: '800', marginTop: 4 },
  heroSub: { color: 'rgba(255,255,255,0.85)', fontSize: 13, marginTop: 6, lineHeight: 18 },
  scroll: { flex: 1 },
  productCard: { backgroundColor: '#fff', borderRadius: 16, padding: 14, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  productBadge: { alignSelf: 'flex-start', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, marginBottom: 8 },
  productBadgeTxt: { color: '#fff', fontSize: 11, fontWeight: '700' },
  productTitle: { fontSize: 16, fontWeight: '800', color: COLORS.text },
  productDesc: { fontSize: 12, color: COLORS.textMuted, marginTop: 2, marginBottom: 8 },
  highlightRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  highlightTxt: { fontSize: 12, color: COLORS.text },
  noteBox: { flexDirection: 'row', gap: 8, backgroundColor: '#fff', borderRadius: 12, padding: 12, marginTop: 4 },
  noteTxt: { flex: 1, fontSize: 12, color: COLORS.textMuted, lineHeight: 16 },
  ctaBar: { backgroundColor: '#fff', padding: 16, borderTopWidth: 1, borderTopColor: COLORS.border },
  ctaWrap: { borderRadius: 14, overflow: 'hidden' },
  cta: { padding: 16, alignItems: 'center' },
  ctaTxt: { color: '#fff', fontSize: 15, fontWeight: '800' },
})
