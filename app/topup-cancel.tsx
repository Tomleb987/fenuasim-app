// Cible du cancel_url Stripe pour la recharge eSIM (fenuasim://topup-cancel,
// configure cote create-topup-checkout). Aucun appel Airalo n'a lieu dans ce
// cas -- la ligne esim_topup_orders reste en pending_payment, conformement
// au fonctionnement deja retenu pour les paiements eSIM/assurance.
import React, { useEffect } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { COLORS } from '../constants/theme'
import { closeCheckoutBrowser } from '../lib/checkout'

export default function TopupCancel() {
  const router = useRouter()

  // Retour de Stripe : sur iOS le SFSafariViewController reste presente
  // derriere l'app, on le referme. Sans effet sur Android (voir lib/checkout).
  useEffect(() => { closeCheckoutBrowser() }, [])

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.wrap}>
        <View style={s.circle}>
          <Ionicons name="close" size={36} color={COLORS.textMuted} />
        </View>
        <Text style={s.title}>Paiement annulé</Text>
        <Text style={s.sub}>Aucun montant n'a été débité. Vous pouvez réessayer à tout moment depuis votre eSIM.</Text>

        <TouchableOpacity style={s.ctaWrap} onPress={() => router.replace('/(tabs)')}>
          <View style={s.cta}>
            <Text style={s.ctaTxt}>Retour à l'accueil</Text>
          </View>
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
  ctaWrap: { marginTop: 28, borderRadius: 14, overflow: 'hidden', backgroundColor: '#fff', borderWidth: 1.5, borderColor: COLORS.violet },
  cta: { paddingVertical: 16, paddingHorizontal: 32 },
  ctaTxt: { color: COLORS.violet, fontSize: 16, fontWeight: '800' },
})
