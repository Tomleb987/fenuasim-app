import React, { useMemo, useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, ScrollView } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { COLORS, RADIUS, TYPO } from '../../constants/theme'
import { useTravelers } from '../../hooks/useTravelers'
import { useDevices } from '../../hooks/useDevices'
import { useEsimAssignments } from '../../hooks/useEsimAssignments'

type Step = 1 | 2 | 3 | 4

export default function AssignEsim() {
  const router = useRouter()
  // Android SDK 35+ impose l'edge-to-edge : la barre de navigation systeme se
  // superpose au bas de l'ecran. Sans cet inset, le bouton principal passe
  // partiellement sous la barre de gestes ou les 3 boutons.
  const insets = useSafeAreaInsets()
  const params = useLocalSearchParams<{
    iccid: string
    airaloOrderId?: string
    destination?: string
    packageLabel?: string
  }>()

  const { travelers, loading: loadingTravelers, addTraveler } = useTravelers()
  const { devices, byTraveler, loading: loadingDevices, addDevice } = useDevices()
  const { assignEsim } = useEsimAssignments()

  const [step, setStep] = useState<Step>(1)
  const [travelerId, setTravelerId] = useState<string | null>(null)
  const [deviceId, setDeviceId] = useState<string | null>(null)
  const [label, setLabel] = useState('')
  const [saving, setSaving] = useState(false)

  const [showAddTraveler, setShowAddTraveler] = useState(false)
  const [newTravelerName, setNewTravelerName] = useState('')
  const [addingTraveler, setAddingTraveler] = useState(false)

  const [showAddDevice, setShowAddDevice] = useState(false)
  const [newDeviceName, setNewDeviceName] = useState('')
  const [addingDevice, setAddingDevice] = useState(false)

  const selectedTraveler = travelers.find(t => t.id === travelerId)
  const selectedDevice = devices.find(d => d.id === deviceId)
  const travelerDevices = travelerId ? byTraveler(travelerId) : []

  const suggestedLabel = useMemo(() => {
    const dest = params.destination || 'eSIM'
    const name = selectedTraveler?.nickname || selectedTraveler?.first_name || ''
    return name ? `${dest} • ${name}` : dest
  }, [params.destination, selectedTraveler])

  function goToStep3() {
    setLabel(suggestedLabel)
    setStep(3)
  }

  async function handleAddTraveler() {
    if (!newTravelerName.trim()) return
    setAddingTraveler(true)
    try {
      const t = await addTraveler({ first_name: newTravelerName.trim() })
      setTravelerId(t.id)
      setNewTravelerName('')
      setShowAddTraveler(false)
    } catch (e: any) {
      console.error('handleAddTraveler:', e)
      Alert.alert('Erreur', "Impossible d'ajouter ce voyageur, veuillez réessayer.")
    } finally {
      setAddingTraveler(false)
    }
  }

  async function handleAddDevice() {
    if (!newDeviceName.trim()) return
    setAddingDevice(true)
    try {
      const d = await addDevice({ name: newDeviceName.trim(), traveler_id: travelerId })
      setDeviceId(d.id)
      setNewDeviceName('')
      setShowAddDevice(false)
    } catch (e: any) {
      console.error('handleAddDevice:', e)
      Alert.alert('Erreur', "Impossible d'ajouter cet appareil, veuillez réessayer.")
    } finally {
      setAddingDevice(false)
    }
  }

  async function handleConfirm() {
    if (!params.iccid) { Alert.alert('Erreur', 'ICCID manquant'); return }
    setSaving(true)
    try {
      await assignEsim({
        iccid: params.iccid,
        airalo_order_id: params.airaloOrderId ?? null,
        traveler_id: travelerId,
        device_id: deviceId,
        label: label.trim() || suggestedLabel,
      })
      setStep(4)
    } catch (e: any) {
      console.error('handleConfirm assign:', e)
      Alert.alert('Erreur', "Impossible d'attribuer cette eSIM, veuillez réessayer.")
    } finally {
      setSaving(false)
    }
  }

  function handleBack() {
    if (step === 1) router.back()
    else setStep((step - 1) as Step)
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <LinearGradient colors={['#D251D8', '#FD7F3C']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.hero}>
        <TouchableOpacity style={s.backBtn} onPress={handleBack}>
          <Ionicons name="arrow-back" size={20} color="#fff" />
        </TouchableOpacity>
        <Text style={s.heroTitle}>Attribuer l'eSIM</Text>
        {step < 4 && (
          <>
            <View style={s.stepDots}>
              {[1, 2, 3].map((i) => (
                <View key={i} style={[s.stepDot, i === step && s.stepDotActive, i < step && s.stepDotDone]} />
              ))}
            </View>
            <Text style={s.heroSub}>Étape {step}/3</Text>
          </>
        )}
      </LinearGradient>

      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}
        // La barre d'action est en position absolue : sans cette reserve, le
        // dernier element de la liste reste masque dessous.
        contentContainerStyle={{ paddingBottom: 100 + insets.bottom }}
      >

        {step === 1 && (
          <View>
            <Text style={s.question}>A qui appartient cette eSIM ?</Text>
            {params.destination && <Text style={s.contextTxt}>{params.destination}{params.packageLabel ? ` · ${params.packageLabel}` : ''}</Text>}

            {loadingTravelers ? (
              <ActivityIndicator color={COLORS.violet} style={{ marginTop: 20 }} />
            ) : (
              <View style={{ marginTop: 16 }}>
                {travelers.map(t => (
                  <TouchableOpacity
                    key={t.id}
                    style={[s.optRow, travelerId === t.id && s.optRowSel]}
                    onPress={() => { setTravelerId(t.id); setDeviceId(null) }}
                  >
                    <View style={s.avatar}><Text style={s.avatarTxt}>{t.first_name[0]?.toUpperCase()}</Text></View>
                    <Text style={s.optTxt}>{t.nickname || t.first_name}</Text>
                    {travelerId === t.id && <Ionicons name="checkmark-circle" size={20} color={COLORS.violet} />}
                  </TouchableOpacity>
                ))}

                {showAddTraveler ? (
                  <View style={s.addBox}>
                    <TextInput
                      style={s.addInput}
                      placeholder="Prenom du voyageur"
                      placeholderTextColor="#aaa"
                      value={newTravelerName}
                      onChangeText={setNewTravelerName}
                      autoFocus
                    />
                    <TouchableOpacity style={s.addConfirmBtn} onPress={handleAddTraveler} disabled={addingTraveler}>
                      {addingTraveler ? <ActivityIndicator color="#fff" size="small" /> : <Ionicons name="checkmark" size={18} color="#fff" />}
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity style={s.addRow} onPress={() => setShowAddTraveler(true)}>
                    <Ionicons name="add-circle-outline" size={20} color={COLORS.violet} />
                    <Text style={s.addRowTxt}>Ajouter une personne</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        )}

        {step === 2 && (
          <View>
            <Text style={s.question}>Quel telephone utilisera {selectedTraveler?.nickname || selectedTraveler?.first_name} ?</Text>

            {loadingDevices ? (
              <ActivityIndicator color={COLORS.violet} style={{ marginTop: 20 }} />
            ) : (
              <View style={{ marginTop: 16 }}>
                {travelerDevices.map(d => (
                  <TouchableOpacity
                    key={d.id}
                    style={[s.optRow, deviceId === d.id && s.optRowSel]}
                    onPress={() => setDeviceId(d.id)}
                  >
                    <View style={s.avatar}><Ionicons name="phone-portrait-outline" size={18} color={COLORS.violet} /></View>
                    <Text style={s.optTxt}>{d.name}</Text>
                    {deviceId === d.id && <Ionicons name="checkmark-circle" size={20} color={COLORS.violet} />}
                  </TouchableOpacity>
                ))}

                {showAddDevice ? (
                  <View style={s.addBox}>
                    <TextInput
                      style={s.addInput}
                      placeholder="Ex : iPhone de Thomas"
                      placeholderTextColor="#aaa"
                      value={newDeviceName}
                      onChangeText={setNewDeviceName}
                      autoFocus
                    />
                    <TouchableOpacity style={s.addConfirmBtn} onPress={handleAddDevice} disabled={addingDevice}>
                      {addingDevice ? <ActivityIndicator color="#fff" size="small" /> : <Ionicons name="checkmark" size={18} color="#fff" />}
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity style={s.addRow} onPress={() => setShowAddDevice(true)}>
                    <Ionicons name="add-circle-outline" size={20} color={COLORS.violet} />
                    <Text style={s.addRowTxt}>Ajouter un telephone</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity style={s.laterBtn} onPress={() => { setDeviceId(null); goToStep3() }}>
                  <Text style={s.laterTxt}>Je choisirai plus tard</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {step === 3 && (
          <View>
            <Text style={s.question}>Nommez cette eSIM</Text>
            <View style={s.inputWrap}>
              <TextInput style={s.input} value={label} onChangeText={setLabel} placeholder={suggestedLabel} placeholderTextColor="#aaa" />
            </View>

            <View style={s.recap}>
              <View style={s.recapRow}>
                <Text style={s.recapLabel}>Voyageur</Text>
                <Text style={s.recapVal}>{selectedTraveler?.nickname || selectedTraveler?.first_name || 'Non attribue'}</Text>
              </View>
              <View style={[s.recapRow, { borderBottomWidth: 0 }]}>
                <Text style={s.recapLabel}>Appareil</Text>
                <Text style={s.recapVal}>{selectedDevice?.name || 'A definir plus tard'}</Text>
              </View>
            </View>
          </View>
        )}

        {step === 4 && (
          <View style={s.successWrap}>
            <LinearGradient colors={['#D251D8', '#FD7F3C']} style={s.successCircle}>
              <Ionicons name="checkmark" size={32} color="#fff" />
            </LinearGradient>
            <Text style={s.successTitle}>C'est fait !</Text>
            <Text style={s.successSub}>Cette eSIM est maintenant identifiee comme :</Text>
            <Text style={s.successLabel}>{label || suggestedLabel}</Text>
            {selectedDevice && <Text style={s.successDevice}>{selectedDevice.name}</Text>}
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {step < 4 && (
        <View style={[s.ctaBar, { paddingBottom: 16 + insets.bottom }]}>
          {step === 1 && (
            <TouchableOpacity style={[s.ctaWrapNeutral, !travelerId && s.ctaDisabled]} disabled={!travelerId} onPress={() => setStep(2)}>
              <View style={s.cta}><Text style={s.ctaTxtNeutral}>Continuer</Text></View>
            </TouchableOpacity>
          )}
          {step === 2 && (
            <TouchableOpacity style={s.ctaWrapNeutral} onPress={goToStep3}>
              <View style={s.cta}><Text style={s.ctaTxtNeutral}>Continuer</Text></View>
            </TouchableOpacity>
          )}
          {step === 3 && (
            <TouchableOpacity style={s.ctaWrap} onPress={handleConfirm} disabled={saving}>
              <LinearGradient colors={['#D251D8', '#FD7F3C']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.cta}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.ctaTxt}>Confirmer</Text>}
              </LinearGradient>
            </TouchableOpacity>
          )}
        </View>
      )}

      {step === 4 && (
        <View style={[s.ctaBar, { paddingBottom: 16 + insets.bottom }]}>
          <TouchableOpacity style={s.ctaWrapNeutral} onPress={() => router.replace('/(tabs)')}>
            <View style={s.cta}><Text style={s.ctaTxtNeutral}>Retour a l'accueil</Text></View>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  hero: { padding: 20, paddingBottom: 24, borderBottomLeftRadius: RADIUS.xl, borderBottomRightRadius: RADIUS.xl, overflow: 'hidden' },
  backBtn: { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 20, width: 36, height: 36, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  heroTitle: { color: '#fff', ...TYPO.screenTitle },
  heroSub: { color: 'rgba(255,255,255,0.85)', fontSize: 12, marginTop: 8, fontWeight: '600' },
  stepDots: { flexDirection: 'row', gap: 6, marginTop: 14 },
  stepDot: { flex: 1, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.3)' },
  stepDotActive: { backgroundColor: '#fff' },
  stepDotDone: { backgroundColor: 'rgba(255,255,255,0.8)' },
  scroll: { flex: 1, padding: 20 },
  question: { fontSize: 19, fontWeight: '800', color: COLORS.text, marginTop: 8 },
  contextTxt: { fontSize: 13, color: COLORS.textMuted, marginTop: 4 },
  optRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 8, borderWidth: 1.5, borderColor: COLORS.border },
  optRowSel: { borderColor: COLORS.violet, backgroundColor: 'rgba(210,81,216,0.05)' },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(210,81,216,0.12)', justifyContent: 'center', alignItems: 'center' },
  avatarTxt: { fontSize: 15, fontWeight: '800', color: COLORS.violet },
  optTxt: { flex: 1, fontSize: 14, fontWeight: '600', color: COLORS.text },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12 },
  addRowTxt: { fontSize: 14, fontWeight: '600', color: COLORS.violet },
  addBox: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  addInput: { flex: 1, backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1.5, borderColor: COLORS.violet, fontSize: 14, color: COLORS.text },
  addConfirmBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: COLORS.violet, justifyContent: 'center', alignItems: 'center' },
  laterBtn: { alignItems: 'center', padding: 14, marginTop: 4 },
  laterTxt: { fontSize: 14, fontWeight: '600', color: COLORS.textMuted },
  inputWrap: { backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, borderWidth: 1, borderColor: COLORS.border, marginTop: 16 },
  input: { fontSize: 15, color: COLORS.text, fontWeight: '600' },
  recap: { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginTop: 16 },
  recapRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 9, borderBottomWidth: 0.5, borderBottomColor: '#f5f5f5' },
  recapLabel: { fontSize: 13, color: COLORS.textMuted },
  recapVal: { fontSize: 13, fontWeight: '700', color: COLORS.text },
  successWrap: { alignItems: 'center', paddingTop: 40 },
  successCircle: { width: 72, height: 72, borderRadius: 36, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  successTitle: { fontSize: 22, fontWeight: '800', color: COLORS.text },
  successSub: { fontSize: 14, color: '#888', marginTop: 8, textAlign: 'center' },
  successLabel: { fontSize: 18, fontWeight: '800', color: COLORS.violet, marginTop: 6 },
  successDevice: { fontSize: 13, color: COLORS.textMuted, marginTop: 4 },
  ctaBar: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', padding: 16, borderTopWidth: 1, borderTopColor: COLORS.border },
  ctaWrap: { borderRadius: 14, overflow: 'hidden' },
  ctaWrapNeutral: { borderRadius: 14, overflow: 'hidden', backgroundColor: '#fff', borderWidth: 1.5, borderColor: COLORS.violet },
  ctaTxtNeutral: { color: COLORS.violet, fontSize: 16, fontWeight: '800' },
  ctaDisabled: { opacity: 0.4 },
  cta: { padding: 16, alignItems: 'center' },
  ctaTxt: { color: '#fff', fontSize: 16, fontWeight: '800' },
})
