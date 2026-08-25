// Cible du success_url Stripe pour la recharge eSIM (fenuasim://topup-success,
// configure cote create-topup-checkout). La recharge Airalo elle-meme n'est
// jamais declenchee par ce retour : elle est deja traitee (ou en cours de
// traitement) cote serveur par le webhook Stripe. Cet ecran ne fait que lire
// l'etat reel de esim_topup_orders, avec un polling borne.
import React, { useEffect, useRef, useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { COLORS } from '../constants/theme'
import { fetchTopupOrderBySession } from '../hooks/useEsimTopups'
import { EsimTopupStatus } from '../types'

const POLL_INTERVAL_MS = 3000
const POLL_TIMEOUT_MS = 45000

export default function TopupSuccess() {
  const router = useRouter()
  const { session_id } = useLocalSearchParams<{ session_id: string }>()
  const [status, setStatus] = useState<EsimTopupStatus | 'not_found'>('pending_payment')
  const [lastError, setLastError] = useState<string | null>(null)
  const [timedOut, setTimedOut] = useState(false)
  const stopRef = useRef(false)

  useEffect(() => {
    if (!session_id) return
    stopRef.current = false
    const startedAt = Date.now()

    async function poll() {
      if (stopRef.current) return
      try {
        const order = await fetchTopupOrderBySession(session_id)
        if (!order) { setStatus('not_found'); return }
        setStatus(order.status)
        setLastError(order.last_error)
        if (order.status === 'completed' || order.status === 'failed') { stopRef.current = true; return }
      } catch {
        // Erreur reseau ponctuelle : on retente au prochain tick, sans afficher d'echec.
      }
      if (Date.now() - startedAt >= POLL_TIMEOUT_MS) { stopRef.current = true; setTimedOut(true); return }
      setTimeout(poll, POLL_INTERVAL_MS)
    }

    poll()
    return () => { stopRef.current = true }
  }, [session_id])

  const isWaiting = !timedOut && (status === 'pending_payment' || status === 'paid' || status === 'processing')

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.wrap}>
        {status === 'completed' ? (
          <>
            <LinearGradient colors={['#D251D8', '#FD7F3C']} style={s.circle}>
              <Ionicons name="checkmark" size={36} color="#fff" />
            </LinearGradient>
            <Text style={s.title}>Recharge effectuée</Text>
            <Text style={s.sub}>Votre nouvelle enveloppe de données est maintenant associée à votre eSIM.</Text>
          </>
        ) : status === 'failed' ? (
          <>
            <View style={[s.circle, { backgroundColor: '#FFF3DC' }]}>
              <Ionicons name="time-outline" size={36} color="#9A6200" />
            </View>
            <Text style={s.title}>Paiement reçu</Text>
            <Text style={s.sub}>
              Votre paiement a bien été reçu, mais la finalisation de votre recharge nécessite quelques instants
              supplémentaires. Notre équipe suit ce dossier automatiquement.
            </Text>
            {!!lastError && <Text style={s.errDetail}>Référence technique : {lastError.slice(0, 120)}</Text>}
          </>
        ) : status === 'not_found' ? (
          <>
            <Ionicons name="alert-circle-outline" size={48} color="#FD7F3C" />
            <Text style={s.title}>Paiement en cours de traitement</Text>
            <Text style={s.sub}>Nous n'avons pas encore trouvé votre recharge. Elle apparaîtra automatiquement dans "Mes eSIM" une fois confirmée.</Text>
          </>
        ) : isWaiting ? (
          <>
            <ActivityIndicator color={COLORS.violet} size="large" style={{ marginBottom: 16 }} />
            <Text style={s.title}>Paiement reçu</Text>
            <Text style={s.sub}>Nous appliquons votre recharge à votre eSIM. Cela prend généralement quelques instants.</Text>
          </>
        ) : (
          <>
            <Ionicons name="time-outline" size={48} color={COLORS.textMuted} />
            <Text style={s.title}>Paiement reçu</Text>
            <Text style={s.sub}>
              Votre recharge est toujours en cours de validation. Vous pouvez fermer cet écran — elle apparaîtra
              automatiquement dans "Mes eSIM" une fois terminée.
            </Text>
          </>
        )}

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
  circle: { width: 72, height: 72, borderRadius: 36, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  title: { fontSize: 22, fontWeight: '800', color: COLORS.text, textAlign: 'center' },
  sub: { fontSize: 14, color: '#888', marginTop: 8, textAlign: 'center', lineHeight: 20 },
  errDetail: { fontSize: 11, color: '#bbb', marginTop: 10, textAlign: 'center' },
  cta: { marginTop: 28, borderRadius: 14, paddingVertical: 16, paddingHorizontal: 32, backgroundColor: COLORS.violet },
  ctaTxt: { color: '#fff', fontSize: 16, fontWeight: '800' },
})
