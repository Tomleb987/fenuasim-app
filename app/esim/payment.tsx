import React, { useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Linking } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { supabase } from '../../lib/supabase'
import { COLORS } from '../../constants/theme'

export default function PaymentScreen() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const params = useLocalSearchParams<{
    packageId: string
    packageName: string
    price: string
    days: string
    data: string
    country: string
  }>()

  async function handlePayment() {
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { Alert.alert('Erreur', 'Vous devez etre connecte'); return }

      const { data, error } = await supabase.functions.invoke('create-checkout-mobile', {
        body: {
          packageId: params.packageId,
          customerEmail: session.user.email,
          customerName: session.user.email,
        }
      })

      if (error || !data?.url) {
        Alert.alert('Erreur', error?.message ?? 'Impossible de creer le paiement')
        return
      }

      await Linking.openURL(data.url)

    } catch (e: any) {
      Alert.alert('Erreur', e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={20} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Paiement</Text>
      </View>

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
            <Text style={s.rowLabel}>Duree</Text>
            <Text style={s.rowVal}>{params.days}</Text>
          </View>
          <View style={[s.row,{borderBottomWidth:0,marginTop:8}]}>
            <Text style={s.totalLabel}>Total</Text>
            <Text style={s.totalVal}>{parseInt(params.price).toLocaleString()} XPF</Text>
          </View>
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

      <View style={s.ctaBar}>
        <TouchableOpacity style={s.ctaWrap} onPress={handlePayment} disabled={loading}>
          <LinearGradient colors={['#D251D8','#FD7F3C']} start={{x:0,y:0}} end={{x:1,y:0}} style={s.cta}>
            {loading
              ? <ActivityIndicator color="#fff" />
              : <>
                  <Ionicons name="card-outline" size={20} color="#fff" style={{marginRight:8}} />
                  <Text style={s.ctaTxt}>Payer {parseInt(params.price).toLocaleString()} XPF</Text>
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
  header:{flexDirection:'row',alignItems:'center',padding:16,backgroundColor:'#fff',borderBottomWidth:0.5,borderBottomColor:COLORS.border},
  backBtn:{marginRight:12},
  headerTitle:{fontSize:17,fontWeight:'700',color:COLORS.text},
  content:{flex:1,padding:16},
  summaryCard:{backgroundColor:'#fff',borderRadius:16,padding:16,marginBottom:12,shadowColor:'#000',shadowOpacity:0.05,shadowRadius:6,elevation:2},
  summaryTitle:{fontSize:15,fontWeight:'700',color:COLORS.text,marginBottom:12},
  row:{flexDirection:'row',justifyContent:'space-between',paddingVertical:9,borderBottomWidth:0.5,borderBottomColor:'#f5f5f5'},
  rowLabel:{fontSize:13,color:COLORS.textMuted},
  rowVal:{fontSize:13,fontWeight:'600',color:COLORS.text},
  totalLabel:{fontSize:15,fontWeight:'700',color:COLORS.text},
  totalVal:{fontSize:20,fontWeight:'800',color:COLORS.violet},
  infoBox:{flexDirection:'row',alignItems:'flex-start',gap:10,backgroundColor:'rgba(210,81,216,0.06)',borderRadius:12,padding:12,marginBottom:12},
  infoTxt:{fontSize:13,color:COLORS.text,flex:1,lineHeight:20},
  secureBox:{flexDirection:'row',alignItems:'center',gap:8,backgroundColor:'#E6F9F2',borderRadius:10,padding:10},
  secureTxt:{fontSize:13,color:COLORS.success,fontWeight:'600'},
  ctaBar:{backgroundColor:'#fff',padding:16,borderTopWidth:1,borderTopColor:COLORS.border},
  ctaWrap:{borderRadius:14,overflow:'hidden'},
  cta:{padding:16,alignItems:'center',flexDirection:'row',justifyContent:'center'},
  ctaTxt:{color:'#fff',fontSize:16,fontWeight:'800'},
})
