import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { COLORS } from '../../constants/theme'

const COUNTRIES: Record<string, any> = {
  JP: { flag: '🇯🇵', country: 'Japon', sub: '4G/5G · Reseau national', c1: '#FF6B6B', c2: '#FF8E53' },
  US: { flag: '🇺🇸', country: 'Etats-Unis', sub: '4G LTE · Couverture nationale', c1: '#4776E6', c2: '#8E54E9' },
  AU: { flag: '🇦🇺', country: 'Australie', sub: '4G LTE · Reseau national', c1: '#11998e', c2: '#38ef7d' },
  FR: { flag: '🇫🇷', country: 'France', sub: '4G/5G · Reseau national', c1: '#2980B9', c2: '#6DD5FA' },
  NZ: { flag: '🇳🇿', country: 'N.-Zelande', sub: '4G LTE · Reseau national', c1: '#093028', c2: '#237A57' },
  GB: { flag: '🇬🇧', country: 'Royaume-Uni', sub: '4G/5G · Reseau national', c1: '#141E30', c2: '#243B55' },
}

const PLANS = [
  { id: '1', data: '5 GB', days: 7, price: 1900, best: true },
  { id: '2', data: '10 GB', days: 15, price: 2800, best: false },
  { id: '3', data: 'Illimite', days: 30, price: 3900, best: false },
]

const FEATURES = [
  'Installation par QR code en 2 min',
  'Activable avant le depart',
  'Rechargeable depuis lapp',
  'Compatible iPhone et Android',
]

export default function CountryDetail() {
  const router = useRouter()
  const { country: code } = useLocalSearchParams<{ country: string }>()
  const info = COUNTRIES[code ?? 'JP'] ?? COUNTRIES['JP']
  const [selected, setSelected] = React.useState('1')

  const selectedPlan = PLANS.find(p => p.id === selected)

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <LinearGradient colors={[info.c1, info.c2]} style={s.hero}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color="#fff" />
        </TouchableOpacity>
        <Text style={s.heroFlag}>{info.flag}</Text>
        <Text style={s.heroTitle}>{info.country}</Text>
        <Text style={s.heroSub}>{info.sub}</Text>
      </LinearGradient>

      <View style={s.tabs}>
        <Text style={[s.tab, s.tabActive]}>Forfaits</Text>
        <Text style={s.tab}>Infos</Text>
        <Text style={s.tab}>Avis</Text>
      </View>

      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>
        <Text style={s.secLabel}>Choisissez votre forfait</Text>
        <View style={s.plans}>
          {PLANS.map(p => (
            <TouchableOpacity
              key={p.id}
              style={[s.planOpt, selected === p.id && s.planOptSel]}
              onPress={() => setSelected(p.id)}
            >
              {p.best && (
                <LinearGradient colors={['#D251D8','#FD7F3C']} start={{x:0,y:0}} end={{x:1,y:0}} style={s.bestBadge}>
                  <Text style={s.bestTxt}>Meilleur choix</Text>
                </LinearGradient>
              )}
              <Text style={s.planData}>{p.data}</Text>
              <Text style={s.planDays}>{p.days} jours</Text>
              <Text style={s.planPrice}>{p.price.toLocaleString()} XPF</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={s.secLabel}>Inclus</Text>
        {FEATURES.map(f => (
          <View key={f} style={s.featRow}>
            <LinearGradient colors={['#D251D8','#FD7F3C']} style={s.featCheck}>
              <Ionicons name="checkmark" size={12} color="#fff" />
            </LinearGradient>
            <Text style={s.featTxt}>{f}</Text>
          </View>
        ))}
        <View style={{height:100}} />
      </ScrollView>

      <View style={s.ctaBar}>
        <TouchableOpacity
          style={s.ctaWrap}
          onPress={() => router.push('/esim/confirm')}
        >
          <LinearGradient colors={['#D251D8','#FD7F3C']} start={{x:0,y:0}} end={{x:1,y:0}} style={s.ctaBtn}>
            <Text style={s.ctaTxt}>Acheter · {selectedPlan?.price.toLocaleString()} XPF</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}

import React from 'react'

const s = StyleSheet.create({
  safe:{flex:1,backgroundColor:COLORS.bg},
  hero:{padding:20,paddingBottom:24,alignItems:'center'},
  backBtn:{position:'absolute',top:16,left:16,backgroundColor:'rgba(255,255,255,0.2)',borderRadius:20,width:36,height:36,justifyContent:'center',alignItems:'center'},
  heroFlag:{fontSize:56,marginBottom:8},
  heroTitle:{color:'#fff',fontSize:22,fontWeight:'800'},
  heroSub:{color:'rgba(255,255,255,0.8)',fontSize:13,marginTop:4},
  tabs:{backgroundColor:'#fff',flexDirection:'row',borderBottomWidth:1.5,borderBottomColor:'#F0F0F0'},
  tab:{flex:1,textAlign:'center',paddingVertical:12,fontSize:13,fontWeight:'600',color:'#aaa'},
  tabActive:{color:COLORS.violet,borderBottomWidth:2.5,borderBottomColor:COLORS.violet},
  scroll:{flex:1,padding:16},
  secLabel:{fontSize:13,fontWeight:'600',color:'#999',textTransform:'uppercase',letterSpacing:0.5,marginBottom:12,marginTop:4},
  plans:{flexDirection:'row',gap:8,marginBottom:20},
  planOpt:{flex:1,borderWidth:1.5,borderColor:'#F0F0F0',borderRadius:14,padding:12,alignItems:'center',backgroundColor:'#fff'},
  planOptSel:{borderColor:COLORS.violet,backgroundColor:'rgba(210,81,216,0.05)'},
  bestBadge:{borderRadius:20,paddingHorizontal:8,paddingVertical:3,marginBottom:6},
  bestTxt:{color:'#fff',fontSize:9,fontWeight:'700'},
  planData:{fontSize:15,fontWeight:'700',color:COLORS.text},
  planDays:{fontSize:11,color:'#999',marginTop:2},
  planPrice:{fontSize:12,fontWeight:'600',color:COLORS.violet,marginTop:6},
  featRow:{flexDirection:'row',alignItems:'center',gap:10,paddingVertical:9,borderBottomWidth:0.5,borderBottomColor:'#f5f5f5'},
  featCheck:{width:20,height:20,borderRadius:10,justifyContent:'center',alignItems:'center'},
  featTxt:{fontSize:13,color:'#333',flex:1},
  ctaBar:{backgroundColor:'#fff',padding:16,borderTopWidth:1,borderTopColor:'#F0F0F0'},
  ctaWrap:{borderRadius:14,overflow:'hidden'},
  ctaBtn:{padding:16,alignItems:'center'},
  ctaTxt:{color:'#fff',fontSize:16,fontWeight:'800'},
})
