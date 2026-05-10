import React, { useEffect, useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { supabase } from '../../lib/supabase'
import { COLORS } from '../../constants/theme'

const FR: Record<string,string> = {
  'Japan':'Japon','United States':'Etats-Unis','Australia':'Australie',
  'France':'France','New Zealand':'Nouvelle-Zelande','United Kingdom':'Royaume-Uni',
  'Germany':'Allemagne','Spain':'Espagne','Italy':'Italie','Portugal':'Portugal',
  'Netherlands':'Pays-Bas','Belgium':'Belgique','Switzerland':'Suisse',
  'South Korea':'Coree du Sud','China':'Chine','Thailand':'Thailande',
  'Indonesia':'Indonesie','Malaysia':'Malaisie','Singapore':'Singapour',
  'Philippines':'Philippines','Vietnam':'Vietnam','India':'Inde',
  'Canada':'Canada','Mexico':'Mexique','Brazil':'Bresil',
  'United Arab Emirates':'Emirats Arabes Unis','Turkey':'Turquie',
  'Saudi Arabia':'Arabie Saoudite','Egypt':'Egypte','Morocco':'Maroc',
  'South Africa':'Afrique du Sud','Kenya':'Kenya',
}

const GRAD: Record<string,[string,string]> = {
  'Japan':['#FF6B6B','#FF8E53'],
  'United States':['#4776E6','#8E54E9'],
  'Australia':['#11998e','#38ef7d'],
  'France':['#2980B9','#6DD5FA'],
  'New Zealand':['#093028','#237A57'],
  'United Kingdom':['#141E30','#243B55'],
}

function toFR(n: string) { return FR[n] ?? n }
function getGrad(n: string): [string,string] { return GRAD[n] ?? ['#D251D8','#FD7F3C'] }
function getDays(p: any): string {
  if (p.validity_days) return String(p.validity_days) + ' jours'
  if (p.validity) return p.validity.replace(' days','').replace(' day','') + ' jours'
  return '-'
}
function getData(p: any): string {
  if (p.is_unlimited) return 'Illimite'
  return String(p.data_amount) + ' ' + (p.data_unit ?? 'GB')
}

const FEATURES = [
  'Installation par QR code en 2 min',
  'Activable avant le depart',
  'Rechargeable depuis lapp',
  'Compatible iPhone et Android',
]

export default function CountryDetail() {
  const router = useRouter()
  const { country: slug } = useLocalSearchParams<{ country: string }>()
  const [plans, setPlans] = useState<any[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [countryName, setCountryName] = useState('')

  useEffect(() => { if (slug) fetchPlans(String(slug)) }, [slug])

  async function fetchPlans(s: string) {
    setLoading(true)
    const { data } = await supabase
      .from('airalo_packages')
      .select('id, name, region_fr, data_amount, data_unit, validity_days, validity, final_price_xpf, is_unlimited, available_topup, operator_name, includes_voice, includes_sms, networks')
      .eq('status', 'active')
      .eq('slug', s)
      .order('final_price_xpf', { ascending: true })
    if (data && data.length > 0) {
      setPlans(data)
      setSelected(data[0].id)
      setCountryName(data[0].region_fr ?? s)
    }
    setLoading(false)
  }

  const sel = plans.find(p => p.id === selected)
  const grad = getGrad(countryName)

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <LinearGradient colors={grad} style={s.hero}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color="#fff" />
        </TouchableOpacity>
        <Text style={s.heroTitle}>{toFR(countryName)}</Text>
        <Text style={s.heroSub}>4G/5G · Reseau local</Text>
      </LinearGradient>

      <View style={s.tabs}>
        <Text style={[s.tab, s.tabActive]}>Forfaits</Text>
        <Text style={s.tab}>Infos</Text>
      </View>

      {loading ? (
        <View style={s.loader}><ActivityIndicator color={COLORS.violet} size="large" /></View>
      ) : (
        <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>
          <Text style={s.secLabel}>{plans.length} forfait{plans.length > 1 ? 's' : ''} disponible{plans.length > 1 ? 's' : ''}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom:20}}>
            {plans.map(p => (
              <TouchableOpacity
                key={p.id}
                style={[s.planOpt, selected === p.id && s.planOptSel]}
                onPress={() => setSelected(p.id)}
              >
                <Text style={s.planData}>{getData(p)}</Text>
                <Text style={s.planDays}>{getDays(p)}</Text>
                <View style={s.planBadges}>
                  {p.includes_voice && <View style={s.badge}><Text style={s.badgeTxt}>Appels</Text></View>}
                  {p.includes_sms && <View style={s.badge}><Text style={s.badgeTxt}>SMS</Text></View>}
                  {p.available_topup && <View style={[s.badge,s.badgeGreen]}><Text style={[s.badgeTxt,{color:'#0A8754'}]}>Rechargeable</Text></View>}
                </View>
                <Text style={s.planPrice}>{Math.round(p.final_price_xpf).toLocaleString()} XPF</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {sel && (
            <View style={s.selectedCard}>
              <Text style={s.selectedTitle}>Forfait selectionne</Text>
              <View style={s.row}>
                <Text style={s.rowLabel}>Data</Text>
                <Text style={s.rowVal}>{getData(sel)}</Text>
              </View>
              <View style={s.row}>
                <Text style={s.rowLabel}>Duree</Text>
                <Text style={s.rowVal}>{getDays(sel)}</Text>
              </View>
              <View style={s.row}>
                <Text style={s.rowLabel}>Operateur</Text>
                <Text style={s.rowVal}>{sel.operator_name ?? 'Local'}</Text>
              </View>
              <View style={s.row}>
                <Text style={s.rowLabel}>Appels</Text>
                <Text style={s.rowVal}>{sel.includes_voice ? 'Inclus' : 'Non inclus'}</Text>
              </View>
              <View style={s.row}>
                <Text style={s.rowLabel}>SMS</Text>
                <Text style={s.rowVal}>{sel.includes_sms ? 'Inclus' : 'Non inclus'}</Text>
              </View>
              <View style={[s.row,{borderBottomWidth:0}]}>
                <Text style={s.rowLabel}>Prix</Text>
                <Text style={[s.rowVal,{color:COLORS.violet,fontWeight:'800'}]}>{Math.round(sel.final_price_xpf).toLocaleString()} XPF</Text>
              </View>
            </View>
          )}

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
      )}

      {sel && (
        <View style={s.ctaBar}>
          <TouchableOpacity style={s.ctaWrap} onPress={() => router.push({ pathname: '/esim/payment', params: { packageId: sel.id, packageName: sel.name, price: String(Math.round(sel.final_price_xpf)), days: getDays(sel), data: getData(sel), country: toFR(countryName) } })}>
            <LinearGradient colors={['#D251D8','#FD7F3C']} start={{x:0,y:0}} end={{x:1,y:0}} style={s.ctaBtn}>
              <Text style={s.ctaTxt}>Acheter · {Math.round(sel.final_price_xpf).toLocaleString()} XPF</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe:{flex:1,backgroundColor:COLORS.bg},
  hero:{padding:20,paddingBottom:24},
  backBtn:{backgroundColor:'rgba(255,255,255,0.2)',borderRadius:20,width:36,height:36,justifyContent:'center',alignItems:'center',marginBottom:12},
  heroTitle:{color:'#fff',fontSize:24,fontWeight:'800'},
  heroSub:{color:'rgba(255,255,255,0.8)',fontSize:13,marginTop:4},
  tabs:{backgroundColor:'#fff',flexDirection:'row',borderBottomWidth:1.5,borderBottomColor:'#F0F0F0'},
  tab:{flex:1,textAlign:'center',paddingVertical:12,fontSize:13,fontWeight:'600',color:'#aaa'},
  tabActive:{color:COLORS.violet,borderBottomWidth:2.5,borderBottomColor:COLORS.violet},
  loader:{flex:1,justifyContent:'center',alignItems:'center'},
  scroll:{flex:1,padding:16},
  secLabel:{fontSize:13,fontWeight:'600',color:'#999',textTransform:'uppercase',letterSpacing:0.5,marginBottom:12},
  planOpt:{borderWidth:1.5,borderColor:'#F0F0F0',borderRadius:14,padding:12,alignItems:'center',backgroundColor:'#fff',marginRight:10,minWidth:110},
  planOptSel:{borderColor:COLORS.violet,backgroundColor:'rgba(210,81,216,0.05)'},
  planData:{fontSize:15,fontWeight:'700',color:COLORS.text},
  planDays:{fontSize:11,color:'#999',marginTop:2},
  planPrice:{fontSize:12,fontWeight:'600',color:COLORS.violet,marginTop:6},
  planBadges:{flexDirection:'row',gap:4,marginTop:4,flexWrap:'wrap'},
  badge:{backgroundColor:'rgba(210,81,216,0.1)',borderRadius:20,paddingHorizontal:6,paddingVertical:2},
  badgeGreen:{backgroundColor:'rgba(10,135,84,0.1)'},
  badgeTxt:{fontSize:9,fontWeight:'700',color:COLORS.violet},
  selectedCard:{backgroundColor:'#fff',borderRadius:16,padding:16,marginBottom:16,shadowColor:'#000',shadowOpacity:0.05,shadowRadius:6,elevation:2},
  selectedTitle:{fontSize:14,fontWeight:'700',color:COLORS.text,marginBottom:12},
  row:{flexDirection:'row',justifyContent:'space-between',paddingVertical:8,borderBottomWidth:0.5,borderBottomColor:'#f5f5f5'},
  rowLabel:{fontSize:13,color:COLORS.textMuted},
  rowVal:{fontSize:13,fontWeight:'600',color:COLORS.text},
  featRow:{flexDirection:'row',alignItems:'center',gap:10,paddingVertical:9,borderBottomWidth:0.5,borderBottomColor:'#f5f5f5'},
  featCheck:{width:20,height:20,borderRadius:10,justifyContent:'center',alignItems:'center'},
  featTxt:{fontSize:13,color:'#333',flex:1},
  ctaBar:{backgroundColor:'#fff',padding:16,borderTopWidth:1,borderTopColor:'#F0F0F0'},
  ctaWrap:{borderRadius:14,overflow:'hidden'},
  ctaBtn:{padding:16,alignItems:'center'},
  ctaTxt:{color:'#fff',fontSize:16,fontWeight:'800'},
})
