import React, { useEffect, useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, TextInput } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { COLORS, RADIUS, SHADOW, EUR_TO_XPF } from '../../constants/theme'
import { useCurrency, formatAmount } from '../../lib/currency'
import { useEsimTopups } from '../../hooks/useEsimTopups'
import { EsimTopupOption } from '../../types'
import { openCheckout } from '../../lib/checkout'
import { validateEsimPromoCode } from '../../hooks/usePromoCode'

export default function EsimTopupScreen() {
  const router = useRouter()
  // Android SDK 35+ impose l'edge-to-edge : la barre de navigation systeme se
  // superpose au bas de l'ecran. Sans cet inset, le bouton principal passe
  // partiellement sous la barre de gestes ou les 3 boutons.
  const insets = useSafeAreaInsets()
  const { currency } = useCurrency()
  // 2026-10-25 : les recharges sont tarifees et debitees en euros (price_eur).
  // L'ancien affichage repassait par le XPF puis arrondissait a l'euro
  // superieur en mode EUR (5,40 EUR affiches 6 EUR). On affiche l'euro exact,
  // ou son equivalent XPF.
  const showEur = (eur: number) =>
    currency === 'EUR' ? formatAmount(eur, 'EUR') : formatAmount(Math.round(eur * EUR_TO_XPF), 'XPF')
  const { iccid, destination } = useLocalSearchParams<{ iccid: string; destination?: string }>()
  const { loading, options, compatible, error, fetchTopups, createCheckout } = useEsimTopups()
  const [selected, setSelected] = useState<EsimTopupOption | null>(null)
  const [creating, setCreating] = useState(false)
  // Code promo (2026-10-14) : meme validation que l'achat initial
  // (hooks/usePromoCode), puis revalidation et application cote serveur par
  // create-topup-checkout. Besoin : recharge avec le code AVA5.
  const [promoCode, setPromoCode] = useState('')
  const [promoStatus, setPromoStatus] = useState<'idle' | 'loading' | 'valid' | 'invalid'>('idle')
  const [promoError, setPromoError] = useState('')
  const [discount, setDiscount] = useState<{ percentage?: number | null; amountEur?: number | null } | null>(null)

  // Prix affiche apres remise, en EUR (meme formule que le serveur : % puis
  // arrondi au centime, ou montant fixe en EUR, jamais negatif).
  function discountedEur(priceEur: number) {
    if (!discount) return priceEur
    if (discount.percentage) return Math.round(priceEur * 100 * (1 - discount.percentage / 100)) / 100
    if (discount.amountEur) return Math.max(0, priceEur - discount.amountEur)
    return priceEur
  }

  async function handleApplyPromo() {
    const code = promoCode.trim()
    if (!code) return
    setPromoStatus('loading')
    const result = await validateEsimPromoCode(code, selected ? Math.round(selected.price_eur * EUR_TO_XPF) : 0)
    if (result.isValid) {
      setDiscount({ percentage: result.discountPercentage, amountEur: result.discountAmountEur })
      setPromoStatus('valid')
    } else {
      setDiscount(null)
      setPromoError(result.error ?? 'Code promo invalide')
      setPromoStatus('invalid')
    }
  }

  useEffect(() => {
    if (iccid) fetchTopups(iccid)
  }, [iccid])

  async function handleRecharge() {
    if (!selected || !iccid || creating) return
    setCreating(true)
    try {
      const { url } = await createCheckout(iccid, selected.package_id, promoStatus === 'valid' ? promoCode.trim() : undefined)
      await openCheckout(url)
    } catch (e: any) {
      console.error('handleRecharge:', e)
      // Un code promo refuse par le serveur remonte son propre message.
      const msg = typeof e?.message === 'string' && /promo/i.test(e.message) ? e.message : 'Impossible de créer le paiement, veuillez réessayer.'
      Alert.alert('Erreur', msg)
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
                  <Text style={s.optionPrice}>{showEur(discountedEur(opt.price_eur))}</Text>
                  <Ionicons
                    name={isSelected ? 'radio-button-on' : 'radio-button-off'}
                    size={20}
                    color={isSelected ? COLORS.violet : '#ccc'}
                    style={{ marginLeft: 10 }}
                  />
                </TouchableOpacity>
              )
            })}

            <Text style={[s.sectionLabel, { marginTop: 10 }]}>Code promo</Text>
            <View style={s.promoRow}>
              <TextInput
                style={s.promoInput}
                placeholder="Code promo (optionnel)"
                autoCapitalize="characters"
                autoCorrect={false}
                value={promoCode}
                onChangeText={(v) => { setPromoCode(v); if (promoStatus !== 'idle') { setPromoStatus('idle'); setDiscount(null) } }}
              />
              <TouchableOpacity style={s.promoBtn} onPress={handleApplyPromo} disabled={!promoCode.trim() || promoStatus === 'loading'}>
                {promoStatus === 'loading' ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.promoBtnTxt}>Appliquer</Text>}
              </TouchableOpacity>
            </View>
            {promoStatus === 'valid' && <Text style={s.promoValid}>Code appliqué{discount?.percentage ? ` : −${discount.percentage} %` : ''}</Text>}
            {promoStatus === 'invalid' && <Text style={s.promoErr}>{promoError}</Text>}
            <View style={{ height: 24 }} />
          </ScrollView>

          <View style={[s.ctaBar, { paddingBottom: 16 + insets.bottom }]}>
            <TouchableOpacity style={s.ctaWrap} disabled={!selected || creating} onPress={handleRecharge}>
              <LinearGradient
                colors={selected ? ['#D251D8', '#FD7F3C'] : ['#ccc', '#ccc']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={s.cta}
              >
                {creating ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={s.ctaTxt}>{selected ? `Recharger — ${showEur(discountedEur(selected.price_eur))}` : 'Choisissez une recharge'}</Text>
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
  hero: { padding: 20, paddingBottom: 24, borderBottomLeftRadius: RADIUS.xl, borderBottomRightRadius: RADIUS.xl, overflow: 'hidden' },
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
  optionCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: RADIUS.lg, padding: 14, marginBottom: 10, borderWidth: 1.5, borderColor: 'transparent', ...SHADOW.card },
  optionCardSelected: { borderColor: COLORS.violet },
  optionIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(210,81,216,0.1)', justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  optionTitle: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  optionSub: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  optionPrice: { fontSize: 15, fontWeight: '800', color: COLORS.violet },
  promoRow: { flexDirection: 'row', gap: 8 },
  promoInput: { flex: 1, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: COLORS.text },
  promoBtn: { backgroundColor: COLORS.violet, borderRadius: 12, paddingHorizontal: 16, justifyContent: 'center', alignItems: 'center' },
  promoBtnTxt: { color: '#fff', fontWeight: '700', fontSize: 13 },
  promoValid: { fontSize: 12, color: COLORS.success, marginTop: 6, fontWeight: '600' },
  promoErr: { fontSize: 12, color: '#E5484D', marginTop: 6 },
  ctaBar: { backgroundColor: '#fff', padding: 16, borderTopWidth: 1, borderTopColor: COLORS.border },
  ctaWrap: { borderRadius: 14, overflow: 'hidden' },
  cta: { padding: 16, alignItems: 'center', justifyContent: 'center' },
  ctaTxt: { color: '#fff', fontSize: 15, fontWeight: '800' },
})
