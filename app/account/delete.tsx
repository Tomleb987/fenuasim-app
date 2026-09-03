import React, { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { COLORS } from '../../constants/theme'
import { supabase } from '../../lib/supabase'

type Step = 'info' | 'confirm'

export default function DeleteAccountScreen() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('info')
  const [confirmText, setConfirmText] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const canConfirm = confirmText.trim().toUpperCase() === 'SUPPRIMER'

  async function handleDelete() {
    if (!canConfirm || loading) return
    setLoading(true)
    setErrorMsg(null)
    try {
      const { data, error } = await supabase.functions.invoke('delete-account', { method: 'POST' })

      if (error) {
        setErrorMsg("Impossible de supprimer votre compte pour le moment. Veuillez réessayer ou contacter le support FenuaSIM.")
        setLoading(false)
        return
      }

      if (data?.error === 'admin_account') {
        setErrorMsg("Ce compte ne peut pas être supprimé depuis l'application. Veuillez contacter FenuaSIM.")
        setLoading(false)
        return
      }

      if (data?.error) {
        setErrorMsg("Impossible de supprimer votre compte pour le moment. Veuillez réessayer ou contacter le support FenuaSIM.")
        setLoading(false)
        return
      }

      // status === 'completed' ou 'already_deleted' : dans les deux cas, le
      // compte n'existe plus. On nettoie la session locale et on repart sur
      // l'ecran de connexion, sans jamais laisser l'utilisateur sur un ecran
      // authentifie.
      await supabase.auth.signOut()
      router.replace('/(auth)/login')
    } catch (e) {
      setErrorMsg("Impossible de supprimer votre compte pour le moment. Veuillez réessayer ou contacter le support FenuaSIM.")
      setLoading(false)
    }
  }

  if (step === 'confirm') {
    return (
      <SafeAreaView style={s.safe} edges={['top']}>
        <LinearGradient colors={['#D251D8', '#FD7F3C']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.hero}>
          <TouchableOpacity style={s.backBtn} onPress={() => (loading ? null : setStep('info'))}>
            <Ionicons name="arrow-back" size={20} color="#fff" />
          </TouchableOpacity>
          <Text style={s.heroTitle}>Confirmer la suppression</Text>
        </LinearGradient>

        <View style={s.content}>
          <Text style={s.warningTitle}>Êtes-vous certain de vouloir supprimer définitivement votre compte FenuaSIM ?</Text>

          <Text style={s.label}>Pour confirmer, saisissez SUPPRIMER</Text>
          <TextInput
            style={s.input}
            value={confirmText}
            onChangeText={setConfirmText}
            placeholder="SUPPRIMER"
            placeholderTextColor="#ccc"
            autoCapitalize="characters"
            autoCorrect={false}
            editable={!loading}
          />

          {errorMsg && (
            <View style={s.errorBox}>
              <Ionicons name="alert-circle-outline" size={16} color="#B00020" />
              <Text style={s.errorTxt}>{errorMsg}</Text>
            </View>
          )}

          <TouchableOpacity
            style={[s.deleteBtn, (!canConfirm || loading) && s.deleteBtnDisabled]}
            onPress={handleDelete}
            disabled={!canConfirm || loading}
          >
            {loading ? (
              <>
                <ActivityIndicator color="#fff" size="small" />
                <Text style={s.deleteBtnTxt}>Suppression de votre compte…</Text>
              </>
            ) : (
              <Text style={s.deleteBtnTxt}>Supprimer définitivement mon compte</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={s.cancelBtn} onPress={() => router.back()} disabled={loading}>
            <Text style={s.cancelTxt}>Annuler</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <LinearGradient colors={['#D251D8', '#FD7F3C']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.hero}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color="#fff" />
        </TouchableOpacity>
        <Text style={s.heroTitle}>Supprimer mon compte</Text>
      </LinearGradient>

      <View style={s.content}>
        <View style={s.iconWrap}>
          <Ionicons name="warning-outline" size={32} color="#B00020" />
        </View>

        <Text style={s.paragraph}>
          La suppression de votre compte désactivera définitivement votre accès FenuaSIM.
        </Text>
        <Text style={s.paragraph}>
          Vos voyageurs, appareils et attributions eSIM enregistrés dans l'application seront supprimés.
        </Text>
        <Text style={s.paragraph}>
          Certaines informations liées à vos achats, paiements, factures ou contrats pourront être conservées conformément à nos obligations légales, comptables et contractuelles.
        </Text>
        <Text style={s.paragraphBold}>Cette action est irréversible.</Text>

        <TouchableOpacity style={s.continueBtn} onPress={() => setStep('confirm')}>
          <Text style={s.continueTxt}>Continuer</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.cancelBtn} onPress={() => router.back()}>
          <Text style={s.cancelTxt}>Annuler</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  hero: { padding: 20, paddingBottom: 24 },
  backBtn: { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 20, width: 36, height: 36, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  heroTitle: { color: '#fff', fontSize: 22, fontWeight: '800' },
  content: { padding: 24, flex: 1 },
  iconWrap: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#FDECEA', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  paragraph: { fontSize: 14, color: COLORS.textMuted, lineHeight: 21, marginBottom: 14 },
  paragraphBold: { fontSize: 14, color: '#B00020', fontWeight: '700', lineHeight: 21, marginBottom: 24 },
  warningTitle: { fontSize: 15, color: COLORS.text, fontWeight: '600', lineHeight: 22, marginBottom: 24 },
  label: { fontSize: 12, fontWeight: '700', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 8 },
  input: { backgroundColor: COLORS.bg, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, borderWidth: 1.5, borderColor: COLORS.border, fontSize: 16, fontWeight: '700', color: COLORS.text, marginBottom: 16, letterSpacing: 1 },
  errorBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: '#FDECEA', borderRadius: 10, padding: 12, marginBottom: 16 },
  errorTxt: { flex: 1, fontSize: 13, color: '#B00020', lineHeight: 18 },
  deleteBtn: { backgroundColor: '#B00020', borderRadius: 14, padding: 16, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10, marginTop: 8 },
  deleteBtnDisabled: { backgroundColor: '#e0a8ae' },
  deleteBtnTxt: { color: '#fff', fontSize: 15, fontWeight: '800' },
  continueBtn: { backgroundColor: '#B00020', borderRadius: 14, padding: 16, alignItems: 'center', marginTop: 'auto' },
  continueTxt: { color: '#fff', fontSize: 15, fontWeight: '800' },
  cancelBtn: { padding: 14, alignItems: 'center', marginTop: 10 },
  cancelTxt: { color: COLORS.textMuted, fontSize: 14, fontWeight: '600' },
})
