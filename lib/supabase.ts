import { createClient } from '@supabase/supabase-js'
import { Platform } from 'react-native'
import * as SecureStore from 'expo-secure-store'

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!

const ExpoSecureStoreAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
}

// expo-secure-store n'existe que sur iOS et Android : il s'appuie sur le
// Keychain et le Keystore, que le navigateur n'expose pas. Appele sur web, il
// echoue des le premier acces a la session
// ("getValueWithKeyAsync is not a function") et l'application ne demarre pas.
// On laisse alors supabase-js prendre son stockage par defaut (localStorage).
// Le web ne sert qu'a tester un parcours dans un navigateur, il n'est pas
// distribue : c'est aussi pour cela qu'il n'a pas besoin du Keychain.
const authStorage = Platform.OS === 'web' ? undefined : ExpoSecureStoreAdapter

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: authStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    // PKCE recommande par Supabase pour mobile : le code d'echange transite par
    // deep link mais ne peut etre consomme que par l'appareil qui a initie la
    // demande (code_verifier stocke localement) -- contrairement au flow implicite,
    // aucun token n'est jamais expose directement dans l'URL du deep link.
    flowType: 'pkce',
  },
})
