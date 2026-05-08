import React, { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { supabase } from '../../lib/supabase'
import { COLORS } from '../../constants/theme'

export default function RegisterScreen() {
  const router = useRouter()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleRegister() {
    if (!fullName || !email || !password) { Alert.alert('Erreur', 'Remplissez tous les champs'); return }
    if (password.length < 6) { Alert.alert('Erreur', 'Mot de passe trop court (6 caracteres min)'); return }
    setLoading(true)
    const { error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: fullName } } })
    setLoading(false)
    if (error) Alert.alert('Erreur', error.message)
    else { Alert.alert('Compte cree !', 'Verifiez votre email pour confirmer votre compte.'); router.replace('/(auth)/login') }
  }

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={s.kav}>
        <ScrollView>
          <LinearGradient colors={['#D251D8','#FD7F3C']} start={{x:0,y:0}} end={{x:1,y:1}} style={s.hero}>
            <Text style={s.logo}>FENUASIM</Text>
            <Text style={s.heroSub}>Creez votre compte</Text>
          </LinearGradient>
          <View style={s.form}>
            <Text style={s.formTitle}>Inscription</Text>
            <Text style={s.label}>Nom complet</Text>
            <View style={s.inputWrap}>
              <TextInput style={s.input} placeholder="Thomas Dupont" placeholderTextColor="#aaa" value={fullName} onChangeText={setFullName} />
            </View>
            <Text style={s.label}>Email</Text>
            <View style={s.inputWrap}>
              <TextInput style={s.input} placeholder="votre@email.com" placeholderTextColor="#aaa" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
            </View>
            <Text style={s.label}>Mot de passe</Text>
            <View style={s.inputWrap}>
              <TextInput style={s.input} placeholder="6 caracteres minimum" placeholderTextColor="#aaa" value={password} onChangeText={setPassword} secureTextEntry />
            </View>
            <TouchableOpacity style={s.ctaWrap} onPress={handleRegister} disabled={loading}>
              <LinearGradient colors={['#D251D8','#FD7F3C']} start={{x:0,y:0}} end={{x:1,y:0}} style={s.cta}>
                <Text style={s.ctaTxt}>{loading ? 'Creation...' : 'Creer mon compte'}</Text>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity style={s.switchBtn} onPress={() => router.back()}>
              <Text style={s.switchTxt}>Deja un compte ? <Text style={s.switchLink}>Se connecter</Text></Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe:{flex:1,backgroundColor:'#fff'},
  kav:{flex:1},
  hero:{padding:40,paddingTop:60,alignItems:'center'},
  logo:{color:'#fff',fontSize:28,fontWeight:'800',letterSpacing:1},
  heroSub:{color:'rgba(255,255,255,0.85)',fontSize:14,marginTop:8},
  form:{padding:24,backgroundColor:'#fff'},
  formTitle:{fontSize:22,fontWeight:'800',color:COLORS.text,marginBottom:24},
  label:{fontSize:12,fontWeight:'700',color:'#999',textTransform:'uppercase',letterSpacing:0.3,marginBottom:8},
  inputWrap:{backgroundColor:COLORS.bg,borderRadius:12,paddingHorizontal:14,paddingVertical:13,borderWidth:1,borderColor:COLORS.border,marginBottom:16},
  input:{fontSize:15,color:COLORS.text},
  ctaWrap:{borderRadius:14,overflow:'hidden',marginTop:8},
  cta:{padding:16,alignItems:'center'},
  ctaTxt:{color:'#fff',fontSize:16,fontWeight:'800'},
  switchBtn:{marginTop:20,alignItems:'center'},
  switchTxt:{fontSize:14,color:COLORS.textMuted},
  switchLink:{color:COLORS.violet,fontWeight:'700'},
})
