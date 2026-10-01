import React, { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Href, useLocalSearchParams, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../../lib/supabase'
import { COLORS } from '../../constants/theme'

export default function LoginScreen() {
  const router = useRouter()
  // Chemin sur lequel revenir apres connexion, pose par lib/authGate quand un
  // visiteur declenche une action qui exige un compte. Absent quand l'ecran est
  // ouvert directement depuis l'onglet Compte.
  const { redirect } = useLocalSearchParams<{ redirect?: string }>()
  // La connexion n'est plus la racine de l'application : elle doit toujours
  // offrir une sortie vers le catalogue. router.back() ne suffit pas -- on peut
  // y arriver par un replace (fin de reinitialisation du mot de passe), sans
  // rien derriere soi dans la pile.
  function leaveAuth() {
    if (router.canGoBack()) router.back()
    else router.replace('/(tabs)')
  }
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleLogin() {
    if (!email || !password) { setError('Remplissez tous les champs.'); return }
    setError(null)
    setLoading(true)
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (authError) setError('Email ou mot de passe incorrect.')
    else router.replace((redirect as Href) ?? '/(tabs)')
  }

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={s.kav}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        <LinearGradient colors={['#D251D8','#FD7F3C']} start={{x:0,y:0}} end={{x:1,y:1}} style={s.hero}>
          <TouchableOpacity style={s.backBtn} onPress={leaveAuth} accessibilityLabel="Revenir au catalogue">
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={s.logo}>FENUASIM</Text>
          <Text style={s.heroSub}>Votre eSIM pour voyager connecté</Text>
        </LinearGradient>
        <View style={s.form}>
          <Text style={s.formTitle}>Connexion</Text>
          <Text style={s.label}>Email</Text>
          <View style={s.inputWrap}>
            <TextInput style={s.input} placeholder="votre@email.com" placeholderTextColor="#aaa" value={email} onChangeText={(v) => { setEmail(v); setError(null) }} keyboardType="email-address" autoCapitalize="none" />
          </View>
          <Text style={s.label}>Mot de passe</Text>
          <View style={s.inputWrap}>
            <TextInput style={s.input} placeholder="••••••••" placeholderTextColor="#aaa" value={password} onChangeText={(v) => { setPassword(v); setError(null) }} secureTextEntry />
          </View>
          {!!error && <Text style={s.errorTxt}>{error}</Text>}
          <TouchableOpacity style={s.forgotBtn} onPress={() => router.push('/(auth)/forgot-password')}>
            <Text style={s.forgotTxt}>Mot de passe oublié ?</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.ctaWrap} onPress={handleLogin} disabled={loading}>
            <LinearGradient colors={['#D251D8','#FD7F3C']} start={{x:0,y:0}} end={{x:1,y:0}} style={s.cta}>
              <Text style={s.ctaTxt}>{loading ? 'Connexion...' : 'Se connecter'}</Text>
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity
            style={s.switchBtn}
            onPress={() => router.push({ pathname: '/(auth)/register', params: redirect ? { redirect } : {} } as Href)}
          >
            <Text style={s.switchTxt}>Pas de compte ? <Text style={s.switchLink}>Creer un compte</Text></Text>
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
  scroll:{flexGrow:1},
  hero:{padding:40,paddingTop:60,alignItems:'center'},
  backBtn:{position:'absolute',top:16,left:16,width:40,height:40,borderRadius:20,alignItems:'center',justifyContent:'center',backgroundColor:'rgba(255,255,255,0.18)'},
  logo:{color:'#fff',fontSize:28,fontWeight:'800',letterSpacing:1},
  heroSub:{color:'rgba(255,255,255,0.85)',fontSize:14,marginTop:8},
  form:{flex:1,padding:24,backgroundColor:'#fff'},
  formTitle:{fontSize:22,fontWeight:'800',color:COLORS.text,marginBottom:24},
  label:{fontSize:12,fontWeight:'700',color:COLORS.textMuted,textTransform:'uppercase',letterSpacing:0.3,marginBottom:8},
  inputWrap:{backgroundColor:COLORS.bg,borderRadius:12,paddingHorizontal:14,paddingVertical:13,borderWidth:1,borderColor:COLORS.border,marginBottom:16},
  input:{fontSize:15,color:COLORS.text},
  errorTxt:{color:'#B00020',fontSize:13,marginBottom:8},
  forgotBtn:{alignSelf:'flex-end',marginBottom:8},
  forgotTxt:{fontSize:13,color:COLORS.textMuted,fontWeight:'600'},
  ctaWrap:{borderRadius:14,overflow:'hidden',marginTop:8},
  cta:{padding:16,alignItems:'center'},
  ctaTxt:{color:'#fff',fontSize:16,fontWeight:'800'},
  switchBtn:{marginTop:20,alignItems:'center'},
  switchTxt:{fontSize:14,color:COLORS.textMuted},
  switchLink:{color:COLORS.violet,fontWeight:'700'},
})
