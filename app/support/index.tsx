import React, { useEffect, useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Linking, ActivityIndicator } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { COLORS } from '../../constants/theme'
import { supabase } from '../../lib/supabase'
import { usePackageInfo, looksLikeTechnicalSlug } from '../../hooks/usePackageInfo'
import { useEsimAssignments } from '../../hooks/useEsimAssignments'
import { useTravelers } from '../../hooks/useTravelers'
import {
  buildWhatsappUrl,
  buildSupportMailto,
  buildEsimWhatsappMessage,
  buildEsimMailSubject,
} from '../../constants/support'

export default function SupportScreen() {
  const router = useRouter()
  // Jamais d'ICCID complet ici : uniquement le libelle deja resolu et les
  // 4 derniers chiffres, transmis par l'ecran appelant (ex. accueil).
  const params = useLocalSearchParams<{ label?: string; last4?: string }>()
  const [esims, setEsims] = useState<any[]>([])
  const [loadingEsims, setLoadingEsims] = useState(false)
  const { fetchPackages, getPackageDisplay } = usePackageInfo()
  const { byIccid: getAssignment } = useEsimAssignments()
  const { travelers } = useTravelers()

  const contextLabel = params.label ? String(params.label) : null
  const contextLast4 = params.last4 ? String(params.last4) : null

  useEffect(() => {
    if (!contextLabel) loadEsims()
  }, [])

  async function loadEsims() {
    setLoadingEsims(true)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user?.email) { setLoadingEsims(false); return }
    const { data } = await supabase
      .from('airalo_orders')
      .select('*')
      .eq('email', session.user.email)
      .order('created_at', { ascending: false })
    if (data) {
      setEsims(data)
      fetchPackages(data.map(e => e.package_id))
    }
    setLoadingEsims(false)
  }

  function resolveEsimLabel(e: any): string {
    const assignment = getAssignment(e.sim_iccid)
    const traveler = assignment?.traveler_id ? travelers.find(t => t.id === assignment.traveler_id) : undefined
    const pkgDisplay = getPackageDisplay(e.package_id)
    const rawLabel = assignment?.label
    const technical = rawLabel ? looksLikeTechnicalSlug(rawLabel, e.package_id) : false
    if (rawLabel && !technical) return rawLabel
    return traveler ? `${pkgDisplay.destination} • ${traveler.nickname || traveler.first_name}` : pkgDisplay.destination
  }

  function openWhatsapp(message?: string) {
    Linking.openURL(buildWhatsappUrl(message))
  }
  function openMail(subject: string) {
    Linking.openURL(buildSupportMailto(subject))
  }

  const whatsappMessage = contextLabel ? buildEsimWhatsappMessage(contextLabel, contextLast4) : undefined
  const mailSubject = contextLabel ? buildEsimMailSubject(contextLabel) : 'Assistance FenuaSIM'

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <LinearGradient colors={['#D251D8', '#FD7F3C']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.hero}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color="#fff" />
        </TouchableOpacity>
        <Text style={s.heroTitle}>Besoin d'aide ?</Text>
        {contextLabel && <Text style={s.heroSub}>Concernant : {contextLabel}</Text>}
      </LinearGradient>

      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>
        <TouchableOpacity style={s.card} onPress={() => router.push('/support/chat')}>
          <View style={[s.icon, { backgroundColor: 'rgba(210,81,216,0.1)' }]}>
            <Ionicons name="sparkles" size={22} color={COLORS.violet} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.cardTitle}>Assistant IA</Text>
            <Text style={s.cardSub}>Réponses instantanées</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#ccc" />
        </TouchableOpacity>

        <TouchableOpacity style={s.card} onPress={() => openWhatsapp(whatsappMessage)}>
          <View style={[s.icon, { backgroundColor: '#E7F9F0' }]}>
            <Ionicons name="logo-whatsapp" size={22} color="#25D366" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.cardTitle}>WhatsApp</Text>
            <Text style={s.cardSub}>Contacter FenuaSIM</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#ccc" />
        </TouchableOpacity>

        <TouchableOpacity style={s.card} onPress={() => openMail(mailSubject)}>
          <View style={[s.icon, { backgroundColor: 'rgba(210,81,216,0.1)' }]}>
            <Ionicons name="mail-outline" size={22} color={COLORS.violet} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.cardTitle}>E-mail</Text>
            <Text style={s.cardSub}>Nous écrire</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#ccc" />
        </TouchableOpacity>

        {!contextLabel && (
          <>
            <Text style={s.secTitle}>Problème avec une eSIM</Text>
            {loadingEsims ? (
              <ActivityIndicator color={COLORS.violet} style={{ marginVertical: 12 }} />
            ) : esims.length === 0 ? (
              <Text style={s.emptyTxt}>Aucune eSIM sur ce compte pour le moment.</Text>
            ) : (
              esims.map(e => {
                const label = resolveEsimLabel(e)
                const last4 = e.sim_iccid ? String(e.sim_iccid).slice(-4) : null
                return (
                  <TouchableOpacity
                    key={e.id}
                    style={s.esimRow}
                    onPress={() => openWhatsapp(buildEsimWhatsappMessage(label, last4))}
                  >
                    <Ionicons name="hardware-chip-outline" size={18} color={COLORS.violet} />
                    <Text style={s.esimRowTxt}>{label}{last4 ? ` · ••••${last4}` : ''}</Text>
                    <Ionicons name="logo-whatsapp" size={16} color="#25D366" />
                  </TouchableOpacity>
                )
              })
            )}
          </>
        )}

        <Text style={s.secTitle}>Questions fréquentes</Text>
        <TouchableOpacity style={s.card} onPress={() => router.push('/support/faq')}>
          <View style={[s.icon, { backgroundColor: 'rgba(10,135,84,0.1)' }]}>
            <Ionicons name="help-circle-outline" size={22} color={COLORS.success} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.cardTitle}>FAQ</Text>
            <Text style={s.cardSub}>Questions fréquentes</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#ccc" />
        </TouchableOpacity>

        <View style={{ height: 30 }} />
      </ScrollView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  hero: { padding: 20, paddingBottom: 24 },
  backBtn: { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 20, width: 36, height: 36, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  heroTitle: { color: '#fff', fontSize: 22, fontWeight: '800' },
  heroSub: { color: 'rgba(255,255,255,0.85)', fontSize: 13, marginTop: 4 },
  scroll: { flex: 1, padding: 16 },
  secTitle: { fontSize: 15, fontWeight: '700', color: COLORS.text, marginTop: 10, marginBottom: 10 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: 16, padding: 14, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  icon: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  cardTitle: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  cardSub: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  emptyTxt: { fontSize: 13, color: COLORS.textMuted, marginBottom: 10 },
  esimRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 8, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  esimRowTxt: { flex: 1, fontSize: 13, fontWeight: '600', color: COLORS.text },
})
