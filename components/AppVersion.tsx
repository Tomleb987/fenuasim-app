// 2026-10-29 : ligne de version en bas de l'onglet Compte.
//
// Pourquoi : depuis la 1.0.4, l'app recoit des mises a jour a distance (EAS
// Update). Le numero de version des stores ne change pas avec elles, et rien
// ne permettait de savoir, sur un telephone, si la derniere mise a jour etait
// bien installee -- ni pour Thomas en test, ni pour le support face a un
// client. On affiche donc la version de l'app et la date de la mise a jour
// active, avec ses 8 premiers caracteres d'identifiant (ceux du tableau de
// bord Expo).
//
// Sans mise a jour telechargee (code embarque dans le build des stores),
// expo-updates indique isEmbeddedLaunch : on affiche alors « version
// d'origine ». En developpement (Expo Go, dev client), updateId est nul.
import { Text, StyleSheet } from 'react-native'
import Constants from 'expo-constants'
import * as Updates from 'expo-updates'
import dayjs from 'dayjs'
import { COLORS } from '../constants/theme'

export function appVersionLabel(): string {
  const version = Constants.expoConfig?.version ?? '?'
  if (!Updates.updateId) return `Version ${version}`
  if (Updates.isEmbeddedLaunch) return `Version ${version} · version d'origine`
  const date = Updates.createdAt ? dayjs(Updates.createdAt).format('DD/MM/YYYY') : null
  const id = Updates.updateId.slice(0, 8)
  return `Version ${version} · mise à jour ${date ? `du ${date} ` : ''}(${id})`
}

export default function AppVersion() {
  return (
    <Text style={s.txt} selectable accessibilityLabel={appVersionLabel()}>
      {appVersionLabel()}
    </Text>
  )
}

const s = StyleSheet.create({
  txt: { fontSize: 11, color: COLORS.textMuted, textAlign: 'center', marginTop: 16 },
})
