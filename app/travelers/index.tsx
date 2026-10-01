import React from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { COLORS, RADIUS, SHADOW, TYPO } from '../../constants/theme'
import { useTravelers } from '../../hooks/useTravelers'
import { useDevices } from '../../hooks/useDevices'

export default function TravelersScreen() {
  const router = useRouter()
  // Android SDK 35+ impose l'edge-to-edge : la barre de navigation systeme se
  // superpose au bas de l'ecran. Sans cet inset, le bouton principal passe
  // partiellement sous la barre de gestes ou les 3 boutons.
  const insets = useSafeAreaInsets()
  const { travelers, loading } = useTravelers()
  const { byTraveler, loading: loadingDevices } = useDevices()

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <LinearGradient colors={['#D251D8', '#FD7F3C']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.hero}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color="#fff" />
        </TouchableOpacity>
        <Text style={s.heroTitle}>Mes voyageurs</Text>
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
          {travelers.length === 0 ? (
            <View style={s.empty}>
              <View style={s.emptyIcon}>
                <Ionicons name="people-outline" size={28} color={COLORS.violet} />
              </View>
              <Text style={s.emptyTitle}>Aucun voyageur</Text>
              <Text style={s.emptyTxt}>Ajoutez les personnes qui utilisent vos eSIM pour savoir qui a quoi, en un coup d'oeil.</Text>
            </View>
          ) : (
            travelers.map(t => {
              const deviceCount = loadingDevices ? 0 : byTraveler(t.id).length
              return (
                <TouchableOpacity
                  key={t.id}
                  style={s.card}
                  onPress={() => router.push({ pathname: '/travelers/edit', params: { id: t.id } })}
                >
                  <View style={s.avatar}>
                    <Text style={s.avatarTxt}>{t.first_name[0]?.toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.cardName}>{t.nickname || t.first_name}</Text>
                    <Text style={s.cardSub}>
                      {[t.first_name, t.last_name].filter(Boolean).join(' ')}
                      {deviceCount > 0 ? ` · ${deviceCount} appareil${deviceCount > 1 ? 's' : ''}` : ''}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#ccc" />
                </TouchableOpacity>
              )
            })
          )}
          <View style={{ height: 100 }} />
        </ScrollView>
      )}

      <View style={[s.ctaBar, { paddingBottom: 16 + insets.bottom }]}>
        <TouchableOpacity style={s.ctaWrap} onPress={() => router.push('/travelers/edit')}>
          <View style={s.cta}>
            <Ionicons name="add" size={20} color={COLORS.violet} />
            <Text style={s.ctaTxt}>Ajouter un voyageur</Text>
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
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: 16, padding: 14, marginBottom: 10, ...SHADOW.card },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(210,81,216,0.12)', justifyContent: 'center', alignItems: 'center' },
  avatarTxt: { fontSize: 17, fontWeight: '800', color: COLORS.violet },
  cardName: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  cardSub: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  ctaBar: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', padding: 16, borderTopWidth: 1, borderTopColor: COLORS.border },
  ctaWrap: { borderRadius: 14, overflow: 'hidden', backgroundColor: '#fff', borderWidth: 1.5, borderColor: COLORS.violet },
  cta: { padding: 15, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  ctaTxt: { color: COLORS.violet, fontSize: 15, fontWeight: '800' },
})
