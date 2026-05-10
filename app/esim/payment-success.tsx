import React, { useEffect, useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { supabase } from '../../lib/supabase'
import { COLORS } from '../../constants/theme'

export default function PaymentSuccess() {
  const router = useRouter()
  const { session_id, package_id } = useLocalSearchParams<{ session_id: string, package_id: string }>()
  const [loading, setLoading] = useState(true)
  const [order, setOrder] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (session_id && package_id) createEsim()
  }, [session_id, package_id])

  async function createEsim() {
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Non connecte')

      // Recuperer les infos du package
      const { data: pkg } = await supabase
        .from('airalo_packages')
        .select('*')
        .eq('id', package_id)
        .single()

      if (!pkg) throw new Error('Package introuvable')

      // Appel API Next.js fenuasim.com
      const response = await fetch('https://fenuasim.com/api/create-airalo-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          packageId: pkg.id,
          airalo_id: pkg.airalo_id ?? pkg.slug,
          customerEmail: session.user.email,
          customerName: session.user.email,
          customerFirstname: '',
          quantity: 1,
          description: `Mobile app - ${pkg.name}`,
        })
      })

      const data = await response.json()

      if (!response.ok || data.error) {
        throw new Error(data.error ?? 'Erreur creation eSIM')
      }

      setOrder(data.order)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
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

  if (error) return (
    <SafeAreaView style={s.safe}>
      <View style={s.center}>
        <Ionicons name="alert-circle-outline" size={60} color="#FD7F3C" />
        <Text style={s.errorTitle}>Une erreur est survenue</Text>
        <Text style={s.errorSub}>{error}</Text>
        <TouchableOpacity style={s.retryBtn} onPress={createEsim}>
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
          <View style={s.infoRow}>
            <Ionicons name="mail-outline" size={18} color={COLORS.violet} />
            <Text style={s.infoTxt}>QR code envoye par email</Text>
          </View>
          <View style={[s.infoRow,{borderBottomWidth:0}]}>
            <Ionicons name="server-outline" size={18} color={COLORS.violet} />
            <Text style={s.infoTxt}>ICCID : {order?.sim_iccid ?? '-'}</Text>
          </View>
        </View>

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

        <TouchableOpacity style={s.ghost} onPress={() => router.push('/(tabs)')}>
          <Text style={s.ghostTxt}>Retour a l'accueil</Text>
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
  installBox:{backgroundColor:'#fff',borderRadius:16,padding:16,marginBottom:16,shadowColor:'#000',shadowOpacity:0.05,shadowRadius:6,elevation:2},
  installTitle:{fontSize:15,fontWeight:'700',color:COLORS.text,marginBottom:6},
  installSub:{fontSize:13,color:'#888',lineHeight:20,marginBottom:16},
  codeWrap:{alignItems:'center',marginBottom:16},
  codeLabel:{fontSize:12,color:'#999',fontWeight:'600',textTransform:'uppercase',letterSpacing:0.5,marginBottom:10},
  codeRow:{flexDirection:'row',gap:10},
  codeBox:{width:52,height:60,backgroundColor:COLORS.bg,borderRadius:12,justifyContent:'center',alignItems:'center',borderWidth:1.5,borderColor:'rgba(210,81,216,0.3)'},
  codeDigit:{fontSize:28,fontWeight:'800',color:COLORS.violet},
  ctaWrap:{borderRadius:14,overflow:'hidden'},
  cta:{padding:14,alignItems:'center',flexDirection:'row',justifyContent:'center'},
  ctaTxt:{color:'#fff',fontSize:15,fontWeight:'800'},
  ghost:{width:'100%',padding:14,alignItems:'center',marginTop:8},
  ghostTxt:{color:COLORS.textMuted,fontSize:14,fontWeight:'500'},
})
