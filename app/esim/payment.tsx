import React, { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { supabase } from '../../lib/supabase'
import { COLORS, RADIUS, SHADOW, TYPO, EUR_TO_XPF } from '../../constants/theme'
import { useCurrency, formatAmount } from '../../lib/currency'
import { validateEsimPromoCode } from '../../hooks/usePromoCode'
import { openCheckout } from '../../lib/checkout'
import { createOraCheckout, isOraPackageId } from '../../lib/oraFly'

export default function PaymentScreen() {
  const router = useRouter()
  // Android SDK 35+ impose l'edge-to-edge : la barre de navigation systeme se
  // superpose au bas de l'ecran. Sans cet inset, le bouton principal passe
  // partiellement sous la barre de gestes ou les 3 boutons.
  const insets = useSafeAreaInsets()
  const { currency } = useCurrency()
  const [loading, setLoading] = useState(false)
  const [promoCode, setPromoCode] = useState('')
  const [promoStatus, setPromoStatus] = useState<'idle' | 'loading' | 'valid' | 'invalid'>('idle')
  const [promoError, setPromoError] = useState('')
  const [discount, setDiscount] = useState<{ percentage?: number | null; amountEur?: number | null } | null>(null)
  const params = useLocalSearchParams<{
    packageId: string
    packageName: string
    price: string
    priceEur?: string
    days: string
    data: string
    country: string
  }>()

  // Les forfaits ORA FLY sont vendus depuis un stock achete d'avance, a prix
  // ferme : aucun code promo ne s'y applique.
  const isOra = isOraPackageId(params.packageId)

  // 2026-10-25 -- Le total affiche est desormais le montant REELLEMENT debite.
  //
  // Stripe debite toujours en euros, sur airalo_packages.final_price_eur (ou
  // ora_packages.final_price_eur). Avant, l'ecran derivait le prix du XPF
  // catalogue : en XPF il annoncait par exemple 673 XPF quand la carte etait
  // debitee de 6 EUR (= 716 XPF), et meme en EUR il affichait 1 EUR de trop
  // sur 385 forfaits (les prix EUR et XPF sont arrondis separement en base).
  // Le client decouvrait un autre montant chez Stripe ou sur son releve.
  //
  // Le calcul suit a l'identique l'edge function create-checkout-mobile :
  // remise en % ou en montant (EUR) sur final_price_eur, arrondi au centime.
  // Repli (ancienne navigation sans priceEur) : arrondi a l'euro superieur du
  // XPF, la regle d'affichage historique.
  const parsedEur = Number(params.priceEur)
  const baseEur = params.priceEur && Number.isFinite(parsedEur) && parsedEur > 0
    ? parsedEur
    : Math.ceil(parseInt(params.price) / EUR_TO_XPF)
  let finalEur = baseEur
  if (discount?.percentage) finalEur = baseEur * (1 - discount.percentage / 100)
  else if (discount?.amountEur) finalEur = Math.max(0, baseEur - discount.amountEur)
  finalEur = Math.round(finalEur * 100) / 100
  const discountEur = Math.round((baseEur - finalEur) * 100) / 100

  // Montant principal dans la devise choisie, equivalent XPF exact du debit.
  const xpfOf = (eur: number) => Math.round(eur * EUR_TO_XPF)
  const shown = (eur: number) => currency === 'EUR' ? formatAmount(eur, 'EUR') : formatAmount(xpfOf(eur), 'XPF')

  async function handleApplyPromo() {
    if (!promoCode.trim()) return
    setPromoStatus('loading')
    const result = await validateEsimPromoCode(promoCode.trim(), parseInt(params.price))
    if (result.isValid) {
      setDiscount({ percentage: result.discountPercentage, amountEur: result.discountAmountEur })
      setPromoStatus('valid')
    } else {
      setDiscount(null)
      setPromoError(result.error ?? 'Code promo invalide')
      setPromoStatus('invalid')
    }
  }

  async function handlePayment() {
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { Alert.alert('Erreur', 'Vous devez être connecté'); return }

      // ORA FLY (Polynésie) : paiement créé par le site, qui gère le stock et la
      // livraison. L'edge function create-checkout-mobile ne connaît qu'Airalo.
      // Le paiement s'ouvre dans le navigateur integre, comme la filiere Airalo :
      // c'est lui qui ramene sur le deep link de retour.
      if (isOra) {
        await openCheckout(await createOraCheckout(params.packageId))
        return
      }

      const { data, error } = await supabase.functions.invoke('create-checkout-mobile', {
        body: {
          packageId: params.packageId,
          customerEmail: session.user.email,
          customerName: session.user.email,
          ...(promoStatus === 'valid' ? { promoCode: promoCode.trim() } : {}),
        }
      })

      if (error || !data?.url) {
        console.error('create-checkout-mobile:', error)
        Alert.alert('Erreur', 'Impossible de créer le paiement, veuillez réessayer.')
        return
      }

      await openCheckout(data.url)

    } catch (e: any) {
      console.error('handlePayment:', e)
      Alert.alert('Erreur', 'Une erreur est survenue, veuillez réessayer.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <LinearGradient colors={['#D251D8', '#FD7F3C']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.hero}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} accessibilityRole="button" accessibilityLabel="Retour">
          <Ionicons name="arrow-back" size={20} color="#fff" />
        </TouchableOpacity>
        <Text style={s.heroTitle}>Paiement</Text>
        <Text style={s.heroSub}>{params.country}</Text>
      </LinearGradient>

      <View style={s.content}>
        <View style={s.summaryCard}>
          <Text style={s.summaryTitle}>Recapitulatif</Text>
          <View style={s.row}>
            <Text style={s.rowLabel}>Destination</Text>
            <Text style={s.rowVal}>{params.country}</Text>
          </View>
          <View style={s.row}>
            <Text style={s.rowLabel}>Forfait</Text>
            <Text style={s.rowVal}>{params.data}</Text>
          </View>
          <View style={s.row}>
            <Text style={s.rowLabel}>Durée</Text>
            <Text style={s.rowVal}>{params.days}</Text>
          </View>
          {promoStatus === 'valid' && (
            <>
              <View style={s.row}>
                <Text style={s.rowLabel}>Code promo</Text>
                <Text style={[s.rowVal,{color:COLORS.success}]}>{promoCode.trim().toUpperCase()}</Text>
              </View>
              <View style={s.row}>
                <Text style={s.rowLabel}>Remise</Text>
                <Text style={[s.rowVal,{color:COLORS.success}]}>
                  {discount?.percentage ? `-${discount.percentage} %` : `-${shown(discountEur)}`}
                </Text>
              </View>
            </>
          )}
          <View style={[s.row,{borderBottomWidth:0,marginTop:8}]}>
            <Text style={s.totalLabel}>Total</Text>
            <Text style={s.totalVal}>{shown(finalEur)}</Text>
          </View>
          {/* Le debit se fait toujours en euros : on le dit avant le paiement
              (une carte en XPF peut supporter des frais de change bancaires). */}
          <Text style={s.chargeNote}>
            {currency === 'EUR'
              ? `Montant débité : ${formatAmount(finalEur, 'EUR')} (≈ ${formatAmount(xpfOf(finalEur), 'XPF')})`
              : `Montant débité en euros : ${formatAmount(finalEur, 'EUR')}`}
          </Text>
        </View>

        <View style={s.promoCard}>
          <Text style={s.promoLabel}>Code promo</Text>
          {isOra ? (
            <Text style={s.promoNote}>Les codes promo ne s'appliquent pas aux forfaits ORA FLY.</Text>
          ) : (
          <View style={s.promoRow}>
            <TextInput
              style={s.promoInput}
              placeholder="Ex: BIENVENUE10"
              placeholderTextColor="#aaa"
              autoCapitalize="characters"
              value={promoCode}
              onChangeText={(v) => { setPromoCode(v); setPromoStatus('idle'); setDiscount(null) }}
              editable={promoStatus !== 'loading'}
            />
            <TouchableOpacity style={s.promoBtn} onPress={handleApplyPromo} disabled={!promoCode.trim() || promoStatus === 'loading'}>
              {promoStatus === 'loading' ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.promoBtnTxt}>Appliquer</Text>}
            </TouchableOpacity>
          </View>
          )}
          {!isOra && promoStatus === 'valid' && <Text style={s.promoValid}>Code appliqué avec succès</Text>}
          {!isOra && promoStatus === 'invalid' && <Text style={s.promoInvalid}>{promoError}</Text>}
        </View>

        <View style={s.infoBox}>
          <Ionicons name="information-circle-outline" size={18} color={COLORS.violet} />
          <Text style={s.infoTxt}>Vous allez etre redirige vers notre page de paiement securisee. Une fois le paiement confirme, votre eSIM sera activee automatiquement.</Text>
        </View>

        <View style={s.secureBox}>
          <Ionicons name="lock-closed-outline" size={16} color={COLORS.success} />
          <Text style={s.secureTxt}>Paiement securise par Stripe</Text>
        </View>
      </View>

      <View style={[s.ctaBar, { paddingBottom: 16 + insets.bottom }]}>
        <TouchableOpacity
          style={s.ctaWrap}
          onPress={handlePayment}
          disabled={loading}
          accessibilityRole="button"
          accessibilityLabel={`Payer ${formatAmount(finalEur, 'EUR')}`}
        >
          <LinearGradient colors={['#D251D8','#FD7F3C']} start={{x:0,y:0}} end={{x:1,y:0}} style={s.cta}>
            {loading
              ? <ActivityIndicator color="#fff" />
              : <>
                  <Ionicons name="card-outline" size={20} color="#fff" style={{marginRight:8}} />
                  <Text style={s.ctaTxt}>Payer {formatAmount(finalEur, 'EUR')}</Text>
                </>
            }
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe:{flex:1,backgroundColor:COLORS.bg},
  hero:{padding:20,paddingBottom:24,borderBottomLeftRadius:RADIUS.xl,borderBottomRightRadius:RADIUS.xl,overflow:'hidden'},
  backBtn:{backgroundColor:'rgba(255,255,255,0.2)',borderRadius:20,width:36,height:36,justifyContent:'center',alignItems:'center',marginBottom:12},
  heroTitle:{color:'#fff',...TYPO.screenTitle},
  heroSub:{color:'rgba(255,255,255,0.85)',fontSize:13,marginTop:4},
  content:{flex:1,padding:16},
  summaryCard:{backgroundColor:'#fff',borderRadius:RADIUS.lg,padding:16,marginBottom:12,...SHADOW.card},
  summaryTitle:{fontSize:15,fontWeight:'700',color:COLORS.text,marginBottom:12},
  row:{flexDirection:'row',justifyContent:'space-between',paddingVertical:9,borderBottomWidth:0.5,borderBottomColor:'#f5f5f5'},
  rowLabel:{fontSize:13,color:COLORS.textMuted},
  rowVal:{fontSize:13,fontWeight:'600',color:COLORS.text},
  totalLabel:{fontSize:15,fontWeight:'700',color:COLORS.text},
  totalVal:{fontSize:20,fontWeight:'800',color:COLORS.violet},
  chargeNote:{fontSize:12,color:COLORS.textMuted,textAlign:'right',marginTop:2},
  promoCard:{backgroundColor:'#fff',borderRadius:RADIUS.lg,padding:16,marginBottom:12,...SHADOW.card},
  promoLabel:{fontSize:12,fontWeight:'700',color:COLORS.textMuted,textTransform:'uppercase',letterSpacing:0.3,marginBottom:8},
  promoRow:{flexDirection:'row',gap:10},
  promoInput:{flex:1,backgroundColor:COLORS.bg,borderRadius:12,paddingHorizontal:14,paddingVertical:12,fontSize:14,color:COLORS.text,borderWidth:1,borderColor:COLORS.border},
  promoBtn:{backgroundColor:COLORS.violet,borderRadius:12,paddingHorizontal:16,justifyContent:'center',alignItems:'center'},
  promoBtnTxt:{color:'#fff',fontWeight:'700',fontSize:13},
  promoNote:{fontSize:13,color:COLORS.textMuted,lineHeight:18},
  promoValid:{fontSize:12,color:COLORS.success,marginTop:8,fontWeight:'600'},
  promoInvalid:{fontSize:12,color:'#B00020',marginTop:8,fontWeight:'600'},
  infoBox:{flexDirection:'row',alignItems:'flex-start',gap:10,backgroundColor:'rgba(210,81,216,0.06)',borderRadius:RADIUS.md,padding:12,marginBottom:12},
  infoTxt:{fontSize:13,color:COLORS.text,flex:1,lineHeight:20},
  secureBox:{flexDirection:'row',alignItems:'center',gap:8,backgroundColor:'#E6F9F2',borderRadius:RADIUS.md,padding:10},
  secureTxt:{fontSize:13,color:COLORS.success,fontWeight:'600'},
  ctaBar:{backgroundColor:'#fff',padding:16,borderTopWidth:1,borderTopColor:COLORS.border},
  ctaWrap:{borderRadius:14,overflow:'hidden'},
  cta:{padding:16,alignItems:'center',flexDirection:'row',justifyContent:'center'},
  ctaTxt:{color:'#fff',fontSize:16,fontWeight:'800'},
})
