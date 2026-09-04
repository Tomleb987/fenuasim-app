import React, { useEffect, useRef, useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { supabase } from '../../lib/supabase'
import { COLORS } from '../../constants/theme'

// 2026-09-04 : cet ecran ne declenche plus rien. Auparavant il appelait
// lui-meme fenuasim.com/api/create-airalo-order depuis le client, sans
// en-tete d'autorisation -- l'endpoint repondait 401 et le paiement etait
// encaisse sans qu'aucune eSIM ne soit livree. La livraison est desormais
// declenchee cote serveur par le webhook Stripe, apres verification du
// paiement (table esim_purchase_orders, fonction stripe-webhook). Cet ecran
// se contente de lire l'avancement, ce qui le rend naturellement idempotent :
// un remontage, un retour dans l'app ou une double ouverture du deep link ne
// peuvent plus provoquer de seconde commande Airalo.
const POLL_INTERVAL_MS = 2000
const POLL_MAX_ATTEMPTS = 30 // ~60 s

export default function PaymentSuccess() {
  const router = useRouter()
  const { session_id, package_id } = useLocalSearchParams<{ session_id: string, package_id: string }>()
  const [loading, setLoading] = useState(true)
  const [order, setOrder] = useState<any>(null)
  const [pkg, setPkg] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [showTechInfo, setShowTechInfo] = useState(false)
  const cancelled = useRef(false)

  useEffect(() => {
    cancelled.current = false
    if (session_id) watchOrder()
    return () => { cancelled.current = true }
  }, [session_id, package_id])

  async function watchOrder() {
    setLoading(true)
    setError(null)
    setPending(false)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Non connecte')

      if (package_id) {
        const { data: pkgData } = await supabase
          .from('airalo_packages')
          .select('*')
          .eq('id', package_id)
          .single()
        if (pkgData) setPkg(pkgData)
      }

      for (let attempt = 0; attempt < POLL_MAX_ATTEMPTS; attempt++) {
        if (cancelled.current) return

        const { data: row } = await supabase
          .from('esim_purchase_orders')
          .select('*')
          .eq('stripe_session_id', session_id)
          .maybeSingle()

        if (row?.status === 'completed') {
          // id = identifiant de commande Airalo, attendu par l'ecran d'attribution.
          setOrder({ ...row, id: row.airalo_order_id })
          setLoading(false)
          return
        }

        if (row?.status === 'failed') {
          throw new Error(row.last_error || "La creation de votre eSIM a echoue.")
        }

        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS))
      }

      // Delai depasse : le paiement est enregistre cote serveur et la livraison
      // suit son cours. On ne montre jamais d'erreur dans ce cas -- l'argent a
      // bien ete encaisse et la commande existe.
      if (!cancelled.current) {
        setPending(true)
        setLoading(false)
      }
    } catch (e: any) {
      if (!cancelled.current) {
        setError(e.message)
        setLoading(false)
      }
    }
  }

  if (loading) return (
    <SafeAreaView style={s.safe}>
      <View style={s.center}>
        <ActivityIndicator color={COLORS.violet} size="large" />
        <Text style={s.loadingTxt}>Creation de votre eSIM en cours...</Text>
      </View>
    </SafeAreaView>
  )

  if (pending) return (
    <SafeAreaView style={s.safe}>
      <View style={s.center}>
        <Ionicons name="time-outline" size={60} color={COLORS.violet} />
        <Text style={s.errorTitle}>Paiement bien recu</Text>
        <Text style={s.errorSub}>Votre eSIM est en cours de creation. Vous la retrouverez sur l'accueil et recevrez le QR code par email dans quelques instants.</Text>
        <TouchableOpacity style={s.retryBtn} onPress={watchOrder}>
          <Text style={s.retryTxt}>Actualiser</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.push('/(tabs)')}>
          <Text style={s.ghostTxt}>Retour a l'accueil</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )

  if (error) return (
    <SafeAreaView style={s.safe}>
      <View style={s.center}>
        <Ionicons name="alert-circle-outline" size={60} color="#FD7F3C" />
        <Text style={s.errorTitle}>Une erreur est survenue</Text>
        <Text style={s.errorSub}>{error}</Text>
        <TouchableOpacity style={s.retryBtn} onPress={watchOrder}>
          <Text style={s.retryTxt}>Reessayer</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.push('/(tabs)')}>
          <Text style={s.ghostTxt}>Retour a l'accueil</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )

  const accessCode = order?.sim_iccid?.slice(-4) ?? '----'

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.wrap}>
        <LinearGradient colors={['#D251D8','#FD7F3C']} style={s.circle}>
          <Ionicons name="checkmark" size={36} color="#fff" />
        </LinearGradient>
        <Text style={s.title}>eSIM commandee !</Text>
        <Text style={s.sub}>Votre eSIM est prete a installer.</Text>

        <View style={s.infoBox}>
          <View style={[s.infoRow,{borderBottomWidth:0}]}>
            <Ionicons name="mail-outline" size={18} color={COLORS.violet} />
            <Text style={s.infoTxt}>QR code envoye par email</Text>
          </View>
        </View>

        {!!order?.sim_iccid && (
          <View style={s.techBox}>
            <TouchableOpacity style={s.techToggle} onPress={() => setShowTechInfo(v => !v)}>
              <Text style={s.techToggleTxt}>Informations techniques</Text>
              <Ionicons name={showTechInfo ? 'chevron-up' : 'chevron-down'} size={16} color={COLORS.textMuted} />
            </TouchableOpacity>
            {showTechInfo && (
              <Text style={s.techDetail}>ICCID : {order.sim_iccid}</Text>
            )}
          </View>
        )}

        {order?.apple_installation_url && (
          <View style={s.installBox}>
            <Text style={s.installTitle}>Installation directe</Text>
            <Text style={s.installSub}>Utilisez ce code pour vous connecter sur esims.cloud</Text>
            <View style={s.codeWrap}>
              <Text style={s.codeLabel}>Code d'acces</Text>
              <View style={s.codeRow}>
                {accessCode.split('').map((d: string, i: number) => (
                  <View key={i} style={s.codeBox}>
                    <Text style={s.codeDigit}>{d}</Text>
                  </View>
                ))}
              </View>
            </View>
            <TouchableOpacity
              style={s.ctaWrap}
              onPress={() => {
                const { Linking } = require('react-native')
                Linking.openURL(order.apple_installation_url)
              }}
            >
              <LinearGradient colors={['#D251D8','#FD7F3C']} start={{x:0,y:0}} end={{x:1,y:0}} style={s.cta}>
                <Ionicons name="download-outline" size={20} color="#fff" style={{marginRight:8}} />
                <Text style={s.ctaTxt}>Installer mon eSIM</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}

        {order?.sim_iccid && (
          <TouchableOpacity
            style={s.ctaWrap}
            onPress={() => router.push({
              pathname: '/esim/assign',
              params: {
                iccid: order.sim_iccid,
                airaloOrderId: order.id ? String(order.id) : undefined,
                destination: pkg?.region_fr || pkg?.name || '',
              }
            })}
          >
            <LinearGradient colors={['#D251D8','#FD7F3C']} start={{x:0,y:0}} end={{x:1,y:0}} style={s.cta}>
              <Ionicons name="person-add-outline" size={18} color="#fff" style={{marginRight:8}} />
              <Text style={s.ctaTxt}>Attribuer cette eSIM</Text>
            </LinearGradient>
          </TouchableOpacity>
        )}

        {!!order?.sim_iccid && (
          <View style={s.upsellBox}>
            <View style={s.upsellHead}>
              <Ionicons name="shield-checkmark-outline" size={20} color={COLORS.violet} />
              <Text style={s.upsellTitle}>Protégez votre voyage</Text>
            </View>
            <Text style={s.upsellSub}>Frais médicaux, annulation, bagages... souscrivez une assurance voyage AVA en quelques minutes.</Text>
            <TouchableOpacity style={s.upsellBtn} onPress={() => router.push('/(tabs)/insurance')}>
              <Text style={s.upsellBtnTxt}>Voir les offres d'assurance</Text>
              <Ionicons name="arrow-forward" size={16} color={COLORS.violet} />
            </TouchableOpacity>
          </View>
        )}

        <TouchableOpacity style={s.ghost} onPress={() => router.push('/(tabs)')}>
          <Text style={s.ghostTxt}>{order?.sim_iccid ? 'Plus tard' : "Retour a l'accueil"}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe:{flex:1,backgroundColor:COLORS.bg},
  center:{flex:1,justifyContent:'center',alignItems:'center',padding:32,gap:12},
  loadingTxt:{fontSize:15,color:COLORS.textMuted,textAlign:'center'},
  errorTitle:{fontSize:20,fontWeight:'800',color:COLORS.text,textAlign:'center'},
  errorSub:{fontSize:14,color:'#888',textAlign:'center'},
  retryBtn:{backgroundColor:COLORS.violet,borderRadius:12,paddingHorizontal:24,paddingVertical:12,marginTop:8},
  retryTxt:{color:'#fff',fontWeight:'700',fontSize:14},
  wrap:{flex:1,padding:24,paddingTop:40},
  circle:{width:72,height:72,borderRadius:36,justifyContent:'center',alignItems:'center',marginBottom:16,alignSelf:'center'},
  title:{fontSize:22,fontWeight:'800',color:COLORS.text,textAlign:'center'},
  sub:{fontSize:14,color:'#888',marginTop:6,textAlign:'center',marginBottom:20},
  infoBox:{backgroundColor:'#fff',borderRadius:16,padding:16,marginBottom:12,shadowColor:'#000',shadowOpacity:0.05,shadowRadius:6,elevation:2},
  infoRow:{flexDirection:'row',alignItems:'center',gap:10,paddingVertical:9,borderBottomWidth:0.5,borderBottomColor:'#f5f5f5'},
  infoTxt:{fontSize:14,color:COLORS.text,fontWeight:'500'},
  techBox:{marginBottom:12},
  techToggle:{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:6,paddingVertical:6},
  techToggleTxt:{fontSize:12,color:COLORS.textMuted,fontWeight:'600'},
  techDetail:{fontSize:12,color:'#aaa',textAlign:'center',marginTop:2},
  installBox:{backgroundColor:'#fff',borderRadius:16,padding:16,marginBottom:16,shadowColor:'#000',shadowOpacity:0.05,shadowRadius:6,elevation:2},
  installTitle:{fontSize:15,fontWeight:'700',color:COLORS.text,marginBottom:6},
  installSub:{fontSize:13,color:'#888',lineHeight:20,marginBottom:16},
  codeWrap:{alignItems:'center',marginBottom:16},
  codeLabel:{fontSize:12,color:COLORS.textMuted,fontWeight:'600',textTransform:'uppercase',letterSpacing:0.5,marginBottom:10},
  codeRow:{flexDirection:'row',gap:10},
  codeBox:{width:52,height:60,backgroundColor:COLORS.bg,borderRadius:12,justifyContent:'center',alignItems:'center',borderWidth:1.5,borderColor:'rgba(210,81,216,0.3)'},
  codeDigit:{fontSize:28,fontWeight:'800',color:COLORS.violet},
  ctaWrap:{borderRadius:14,overflow:'hidden'},
  cta:{padding:14,alignItems:'center',flexDirection:'row',justifyContent:'center'},
  ctaTxt:{color:'#fff',fontSize:15,fontWeight:'800'},
  ghost:{width:'100%',padding:14,alignItems:'center',marginTop:8},
  ghostTxt:{color:COLORS.textMuted,fontSize:14,fontWeight:'500'},
  upsellBox:{backgroundColor:'#fff',borderRadius:16,padding:16,marginTop:4,shadowColor:'#000',shadowOpacity:0.05,shadowRadius:6,elevation:2},
  upsellHead:{flexDirection:'row',alignItems:'center',gap:8,marginBottom:6},
  upsellTitle:{fontSize:15,fontWeight:'700',color:COLORS.text},
  upsellSub:{fontSize:13,color:'#888',lineHeight:19,marginBottom:14},
  upsellBtn:{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:6,borderWidth:1.5,borderColor:COLORS.violet,borderRadius:12,paddingVertical:12},
  upsellBtnTxt:{color:COLORS.violet,fontWeight:'700',fontSize:14},
})
