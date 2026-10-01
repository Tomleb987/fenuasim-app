// Formulaire d'assurance voyage reel (AVA), reconstitue depuis le vrai
// parcours public fenuasim.com/assurance apres verification directe des
// appels /api/get-quote et /api/insurance-checkout. Remplace l'ancien ecran
// "Bientot disponible" neutralise en Phase 4C -- voir PHASE4C_ASSURANCE_STRIPE.md
// et la memoire fenuasim-ui-polish-and-ai-support pour le contexte complet.
import React, { useEffect, useRef, useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Switch, Linking, Alert, KeyboardAvoidingView, Platform } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { COLORS, RADIUS, SHADOW, TYPO, EUR_TO_XPF } from '../../constants/theme'
import { useCurrency } from '../../lib/currency'
import { supabase } from '../../lib/supabase'
import {
  INSURANCE_PRODUCTS,
  INSURANCE_DESTINATIONS,
  INSURANCE_OPTIONS,
  PARENTAL_LINKS,
  INSURANCE_SERVICE_FEE_EUR,
  InsuranceProductId,
  getInsuranceProduct,
} from '../../constants/insurance'
import { useInsuranceQuote, InsuranceCompanion } from '../../hooks/useInsuranceQuote'

const TOTAL_STEPS = 6
const STEP_TITLES = ['Formule', 'Voyage', 'Souscripteur', 'Voyageurs', 'Options', 'Récapitulatif']

interface FormState {
  productType: InsuranceProductId
  destination: string
  departureDate: string
  returnDate: string
  tripPrice: string
  firstName: string
  lastName: string
  birthDate: string
  email: string
  address: string
  postalCode: string
  city: string
  companions: InsuranceCompanion[]
  selectedOptions: string[]
  optionDateRanges: Record<string, { from_date_option?: string; to_date_option?: string }>
  promoCode: string
}

// Les dates sont saisies et affichees en JJ/MM/AAAA (convention francaise)
// mais stockees/envoyees en ISO (AAAA-MM-JJ), format attendu par l'API reelle
// du site (verifie sur /api/get-quote).
function isoToDisplay(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : ''
}
function displayToIso(display: string): string {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(display)
  return m ? `${m[3]}-${m[2]}-${m[1]}` : ''
}
function formatDateDigits(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8)
  if (digits.length > 4) return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`
  if (digits.length > 2) return `${digits.slice(0, 2)}/${digits.slice(2)}`
  return digits
}

function DateField({ value, onChange, error }: { value: string; onChange: (iso: string) => void; error?: boolean }) {
  const [text, setText] = useState(isoToDisplay(value))
  useEffect(() => { setText(isoToDisplay(value)) }, [value])

  function handleChange(raw: string) {
    const formatted = formatDateDigits(raw)
    setText(formatted)
    if (formatted.length === 10) onChange(displayToIso(formatted))
    else if (formatted === '') onChange('')
  }

  return (
    <TextInput
      style={[s.input, error && s.inputErr]}
      placeholder="JJ/MM/AAAA"
      keyboardType="number-pad"
      maxLength={10}
      value={text}
      onChangeText={handleChange}
    />
  )
}

function ageFromBirthDate(birthDate: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) return null
  const b = new Date(birthDate)
  if (isNaN(b.getTime())) return null
  const now = new Date()
  let age = now.getFullYear() - b.getFullYear()
  const m = now.getMonth() - b.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--
  return age
}

export default function InsuranceForm() {
  const router = useRouter()
  const { formatXpf } = useCurrency()
  const { quoting, premium, fetchQuote, checkingOut, checkout, promoStatus, promoDiscount, checkPromoCode } = useInsuranceQuote()
  const [step, setStep] = useState(1)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null)
  const [residencyConfirmed, setResidencyConfirmed] = useState(false)
  const [form, setForm] = useState<FormState>({
    productType: 'ava_tourist_card',
    destination: '',
    departureDate: '',
    returnDate: '',
    tripPrice: '',
    firstName: '',
    lastName: '',
    birthDate: '',
    email: '',
    address: '',
    postalCode: '',
    city: '',
    companions: [],
    selectedOptions: [],
    optionDateRanges: {},
    promoCode: '',
  })

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user?.email) update({ email: session.user.email })
    })
  }, [])

  function update(patch: Partial<FormState>) {
    setForm((f) => ({ ...f, ...patch }))
    setErrors({})
  }

  const product = getInsuranceProduct(form.productType)
  const options = INSURANCE_OPTIONS[form.productType]

  function buildQuotePayload() {
    return {
      productType: form.productType,
      startDate: form.departureDate,
      endDate: form.returnDate,
      destinationRegion: product.requiresTrip ? form.destination : undefined,
      tripCost: product.requiresTrip ? parseFloat(form.tripPrice) || 0 : undefined,
      subscriber: {
        firstName: form.firstName,
        lastName: form.lastName,
        birthDate: form.birthDate,
        email: form.email,
        address: form.address,
        postalCode: form.postalCode,
        city: form.city,
      },
      companions: form.companions,
      options: form.selectedOptions,
      optionDateRanges: form.optionDateRanges,
    }
  }

  // Redevis silencieux a chaque changement d'option, une fois arrive a l'etape
  // Options -- reproduit exactement le comportement du site (debounce 500ms).
  const quoteDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (step < 5) return
    if (quoteDebounce.current) clearTimeout(quoteDebounce.current)
    quoteDebounce.current = setTimeout(() => {
      fetchQuote(buildQuotePayload()).catch(() => {})
    }, 500)
    return () => { if (quoteDebounce.current) clearTimeout(quoteDebounce.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, form.selectedOptions, form.optionDateRanges])

  function validateStep1(): boolean {
    const e: Record<string, string> = {}
    if (product.requiresTrip && !form.destination) e.destination = 'Requis'
    if (!form.departureDate) e.departureDate = 'Requis'
    if (product.requiresTrip && !form.tripPrice) e.tripPrice = 'Requis'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function validateStep2(): boolean {
    const e: Record<string, string> = {}
    if (!form.firstName) e.firstName = 'Prénom requis'
    if (!form.lastName) e.lastName = 'Nom requis'
    if (!form.birthDate) e.birthDate = 'Date de naissance requise'
    if (!form.email) e.email = 'Email requis'
    if (!form.address) e.address = 'Adresse requise'
    if (!form.postalCode) e.postalCode = 'Code postal requis'
    if (!form.city) e.city = 'Ville requise'
    if (!residencyConfirmed) e.residency = 'Confirmation requise'
    if (Object.keys(e).length > 0) { setErrors(e); return false }
    const age = ageFromBirthDate(form.birthDate)
    if (age === null) { setErrors({ birthDate: 'Date invalide' }); return false }
    if (age < 18) { setErrors({ birthDate: 'Vous devez avoir au moins 18 ans pour souscrire seul.' }); return false }
    if (product.maxAge && age > product.maxAge) {
      setErrors({ birthDate: `La ${product.label} est réservée aux moins de ${product.maxAge} ans. Choisissez la Tourist Card.` })
      return false
    }
    setErrors({})
    return true
  }

  function validateStep3(): boolean {
    const invalid = form.companions.some((c) => !c.firstName || !c.birthDate)
    if (invalid) Alert.alert('Voyageurs incomplets', 'Veuillez compléter les informations de tous les voyageurs.')
    return !invalid
  }

  async function goNext() {
    if (step === 2 && !validateStep1()) return
    if (step === 3 && !validateStep2()) return
    if (step === 4 && !validateStep3()) return
    if (step === 5) {
      try { await fetchQuote(buildQuotePayload()) } catch { Alert.alert('Erreur', 'Impossible de calculer le tarif pour ces dates.'); return }
    }
    if (step < TOTAL_STEPS) setStep(step + 1)
    else handlePay()
  }

  async function handlePay() {
    try {
      const total = premium != null ? premium + INSURANCE_SERVICE_FEE_EUR - promoDiscount : null
      const url = await checkout(buildQuotePayload(), form.email, total)
      await Linking.openURL(url)
    } catch (e: any) {
      Alert.alert('Erreur', e.message || 'Erreur lors de la création du paiement')
    }
  }

  function addCompanion() {
    update({ companions: [...form.companions, { firstName: '', lastName: '', birthDate: '', parental_link: '13' }] })
  }
  function updateCompanion(i: number, patch: Partial<InsuranceCompanion>) {
    const next = [...form.companions]
    next[i] = { ...next[i], ...patch }
    update({ companions: next })
  }
  function removeCompanion(i: number) {
    update({ companions: form.companions.filter((_, idx) => idx !== i) })
  }

  function isBooleanSelected(optId: string) { return form.selectedOptions.includes(optId) }
  function toggleBooleanOption(optId: string, checked: boolean) {
    update({ selectedOptions: checked ? [...new Set([...form.selectedOptions, optId])] : form.selectedOptions.filter((id) => id !== optId) })
  }
  function selectedSubOptionId(subOptions: { id: string }[] = []) {
    return subOptions.find((s) => form.selectedOptions.includes(s.id))?.id ?? ''
  }
  function chooseSelectOption(subOptions: { id: string }[] = [], subId: string) {
    const groupIds = subOptions.map((s) => s.id)
    const filtered = form.selectedOptions.filter((id) => !groupIds.includes(id))
    update({ selectedOptions: subId ? [...filtered, subId] : filtered })
  }
  function isDateRangeSelected(optId: string) { return form.selectedOptions.includes(optId) }
  function toggleDateRangeOption(optId: string, checked: boolean) {
    const nextRanges = { ...form.optionDateRanges }
    if (!checked) delete nextRanges[optId]
    update({
      selectedOptions: checked ? [...new Set([...form.selectedOptions, optId])] : form.selectedOptions.filter((id) => id !== optId),
      optionDateRanges: nextRanges,
    })
  }
  function setOptionDateRange(optId: string, field: 'from_date_option' | 'to_date_option', value: string) {
    update({ optionDateRanges: { ...form.optionDateRanges, [optId]: { ...form.optionDateRanges[optId], [field]: value } } })
  }

  const totalEur = premium != null ? Math.max(0, premium + INSURANCE_SERVICE_FEE_EUR - promoDiscount) : null

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={0}>
      <LinearGradient colors={['#D251D8', '#FD7F3C']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.hero}>
        <TouchableOpacity style={s.backBtn} onPress={() => (step > 1 ? setStep(step - 1) : router.back())}>
          <Ionicons name="arrow-back" size={20} color="#fff" />
        </TouchableOpacity>
        <Text style={s.heroLabel}>by FENUASIM · AVA</Text>
        <Text style={s.heroTitle}>Assurance voyage</Text>
        <View style={s.stepDots}>
          {STEP_TITLES.map((t, i) => (
            <View key={t} style={[s.stepDot, i + 1 === step && s.stepDotActive, i + 1 < step && s.stepDotDone]} />
          ))}
        </View>
        <Text style={s.stepLabel}>Étape {step}/{TOTAL_STEPS} · {STEP_TITLES[step - 1]}</Text>
      </LinearGradient>

      <ScrollView style={s.scroll} contentContainerStyle={{ padding: 16, paddingBottom: 32 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {step === 1 && (
          <>
            <Text style={s.sectionLabel}>Choisissez votre formule</Text>
            {INSURANCE_PRODUCTS.map((p) => {
              const selected = form.productType === p.id
              const expanded = expandedProduct === p.id
              return (
                <TouchableOpacity key={p.id} style={[s.productCard, selected && s.productCardSelected]} onPress={() => update({ productType: p.id })} activeOpacity={0.85}>
                  <View style={s.productCardHead}>
                    <LinearGradient colors={p.colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.productBadge}>
                      <Text style={s.productBadgeTxt}>{p.tagline}</Text>
                    </LinearGradient>
                    <TouchableOpacity style={s.expandBtn} onPress={() => setExpandedProduct(expanded ? null : p.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Ionicons name={expanded ? 'remove' : 'add'} size={16} color={COLORS.violet} />
                    </TouchableOpacity>
                  </View>
                  <Text style={s.productTitle}>{p.label}</Text>
                  {expanded && (
                    <>
                      <Text style={s.productDesc}>{p.description}</Text>
                      {p.highlights.map((h) => (
                        <View key={h} style={s.highlightRow}>
                          <Ionicons name="checkmark-circle" size={14} color={selected ? COLORS.violet : '#ccc'} />
                          <Text style={s.highlightTxt}>{h}</Text>
                        </View>
                      ))}
                    </>
                  )}
                </TouchableOpacity>
              )
            })}
          </>
        )}

        {step === 2 && (
          <>
            <Text style={s.sectionLabel}>Votre voyage</Text>
            {product.requiresTrip && (
              <>
                <Text style={s.fieldLabel}>Destination</Text>
                <View style={s.chipRow}>
                  {INSURANCE_DESTINATIONS.map((d) => (
                    <TouchableOpacity key={d.value} style={[s.chip, form.destination === d.value && s.chipSelected]} onPress={() => update({ destination: d.value })}>
                      <Text style={[s.chipTxt, form.destination === d.value && s.chipTxtSelected]}>{d.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {!!errors.destination && <Text style={s.errTxt}>{errors.destination}</Text>}
              </>
            )}

            <Text style={s.fieldLabel}>Dates</Text>
            <View style={s.row2}>
              <View style={{ flex: 1 }}>
                <Text style={s.fieldLabel}>Départ</Text>
                <DateField value={form.departureDate} onChange={(v) => update({ departureDate: v })} error={!!errors.departureDate} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.fieldLabel}>Retour</Text>
                <DateField value={form.returnDate} onChange={(v) => update({ returnDate: v })} />
              </View>
            </View>
            {!!errors.departureDate && <Text style={s.errTxt}>{errors.departureDate}</Text>}

            {product.requiresTrip && (
              <>
                <Text style={s.fieldLabel}>Prix total du voyage (€)</Text>
                <TextInput style={[s.input, !!errors.tripPrice && s.inputErr]} placeholder="Ex: 2500" keyboardType="numeric" value={form.tripPrice} onChangeText={(v) => update({ tripPrice: v })} />
                {!!errors.tripPrice && <Text style={s.errTxt}>{errors.tripPrice}</Text>}
              </>
            )}
          </>
        )}

        {step === 3 && (
          <>
            <Text style={s.sectionLabel}>Identité du souscripteur</Text>
            <View style={s.row2}>
              <View style={{ flex: 1 }}>
                <Text style={s.fieldLabel}>Prénom</Text>
                <TextInput style={[s.input, !!errors.firstName && s.inputErr]} value={form.firstName} onChangeText={(v) => update({ firstName: v })} placeholder="Jean" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.fieldLabel}>Nom</Text>
                <TextInput style={[s.input, !!errors.lastName && s.inputErr]} value={form.lastName} onChangeText={(v) => update({ lastName: v })} placeholder="Dupont" />
              </View>
            </View>
            <Text style={s.fieldLabel}>Date de naissance</Text>
            <DateField value={form.birthDate} onChange={(v) => update({ birthDate: v })} error={!!errors.birthDate} />
            {!!errors.birthDate && <Text style={s.errTxt}>{errors.birthDate}</Text>}
            <Text style={s.fieldLabel}>Email</Text>
            <TextInput style={[s.input, !!errors.email && s.inputErr]} value={form.email} onChangeText={(v) => update({ email: v })} placeholder="vous@email.com" keyboardType="email-address" autoCapitalize="none" />
            <Text style={s.fieldLabel}>Adresse</Text>
            <TextInput style={[s.input, !!errors.address && s.inputErr]} value={form.address} onChangeText={(v) => update({ address: v })} placeholder="Rue, quartier" />
            <View style={s.row2}>
              <View style={{ flex: 1 }}>
                <Text style={s.fieldLabel}>Code postal</Text>
                <TextInput style={[s.input, !!errors.postalCode && s.inputErr]} value={form.postalCode} onChangeText={(v) => update({ postalCode: v })} placeholder="98713" keyboardType="numeric" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.fieldLabel}>Ville</Text>
                <TextInput style={[s.input, !!errors.city && s.inputErr]} value={form.city} onChangeText={(v) => update({ city: v })} placeholder="Papeete" />
              </View>
            </View>

            <TouchableOpacity style={s.residencyRow} onPress={() => setResidencyConfirmed(!residencyConfirmed)}>
              <Ionicons name={residencyConfirmed ? 'checkbox' : 'square-outline'} size={20} color={residencyConfirmed ? COLORS.violet : COLORS.textMuted} />
              <Text style={s.residencyTxt}>Je confirme résider en Polynésie française — cette assurance leur est réservée.</Text>
            </TouchableOpacity>
            {!!errors.residency && <Text style={s.errTxt}>Confirmez votre résidence pour continuer.</Text>}
          </>
        )}

        {step === 4 && (
          <>
            <Text style={s.sectionLabel}>Voyageurs accompagnants</Text>
            <Text style={s.hint}>Vous voyagez seul ? Passez à l'étape suivante. Sinon, ajoutez vos accompagnants.</Text>
            {form.companions.map((c, i) => (
              <View key={i} style={s.companionCard}>
                <View style={s.companionHead}>
                  <Text style={s.companionTitle}>Voyageur {i + 1}</Text>
                  <TouchableOpacity onPress={() => removeCompanion(i)}>
                    <Ionicons name="trash-outline" size={18} color="#B00020" />
                  </TouchableOpacity>
                </View>
                <View style={s.row2}>
                  <TextInput style={[s.input, { flex: 1 }]} placeholder="Prénom" value={c.firstName} onChangeText={(v) => updateCompanion(i, { firstName: v })} />
                  <TextInput style={[s.input, { flex: 1 }]} placeholder="Nom" value={c.lastName} onChangeText={(v) => updateCompanion(i, { lastName: v })} />
                </View>
                <DateField value={c.birthDate} onChange={(v) => updateCompanion(i, { birthDate: v })} />
                <View style={s.chipRow}>
                  {PARENTAL_LINKS.map((p) => (
                    <TouchableOpacity key={p.value} style={[s.chipSm, c.parental_link === p.value && s.chipSelected]} onPress={() => updateCompanion(i, { parental_link: p.value })}>
                      <Text style={[s.chipTxtSm, c.parental_link === p.value && s.chipTxtSelected]}>{p.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ))}
            <TouchableOpacity style={s.addBtn} onPress={addCompanion}>
              <Ionicons name="add" size={18} color={COLORS.violet} />
              <Text style={s.addBtnTxt}>Ajouter un voyageur</Text>
            </TouchableOpacity>
          </>
        )}

        {step === 5 && (
          <>
            <Text style={s.sectionLabel}>Options de votre contrat</Text>
            <Text style={s.hint}>Personnalisez votre couverture selon vos besoins.</Text>
            {options.map((opt) => (
              <View key={opt.id} style={s.optionCard}>
                {opt.type === 'boolean' && (
                  <View style={s.optionRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.optionLabel}>{opt.label}</Text>
                      <Text style={s.optionDesc}>{opt.description}</Text>
                    </View>
                    <Switch value={isBooleanSelected(opt.defaultSubOptionId || opt.id)} onValueChange={(v) => toggleBooleanOption(opt.defaultSubOptionId || opt.id, v)} trackColor={{ true: COLORS.violet }} />
                  </View>
                )}
                {opt.type === 'select' && (
                  <>
                    <Text style={s.optionLabel}>{opt.label}</Text>
                    <Text style={s.optionDesc}>{opt.description}</Text>
                    <View style={s.chipRow}>
                      <TouchableOpacity style={[s.chipSm, selectedSubOptionId(opt.subOptions) === '' && s.chipSelected]} onPress={() => chooseSelectOption(opt.subOptions, '')}>
                        <Text style={[s.chipTxtSm, selectedSubOptionId(opt.subOptions) === '' && s.chipTxtSelected]}>Standard</Text>
                      </TouchableOpacity>
                      {opt.subOptions?.map((so) => (
                        <TouchableOpacity key={so.id} style={[s.chipSm, selectedSubOptionId(opt.subOptions) === so.id && s.chipSelected]} onPress={() => chooseSelectOption(opt.subOptions, so.id)}>
                          <Text style={[s.chipTxtSm, selectedSubOptionId(opt.subOptions) === so.id && s.chipTxtSelected]}>{so.label}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </>
                )}
                {opt.type === 'date-range' && (
                  <>
                    <View style={s.optionRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={s.optionLabel}>{opt.label}</Text>
                        <Text style={s.optionDesc}>{opt.description}</Text>
                      </View>
                      <Switch value={isDateRangeSelected(opt.id)} onValueChange={(v) => toggleDateRangeOption(opt.id, v)} trackColor={{ true: COLORS.violet }} />
                    </View>
                    {isDateRangeSelected(opt.id) && (
                      <View style={s.row2}>
                        <View style={{ flex: 1 }}>
                          <Text style={s.fieldLabel}>Début location</Text>
                          <DateField value={form.optionDateRanges[opt.id]?.from_date_option ?? ''} onChange={(v) => setOptionDateRange(opt.id, 'from_date_option', v)} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={s.fieldLabel}>Fin location</Text>
                          <DateField value={form.optionDateRanges[opt.id]?.to_date_option ?? ''} onChange={(v) => setOptionDateRange(opt.id, 'to_date_option', v)} />
                        </View>
                      </View>
                    )}
                  </>
                )}
              </View>
            ))}

            <Text style={s.sectionLabel}>Code promo</Text>
            <View style={s.row2}>
              <TextInput style={[s.input, { flex: 1 }]} placeholder="Code promo (optionnel)" autoCapitalize="characters" value={form.promoCode} onChangeText={(v) => update({ promoCode: v })} />
              <TouchableOpacity style={s.promoBtn} onPress={() => checkPromoCode(form.promoCode)} disabled={!form.promoCode || promoStatus === 'loading'}>
                {promoStatus === 'loading' ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.promoBtnTxt}>Appliquer</Text>}
              </TouchableOpacity>
            </View>
            {promoStatus === 'valid' && <Text style={s.promoValid}>Code appliqué : -{promoDiscount} €</Text>}
            {promoStatus === 'invalid' && <Text style={s.errTxt}>Code promo invalide</Text>}

            <View style={s.quoteBox}>
              {quoting ? (
                <ActivityIndicator color={COLORS.violet} />
              ) : premium != null ? (
                <>
                  <Text style={s.quoteLabel}>Tarif estimé</Text>
                  <Text style={s.quoteValue}>{formatXpf((totalEur ?? 0) * EUR_TO_XPF)}</Text>
                  <Text style={s.quoteSub}>Frais de service inclus</Text>
                </>
              ) : (
                <Text style={s.hint}>Le tarif se met à jour automatiquement.</Text>
              )}
            </View>
          </>
        )}

        {step === 6 && (
          <>
            <Text style={s.sectionLabel}>Récapitulatif</Text>
            <View style={s.recapCard}>
              <View style={s.recapRow}><Text style={s.recapLabel}>Formule</Text><Text style={s.recapValue}>{product.label}</Text></View>
              {product.requiresTrip && (
                <View style={s.recapRow}><Text style={s.recapLabel}>Destination</Text><Text style={s.recapValue}>{INSURANCE_DESTINATIONS.find((d) => d.value === form.destination)?.label ?? '-'}</Text></View>
              )}
              <View style={s.recapRow}><Text style={s.recapLabel}>Dates</Text><Text style={s.recapValue}>{isoToDisplay(form.departureDate)} → {isoToDisplay(form.returnDate)}</Text></View>
              <View style={s.recapRow}><Text style={s.recapLabel}>Souscripteur</Text><Text style={s.recapValue}>{form.firstName} {form.lastName}</Text></View>
              {form.companions.length > 0 && (
                <View style={s.recapRow}><Text style={s.recapLabel}>Voyageurs</Text><Text style={s.recapValue}>+{form.companions.length}</Text></View>
              )}
            </View>

            <View style={s.quoteBox}>
              {quoting ? (
                <ActivityIndicator color={COLORS.violet} />
              ) : (
                <>
                  <Text style={s.quoteLabel}>Total à payer</Text>
                  <Text style={s.quoteValue}>{totalEur != null ? formatXpf(totalEur * EUR_TO_XPF) : '-'}</Text>
                  <Text style={s.quoteSub}>TTC</Text>
                </>
              )}
            </View>

            <View style={s.noteBox}>
              <Ionicons name="information-circle-outline" size={16} color={COLORS.textMuted} />
              <Text style={s.noteTxt}>
                Vous allez être redirigé vers un paiement sécurisé Stripe dans votre navigateur. Une fois le paiement effectué, revenez sur l'app :
                votre contrat apparaîtra dans Mon compte → Mes assurances dès sa confirmation.
              </Text>
            </View>
          </>
        )}
      </ScrollView>

      <View style={s.ctaBar}>
        {step < TOTAL_STEPS ? (
          <TouchableOpacity style={s.ctaWrapNeutral} disabled={quoting || checkingOut} onPress={goNext}>
            <View style={s.cta}>
              <Text style={s.ctaTxtNeutral}>Continuer</Text>
            </View>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={s.ctaWrap} disabled={quoting || checkingOut} onPress={goNext}>
            <LinearGradient colors={['#D251D8', '#FD7F3C']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.cta}>
              {checkingOut ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={s.ctaTxt}>{`Payer${totalEur != null ? ` — ${formatXpf(totalEur * EUR_TO_XPF)}` : ''}`}</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>
        )}
      </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  hero: { padding: 20, paddingTop: 16, paddingBottom: 20 },
  backBtn: { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 20, width: 36, height: 36, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  heroLabel: { color: 'rgba(255,255,255,0.75)', fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  heroTitle: { color: '#fff', ...TYPO.screenTitle, marginTop: 4 },
  stepDots: { flexDirection: 'row', gap: 6, marginTop: 14 },
  stepDot: { flex: 1, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.3)' },
  stepDotActive: { backgroundColor: '#fff' },
  stepDotDone: { backgroundColor: 'rgba(255,255,255,0.8)' },
  stepLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 12, marginTop: 8, fontWeight: '600' },
  scroll: { flex: 1 },
  sectionLabel: { fontSize: 15, fontWeight: '700', color: COLORS.text, marginTop: 8, marginBottom: 10 },
  hint: { fontSize: 12, color: COLORS.textMuted, marginBottom: 12, lineHeight: 17 },
  residencyRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 16, padding: 4 },
  residencyTxt: { flex: 1, fontSize: 12.5, color: COLORS.text, lineHeight: 18 },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: COLORS.textMuted, marginBottom: 6, marginTop: 10 },
  input: { backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: COLORS.text, borderWidth: 1.5, borderColor: 'transparent' },
  inputErr: { borderColor: '#B00020' },
  errTxt: { fontSize: 12, color: '#B00020', marginTop: 4 },
  row2: { flexDirection: 'row', gap: 10 },
  productCard: { backgroundColor: '#fff', borderRadius: RADIUS.lg, padding: 14, marginBottom: 10, borderWidth: 1.5, borderColor: 'transparent', ...SHADOW.card },
  productCardSelected: { borderColor: COLORS.violet },
  productCardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  expandBtn: { width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(210,81,216,0.1)', justifyContent: 'center', alignItems: 'center' },
  productBadge: { alignSelf: 'flex-start', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, marginBottom: 8 },
  productBadgeTxt: { color: '#fff', fontSize: 11, fontWeight: '700' },
  productTitle: { fontSize: 16, fontWeight: '800', color: COLORS.text },
  productDesc: { fontSize: 12, color: COLORS.textMuted, marginTop: 2, marginBottom: 8 },
  highlightRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  highlightTxt: { fontSize: 12, color: COLORS.text },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 6 },
  chip: { backgroundColor: '#fff', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1.5, borderColor: '#EDEDED' },
  chipSm: { backgroundColor: '#fff', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1.5, borderColor: '#EDEDED' },
  chipSelected: { borderColor: COLORS.violet, backgroundColor: 'rgba(210,81,216,0.08)' },
  chipTxt: { fontSize: 13, fontWeight: '600', color: COLORS.text },
  chipTxtSm: { fontSize: 12, fontWeight: '600', color: COLORS.text },
  chipTxtSelected: { color: COLORS.violet },
  companionCard: { backgroundColor: '#fff', borderRadius: RADIUS.lg, padding: 14, marginBottom: 10, gap: 8 },
  companionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  companionTitle: { fontSize: 13, fontWeight: '700', color: COLORS.text },
  addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1.5, borderColor: '#EDEDED', borderStyle: 'dashed', borderRadius: 12, paddingVertical: 14, marginTop: 4 },
  addBtnTxt: { color: COLORS.violet, fontWeight: '700', fontSize: 13 },
  optionCard: { backgroundColor: '#fff', borderRadius: RADIUS.lg, padding: 14, marginBottom: 10 },
  optionRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  optionLabel: { fontSize: 13, fontWeight: '700', color: COLORS.text },
  optionDesc: { fontSize: 11, color: COLORS.textMuted, marginTop: 2, marginBottom: 6 },
  promoBtn: { backgroundColor: COLORS.violet, borderRadius: 12, paddingHorizontal: 16, justifyContent: 'center', alignItems: 'center' },
  promoBtnTxt: { color: '#fff', fontWeight: '700', fontSize: 13 },
  promoValid: { fontSize: 12, color: COLORS.success, marginTop: 6, fontWeight: '600' },
  quoteBox: { backgroundColor: '#fff', borderRadius: RADIUS.md, padding: 18, alignItems: 'center', marginTop: 12, marginBottom: 8 },
  quoteLabel: { fontSize: 12, color: COLORS.textMuted, fontWeight: '600', textTransform: 'uppercase' },
  quoteValue: { fontSize: 28, fontWeight: '800', color: COLORS.violet, marginTop: 4 },
  quoteSub: { fontSize: 12, color: COLORS.textMuted, marginTop: 4 },
  recapCard: { backgroundColor: '#fff', borderRadius: RADIUS.lg, padding: 14, marginBottom: 4 },
  recapRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: '#f0f0f0' },
  recapLabel: { fontSize: 12, color: COLORS.textMuted },
  recapValue: { fontSize: 12, fontWeight: '700', color: COLORS.text, flexShrink: 1, textAlign: 'right' },
  noteBox: { flexDirection: 'row', gap: 8, backgroundColor: '#F5F4F2', borderRadius: RADIUS.md, padding: 12, marginTop: 4 },
  noteTxt: { flex: 1, fontSize: 11.5, color: COLORS.textMuted, lineHeight: 16 },
  ctaBar: { backgroundColor: '#fff', padding: 16, borderTopWidth: 1, borderTopColor: COLORS.border },
  ctaWrap: { borderRadius: 14, overflow: 'hidden' },
  ctaWrapNeutral: { borderRadius: 14, overflow: 'hidden', backgroundColor: '#fff', borderWidth: 1.5, borderColor: COLORS.violet },
  ctaTxtNeutral: { color: COLORS.violet, fontSize: 15, fontWeight: '800' },
  cta: { padding: 16, alignItems: 'center', justifyContent: 'center' },
  ctaTxt: { color: '#fff', fontSize: 15, fontWeight: '800' },
})
