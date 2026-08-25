// Phase 4C (audit assurance) : cet ecran affichait auparavant des formules et
// des tarifs entierement inventes (Essentiel/Confort/Globe Premium, XPF fixes)
// et un bouton "Souscrire" qui menait a un faux ecran de confirmation sans
// aucun paiement ni aucune souscription reelle. Le vrai moteur tarifaire et
// la vraie souscription (assureur AVA) vivent cote site, sans point d'entree
// serveur exploitable depuis l'app mobile pour l'instant -- voir
// PHASE4C_ASSURANCE_STRIPE.md. En attendant cette integration reelle, cet
// ecran reste honnete : aucune formule ni prix fictif n'est affiche.
import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { COLORS } from '../../constants/theme'

export default function InsuranceForm() {
  const router = useRouter()

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <LinearGradient colors={['#D251D8', '#FD7F3C']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.hero}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color="#fff" />
        </TouchableOpacity>
        <Text style={s.heroLabel}>by FENUASIM</Text>
        <Text style={s.heroTitle}>Assurance voyage</Text>
      </LinearGradient>

      <View style={s.content}>
        <View style={s.iconCircle}>
          <Ionicons name="shield-outline" size={32} color="#FD7F3C" />
        </View>
        <Text style={s.title}>Bientôt disponible</Text>
        <Text style={s.desc}>
          La souscription d'une assurance voyage directement depuis l'application n'est pas encore ouverte.
        </Text>

        <TouchableOpacity style={s.supportLink} onPress={() => router.push('/support')}>
          <Text style={s.supportTxt}>Besoin d'aide avec votre assurance ? Contactez le support</Text>
        </TouchableOpacity>

        <TouchableOpacity style={s.ghost} onPress={() => router.back()}>
          <Text style={s.ghostTxt}>Retour</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  hero: { padding: 20, paddingTop: 16, paddingBottom: 24 },
  backBtn: { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 20, width: 36, height: 36, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  heroLabel: { color: 'rgba(255,255,255,0.75)', fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  heroTitle: { color: '#fff', fontSize: 22, fontWeight: '800', marginTop: 4 },
  content: { flex: 1, padding: 24, alignItems: 'center', paddingTop: 48 },
  iconCircle: { width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(253,127,60,0.1)', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  title: { fontSize: 20, fontWeight: '800', color: COLORS.text, textAlign: 'center' },
  desc: { fontSize: 14, color: '#888', textAlign: 'center', marginTop: 8, lineHeight: 20, paddingHorizontal: 12 },
  supportLink: { marginTop: 28, paddingVertical: 10 },
  supportTxt: { fontSize: 14, color: COLORS.violet, fontWeight: '600', textAlign: 'center' },
  ghost: { marginTop: 8, padding: 12 },
  ghostTxt: { fontSize: 14, color: COLORS.textMuted, fontWeight: '500' },
})
