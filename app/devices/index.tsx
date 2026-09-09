import React from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { COLORS, RADIUS, SHADOW, TYPO } from '../../constants/theme'
import { useDevices } from '../../hooks/useDevices'
import { useTravelers } from '../../hooks/useTravelers'
import { Device } from '../../types'

export default function DevicesScreen() {
  const router = useRouter()
  // Android SDK 35+ impose l'edge-to-edge : la barre de navigation systeme se
  // superpose au bas de l'ecran. Sans cet inset, le bouton principal passe
  // partiellement sous la barre de gestes ou les 3 boutons.
  const insets = useSafeAreaInsets()
  const { devices, loading: loadingDevices } = useDevices()
  const { travelers, loading: loadingTravelers } = useTravelers()
  const loading = loadingDevices || loadingTravelers

  const groups: { key: string; title: string; items: Device[] }[] = []
  if (!loading) {
    travelers.forEach(t => {
      const items = devices.filter(d => d.traveler_id === t.id)
      if (items.length > 0) groups.push({ key: t.id, title: t.nickname || t.first_name, items })
    })
    const noOwner = devices.filter(d => !d.traveler_id)
    if (noOwner.length > 0) groups.push({ key: 'none', title: 'Sans voyageur associe', items: noOwner })
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <LinearGradient colors={['#D251D8', '#FD7F3C']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.hero}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color="#fff" />
        </TouchableOpacity>
        <Text style={s.heroTitle}>Mes appareils</Text>
      </LinearGradient>

      {loading ? (
        <View style={s.loader}>
          <ActivityIndicator color={COLORS.violet} size="large" />
        </View>
      ) : (
        <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}
          // La barre d'action est en position absolue : sans cette reserve, le
          // dernier element de la liste reste masque dessous.
          contentContainerStyle={{ paddingBottom: 100 + insets.bottom }}
        >
          {devices.length === 0 ? (
            <View style={s.empty}>
              <View style={s.emptyIcon}>
                <Ionicons name="phone-portrait-outline" size={28} color={COLORS.violet} />
              </View>
              <Text style={s.emptyTitle}>Aucun appareil</Text>
              <Text style={s.emptyTxt}>Ajoutez les telephones sur lesquels vos eSIM sont installees.</Text>
            </View>
          ) : (
            groups.map(g => (
              <View key={g.key} style={{ marginBottom: 18 }}>
                <Text style={s.groupTitle}>{g.title}</Text>
                {g.items.map(d => (
                  <TouchableOpacity
                    key={d.id}
                    style={s.card}
                    onPress={() => router.push({ pathname: '/devices/edit', params: { id: d.id } })}
                  >
                    <View style={s.deviceIcon}>
                      <Ionicons name="phone-portrait-outline" size={20} color={COLORS.violet} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.cardName}>{d.name}</Text>
                      {(d.brand || d.model) && (
                        <Text style={s.cardSub}>{[d.brand, d.model].filter(Boolean).join(' · ')}</Text>
                      )}
                    </View>
                    <Ionicons name="chevron-forward" size={18} color="#ccc" />
                  </TouchableOpacity>
                ))}
              </View>
            ))
          )}
          <View style={{ height: 100 }} />
        </ScrollView>
      )}

      <View style={[s.ctaBar, { paddingBottom: 16 + insets.bottom }]}>
        <TouchableOpacity style={s.ctaWrap} onPress={() => router.push('/devices/edit')}>
          <View style={s.cta}>
            <Ionicons name="add" size={20} color={COLORS.violet} />
            <Text style={s.ctaTxt}>Ajouter un appareil</Text>
          </View>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  hero: { padding: 20, paddingBottom: 24, borderBottomLeftRadius: RADIUS.xl, borderBottomRightRadius: RADIUS.xl, overflow: 'hidden' },
  backBtn: { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 20, width: 36, height: 36, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  heroTitle: { color: '#fff', ...TYPO.screenTitle },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { flex: 1, padding: 16 },
  empty: { alignItems: 'center', padding: 30, backgroundColor: '#fff', borderRadius: 16, gap: 6 },
  emptyIcon: { width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(210,81,216,0.1)', justifyContent: 'center', alignItems: 'center', marginBottom: 6 },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  emptyTxt: { fontSize: 13, color: COLORS.textMuted, textAlign: 'center', lineHeight: 19 },
  groupTitle: { fontSize: 12, fontWeight: '700', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 8 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: 16, padding: 14, marginBottom: 8, ...SHADOW.card },
  deviceIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(210,81,216,0.1)', justifyContent: 'center', alignItems: 'center' },
  cardName: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  cardSub: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  ctaBar: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', padding: 16, borderTopWidth: 1, borderTopColor: COLORS.border },
  ctaWrap: { borderRadius: 14, overflow: 'hidden', backgroundColor: '#fff', borderWidth: 1.5, borderColor: COLORS.violet },
  cta: { padding: 15, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  ctaTxt: { color: COLORS.violet, fontSize: 15, fontWeight: '800' },
})
