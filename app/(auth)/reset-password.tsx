import React, { useEffect, useRef, useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { supabase } from '../../lib/supabase'
import { COLORS } from '../../constants/theme'

type Step = 'verifying' | 'ready' | 'invalid' | 'success'

const GENERIC_INVALID_MESSAGE = "Ce lien de réinitialisation n'est plus valide."

type ResetParams = {
  code?: string
  token_hash?: string
  type?: string
  access_token?: string
  refresh_token?: string
  error?: string
  error_description?: string
}

export default function ResetPasswordScreen() {
  const router = useRouter()
  const params = useLocalSearchParams<ResetParams>()
  const [step, setStep] = useState<Step>('verifying')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const exchanged = useRef(false)

  useEffect(() => {
    if (exchanged.current) return
    exchanged.current = true

    async function process() {
      // Un lien de recuperation errone ou expire renvoie des parametres
      // d'erreur explicites : jamais de detail technique affiche a l'utilisateur.
      if (params.error) { setStep('invalid'); return }

      const code = params.code ? String(params.code) : null
      const tokenHash = params.token_hash ? String(params.token_hash) : null
      const otpType = params.type ? String(params.type) : null
      const accessToken = params.access_token ? String(params.access_token) : null
      const refreshToken = params.refresh_token ? String(params.refresh_token) : null

      // Le format exact du retour depend de la configuration du template
      // e-mail cote Supabase (non consultable depuis cet environnement) --
      // les trois mecanismes officiels sont donc geres, jamais un seul
      // suppose arbitrairement. Une ouverture sans aucun de ces elements
      // n'est jamais consideree comme une preuve d'identite (aucun acces
      // au formulaire dans ce cas).
      if (!code && !(tokenHash && otpType) && !(accessToken && refreshToken)) {
        setStep('invalid')
        return
      }

      // Si un utilisateur est deja connecte sur cet appareil, on ne melange
      // jamais sa session active avec la session de recuperation : on la
      // termine proprement avant tout traitement du lien.
      const { data: existing } = await supabase.auth.getSession()
      if (existing.session) {
        await supabase.auth.signOut()
      }

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        setStep(error ? 'invalid' : 'ready')
        return
      }

      if (tokenHash && otpType) {
        const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: otpType as 'recovery' })
        setStep(error ? 'invalid' : 'ready')
        return
      }

      if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
        setStep(error ? 'invalid' : 'ready')
      }
    }

    process()
  }, [params.code, params.error])

  async function handleSubmit() {
    if (!password || !confirm) { setFormError('Renseignez les deux champs.'); return }
    if (password.length < 6) { setFormError('Mot de passe trop court (6 caractères min).'); return }
    if (password !== confirm) { setFormError('Les mots de passe ne correspondent pas.'); return }

    setFormError(null)
    setSaving(true)
    const { error } = await supabase.auth.updateUser({ password })
    setSaving(false)

    if (error) { setFormError("Impossible de modifier le mot de passe. Réessayez."); return }

    setPassword('')
    setConfirm('')
    setStep('success')
  }

  async function handleBackToLogin() {
    // Deconnexion volontaire apres reset : l'utilisateur se reconnecte
    // explicitement avec son nouveau mot de passe, aucune session de
    // recuperation ne doit subsister.
    await supabase.auth.signOut()
    router.replace('/(auth)/login')
  }

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={s.kav}>
        <LinearGradient colors={['#D251D8', '#FD7F3C']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.hero}>
          <Text style={s.logo}>FENUASIM</Text>
          <Text style={s.heroSub}>Nouveau mot de passe</Text>
        </LinearGradient>

        <View style={s.form}>
          {step === 'verifying' && (
            <View style={s.centerBox}>
              <ActivityIndicator color={COLORS.violet} size="large" />
              <Text style={s.verifyingTxt}>Vérification du lien…</Text>
            </View>
          )}

          {step === 'invalid' && (
            <>
              <Text style={s.formTitle}>Lien expiré ou invalide</Text>
              <Text style={s.desc}>
                {GENERIC_INVALID_MESSAGE}{'\n'}Demandez un nouveau lien depuis l'écran de connexion.
              </Text>
              <TouchableOpacity style={s.ctaWrap} onPress={() => router.replace('/(auth)/forgot-password')}>
                <LinearGradient colors={['#D251D8', '#FD7F3C']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.cta}>
                  <Text style={s.ctaTxt}>Demander un nouveau lien</Text>
                </LinearGradient>
              </TouchableOpacity>
              <TouchableOpacity style={s.switchBtn} onPress={handleBackToLogin}>
                <Text style={s.switchTxt}>Retour à la connexion</Text>
              </TouchableOpacity>
            </>
          )}

          {step === 'ready' && (
            <>
              <Text style={s.formTitle}>Nouveau mot de passe</Text>

              <Text style={s.label}>Nouveau mot de passe</Text>
              <View style={s.inputWrap}>
                <TextInput
                  style={s.input}
                  placeholder="6 caractères minimum"
                  placeholderTextColor="#aaa"
                  value={password}
                  onChangeText={(v) => { setPassword(v); setFormError(null) }}
                  secureTextEntry
                  editable={!saving}
                />
              </View>

              <Text style={s.label}>Confirmer le mot de passe</Text>
              <View style={s.inputWrap}>
                <TextInput
                  style={s.input}
                  placeholder="6 caractères minimum"
                  placeholderTextColor="#aaa"
                  value={confirm}
                  onChangeText={(v) => { setConfirm(v); setFormError(null) }}
                  secureTextEntry
                  editable={!saving}
                />
              </View>

              {formError && <Text style={s.errorTxt}>{formError}</Text>}

              <TouchableOpacity style={s.ctaWrap} onPress={handleSubmit} disabled={saving}>
                <LinearGradient colors={['#D251D8', '#FD7F3C']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.cta}>
                  {saving ? (
                    <View style={s.ctaLoading}>
                      <ActivityIndicator color="#fff" size="small" />
                      <Text style={s.ctaTxt}>Modification…</Text>
                    </View>
                  ) : (
                    <Text style={s.ctaTxt}>Modifier mon mot de passe</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </>
          )}

          {step === 'success' && (
            <>
              <Text style={s.formTitle}>Mot de passe modifié</Text>
              <Text style={s.desc}>Votre mot de passe FenuaSIM a été mis à jour.</Text>
              <TouchableOpacity style={s.ctaWrap} onPress={handleBackToLogin}>
                <LinearGradient colors={['#D251D8', '#FD7F3C']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.cta}>
                  <Text style={s.ctaTxt}>Se connecter</Text>
                </LinearGradient>
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
  inputWrap: { backgroundColor: COLORS.bg, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, borderWidth: 1, borderColor: COLORS.border, marginBottom: 16 },
  input: { fontSize: 15, color: COLORS.text },
  errorTxt: { color: '#B00020', fontSize: 13, marginBottom: 8, marginTop: -8 },
  ctaWrap: { borderRadius: 14, overflow: 'hidden', marginTop: 8 },
  cta: { padding: 16, alignItems: 'center' },
  ctaLoading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ctaTxt: { color: '#fff', fontSize: 16, fontWeight: '800' },
  switchBtn: { marginTop: 20, alignItems: 'center' },
  switchTxt: { fontSize: 14, color: COLORS.textMuted },
  centerBox: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 16 },
  verifyingTxt: { fontSize: 14, color: COLORS.textMuted },
})
