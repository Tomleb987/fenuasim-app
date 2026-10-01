// Bloc d'installation d'une eSIM, partage par l'ecran de confirmation d'achat
// et par l'ecran "Installer" accessible depuis l'accueil et "Mes eSIM".
//
// Il existe parce que le parcours iOS et le parcours Android ne sont pas les
// memes et ne peuvent pas l'etre :
//
//  - iOS expose un lien universel (apple_installation_url) qui ouvre
//    directement l'assistant d'installation d'eSIM du systeme. Ce lien n'a
//    aucun equivalent sur Android : ouvert depuis un navigateur Android il
//    aboutit sur une page Apple inerte. Il n'est donc affiche que sur iOS.
//  - Android n'a pas de schema d'installation en un tap universel : la voie
//    reellement supportee est la saisie manuelle de l'adresse SM-DP+ et du
//    code d'activation dans les reglages, ou le scan du QR code depuis un
//    SECOND appareil (le QR affiche sur le telephone a equiper est par
//    definition inscannable par ce meme telephone).
//
// On ne promet donc jamais une installation automatique la ou elle n'existe
// pas : c'est la plateforme qui decide de ce qui est propose.
import React, { useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Image, Platform, Linking, ToastAndroid } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import * as Clipboard from 'expo-clipboard'
import { COLORS, RADIUS, SHADOW } from '../constants/theme'

export type EsimInstallData = {
  qr_code_url?: string | null
  apple_installation_url?: string | null
  lpa?: string | null
  matching_id?: string | null
  sharing_link?: string | null
  sharing_access_code?: string | null
}

export function hasInstallData(order: EsimInstallData | null | undefined): boolean {
  if (!order) return false
  return !!(order.qr_code_url || order.apple_installation_url || order.lpa || order.matching_id || order.sharing_link)
}

function CopyableField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    await Clipboard.setStringAsync(value)
    // Retour visuel systematique dans le bouton (les deux plateformes), plus le
    // toast natif Android auquel les utilisateurs Android s'attendent.
    setCopied(true)
    if (Platform.OS === 'android') ToastAndroid.show('Copié', ToastAndroid.SHORT)
    setTimeout(() => setCopied(false), 1800)
  }

  return (
    <View style={s.fieldWrap}>
      <Text style={s.fieldLabel}>{label}</Text>
      <View style={s.fieldRow}>
        <Text style={s.fieldValue} selectable numberOfLines={2}>{value}</Text>
        <TouchableOpacity
          style={[s.copyBtn, copied && s.copyBtnDone]}
          onPress={handleCopy}
          accessibilityRole="button"
          accessibilityLabel={`Copier ${label}`}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={14} color={copied ? '#fff' : COLORS.violet} />
          <Text style={[s.copyTxt, copied && s.copyTxtDone]}>{copied ? 'Copié' : 'Copier'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

export default function EsimInstallBlock({ order }: { order: EsimInstallData }) {
  // Sur Android le QR est replie par defaut (il faut un second appareil pour
  // le scanner) ; sur iOS il reste le repli naturel apres le bouton natif.
  const [showQr, setShowQr] = useState(false)

  const isIos = Platform.OS === 'ios'
  const hasManual = !!order.lpa || !!order.matching_id

  return (
    <View style={s.box}>
      <Text style={s.title}>Installer votre eSIM</Text>

      {isIos && !!order.apple_installation_url && (
        <TouchableOpacity style={s.ctaWrap} onPress={() => Linking.openURL(order.apple_installation_url!)}>
          <LinearGradient colors={['#D251D8', '#FD7F3C']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.cta}>
            <Ionicons name="download-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
            <Text style={s.ctaTxt}>Installer sur cet iPhone</Text>
          </LinearGradient>
        </TouchableOpacity>
      )}

      {!isIos && hasManual && (
        <View style={s.manualBox}>
          <Text style={s.manualTitle}>Installation sur cet appareil</Text>
          <Text style={s.manualIntro}>
            Ouvrez Paramètres › Réseaux et Internet › Cartes SIM › Ajouter une eSIM, puis choisissez la saisie
            manuelle et collez les informations ci-dessous.
          </Text>
          {!!order.lpa && <CopyableField label="Adresse SM-DP+" value={order.lpa} />}
          {!!order.matching_id && <CopyableField label="Code d'activation" value={order.matching_id} />}
          <Text style={s.manualHint}>
            Le libellé exact des menus varie selon la marque de votre téléphone (Samsung, Google Pixel, Xiaomi…).
          </Text>
        </View>
      )}

      {!isIos && !hasManual && !!order.qr_code_url && (
        <Text style={s.androidNotice}>
          Scannez le QR code ci-dessous depuis l'appareil que vous voulez équiper, ou retrouvez-le dans l'email de
          confirmation.
        </Text>
      )}

      {!!order.qr_code_url && (
        <>
          <TouchableOpacity style={s.qrToggle} onPress={() => setShowQr((v) => !v)} accessibilityRole="button">
            <Ionicons name="qr-code-outline" size={18} color={COLORS.violet} />
            <Text style={s.qrToggleTxt}>{showQr ? 'Masquer mon QR code' : 'Voir mon QR code'}</Text>
            <Ionicons name={showQr ? 'chevron-up' : 'chevron-down'} size={16} color={COLORS.textMuted} />
          </TouchableOpacity>
          {showQr && (
            <View style={s.qrWrap}>
              <Text style={s.qrSub}>À scanner depuis un autre appareil que celui-ci :</Text>
              <Image source={{ uri: order.qr_code_url }} style={s.qrImg} resizeMode="contain" />
            </View>
          )}
        </>
      )}

      {!!order.sharing_link && (
        <TouchableOpacity style={s.cloudRow} onPress={() => Linking.openURL(order.sharing_link!)}>
          <Ionicons name="cloud-outline" size={20} color={COLORS.violet} />
          <View style={s.cloudTxtWrap}>
            <Text style={s.cloudTitle}>Installer et suivre en ligne</Text>
            {!!order.sharing_access_code && (
              <Text style={s.cloudSub}>Code d'accès : {order.sharing_access_code}</Text>
            )}
          </View>
          <Ionicons name="open-outline" size={16} color={COLORS.textMuted} />
        </TouchableOpacity>
      )}
    </View>
  )
}

const s = StyleSheet.create({
  box: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 16, ...SHADOW.card },
  title: { fontSize: 15, fontWeight: '700', color: COLORS.text, marginBottom: 10 },
  ctaWrap: { borderRadius: 14, overflow: 'hidden' },
  cta: { padding: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center' },
  ctaTxt: { color: '#fff', fontSize: 15, fontWeight: '800' },
  manualBox: { backgroundColor: COLORS.bg, borderRadius: RADIUS.md, padding: 14, borderWidth: 1, borderColor: COLORS.border },
  manualTitle: { fontSize: 13, fontWeight: '800', color: COLORS.text, marginBottom: 6 },
  manualIntro: { fontSize: 12, color: COLORS.textMuted, lineHeight: 18, marginBottom: 12 },
  manualHint: { fontSize: 11, color: COLORS.textMuted, lineHeight: 16, marginTop: 2 },
  androidNotice: { fontSize: 13, color: COLORS.textMuted, lineHeight: 19 },
  fieldWrap: { marginBottom: 12 },
  fieldLabel: { fontSize: 11, fontWeight: '700', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 4 },
  fieldRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  fieldValue: { flex: 1, fontSize: 13, color: COLORS.text, fontWeight: '600' },
  copyBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1.5, borderColor: COLORS.violet, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7 },
  copyBtnDone: { backgroundColor: COLORS.success, borderColor: COLORS.success },
  copyTxt: { fontSize: 12, fontWeight: '700', color: COLORS.violet },
  copyTxtDone: { color: '#fff' },
  qrToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, marginTop: 14, borderWidth: 1.5, borderColor: COLORS.violet, borderRadius: 12 },
  qrToggleTxt: { fontSize: 13, fontWeight: '700', color: COLORS.violet },
  qrWrap: { alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: COLORS.border, marginTop: 12 },
  qrSub: { fontSize: 12, color: COLORS.textMuted, marginBottom: 10, textAlign: 'center' },
  // QR volontairement large : a 240 pt il reste scannable par un second
  // appareil meme sur un ecran Android de faible luminosite.
  qrImg: { width: 240, height: 240 },
  cloudRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.bg, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: COLORS.border, marginTop: 14 },
  cloudTxtWrap: { flex: 1, marginLeft: 10 },
  cloudTitle: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  cloudSub: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
})
