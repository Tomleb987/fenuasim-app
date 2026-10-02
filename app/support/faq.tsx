import React, { useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { COLORS, RADIUS, SHADOW, TYPO } from '../../constants/theme'

const FAQ: { q: string; a: string }[] = [
  {
    q: 'Quand installer mon eSIM ?',
    a: "Tu peux l'installer dès que tu reçois le QR code ou le lien d'installation, avant même ton départ. L'installation ne consomme pas de données : l'eSIM est simplement enregistrée sur ton téléphone en attendant l'activation.",
  },
  {
    q: 'Quand activer mon eSIM ?',
    a: "L'activation est généralement automatique dès que tu te connectes au réseau mobile de ta destination, à ton arrivée. Aucune action manuelle n'est nécessaire dans la majorité des cas.",
  },
  {
    q: 'WhatsApp fonctionne-t-il avec une eSIM Internet uniquement ?',
    a: "Oui. WhatsApp, Messenger, la navigation et les réseaux sociaux fonctionnent normalement via l'enveloppe Internet de ton forfait, y compris sur une eSIM \"Internet uniquement\". Seuls les appels et SMS classiques (réseau téléphonique) ne sont pas inclus dans ce type de forfait.",
  },
  {
    q: 'Puis-je utiliser mon numéro habituel en même temps ?',
    a: "Oui, sur un téléphone compatible eSIM. Ta SIM physique (ou ta ligne principale) reste active pour tes appels et SMS habituels, pendant que l'eSIM FenuaSIM gère la data sur place.",
  },
  {
    q: 'Comment vérifier ma consommation ?',
    a: "Directement depuis l'écran d'accueil de l'application : chaque eSIM affiche sa consommation (utilisé / restant) dès que la donnée est disponible côté opérateur.",
  },
  {
    q: 'Que faire si mon eSIM ne se connecte pas ?',
    a: "Dans l'ordre : vérifie que l'eSIM est bien activée, active le mode avion pendant 30 secondes puis désactive-le, vérifie que l'eSIM FenuaSIM est bien sélectionnée pour les données mobiles (et non ta SIM habituelle), et vérifie que l'itinérance des données est activée pour cette eSIM. Si le problème persiste, contacte le support.",
  },
  {
    q: 'Puis-je recharger mon eSIM ?',
    a: "Oui, directement depuis l'application : ouvre \"Mes eSIM\" sur l'accueil, sélectionne l'eSIM concernée puis \"Recharger mon eSIM\". Si aucune recharge n'est proposée, c'est que ton forfait actuel n'en propose pas — dans ce cas, contacte le support FenuaSIM.",
  },
  {
    q: 'Comment supprimer une eSIM ?',
    a: "La suppression se fait depuis les réglages de ton téléphone (Réglages > Réseau mobile / Cellulaire > sélectionner l'eSIM > Supprimer). Si tu penses en avoir encore besoin, contacte le support avant de la supprimer.",
  },
  {
    q: "L'eSIM fonctionne-t-elle sur tous les téléphones ?",
    a: "Non. La plupart des iPhone XR/XS et modèles plus récents prennent en charge l'eSIM, ainsi que de nombreux modèles Android récents — sous réserve du modèle exact, de la région de commercialisation et d'éventuelles restrictions opérateur. Pour vérifier toi-même : compose *#06# dans l'application Téléphone. Si un numéro \"EID\" s'affiche, ton téléphone gère l'eSIM. Attention, un téléphone bloqué par un opérateur peut refuser une eSIM même s'il est compatible : en cas de doute, contacte le support avant ton achat.",
  },
  {
    q: "Ai-je besoin du Wi-Fi pour installer mon eSIM ?",
    a: "Oui, pour l'installation seulement. Le scan du QR code et le téléchargement du profil passent par Internet : fais-le chez toi en Wi-Fi avant de partir. Une fois installée, l'eSIM n'a plus besoin de rien pour fonctionner à l'arrivée.",
  },
  {
    q: "Comment scanner le QR code si je n'ai qu'un seul téléphone ?",
    a: "Ouvre l'e-mail sur un ordinateur ou une tablette, puis scanne depuis ton téléphone. Sinon, enregistre le QR code en photo et utilise l'option \"Saisir les détails manuellement\" dans les réglages : l'adresse du serveur et le code d'activation figurent dans le même e-mail.",
  },
  {
    q: 'Combien de Go prévoir pour mon voyage ?',
    a: "Environ 1 Go par semaine pour un usage léger (cartes, messages, un peu de navigation), 5 à 10 Go pour un usage courant avec réseaux sociaux et photos, et un forfait illimité si tu regardes des vidéos ou si tu partages ta connexion. Dans le doute, prends un peu plus : tu peux recharger en cours de route, mais seulement si ton forfait le permet.",
  },
  {
    q: 'Le partage de connexion fonctionne-t-il ?',
    a: "Oui sur la plupart des forfaits. Garde en tête qu'il consomme beaucoup plus vite qu'un usage solo : un ordinateur connecté en partage peut épuiser plusieurs gigaoctets en une soirée. Si c'est ton usage principal, prévois large ou choisis un forfait illimité.",
  },
  {
    q: "Je suis déjà à l'étranger, puis-je commander ?",
    a: "Oui, tant que tu as un accès Wi-Fi (hôtel, café, aéroport) pour recevoir et installer l'eSIM. La commande est traitée immédiatement et le QR code arrive en quelques minutes.",
  },
  {
    q: "J'ai supprimé mon eSIM par erreur, que faire ?",
    a: "Contacte le support sans attendre. Un QR code ne peut en général être utilisé qu'une seule fois : une fois le profil supprimé du téléphone, il n'est pas toujours possible de le réinstaller. Nous vérifierons si une réactivation ou un remplacement est envisageable.",
  },
]

export default function FaqScreen() {
  const router = useRouter()
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <LinearGradient colors={['#D251D8', '#FD7F3C']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.hero}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color="#fff" />
        </TouchableOpacity>
        <Text style={s.heroTitle}>Questions fréquentes</Text>
      </LinearGradient>

      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>
        {FAQ.map((item, i) => {
          const open = openIndex === i
          return (
            <TouchableOpacity key={i} style={s.card} onPress={() => setOpenIndex(open ? null : i)} activeOpacity={0.8}>
              <View style={s.cardHead}>
                <Text style={s.question}>{item.q}</Text>
                <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={COLORS.violet} />
              </View>
              {open && <Text style={s.answer}>{item.a}</Text>}
            </TouchableOpacity>
          )
        })}
        <View style={{ height: 30 }} />
      </ScrollView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  hero: { padding: 20, paddingBottom: 24, borderBottomLeftRadius: RADIUS.xl, borderBottomRightRadius: RADIUS.xl, overflow: 'hidden' },
  backBtn: { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 20, width: 36, height: 36, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  heroTitle: { color: '#fff', ...TYPO.screenTitle },
  scroll: { flex: 1, padding: 16 },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 8, ...SHADOW.card },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  question: { flex: 1, fontSize: 14, fontWeight: '700', color: COLORS.text },
  answer: { fontSize: 13, color: COLORS.textMuted, lineHeight: 20, marginTop: 10 },
})
