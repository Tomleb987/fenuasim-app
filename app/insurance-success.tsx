// Retour de paiement de l'assurance voyage (2026-10-25).
//
// Cible du success_url Stripe fenuasim://insurance-success?session_id=...,
// renvoye par /api/insurance-checkout du site quand l'app demande
// returnTo: 'app'. Avant, le paiement s'ouvrait dans le navigateur du
// telephone et se terminait sur la page web /assurance/success : le client ne
// revenait jamais dans l'app.
//
// Cet ecran ne declenche rien : il interroge en lecture les memes routes que
// la page web (/api/assurance/mark-paid puis /api/assurance/get-documents),
// qui verifient la session Stripe cote serveur. La validation du contrat chez
// AVA reste le travail exclusif du webhook Stripe du site.
import React, { useEffect, useRef, useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Linking } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { COLORS } from '../constants/theme'
import { closeCheckoutBrowser } from '../lib/checkout'
import { fetchWithTimeout } from '../lib/http'
import { SITE_URL } from '../lib/oraFly'

type Status = 'loading' | 'success' | 'error'

// Les documents AVA sont produits par le webhook juste apres le paiement :
// quelques interrogations suffisent, l'e-mail de confirmation prend le relais.
const POLL_MAX = 6
const POLL_INTERVAL_MS = 5_000

export default function InsuranceSuccess() {
  const router = useRouter()
  const { session_id } = useLocalSearchParams<{ session_id?: string }>()
  const [status, setStatus] = useState<Status>('loading')
  const [adhesion, setAdhesion] = useState<string | null>(null)
  const [contractLink, setContractLink] = useState<string | null>(null)
  const [attestationUrl, setAttestationUrl] = useState<string | null>(null)
  const [docsLoading, setDocsLoading] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Sur iOS le SFSafariViewController reste presente derriere l'app.
  useEffect(() => { closeCheckoutBrowser() }, [])

  useEffect(() => {
    if (!session_id) { setStatus('error'); return }
    let cancelled = false

    async function poll(adhesionNumber: string, attempt: number) {
      if (cancelled) return
      if (attempt > POLL_MAX) { setDocsLoading(false); return }
      timer.current = setTimeout(async () => {
        try {
          const res = await fetchWithTimeout(
            `${SITE_URL}/api/assurance/get-documents?adhesion_number=${encodeURIComponent(adhesionNumber)}&session_id=${encodeURIComponent(String(session_id))}`
          )
          const data = await res.json().catch(() => ({}))
          if (cancelled) return
          if (data.contract_link || data.attestation_url) {
            setContractLink(data.contract_link || null)
            setAttestationUrl(data.attestation_url || null)
            setDocsLoading(false)
            return
          }
        } catch {
          // reseau : on retente au tour suivant
        }
        poll(adhesionNumber, attempt + 1)
      }, POLL_INTERVAL_MS)
    }

    ;(async () => {
      try {
        const res = await fetchWithTimeout(`${SITE_URL}/api/assurance/mark-paid`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ session_id }),
        })
        const data = await res.json().catch(() => ({}))
        if (cancelled) return
        if (!res.ok || !data.success) { setStatus('error'); return }
        setAdhesion(data.adhesion_number || null)
        setStatus('success')
        if (data.contract_link || data.attestation_url) {
          setContractLink(data.contract_link || null)
          setAttestationUrl(data.attestation_url || null)
        } else if (data.adhesion_number) {
          setDocsLoading(true)
          poll(data.adhesion_number, 1)
        }
      } catch {
        if (!cancelled) setStatus('error')
      }
    })()

    return () => { cancelled = true; if (timer.current) clearTimeout(timer.current) }
  }, [session_id])

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.wrap}>
        {status === 'loading' && (
          <>
            <ActivityIndicator size="large" color={COLORS.violet} />
            <Text style={[s.title, { marginTop: 20 }]}>Vérification du paiement…</Text>
            <Text style={s.sub}>Merci de patienter quelques secondes.</Text>
          </>
        )}

        {status === 'success' && (
          <>
            <View style={[s.circle, { backgroundColor: '#E6F9F2' }]}>
              <Ionicons name="shield-checkmark" size={36} color={COLORS.success} />
            </View>
            <Text style={s.title}>Votre assurance voyage est active</Text>
            {adhesion ? <Text style={s.ref}>Adhésion n° {adhesion}</Text> : null}
            <Text style={s.sub}>
              Un e-mail de confirmation vous a été envoyé avec vos documents AVA.
            </Text>

            {docsLoading && (
              <View style={s.docsRow}>
                <ActivityIndicator size="small" color={COLORS.violet} />
                <Text style={s.docsTxt}>Documents en cours de génération…</Text>
              </View>
            )}
            {attestationUrl && (
              <TouchableOpacity
                style={s.docBtn}
                onPress={() => Linking.openURL(attestationUrl)}
                accessibilityRole="button"
                accessibilityLabel="Ouvrir l'attestation d'assurance"
              >
                <Ionicons name="document-text-outline" size={18} color={COLORS.violet} />
                <Text style={s.docBtnTxt}>Attestation d'assurance (PDF)</Text>
              </TouchableOpacity>
            )}
            {contractLink && (
              <TouchableOpacity
                style={s.docBtn}
                onPress={() => Linking.openURL(contractLink)}
                accessibilityRole="button"
                accessibilityLabel="Ouvrir le bulletin d'adhésion"
              >
                <Ionicons name="document-outline" size={18} color={COLORS.violet} />
                <Text style={s.docBtnTxt}>Bulletin d'adhésion (PDF)</Text>
              </TouchableOpacity>
            )}
          </>
        )}

        {status === 'error' && (
          <>
            <View style={[s.circle, { backgroundColor: COLORS.border }]}>
              <Ionicons name="alert" size={36} color={COLORS.textMuted} />
            </View>
            <Text style={s.title}>Paiement en cours de vérification</Text>
            <Text style={s.sub}>
              Nous n'avons pas pu confirmer le paiement depuis l'application. Si votre carte a été débitée,
              vous recevrez la confirmation par e-mail. Sinon, contactez-nous.
            </Text>
            <TouchableOpacity
              style={s.docBtn}
              onPress={() => router.push('/support')}
              accessibilityRole="button"
              accessibilityLabel="Contacter le support"
            >
              <Ionicons name="chatbubbles-outline" size={18} color={COLORS.violet} />
              <Text style={s.docBtnTxt}>Contacter le support</Text>
            </TouchableOpacity>
          </>
        )}

        {status !== 'loading' && (
          <TouchableOpacity
            style={s.ctaWrap}
            onPress={() => router.replace('/(tabs)')}
            accessibilityRole="button"
            accessibilityLabel="Retour à l'accueil"
          >
            <View style={s.cta}>
              <Text style={s.ctaTxt}>Retour à l'accueil</Text>
            </View>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  wrap: { flex: 1, padding: 24, paddingTop: 60, alignItems: 'center' },
  circle: { width: 72, height: 72, borderRadius: 36, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  title: { fontSize: 22, fontWeight: '800', color: COLORS.text, textAlign: 'center' },
  ref: { fontSize: 13, color: COLORS.textMuted, marginTop: 6, fontWeight: '600' },
  sub: { fontSize: 14, color: '#888', marginTop: 8, textAlign: 'center', lineHeight: 20 },
  docsRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 20 },
  docsTxt: { fontSize: 13, color: COLORS.textMuted },
  docBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12, backgroundColor: '#fff', borderWidth: 1, borderColor: COLORS.border },
  docBtnTxt: { fontSize: 14, fontWeight: '700', color: COLORS.violet },
  ctaWrap: { marginTop: 28, borderRadius: 14, overflow: 'hidden', backgroundColor: '#fff', borderWidth: 1.5, borderColor: COLORS.violet },
  cta: { paddingVertical: 16, paddingHorizontal: 32 },
  ctaTxt: { color: COLORS.violet, fontSize: 16, fontWeight: '800' },
})
