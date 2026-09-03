import React, { useEffect, useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../constants/theme'
import { CurrencyCode, getLastCurrency } from '../lib/currency'

const OPTIONS: { code: CurrencyCode; label: string; sub: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { code: 'XPF', label: 'Francs Pacifique', sub: 'XPF — devise locale', icon: 'cash-outline' },
  { code: 'EUR', label: 'Euros', sub: '€ — converti au taux officiel', icon: 'card-outline' },
]

export default function CurrencyPicker({ onSelect }: { onSelect: (c: CurrencyCode) => void }) {
  const [selected, setSelected] = useState<CurrencyCode>('XPF')

  useEffect(() => {
    getLastCurrency().then((c) => { if (c) setSelected(c) })
  }, [])

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <View style={s.content}>
        <View style={s.iconCircle}>
          <Ionicons name="pricetags-outline" size={30} color={COLORS.violet} />
        </View>
        <Text style={s.title}>Comment souhaitez-vous voir les prix ?</Text>
        <Text style={s.desc}>Vous pourrez changer cela à tout moment depuis Mon compte.</Text>

        <View style={s.options}>
          {OPTIONS.map((opt) => {
            const isSel = selected === opt.code
            return (
              <TouchableOpacity key={opt.code} style={[s.option, isSel && s.optionSel]} onPress={() => setSelected(opt.code)}>
                <View style={[s.optionIcon, isSel && s.optionIconSel]}>
                  <Ionicons name={opt.icon} size={20} color={isSel ? '#fff' : COLORS.violet} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.optionLabel}>{opt.label}</Text>
                  <Text style={s.optionSub}>{opt.sub}</Text>
                </View>
                <Ionicons name={isSel ? 'radio-button-on' : 'radio-button-off'} size={20} color={isSel ? COLORS.violet : '#ccc'} />
              </TouchableOpacity>
            )
          })}
        </View>

        <TouchableOpacity style={s.ctaWrap} onPress={() => onSelect(selected)}>
          <LinearGradient colors={['#D251D8', '#FD7F3C']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.cta}>
            <Text style={s.ctaTxt}>Continuer</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  content: { flex: 1, padding: 24, justifyContent: 'center' },
  iconCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(210,81,216,0.1)', justifyContent: 'center', alignItems: 'center', alignSelf: 'center', marginBottom: 20 },
  title: { fontSize: 20, fontWeight: '800', color: COLORS.text, textAlign: 'center' },
  desc: { fontSize: 13, color: COLORS.textMuted, textAlign: 'center', marginTop: 8, marginBottom: 28, lineHeight: 18 },
  options: { gap: 10, marginBottom: 24 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: 16, padding: 14, borderWidth: 1.5, borderColor: 'transparent' },
  optionSel: { borderColor: COLORS.violet },
  optionIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(210,81,216,0.1)', justifyContent: 'center', alignItems: 'center' },
  optionIconSel: { backgroundColor: COLORS.violet },
  optionLabel: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  optionSub: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  ctaWrap: { borderRadius: 14, overflow: 'hidden' },
  cta: { padding: 16, alignItems: 'center' },
  ctaTxt: { color: '#fff', fontSize: 16, fontWeight: '800' },
})
