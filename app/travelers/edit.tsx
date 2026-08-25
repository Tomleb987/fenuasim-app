import React, { useEffect, useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { COLORS } from '../../constants/theme'
import { useTravelers } from '../../hooks/useTravelers'

export default function EditTraveler() {
  const router = useRouter()
  const { id } = useLocalSearchParams<{ id?: string }>()
  const { travelers, loading, addTraveler, updateTraveler, deleteTraveler } = useTravelers()
  const isEdit = !!id

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [nickname, setNickname] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!isEdit || loading) return
    const t = travelers.find(t => t.id === id)
    if (t) {
      setFirstName(t.first_name)
      setLastName(t.last_name ?? '')
      setNickname(t.nickname ?? '')
    }
  }, [isEdit, loading, id, travelers])

  async function handleSave() {
    if (!firstName.trim()) { Alert.alert('Erreur', 'Le prenom est obligatoire'); return }
    setSaving(true)
    try {
      const input = { first_name: firstName.trim(), last_name: lastName.trim(), nickname: nickname.trim() }
      if (isEdit && id) await updateTraveler(id, input)
      else await addTraveler(input)
      router.back()
    } catch (e: any) {
      Alert.alert('Erreur', e.message ?? 'Impossible d\'enregistrer')
    } finally {
      setSaving(false)
    }
  }

  function handleDelete() {
    if (!id) return
    Alert.alert('Supprimer ce voyageur ?', 'Les eSIM qui lui sont attribuees redeviendront non attribuees.', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer', style: 'destructive', onPress: async () => {
          try {
            await deleteTraveler(id)
            router.back()
          } catch (e: any) {
            Alert.alert('Erreur', e.message ?? 'Impossible de supprimer')
          }
        }
      },
    ])
  }

  if (isEdit && loading) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.loader}><ActivityIndicator color={COLORS.violet} size="large" /></View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <LinearGradient colors={['#D251D8', '#FD7F3C']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.hero}>
          <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={20} color="#fff" />
          </TouchableOpacity>
          <Text style={s.heroTitle}>{isEdit ? 'Modifier le voyageur' : 'Ajouter un voyageur'}</Text>
        </LinearGradient>

        <View style={s.form}>
          <Text style={s.label}>Prenom</Text>
          <View style={s.inputWrap}>
            <TextInput style={s.input} placeholder="Thomas" placeholderTextColor="#aaa" value={firstName} onChangeText={setFirstName} />
          </View>
          <Text style={s.label}>Nom (facultatif)</Text>
          <View style={s.inputWrap}>
            <TextInput style={s.input} placeholder="Dupont" placeholderTextColor="#aaa" value={lastName} onChangeText={setLastName} />
          </View>
          <Text style={s.label}>Surnom (facultatif)</Text>
          <View style={s.inputWrap}>
            <TextInput style={s.input} placeholder="Papa, Tom..." placeholderTextColor="#aaa" value={nickname} onChangeText={setNickname} />
          </View>

          <TouchableOpacity style={s.ctaWrap} onPress={handleSave} disabled={saving}>
            <View style={s.cta}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.ctaTxt}>{isEdit ? 'Enregistrer' : 'Ajouter'}</Text>}
            </View>
          </TouchableOpacity>

          {isEdit && (
            <TouchableOpacity style={s.deleteBtn} onPress={handleDelete}>
              <Text style={s.deleteTxt}>Supprimer ce voyageur</Text>
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  hero: { padding: 20, paddingBottom: 24 },
  backBtn: { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 20, width: 36, height: 36, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  heroTitle: { color: '#fff', fontSize: 22, fontWeight: '800' },
  form: { padding: 20 },
  label: { fontSize: 12, fontWeight: '700', color: '#999', textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 8 },
  inputWrap: { backgroundColor: COLORS.bg, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, borderWidth: 1, borderColor: COLORS.border, marginBottom: 16 },
  input: { fontSize: 15, color: COLORS.text },
  ctaWrap: { borderRadius: 14, overflow: 'hidden', backgroundColor: COLORS.violet, marginTop: 8 },
  cta: { padding: 16, alignItems: 'center' },
  ctaTxt: { color: '#fff', fontSize: 16, fontWeight: '800' },
  deleteBtn: { marginTop: 16, alignItems: 'center', padding: 10 },
  deleteTxt: { color: '#e74c3c', fontSize: 14, fontWeight: '600' },
})
