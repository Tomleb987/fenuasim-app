import React, { useEffect, useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Image, ScrollView, Linking } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { COLORS } from '../constants/theme'
import { fetchOraResult, ORA_RECHARGE_URL, type OraOrderResult } from '../lib/oraFly'

const POLL_MS = 3000
const MAX_ATTEMPTS = 15 // ~45 s, comme app/topup-success.tsx

/**
 * Écran de fin d'achat ORA FLY. La livraison est faite par le webhook du site
 * (stock ORA) : l'app se contente d'interroger le résultat, vérifié côté
 * serveur, et ne déclenche jamais rien elle-même.
 */
export default function OraPurchaseResult({ sessionId }: { sessionId: string }) {
  const router = useRouter()
  const [result, setResult] = useState<OraOrderResult>({ status: 'pending' })
  const [timedOut, setTimedOut] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      for (let i = 0; i < MAX_ATTEMPTS && !cancelled; i++) {
        const r = await fetchOraResult(sessionId).catch(() => ({ status: 'pending' } as OraOrderResult))
        if (cancelled) return
        if (r.status !== 'pending') { setResult(r); return }
        await new Promise(res => setTimeout(res, POLL_MS))
      }
      if (!cancelled) setTimedOut(true)
    })()
    return () => { cancelled = true }
  }, [sessionId])

  if (result.status === 'pending') return (
    <SafeAreaView style={s.safe}>
      <View style={s.center}>
        {timedOut ? (
          <>
            <Ionicons name="mail-outline" size={56} color={COLORS.violet} />
            <Text style={s.title}>Paiement reçu</Text>
            <Text style={s.sub}>Votre eSIM arrive par email dans quelques minutes. Vous la retrouverez aussi dans l'accueil de l'application.</Text>
            <HomeButton onPress={() => router.push('/(tabs)')} />
          </>
        ) : (
          <>
            <ActivityIndicator color={COLORS.violet} size="large" />
            <Text style={s.loadingTxt}>Préparation de votre eSIM ORA FLY…</Text>
          </>
        )}
      </View>
    </SafeAreaView>
  )

  if (result.status === 'awaiting_stock') return (
    <SafeAreaView style={s.safe}>
      <View style={s.center}>
        <Ionicons name="time-outline" size={56} color={COLORS.violet} />
        <Text style={s.title}>Paiement reçu</Text>
        <Text style={s.sub}>Votre eSIM ORA FLY est en cours de préparation par notre équipe. Vous la recevrez par email sous 24 h.</Text>
        <HomeButton onPress={() => router.push('/(tabs)')} />
      </View>
    </SafeAreaView>
  )

  if (result.status === 'error') return (
    <SafeAreaView style={s.safe}>
      <View style={s.center}>
        <Ionicons name="alert-circle-outline" size={56} color="#FD7F3C" />
        <Text style={s.title}>Une erreur est survenue</Text>
        <Text style={s.sub}>{result.error}. Si vous avez été débité, écrivez-nous à contact@fenuasim.com.</Text>
        <HomeButton onPress={() => router.push('/(tabs)')} />
      </View>
    </SafeAreaView>
  )

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.wrap}>
        <LinearGradient colors={['#D251D8', '#FD7F3C']} style={s.circle}>
          <Ionicons name="checkmark" size={36} color="#fff" />
        </LinearGradient>
        <Text style={s.title}>eSIM commandée !</Text>
        <Text style={s.sub}>{result.packageName} · aussi envoyée par email</Text>

        {result.qrCodeUrl && (
          <View style={s.card}>
            <Text style={s.cardTitle}>Scannez ce QR code</Text>
            <Image source={{ uri: result.qrCodeUrl }} style={s.qr} resizeMode="contain" />
            <Text style={s.hint}>Depuis un autre écran, ou utilisez les codes ci-dessous.</Text>
          </View>
        )}

        <View style={s.card}>
          <Text style={s.cardTitle}>Installation manuelle</Text>
          <Row label="Adresse SM-DP+" value={result.smdpAddress} />
          <Row label="Code d'activation" value={result.matchingCode} />
          <Row label="ICCID" value={result.iccid ?? '-'} last />
        </View>

        <View style={s.card}>
          {result.voiceDesc && <Text style={s.feature}>📞 {result.voiceDesc}</Text>}
          {result.smsDesc && <Text style={s.feature}>✉️ {result.smsDesc}</Text>}
          <TouchableOpacity onPress={() => Linking.openURL(ORA_RECHARGE_URL)}>
            <Text style={s.link}>🔄 La recharge se fait directement chez ORA</Text>
          </TouchableOpacity>
        </View>

        <HomeButton onPress={() => router.push('/(tabs)')} />
      </ScrollView>
    </SafeAreaView>
  )
}

function Row({ label, value, last = false }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[s.row, last && { borderBottomWidth: 0 }]}>
      <Text style={s.rowLabel}>{label}</Text>
      <Text style={s.rowVal} selectable>{value || '-'}</Text>
    </View>
  )
}

function HomeButton({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity style={s.ctaWrap} onPress={onPress}>
      <LinearGradient colors={['#D251D8', '#FD7F3C']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.cta}>
        <Text style={s.ctaTxt}>Retour à l'accueil</Text>
      </LinearGradient>
    </TouchableOpacity>
  )
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, gap: 12 },
  loadingTxt: { fontSize: 15, color: COLORS.textMuted, textAlign: 'center' },
  wrap: { padding: 24, paddingTop: 32, gap: 12 },
  circle: { width: 72, height: 72, borderRadius: 36, justifyContent: 'center', alignItems: 'center', alignSelf: 'center' },
  title: { fontSize: 22, fontWeight: '800', color: COLORS.text, textAlign: 'center' },
  sub: { fontSize: 14, color: '#888', textAlign: 'center', lineHeight: 20 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2, gap: 6 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: COLORS.text, marginBottom: 4 },
  qr: { width: 220, height: 220, alignSelf: 'center' },
  hint: { fontSize: 12, color: COLORS.textMuted, textAlign: 'center' },
  row: { paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: '#f5f5f5' },
  rowLabel: { fontSize: 12, color: COLORS.textMuted },
  rowVal: { fontSize: 14, fontWeight: '600', color: COLORS.text, marginTop: 2 },
  feature: { fontSize: 13, color: COLORS.text },
  link: { fontSize: 13, color: COLORS.violet, fontWeight: '700', marginTop: 4 },
  ctaWrap: { borderRadius: 14, overflow: 'hidden', marginTop: 8, alignSelf: 'stretch' },
  cta: { padding: 14, alignItems: 'center' },
  ctaTxt: { color: '#fff', fontSize: 15, fontWeight: '800' },
})
