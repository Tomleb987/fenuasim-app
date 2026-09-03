import React, { useEffect, useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Linking } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { COLORS, EUR_TO_XPF } from '../../constants/theme'
import { useEsimTopups } from '../../hooks/useEsimTopups'
import { EsimTopupOption } from '../../types'

export default function EsimTopupScreen() {
  const router = useRouter()
  const { iccid, destination } = useLocalSearchParams<{ iccid: string; destination?: string }>()
  const { loading, options, compatible, error, fetchTopups, createCheckout } = useEsimTopups()
  const [selected, setSelected] = useState<EsimTopupOption | null>(null)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    if (iccid) fetchTopups(iccid)
  }, [iccid])

  async function handleRecharge() {
    if (!selected || !iccid || creating) return
    setCreating(true)
    try {
      const { url } = await createCheckout(iccid, selected.package_id)
      await Linking.openURL(url)
    } catch (e: any) {
      console.error('handleRecharge:', e)
      Alert.alert('Erreur', 'Impossible de créer le paiement, veuillez réessayer.')
    } finally {
      setCreating(false)
    }
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <LinearGradient colors={['#D251D8', '#FD7F3C']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.hero}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color="#fff" />
        </TouchableOpacity>
        <Text style={s.heroTitle}>Recharger mon eSIM</Text>
        {!!destination && <Text style={s.heroSub}>{destination}</Text>}
        {!!iccid && <Text style={s.heroSub}>eSIM •••• {String(iccid).slice(-4)}</Text>}
      </LinearGradient>

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator color={COLORS.violet} size="large" />
          <Text style={s.centerTxt}>Recherche des recharges disponibles...</Text>
        </View>
      ) : error ? (
        <View style={s.center}>
          <Ionicons name="alert-circle-outline" size={48} color="#FD7F3C" />
          <Text style={s.centerTitle}>Service indisponible</Text>
          <Text style={s.centerTxt}>Le service est temporairement indisponible. Veuillez réessayer dans quelques instants.</Text>
          <TouchableOpacity style={s.retryBtn} onPress={() => iccid && fetchTopups(iccid)}>
            <Text style={s.retryTxt}>Réessayer</Text>
          </TouchableOpacity>
        </View>
      ) : compatible === false || options.length === 0 ? (
        <View style={s.center}>
          <Ionicons name="server-outline" size={48} color={COLORS.textMuted} />
          <Text style={s.centerTitle}>Recharge non disponible pour ce forfait</Text>
          <Text style={s.centerTxt}>Ce forfait ne propose pas de recharge. Vous pouvez acheter une nouvelle eSIM à la place.</Text>
          <TouchableOpacity style={s.retryBtn} onPress={() => router.push('/(tabs)/explore')}>
            <Text style={s.retryTxt}>Acheter une nouvelle eSIM</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>
            <Text style={s.sectionLabel}>Choisissez votre recharge</Text>
            {options.map((opt) => {
              const isSelected = selected?.package_id === opt.package_id
              return (
                <TouchableOpacity
                  key={opt.package_id}
                  style={[s.optionCard, isSelected && s.optionCardSelected]}
                  onPress={() => setSelected(opt)}
                >
                  <View style={s.optionIcon}>
                    <Ionicons name="server-outline" size={20} color={COLORS.violet} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.optionTitle}>{opt.is_unlimited ? 'Données illimitées' : (opt.data_label ?? opt.title ?? '-')}</Text>
                    {!!opt.validity_days && <Text style={s.optionSub}>{opt.validity_days} jours</Text>}
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={s.optionPrice}>{Math.round(opt.price_eur * EUR_TO_XPF).toLocaleString('fr-FR')} XPF</Text>
                    <Text style={s.optionPriceSub}>{opt.price_eur} €</Text>
                  </View>
                  <Ionicons
                    name={isSelected ? 'radio-button-on' : 'radio-button-off'}
                    size={20}
                    color={isSelected ? COLORS.violet : '#ccc'}
                    style={{ marginLeft: 10 }}
                  />
                </TouchableOpacity>
              )
            })}
          </ScrollView>

          <View style={s.ctaBar}>
            <TouchableOpacity style={s.ctaWrap} disabled={!selected || creating} onPress={handleRecharge}>
              <LinearGradient
                colors={selected ? ['#D251D8', '#FD7F3C'] : ['#ccc', '#ccc']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={s.cta}
              >
                {creating ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={s.ctaTxt}>{selected ? `Recharger — ${Math.round(selected.price_eur * EUR_TO_XPF).toLocaleString('fr-FR')} XPF` : 'Choisissez une recharge'}</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </>
      )}
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  hero: { padding: 20, paddingBottom: 24 },
  backBtn: { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 20, width: 36, height: 36, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  heroTitle: { color: '#fff', fontSize: 20, fontWeight: '800' },
  heroSub: { color: 'rgba(255,255,255,0.85)', fontSize: 13, marginTop: 4 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, gap: 10 },
  centerTitle: { fontSize: 17, fontWeight: '800', color: COLORS.text, textAlign: 'center' },
  centerTxt: { fontSize: 13, color: COLORS.textMuted, textAlign: 'center', lineHeight: 19 },
  retryBtn: { backgroundColor: COLORS.violet, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12, marginTop: 8 },
  retryTxt: { color: '#fff', fontWeight: '700', fontSize: 14 },
  scroll: { flex: 1, padding: 16 },
  sectionLabel: { fontSize: 13, fontWeight: '700', color: COLORS.textMuted, marginBottom: 10, textTransform: 'uppercase' },
  optionCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1.5, borderColor: 'transparent', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  optionCardSelected: { borderColor: COLORS.violet },
  optionIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(210,81,216,0.1)', justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  optionTitle: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  optionSub: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  optionPrice: { fontSize: 15, fontWeight: '800', color: COLORS.violet },
  optionPriceSub: { fontSize: 11, color: COLORS.textMuted, marginTop: 1 },
  ctaBar: { backgroundColor: '#fff', padding: 16, borderTopWidth: 1, borderTopColor: COLORS.border },
  ctaWrap: { borderRadius: 14, overflow: 'hidden' },
  cta: { padding: 16, alignItems: 'center', justifyContent: 'center' },
  ctaTxt: { color: '#fff', fontSize: 15, fontWeight: '800' },
})
