// Ecran d'installation d'une eSIM deja commandee.
//
// Il comble un trou reel du parcours Android : jusqu'ici les donnees
// d'installation (QR code, adresse SM-DP+, code d'activation) n'existaient que
// sur l'ecran de confirmation d'achat, vu une seule fois. Sur l'accueil, le
// seul bouton "Installer l'eSIM" ouvrait apple_installation_url sans condition
// de plateforme -- un lien Apple qui n'aboutit a rien sur Android -- et "Mes
// eSIM" n'offrait aucune installation du tout. Un utilisateur Android qui
// quittait l'ecran de confirmation n'avait donc plus aucun moyen d'installer
// son eSIM depuis l'application.
//
// Aucune logique metier nouvelle ici : on relit la ligne airalo_orders (RLS :
// uniquement les commandes du compte connecte) et on delegue l'affichage au
// bloc partage avec l'ecran de confirmation.
import React, { useEffect, useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { supabase } from '../../lib/supabase'
import { COLORS } from '../../constants/theme'
import EsimInstallBlock, { EsimInstallData, hasInstallData } from '../../components/EsimInstallBlock'

export default function EsimInstallScreen() {
  const router = useRouter()
  const { orderId, destination } = useLocalSearchParams<{ orderId: string; destination?: string }>()
  const [order, setOrder] = useState<EsimInstallData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(false)
      const { data, error: dbError } = await supabase
        .from('airalo_orders')
        .select('qr_code_url, apple_installation_url, lpa, matching_id, sharing_link, sharing_access_code')
        .eq('id', orderId)
        .maybeSingle()
      if (cancelled) return
      if (dbError) setError(true)
      else setOrder(data)
      setLoading(false)
    }
    if (orderId) load()
    else { setLoading(false); setError(true) }
    return () => { cancelled = true }
  }, [orderId])

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <LinearGradient colors={['#D251D8', '#FD7F3C']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.hero}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Retour">
          <Ionicons name="arrow-back" size={20} color="#fff" />
        </TouchableOpacity>
        <Text style={s.heroTitle}>Installer mon eSIM</Text>
        {!!destination && <Text style={s.heroSub}>{destination}</Text>}
      </LinearGradient>

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator color={COLORS.violet} size="large" />
        </View>
      ) : error || !hasInstallData(order) ? (
        <View style={s.center}>
          <Ionicons name="information-circle-outline" size={48} color={COLORS.textMuted} />
          <Text style={s.centerTitle}>Informations d'installation indisponibles</Text>
          <Text style={s.centerTxt}>
            Les données d'installation de cette eSIM ne sont pas encore disponibles ici. Elles vous ont été envoyées
            par email lors de votre commande. Notre support peut vous les renvoyer si besoin.
          </Text>
          <TouchableOpacity style={s.retryBtn} onPress={() => router.push('/support')}>
            <Text style={s.retryTxt}>Contacter le support</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView style={s.scroll} contentContainerStyle={{ padding: 16 }} showsVerticalScrollIndicator={false}>
          <EsimInstallBlock order={order!} />
          <View style={s.helpBox}>
            <Ionicons name="phone-portrait-outline" size={18} color={COLORS.violet} />
            <Text style={s.helpTxt}>
              Votre téléphone doit être compatible eSIM et déverrouillé (non bloqué par un opérateur). En cas de
              doute, vérifiez auprès de votre opérateur ou contactez notre support.
            </Text>
          </View>
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
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, gap: 10 },
  centerTitle: { fontSize: 16, fontWeight: '800', color: COLORS.text, textAlign: 'center' },
  centerTxt: { fontSize: 13, color: COLORS.textMuted, textAlign: 'center', lineHeight: 19 },
  retryBtn: { backgroundColor: COLORS.violet, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12, marginTop: 8 },
  retryTxt: { color: '#fff', fontWeight: '700', fontSize: 14 },
  helpBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: 'rgba(210,81,216,0.06)', borderRadius: 12, padding: 12 },
  helpTxt: { flex: 1, fontSize: 12, color: COLORS.text, lineHeight: 18 },
})
