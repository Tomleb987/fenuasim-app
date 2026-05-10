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
  'Philippines':'Philippines','Vietnam':'Viet Nam','India':'Inde',
  'Canada':'Canada','Mexico':'Mexique','Brazil':'Bresil',
  'United Arab Emirates':'Emirats Arabes Unis','Turkey':'Turquie',
  'Saudi Arabia':'Arabie saoudite','Egypt':'Egypte','Morocco':'Maroc',
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
  if (p.validity_days) return String(p.validity_days) + 'j'
  if (p.validity) return p.validity.replace(' days','').replace(' day','') + 'j'
  return '-'
}
function getData(p: any): string {
  if (p.is_unlimited) return 'Illimite'
  return String(p.data_amount) + ' ' + (p.data_unit ?? 'GB')
}

export default function CountryDetail() {
  const router = useRouter()
  const { country: slug } = useLocalSearchParams<{ country: string }>()
  const [plans, setPlans] = useState<any[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [countryName, setCountryName] = useState('')
  const [activeTab, setActiveTab] = useState<'forfaits'|'infos'>('forfaits')

  useEffect(() => { if (slug) fetchPlans(String(slug)) }, [slug])

  async function fetchPlans(s: string) {
    setLoading(true)
    const { data } = await supabase
      .from('airalo_packages')
      .select('id, name, region_fr, data_amount, data_unit, validity_days, validity, final_price_xpf, is_unlimited, available_topup, operator_name, includes_voice, includes_sms, networks, type')
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
      
      {/* Header compact */}
      <LinearGradient colors={grad} style={s.hero}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color="#fff" />
        </TouchableOpacity>
        <View style={s.heroContent}>
          <Text style={s.heroTitle}>{toFR(countryName)}</Text>
          {plans[0]?.networks && <Text style={s.heroSub}>{plans[0].networks}</Text>}
        </View>
      </LinearGradient>

      {/* Tabs */}
      <View style={s.tabs}>
        <TouchableOpacity style={[s.tabBtn, activeTab==='forfaits' && s.tabBtnActive]} onPress={() => setActiveTab('forfaits')}>
          <Text style={[s.tabTxt, activeTab==='forfaits' && s.tabTxtActive]}>Forfaits ({plans.length})</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.tabBtn, activeTab==='infos' && s.tabBtnActive]} onPress={() => setActiveTab('infos')}>
          <Text style={[s.tabTxt, activeTab==='infos' && s.tabTxtActive]}>Infos</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={s.loader}><ActivityIndicator color={COLORS.violet} size="large" /></View>
      ) : activeTab === 'infos' ? (
        /* INFOS — tout visible sans scroll */
        <View style={s.infoPage}>
          <View style={s.infoCard}>
            <Text style={s.infoSection}>Compatibilite</Text>
            <View style={s.infoRow}><Ionicons name="phone-portrait-outline" size={16} color={COLORS.violet} /><Text style={s.infoTxt}>iPhone XS et versions ulterieures</Text></View>
            <View style={s.infoRow}><Ionicons name="logo-android" size={16} color={COLORS.violet} /><Text style={s.infoTxt}>Android avec support eSIM</Text></View>
            {plans[0]?.networks && <View style={s.infoRow}><Ionicons name="wifi-outline" size={16} color={COLORS.violet} /><Text style={s.infoTxt}>{plans[0].networks}</Text></View>}
          </View>
          <View style={s.infoCard}>
            <Text style={s.infoSection}>Installation</Text>
            {['Achetez votre forfait','Appuyez sur Installer mon eSIM','Activez dans Reglages › Reseau mobile','Selectionnez leSIM comme donnees mobiles'].map((t,i) => (
              <View key={i} style={s.infoRow}>
                <View style={s.stepNum}><Text style={s.stepNumTxt}>{i+1}</Text></View>
                <Text style={s.infoTxt}>{t}</Text>
              </View>
            ))}
          </View>
          <View style={s.infoCard}>
            <Text style={s.infoSection}>Important</Text>
            <View style={s.infoRow}><Ionicons name="information-circle-outline" size={16} color="#FD7F3C" /><Text style={s.infoTxt}>L'eSIM s'active automatiquement a l'arrivee dans le pays</Text></View>
          </View>
        </View>
      ) : (
        /* FORFAITS — scroll horizontal seulement */
        <View style={s.forfaitsPage}>
          {/* Scroll horizontal des forfaits */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.plansScroll} contentContainerStyle={s.plansContent}>
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
                  {p.available_topup && <View style={[s.badge,s.badgeGreen]}><Text style={[s.badgeTxt,{color:COLORS.success}]}>+</Text></View>}
                </View>
                <Text style={s.planPrice}>{Math.round(p.final_price_xpf).toLocaleString()} XPF</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Récap forfait sélectionné */}
          {sel && (
            <View style={s.recap}>
              <View style={s.recapRow}><Text style={s.recapLabel}>Data</Text><Text style={s.recapVal}>{getData(sel)}</Text></View>
              <View style={s.recapRow}><Text style={s.recapLabel}>Duree</Text><Text style={s.recapVal}>{getDays(sel).replace('j',' jours')}</Text></View>
              <View style={s.recapRow}><Text style={s.recapLabel}>Reseaux</Text><Text style={[s.recapVal,{fontSize:11,flex:1,textAlign:'right'}]}>{sel.networks ?? sel.operator_name ?? '-'}</Text></View>
              <View style={s.recapRow}><Text style={s.recapLabel}>Appels</Text><Text style={s.recapVal}>{sel.includes_voice ? 'Inclus' : 'Non inclus'}</Text></View>
              <View style={[s.recapRow,{borderBottomWidth:0}]}><Text style={s.recapLabel}>SMS</Text><Text style={s.recapVal}>{sel.includes_sms ? 'Inclus' : 'Non inclus'}</Text></View>
            </View>
          )}

          {/* Features */}
          <View style={s.features}>
            {['QR code en 2 min','Activable avant le depart','Rechargeable'].map((f,i) => (
              <View key={i} style={s.featRow}>
                <LinearGradient colors={['#D251D8','#FD7F3C']} style={s.featCheck}>
                  <Ionicons name="checkmark" size={10} color="#fff" />
                </LinearGradient>
                <Text style={s.featTxt}>{f}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* CTA fixe */}
      {sel && (
        <View style={s.ctaBar}>
          <TouchableOpacity
            style={s.ctaWrap}
            onPress={() => router.push({
              pathname: '/esim/payment',
              params: {
                packageId: sel.id,
                packageName: sel.name,
                price: String(Math.round(sel.final_price_xpf)),
                days: getDays(sel).replace('j',' jours'),
                data: getData(sel),
                country: toFR(countryName)
              }
            })}
          >
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
  hero:{paddingHorizontal:16,paddingTop:12,paddingBottom:16,flexDirection:'row',alignItems:'center',gap:12},
  backBtn:{backgroundColor:'rgba(255,255,255,0.2)',borderRadius:20,width:34,height:34,justifyContent:'center',alignItems:'center'},
  heroContent:{flex:1},
  heroTitle:{color:'#fff',fontSize:20,fontWeight:'800'},
  heroSub:{color:'rgba(255,255,255,0.8)',fontSize:11,marginTop:2},
  tabs:{backgroundColor:'#fff',flexDirection:'row',borderBottomWidth:1,borderBottomColor:'#F0F0F0'},
  tabBtn:{flex:1,paddingVertical:10,alignItems:'center'},
  tabBtnActive:{borderBottomWidth:2.5,borderBottomColor:COLORS.violet},
  tabTxt:{fontSize:13,fontWeight:'600',color:'#aaa'},
  tabTxtActive:{color:COLORS.violet},
  loader:{flex:1,justifyContent:'center',alignItems:'center'},
  
  // Forfaits
  forfaitsPage:{flex:1,paddingTop:12},
  plansScroll:{paddingLeft:16,maxHeight:130,flexGrow:0},
  plansContent:{paddingRight:16,gap:10},
  planOpt:{borderWidth:1.5,borderColor:'#F0F0F0',borderRadius:14,padding:10,alignItems:'center',backgroundColor:'#fff',width:110},
  planOptSel:{borderColor:COLORS.violet,backgroundColor:'rgba(210,81,216,0.05)'},
  planData:{fontSize:14,fontWeight:'700',color:COLORS.text},
  planDays:{fontSize:11,color:'#999',marginTop:1},
  planBadges:{flexDirection:'row',gap:3,marginTop:3,flexWrap:'wrap',justifyContent:'center'},
  badge:{backgroundColor:'rgba(210,81,216,0.1)',borderRadius:20,paddingHorizontal:5,paddingVertical:1},
  badgeGreen:{backgroundColor:'rgba(10,135,84,0.1)'},
  badgeTxt:{fontSize:9,fontWeight:'700',color:COLORS.violet},
  planPrice:{fontSize:11,fontWeight:'700',color:COLORS.violet,marginTop:4},
  recap:{backgroundColor:'#fff',marginHorizontal:16,marginTop:12,borderRadius:14,padding:14,shadowColor:'#000',shadowOpacity:0.05,shadowRadius:6,elevation:2},
  recapRow:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',paddingVertical:7,borderBottomWidth:0.5,borderBottomColor:'#f5f5f5'},
  recapLabel:{fontSize:12,color:COLORS.textMuted},
  recapVal:{fontSize:13,fontWeight:'600',color:COLORS.text},
  features:{flexDirection:'row',justifyContent:'space-around',marginHorizontal:16,marginTop:12,backgroundColor:'#fff',borderRadius:14,padding:12,shadowColor:'#000',shadowOpacity:0.05,shadowRadius:4,elevation:1},
  featRow:{flexDirection:'row',alignItems:'center',gap:5},
  featCheck:{width:16,height:16,borderRadius:8,justifyContent:'center',alignItems:'center'},
  featTxt:{fontSize:11,color:'#555'},

  // Infos
  infoPage:{flex:1,padding:16,gap:10},
  infoCard:{backgroundColor:'#fff',borderRadius:14,padding:14,shadowColor:'#000',shadowOpacity:0.05,shadowRadius:4,elevation:1},
  infoSection:{fontSize:11,fontWeight:'700',color:'#999',textTransform:'uppercase',letterSpacing:0.5,marginBottom:8},
  infoRow:{flexDirection:'row',alignItems:'flex-start',gap:10,paddingVertical:6,borderBottomWidth:0.5,borderBottomColor:'#f8f8f8'},
  infoTxt:{fontSize:13,color:'#333',flex:1,lineHeight:18},
  stepNum:{width:20,height:20,borderRadius:10,backgroundColor:COLORS.violet,justifyContent:'center',alignItems:'center',flexShrink:0},
  stepNumTxt:{color:'#fff',fontSize:10,fontWeight:'800'},

  // CTA
  ctaBar:{backgroundColor:'#fff',padding:12,borderTopWidth:1,borderTopColor:'#F0F0F0'},
  ctaWrap:{borderRadius:14,overflow:'hidden'},
  ctaBtn:{padding:15,alignItems:'center'},
  ctaTxt:{color:'#fff',fontSize:15,fontWeight:'800'},
})
