import React from 'react'
import { useEffect, useState } from 'react'
import { Stack, useRouter, useSegments } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { View, Text, ActivityIndicator, Animated, Image } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { supabase } from '../lib/supabase'
import { Session } from '@supabase/supabase-js'
import { COLORS } from '../constants/theme'

function SplashScreen() {
  const scale = React.useRef(new Animated.Value(0.8)).current
  const opacity = React.useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, tension: 50, friction: 7 }),
      Animated.timing(opacity, { toValue: 1, duration: 600, useNativeDriver: true }),
    ]).start()
  }, [])

  return (
    <LinearGradient
      colors={['#D251D8', '#FD7F3C']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}
    >
      <StatusBar style="light" />
      <Animated.View style={{ transform: [{ scale }], opacity, alignItems: 'center' }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
          <Image source={require('../assets/images/logo-white.png')} style={{ width: 260, height: 100, resizeMode: 'contain', borderRadius: 16, overflow: 'hidden' }} />

        </View>
        <Text style={{ fontSize: 15, color: 'rgba(255,255,255,0.85)', marginTop: 10, fontWeight: '500', letterSpacing: 1 }}>
          Votre eSIM pour voyager
        </Text>
      </Animated.View>
      <View style={{ position: 'absolute', bottom: 60 }}>
        <ActivityIndicator color="rgba(255,255,255,0.6)" />
      </View>
    </LinearGradient>
  )
}

export default function RootLayout() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [showSplash, setShowSplash] = useState(true)
  const router = useRouter()
  const segments = useSegments()

  useEffect(() => {
    // Splash minimum 2.5 secondes
    const splashTimer = setTimeout(() => setShowSplash(false), 3000)

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setSession(session)
    })

    return () => {
      subscription.unsubscribe()
      clearTimeout(splashTimer)
    }
  }, [])

  useEffect(() => {
    if (loading || showSplash) return
    const inAuth = segments[0] === '(auth)'
    if (!session && !inAuth) router.replace('/(auth)/login')
    if (session && inAuth) router.replace('/(tabs)')
  }, [session, loading, showSplash, segments])

  if (showSplash || loading) return <SplashScreen />

  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }} />
    </>
  )
}
