import React, { useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { COLORS } from '../../constants/theme'

const FORMULAS = [
  { id: 'essentiel', icon: 'airplane-outline', name: 'Essentiel', desc: 'Annulation · Bagages', price: 890 },
  { id: 'confort', icon: 'heart-outline', name: 'Confort', desc: '+ Frais medicaux', price: 1490 },
  { id: 'globe', icon: 'shield-checkmark-outline', name: 'Globe Premium', desc: 'Couverture totale + rapatriement', price: 2200 },
]

export default function InsuranceForm() {
  const router = useRouter()
  const [destination, setDestination] = useState('')
  const [selected, setSelected] = useState('essentiel')
  const selectedFormula = FORMULAS.find(f => f.id === selected)

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <LinearGradient colors={['#FD7F3C','#D251D8']} start={{x:0,y:0}} end={{x:1,y:1}} style={s.hero}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color="#fff" />
        </TouchableOpacity>
        <Text style={s.heroLabel}>by FENUASIM</Text>
        <Text style={s.heroTitle}>Assurance voyage</Text>
        <Text style={s.heroSub}>Protection complete pour voyageurs internationaux</Text>
      </LinearGradient>

      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>
        <View style={s.formCard}>
          <Text style={s.fieldLabel}>Destination</Text>
          <View style={s.inputWrap}>
            <Ionicons name="location-outline" size={16} color="#999" />
            <TextInput
              style={s.input}
              placeholder="Ex : Japon, Europe, Monde..."
              placeholderTextColor="#aaa"
              value={destination}
              onChangeText={setDestination}
            />
          </View>
          <Text style={s.fieldLabel}>Dates du voyage</Text>
          <View style={s.dateRow}>
            <View style={[s.inputWrap, {flex:1}]}>
              <Ionicons name="calendar-outline" size={16} color="#999" />
              <TextInput style={s.input} placeholder="Depart" placeholderTextColor="#aaa" />
            </View>
            <View style={[s.inputWrap, {flex:1}]}>
              <Ionicons name="calendar-outline" size={16} color="#999" />
              <TextInput style={s.input} placeholder="Retour" placeholderTextColor="#aaa" />
            </View>
          </View>
        </View>

        <Text style={s.secTitle}>Choisissez votre formule</Text>
        {FORMULAS.map(f => (
          <TouchableOpacity
            key={f.id}
            style={[s.formulaRow, selected === f.id && s.formulaRowSel]}
            onPress={() => setSelected(f.id)}
          >
            <View style={s.formulaIcon}>
              <Ionicons name={f.icon as any} size={20} color="#FD7F3C" />
            </View>
            <View style={{flex:1}}>
              <Text style={s.formulaName}>{f.name}</Text>
              <Text style={s.formulaDesc}>{f.desc}</Text>
            </View>
            <Text style={s.formulaPrice}>{f.price.toLocaleString()} XPF</Text>
          </TouchableOpacity>
        ))}
        <View style={{height:100}} />
      </ScrollView>

      <View style={s.ctaBar}>
        <TouchableOpacity style={s.ctaWrap} onPress={() => router.push('/insurance/confirm')}>
          <LinearGradient colors={['#FD7F3C','#D251D8']} start={{x:0,y:0}} end={{x:1,y:0}} style={s.cta}>
            <Text style={s.ctaTxt}>Souscrire · {selectedFormula?.price.toLocaleString()} XPF</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe:{flex:1,backgroundColor:COLORS.bg},
  hero:{padding:20,paddingTop:16,paddingBottom:24},
  backBtn:{backgroundColor:'rgba(255,255,255,0.2)',borderRadius:20,width:36,height:36,justifyContent:'center',alignItems:'center',marginBottom:12},
  heroLabel:{color:'rgba(255,255,255,0.75)',fontSize:12,fontWeight:'600',textTransform:'uppercase',letterSpacing:0.5},
  heroTitle:{color:'#fff',fontSize:22,fontWeight:'800',marginTop:4},
  heroSub:{color:'rgba(255,255,255,0.8)',fontSize:13,marginTop:4},
  scroll:{flex:1,padding:16},
  formCard:{backgroundColor:'#fff',borderRadius:16,padding:16,marginBottom:16,shadowColor:'#000',shadowOpacity:0.05,shadowRadius:6,elevation:2},
  fieldLabel:{fontSize:12,fontWeight:'700',color:'#999',textTransform:'uppercase',letterSpacing:0.3,marginBottom:8,marginTop:4},
  inputWrap:{flexDirection:'row',alignItems:'center',gap:8,backgroundColor:COLORS.bg,borderRadius:12,paddingHorizontal:12,paddingVertical:11,borderWidth:1,borderColor:COLORS.border,marginBottom:8},
  input:{flex:1,fontSize:14,color:COLORS.text},
  dateRow:{flexDirection:'row',gap:8},
  secTitle:{fontSize:16,fontWeight:'700',color:COLORS.text,marginBottom:12},
  formulaRow:{backgroundColor:'#fff',borderRadius:14,padding:14,flexDirection:'row',alignItems:'center',gap:12,borderWidth:2,borderColor:COLORS.border,marginBottom:8,shadowColor:'#000',shadowOpacity:0.04,shadowRadius:4,elevation:1},
  formulaRowSel:{borderColor:'#D251D8',backgroundColor:'rgba(210,81,216,0.04)'},
  formulaIcon:{width:40,height:40,borderRadius:12,backgroundColor:'rgba(253,127,60,0.1)',justifyContent:'center',alignItems:'center'},
  formulaName:{fontSize:14,fontWeight:'700',color:COLORS.text},
  formulaDesc:{fontSize:12,color:'#999',marginTop:2},
  formulaPrice:{fontSize:15,fontWeight:'800',color:'#D251D8'},
  ctaBar:{backgroundColor:'#fff',padding:16,borderTopWidth:1,borderTopColor:COLORS.border},
  ctaWrap:{borderRadius:14,overflow:'hidden'},
  cta:{padding:16,alignItems:'center'},
  ctaTxt:{color:'#fff',fontSize:16,fontWeight:'800'},
})
