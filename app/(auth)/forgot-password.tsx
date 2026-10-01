import React, { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import * as Linking from 'expo-linking'
import { supabase } from '../../lib/supabase'
import { COLORS } from '../../constants/theme'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const GENERIC_SENT_MESSAGE =
  "Si un compte FenuaSIM existe avec cette adresse, vous recevrez dans quelques instants un lien pour choisir un nouveau mot de passe."

type Step = 'form' | 'sent'

export default function ForgotPasswordScreen() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [step, setStep] = useState<Step>('form')
  const [loading, setLoading] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)
  const [serverError, setServerError] = useState<string | null>(null)

  async function handleSend() {
    const trimmed = email.trim()
    if (!trimmed) { setLocalError('Indiquez votre adresse e-mail.'); return }
    if (!EMAIL_RE.test(trimmed)) { setLocalError("Ce format d'e-mail n'est pas valide."); return }

    setLocalError(null)
    setServerError(null)
    setLoading(true)

    // Jamais de systeme maison : mecanisme officiel Supabase Auth uniquement.
    const redirectTo = Linking.createURL('reset-password')
    const { error } = await supabase.auth.resetPasswordForEmail(trimmed, { redirectTo })

    setLoading(false)

    if (error) {
      // Ne jamais reveler si le compte existe : seule une erreur de transport
      // (reseau, limite de frequence) produit un message different, jamais lie
      // a l'existence du compte.
      setServerError('Une erreur est survenue. Veuillez réessayer dans quelques instants.')
      return
    }

    setStep('sent')
  }

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={s.kav}>
        <LinearGradient colors={['#D251D8', '#FD7F3C']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.hero}>
          <Text style={s.logo}>FENUASIM</Text>
          <Text style={s.heroSub}>Mot de passe oublié ?</Text>
        </LinearGradient>

        <View style={s.form}>
          {step === 'form' ? (
            <>
              <Text style={s.formTitle}>Mot de passe oublié ?</Text>
              <Text style={s.desc}>
                Indiquez l'adresse e-mail associée à votre compte FenuaSIM.{'\n'}
                Nous vous enverrons un lien permettant de choisir un nouveau mot de passe.
              </Text>

              <Text style={s.label}>Adresse e-mail</Text>
              <View style={s.inputWrap}>
                <TextInput
                  style={s.input}
                  placeholder="votre@email.com"
                  placeholderTextColor="#aaa"
                  value={email}
                  onChangeText={(v) => { setEmail(v); setLocalError(null); setServerError(null) }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!loading}
                />
              </View>
              {(localError || serverError) && (
                <Text style={s.errorTxt}>{localError ?? serverError}</Text>
              )}

              <TouchableOpacity style={s.ctaWrap} onPress={handleSend} disabled={loading}>
                <LinearGradient colors={['#D251D8', '#FD7F3C']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.cta}>
                  {loading ? (
                    <View style={s.ctaLoading}>
                      <ActivityIndicator color="#fff" size="small" />
                      <Text style={s.ctaTxt}>Envoi en cours…</Text>
                    </View>
                  ) : (
                    <Text style={s.ctaTxt}>Envoyer le lien</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity style={s.switchBtn} onPress={() => router.back()} disabled={loading}>
                <Text style={s.switchTxt}>Retour à la connexion</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={s.formTitle}>Consultez votre boîte e-mail</Text>
              <Text style={s.desc}>{GENERIC_SENT_MESSAGE}</Text>

              <TouchableOpacity
                style={s.resendBtn}
                onPress={() => { setStep('form') }}
                disabled={loading}
              >
                <Text style={s.resendTxt}>Renvoyer le lien</Text>
              </TouchableOpacity>

              <TouchableOpacity style={s.switchBtn} onPress={() => router.replace('/(auth)/login')}>
                <Text style={s.switchTxt}>Retour à la connexion</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  kav: { flex: 1 },
  hero: { padding: 40, paddingTop: 60, alignItems: 'center' },
  logo: { color: '#fff', fontSize: 28, fontWeight: '800', letterSpacing: 1 },
  heroSub: { color: 'rgba(255,255,255,0.85)', fontSize: 14, marginTop: 8 },
  form: { flex: 1, padding: 24, backgroundColor: '#fff' },
  formTitle: { fontSize: 22, fontWeight: '800', color: COLORS.text, marginBottom: 12 },
  desc: { fontSize: 14, color: COLORS.textMuted, lineHeight: 20, marginBottom: 24 },
  label: { fontSize: 12, fontWeight: '700', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 8 },
  inputWrap: { backgroundColor: COLORS.bg, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, borderWidth: 1, borderColor: COLORS.border, marginBottom: 8 },
  input: { fontSize: 15, color: COLORS.text },
  errorTxt: { color: '#B00020', fontSize: 13, marginBottom: 8 },
  ctaWrap: { borderRadius: 14, overflow: 'hidden', marginTop: 16 },
  cta: { padding: 16, alignItems: 'center' },
  ctaLoading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ctaTxt: { color: '#fff', fontSize: 16, fontWeight: '800' },
  switchBtn: { marginTop: 20, alignItems: 'center' },
  switchTxt: { fontSize: 14, color: COLORS.textMuted },
  resendBtn: { marginTop: 4, alignItems: 'center', paddingVertical: 10 },
  resendTxt: { fontSize: 14, color: COLORS.violet, fontWeight: '700' },
})
