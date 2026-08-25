// Cible du cancel_url Stripe (fenuasim://payment-cancel, configure cote
// Edge Function create-checkout-mobile). Aucun ecran n'existait pour cette
// route avant cette phase : sans lui, l'annulation d'un paiement laissait
// l'utilisateur sur une route non appariee. Ecran minimal, sans logique
// metier nouvelle -- seul un retour propre vers l'accueil.
import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { COLORS } from '../constants/theme'

export default function PaymentCancel() {
  const router = useRouter()

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.wrap}>
        <View style={s.circle}>
          <Ionicons name="close" size={36} color={COLORS.textMuted} />
        </View>
        <Text style={s.title}>Paiement annulé</Text>
        <Text style={s.sub}>Aucun montant n'a été débité. Vous pouvez réessayer à tout moment.</Text>

        <TouchableOpacity style={s.cta} onPress={() => router.replace('/(tabs)')}>
          <Text style={s.ctaTxt}>Retour à l'accueil</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  wrap: { flex: 1, padding: 24, paddingTop: 60, alignItems: 'center' },
  circle: { width: 72, height: 72, borderRadius: 36, justifyContent: 'center', alignItems: 'center', marginBottom: 16, backgroundColor: COLORS.border },
  title: { fontSize: 22, fontWeight: '800', color: COLORS.text, textAlign: 'center' },
  sub: { fontSize: 14, color: '#888', marginTop: 8, textAlign: 'center', lineHeight: 20 },
  cta: { marginTop: 28, borderRadius: 14, paddingVertical: 16, paddingHorizontal: 32, backgroundColor: COLORS.violet },
  ctaTxt: { color: '#fff', fontSize: 16, fontWeight: '800' },
})
