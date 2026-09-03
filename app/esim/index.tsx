// Liste complete des eSIM du compte -- n'existait pas avant cette passe UX :
// l'accueil plafonne a 3 eSIM (limit(3)) sans lien "voir tout", et "Mes eSIM"
// dans le compte renvoyait vers l'accueil au lieu d'une vraie liste.
import React, { useEffect, useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { supabase } from '../../lib/supabase'
import { COLORS } from '../../constants/theme'
import { useTravelers } from '../../hooks/useTravelers'
import { useEsimAssignments } from '../../hooks/useEsimAssignments'
import { usePackageInfo, looksLikeTechnicalSlug } from '../../hooks/usePackageInfo'
import { getEsimStatus } from '../../lib/esimStatus'
import dayjs from 'dayjs'

export default function AllEsimsScreen() {
  const router = useRouter()
  const [esims, setEsims] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const { travelers } = useTravelers()
  const { byIccid: getAssignment } = useEsimAssignments()
  const { fetchPackages, getPackageDisplay } = usePackageInfo()

  useEffect(() => { loadEsims() }, [])

  async function loadEsims() {
    setLoading(true)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user?.email) { setLoading(false); return }
    const [{ data }, { data: hidden }] = await Promise.all([
      supabase
        .from('airalo_orders')
        .select('*')
        .eq('email', session.user.email)
        .order('created_at', { ascending: false }),
      session.user.id
        ? supabase.from('esim_hidden_orders').select('order_id').eq('user_id', session.user.id)
        : Promise.resolve({ data: [] as { order_id: string }[] }),
    ])
    if (data) {
      const hiddenIds = new Set((hidden ?? []).map((h) => h.order_id))
      const visible = data.filter((e) => !hiddenIds.has(e.id))
      setEsims(visible)
      fetchPackages(visible.map((e) => e.package_id))
    }
    setLoading(false)
  }

  function handleHide(orderId: string, label: string) {
    Alert.alert(
      'Masquer cette eSIM ?',
      `"${label}" ne sera plus affichée dans cette liste. Cette action n'affecte pas votre eSIM ni votre historique de commande — elle reste consultable par le support si besoin.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Masquer',
          style: 'destructive',
          onPress: async () => {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session?.user?.id) return
            const { error } = await supabase
              .from('esim_hidden_orders')
              .insert({ user_id: session.user.id, order_id: orderId })
            if (error) {
              Alert.alert('Erreur', "Impossible de masquer cette eSIM, veuillez réessayer.")
              return
            }
            setEsims((prev) => prev.filter((e) => e.id !== orderId))
          },
        },
      ]
    )
  }

  function resolveLabel(e: any): string {
    const assignment = getAssignment(e.sim_iccid)
    const traveler = assignment?.traveler_id ? travelers.find((t) => t.id === assignment.traveler_id) : undefined
    const pkgDisplay = getPackageDisplay(e.package_id)
    const rawLabel = assignment?.label
    const technical = rawLabel ? looksLikeTechnicalSlug(rawLabel, e.package_id) : false
    if (rawLabel && !technical) return rawLabel
    return traveler ? `${pkgDisplay.destination} • ${traveler.nickname || traveler.first_name}` : pkgDisplay.destination
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <LinearGradient colors={['#D251D8', '#FD7F3C']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.hero}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color="#fff" />
        </TouchableOpacity>
        <Text style={s.heroTitle}>Mes eSIM</Text>
        {!loading && <Text style={s.heroSub}>{esims.length} eSIM au total</Text>}
      </LinearGradient>

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator color={COLORS.violet} size="large" />
        </View>
      ) : esims.length === 0 ? (
        <View style={s.center}>
          <Ionicons name="hardware-chip-outline" size={48} color={COLORS.textMuted} />
          <Text style={s.emptyTitle}>Aucune eSIM pour le moment</Text>
          <TouchableOpacity style={s.emptyCta} onPress={() => router.push('/(tabs)/explore')}>
            <Text style={s.emptyCtaTxt}>Trouver une eSIM</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView style={s.scroll} contentContainerStyle={{ padding: 16 }} showsVerticalScrollIndicator={false}>
          {esims.map((e) => {
            const iccid = e.sim_iccid
            const last4 = iccid ? String(iccid).slice(-4) : null
            const { label: statusLabel, color: statusColor, isExpired } = getEsimStatus(e)
            const label = resolveLabel(e)

            return (
              <View key={e.id} style={s.card}>
                <View style={s.cardHead}>
                  <View style={s.simIcon}>
                    <Ionicons name="wifi-outline" size={20} color={COLORS.violet} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.cardTitle}>{label}</Text>
                    <Text style={s.cardSub}>
                      {e.expires_at
                        ? (isExpired ? 'Expirée le ' : 'Expire le ') + dayjs(e.expires_at).format('DD/MM/YYYY')
                        : 'Commandée le ' + dayjs(e.created_at).format('DD/MM/YYYY')}
                      {last4 ? ` · ••••${last4}` : ''}
                    </Text>
                  </View>
                  <View style={[s.pill, { backgroundColor: statusColor + '20' }]}>
                    <Text style={[s.pillTxt, { color: statusColor }]}>{statusLabel}</Text>
                  </View>
                </View>

                <View style={s.actionsRow}>
                  {iccid && !isExpired && (
                    <TouchableOpacity
                      style={s.actionBtn}
                      onPress={() => router.push({ pathname: '/esim/topup', params: { iccid, destination: getPackageDisplay(e.package_id).destination } })}
                    >
                      <Ionicons name="add-circle-outline" size={14} color={COLORS.violet} />
                      <Text style={s.actionTxt}>Recharger</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={s.actionBtn}
                    onPress={() => router.push({ pathname: '/support', params: { label, last4: last4 ?? '' } })}
                  >
                    <Ionicons name="headset-outline" size={14} color={COLORS.textMuted} />
                    <Text style={[s.actionTxt, { color: COLORS.textMuted }]}>Aide</Text>
                  </TouchableOpacity>
                  {isExpired && (
                    <TouchableOpacity style={s.actionBtn} onPress={() => handleHide(e.id, label)}>
                      <Ionicons name="eye-off-outline" size={14} color="#B00020" />
                      <Text style={[s.actionTxt, { color: '#B00020' }]}>Masquer</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            )
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  hero: { padding: 20, paddingBottom: 24 },
  backBtn: { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 20, width: 36, height: 36, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  heroTitle: { color: '#fff', fontSize: 22, fontWeight: '800' },
  heroSub: { color: 'rgba(255,255,255,0.85)', fontSize: 13, marginTop: 4 },
  scroll: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, gap: 12 },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  emptyCta: { backgroundColor: COLORS.violet, borderRadius: 12, paddingHorizontal: 20, paddingVertical: 12, marginTop: 4 },
  emptyCtaTxt: { color: '#fff', fontWeight: '700', fontSize: 14 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  simIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(210,81,216,0.1)', justifyContent: 'center', alignItems: 'center' },
  cardTitle: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  cardSub: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  pillTxt: { fontSize: 11, fontWeight: '700' },
  actionsRow: { flexDirection: 'row', gap: 14, marginTop: 12, paddingTop: 10, borderTopWidth: 0.5, borderTopColor: '#f0f0f0' },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  actionTxt: { fontSize: 12, fontWeight: '600', color: COLORS.violet },
})
