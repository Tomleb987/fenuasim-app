import React, { useEffect, useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, ScrollView, KeyboardAvoidingView, Platform } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { COLORS, RADIUS, TYPO } from '../../constants/theme'
import { useDevices } from '../../hooks/useDevices'
import { useTravelers } from '../../hooks/useTravelers'

export default function EditDevice() {
  const router = useRouter()
  const { id } = useLocalSearchParams<{ id?: string }>()
  const { devices, loading, addDevice, updateDevice, deleteDevice } = useDevices()
  const { travelers, loading: loadingTravelers } = useTravelers()
  const isEdit = !!id

  const [name, setName] = useState('')
  const [brand, setBrand] = useState('')
  const [model, setModel] = useState('')
  const [travelerId, setTravelerId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isEdit || loading) return
    const d = devices.find(d => d.id === id)
    if (d) {
      setName(d.name)
      setBrand(d.brand ?? '')
      setModel(d.model ?? '')
      setTravelerId(d.traveler_id)
    }
  }, [isEdit, loading, id, devices])

  async function handleSave() {
    if (!name.trim()) { setError("Le nom de l'appareil est obligatoire."); return }
    setError(null)
    setSaving(true)
    try {
      const input = { name: name.trim(), brand: brand.trim(), model: model.trim(), traveler_id: travelerId }
      if (isEdit && id) await updateDevice(id, input)
      else await addDevice(input)
      router.back()
    } catch (e: any) {
      console.error('handleSave device:', e)
      setError("Impossible d'enregistrer, veuillez réessayer.")
    } finally {
      setSaving(false)
    }
  }

  function handleDelete() {
    if (!id) return
    Alert.alert('Supprimer cet appareil ?', 'Les eSIM qui lui sont attribuees ne seront plus liees a un appareil.', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer', style: 'destructive', onPress: async () => {
          try {
            await deleteDevice(id)
            router.back()
          } catch (e: any) {
            console.error('handleDelete device:', e)
            Alert.alert('Erreur', 'Impossible de supprimer, veuillez réessayer.')
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
          <Text style={s.heroTitle}>{isEdit ? 'Modifier l\'appareil' : 'Ajouter un appareil'}</Text>
        </LinearGradient>

        <ScrollView style={s.form}>
          <Text style={s.label}>Nom de l'appareil</Text>
          <View style={s.inputWrap}>
            <TextInput style={s.input} placeholder="iPhone Thomas" placeholderTextColor="#aaa" value={name} onChangeText={(v) => { setName(v); setError(null) }} />
          </View>
          {!!error && <Text style={s.errorTxt}>{error}</Text>}
          <Text style={s.label}>Marque (facultatif)</Text>
          <View style={s.inputWrap}>
            <TextInput style={s.input} placeholder="Apple" placeholderTextColor="#aaa" value={brand} onChangeText={setBrand} />
          </View>
          <Text style={s.label}>Modele (facultatif)</Text>
          <View style={s.inputWrap}>
            <TextInput style={s.input} placeholder="iPhone 15" placeholderTextColor="#aaa" value={model} onChangeText={setModel} />
          </View>

          <Text style={s.label}>Voyageur associe (facultatif)</Text>
          {loadingTravelers ? (
            <ActivityIndicator color={COLORS.violet} style={{ marginVertical: 10 }} />
          ) : (
            <View style={s.chipRow}>
              <TouchableOpacity
                style={[s.chip, travelerId === null && s.chipSel]}
                onPress={() => setTravelerId(null)}
              >
                <Text style={[s.chipTxt, travelerId === null && s.chipTxtSel]}>Aucun</Text>
              </TouchableOpacity>
              {travelers.map(t => (
                <TouchableOpacity
                  key={t.id}
                  style={[s.chip, travelerId === t.id && s.chipSel]}
                  onPress={() => setTravelerId(t.id)}
                >
                  <Text style={[s.chipTxt, travelerId === t.id && s.chipTxtSel]}>{t.nickname || t.first_name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <TouchableOpacity style={s.ctaWrap} onPress={handleSave} disabled={saving}>
            <View style={s.cta}>
              {saving ? <ActivityIndicator color={COLORS.violet} /> : <Text style={s.ctaTxt}>{isEdit ? 'Enregistrer' : 'Ajouter'}</Text>}
            </View>
          </TouchableOpacity>

          {isEdit && (
            <TouchableOpacity style={s.deleteBtn} onPress={handleDelete}>
              <Text style={s.deleteTxt}>Supprimer cet appareil</Text>
            </TouchableOpacity>
          )}
          <View style={{ height: 30 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  hero: { padding: 20, paddingBottom: 24, borderBottomLeftRadius: RADIUS.xl, borderBottomRightRadius: RADIUS.xl, overflow: 'hidden' },
  backBtn: { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 20, width: 36, height: 36, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  heroTitle: { color: '#fff', ...TYPO.screenTitle },
  form: { padding: 20 },
  label: { fontSize: 12, fontWeight: '700', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 8 },
  inputWrap: { backgroundColor: COLORS.bg, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, borderWidth: 1, borderColor: COLORS.border, marginBottom: 16 },
  input: { fontSize: 15, color: COLORS.text },
  errorTxt: { color: '#B00020', fontSize: 13, marginTop: -8, marginBottom: 16 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: COLORS.border, backgroundColor: '#fff' },
  chipSel: { borderColor: COLORS.violet, backgroundColor: 'rgba(210,81,216,0.08)' },
  chipTxt: { fontSize: 13, fontWeight: '600', color: '#888' },
  chipTxtSel: { color: COLORS.violet },
  ctaWrap: { borderRadius: 14, overflow: 'hidden', marginTop: 8, backgroundColor: '#fff', borderWidth: 1.5, borderColor: COLORS.violet },
  cta: { padding: 16, alignItems: 'center' },
  ctaTxt: { color: COLORS.violet, fontSize: 16, fontWeight: '800' },
  deleteBtn: { marginTop: 16, alignItems: 'center', padding: 10 },
  deleteTxt: { color: '#e74c3c', fontSize: 14, fontWeight: '600' },
})
