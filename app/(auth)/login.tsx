import React, { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, Platform } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { supabase } from '../../lib/supabase'
import { COLORS } from '../../constants/theme'

export default function LoginScreen() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin() {
    if (!email || !password) { Alert.alert('Erreur', 'Remplissez tous les champs'); return }
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) Alert.alert('Erreur', error.message)
    else router.replace('/(tabs)')
  }

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={s.kav}>
        <LinearGradient colors={['#D251D8','#FD7F3C']} start={{x:0,y:0}} end={{x:1,y:1}} style={s.hero}>
          <Text style={s.logo}>FENUASIM</Text>
          <Text style={s.heroSub}>Votre eSIM et assurance voyage</Text>
        </LinearGradient>
        <View style={s.form}>
          <Text style={s.formTitle}>Connexion</Text>
          <Text style={s.label}>Email</Text>
          <View style={s.inputWrap}>
            <TextInput style={s.input} placeholder="votre@email.com" placeholderTextColor="#aaa" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
          </View>
          <Text style={s.label}>Mot de passe</Text>
          <View style={s.inputWrap}>
            <TextInput style={s.input} placeholder="••••••••" placeholderTextColor="#aaa" value={password} onChangeText={setPassword} secureTextEntry />
          </View>
          <TouchableOpacity style={s.ctaWrap} onPress={handleLogin} disabled={loading}>
            <LinearGradient colors={['#D251D8','#FD7F3C']} start={{x:0,y:0}} end={{x:1,y:0}} style={s.cta}>
              <Text style={s.ctaTxt}>{loading ? 'Connexion...' : 'Se connecter'}</Text>
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity style={s.switchBtn} onPress={() => router.push('/(auth)/register')}>
            <Text style={s.switchTxt}>Pas de compte ? <Text style={s.switchLink}>Creer un compte</Text></Text>
          </TouchableOpacity>
        </View>
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
  form:{flex:1,padding:24,backgroundColor:'#fff'},
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
