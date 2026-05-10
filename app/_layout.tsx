import { useEffect, useState } from 'react'
import { Stack, useRouter, useSegments } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { View, ActivityIndicator, Linking } from 'react-native'
import { supabase } from '../lib/supabase'
import { Session } from '@supabase/supabase-js'
import { COLORS } from '../constants/theme'

export default function RootLayout() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const segments = useSegments()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setSession(session)
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (loading) return
    const inAuth = segments[0] === '(auth)'
    if (!session && !inAuth) router.replace('/(auth)/login')
    if (session && inAuth) router.replace('/(tabs)')
  }, [session, loading, segments])

  // Deep link handler — retour depuis Stripe
  useEffect(() => {
    const handleUrl = (event: { url: string }) => {
      const url = event.url
      if (url.startsWith('fenuasim://payment-success')) {
        const params = new URL(url.replace('fenuasim://', 'https://fenuasim.com/'))
        const session_id = params.searchParams.get('session_id')
        const package_id = params.searchParams.get('package_id')
        router.push({ pathname: '/esim/payment-success', params: { session_id, package_id } })
      }
    }
    const sub = Linking.addEventListener('url', handleUrl)
    Linking.getInitialURL().then(url => { if (url) handleUrl({ url }) })
    return () => sub.remove()
  }, [])

  if (loading) return (
    <View style={{ flex:1, justifyContent:'center', alignItems:'center', backgroundColor: COLORS.bg }}>
      <ActivityIndicator color={COLORS.violet} />
    </View>
  )

  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }} />
    </>
  )
}
