import React from 'react'
import { useEffect, useRef, useState } from 'react'
import { Stack, useRouter, useSegments } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { View, Animated, Easing, Dimensions } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import * as NativeSplash from 'expo-splash-screen'
import { supabase } from '../lib/supabase'
import { Session } from '@supabase/supabase-js'
import { COLORS } from '../constants/theme'
import { CurrencyProvider, useCurrency } from '../lib/currency'
import CurrencyPicker from '../components/CurrencyPicker'

// Le splash natif (app.json) n'affiche plus qu'un aplat violet #D251D8 : son
// image est un PNG entierement transparent (assets/splash-blank.png), ce qui
// evite a la fois le gros logo plein ecran de l'ancienne config et l'icone que
// Android 12+ affiche par defaut quand aucune image n'est fournie.
// Le seul logo du demarrage est donc celui du splash JS anime ci-dessous, qui
// part du meme aplat violet puis fond son degrade par dessus : la bascule
// natif -> JS est invisible.
// On empeche la fermeture automatique du splash natif jusqu'au premier rendu
// du splash JS (hideAsync() dans <SplashScreen />), sinon un blanc apparait
// entre les deux.
NativeSplash.preventAutoHideAsync().catch(() => {})

const BAR_HEIGHTS = [10, 15, 20, 25]
const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window')
const STREAK_LENGTH = Math.hypot(SCREEN_W, SCREEN_H) * 1.2

function SignalBars({ color }: { color: string }) {
  const bars = useRef(BAR_HEIGHTS.map(() => new Animated.Value(0.35))).current

  useEffect(() => {
    const loops = bars.map((bar, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 130),
          Animated.timing(bar, { toValue: 1, duration: 380, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.timing(bar, { toValue: 0.35, duration: 380, easing: Easing.in(Easing.quad), useNativeDriver: true }),
          Animated.delay((BAR_HEIGHTS.length - 1 - i) * 130),
        ])
      )
    )
    loops.forEach((l) => l.start())
    return () => loops.forEach((l) => l.stop())
  }, [])

  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 5, height: 25 }}>
      {bars.map((bar, i) => (
        <Animated.View
          key={i}
          style={{
            width: 5,
            height: BAR_HEIGHTS[i],
            borderRadius: 2.5,
            backgroundColor: color,
            transform: [{ scaleY: bar }],
          }}
        />
      ))}
    </View>
  )
}

function PulseRings() {
  const rings = useRef([0, 1, 2].map(() => ({ scale: new Animated.Value(0.5), opacity: new Animated.Value(0) }))).current

  useEffect(() => {
    const loops = rings.map((ring, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 550),
          Animated.parallel([
            Animated.timing(ring.scale, { toValue: 1.6, duration: 1800, easing: Easing.out(Easing.ease), useNativeDriver: true }),
            Animated.sequence([
              Animated.timing(ring.opacity, { toValue: 0.55, duration: 140, useNativeDriver: true }),
              Animated.timing(ring.opacity, { toValue: 0, duration: 1660, easing: Easing.out(Easing.ease), useNativeDriver: true }),
            ]),
          ]),
          Animated.delay((2 - i) * 550 + 200),
        ])
      )
    )
    loops.forEach((l) => {
      l.reset?.()
      l.start()
    })
    return () => loops.forEach((l) => l.stop())
  }, [])

  return (
    <>
      {rings.map((ring, i) => (
        <Animated.View
          key={i}
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            marginTop: -130,
            marginLeft: -130,
            width: 260,
            height: 260,
            borderRadius: 130,
            borderWidth: 1.5,
            borderColor: 'rgba(255,255,255,0.9)',
            opacity: ring.opacity,
            transform: [{ scale: ring.scale }],
          }}
        />
      ))}
    </>
  )
}

function AmbientBlobs() {
  const drift1 = useRef(new Animated.Value(0)).current
  const drift2 = useRef(new Animated.Value(0)).current

  useEffect(() => {
    const l1 = Animated.loop(
      Animated.sequence([
        Animated.timing(drift1, { toValue: 1, duration: 7000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(drift1, { toValue: 0, duration: 7000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    )
    const l2 = Animated.loop(
      Animated.sequence([
        Animated.timing(drift2, { toValue: 1, duration: 9000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(drift2, { toValue: 0, duration: 9000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    )
    l1.start()
    l2.start()
    return () => {
      l1.stop()
      l2.stop()
    }
  }, [])

  const translate1X = drift1.interpolate({ inputRange: [0, 1], outputRange: [-16, 16] })
  const translate1Y = drift1.interpolate({ inputRange: [0, 1], outputRange: [-10, 14] })
  const translate2X = drift2.interpolate({ inputRange: [0, 1], outputRange: [14, -14] })
  const translate2Y = drift2.interpolate({ inputRange: [0, 1], outputRange: [10, -16] })

  return (
    <>
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: -80,
          left: -60,
          width: 260,
          height: 260,
          borderRadius: 130,
          backgroundColor: 'rgba(255,255,255,0.10)',
          transform: [{ translateX: translate1X }, { translateY: translate1Y }],
        }}
      />
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          bottom: -100,
          right: -70,
          width: 320,
          height: 320,
          borderRadius: 160,
          backgroundColor: 'rgba(255,255,255,0.08)',
          transform: [{ translateX: translate2X }, { translateY: translate2Y }],
        }}
      />
    </>
  )
}

function DiagonalStreak() {
  const sweep = useRef(new Animated.Value(0)).current

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        // 1400 ms : la passe complete tient dans la duree minimum du splash
        // (1800 ms), le reflet n'est jamais coupe en plein milieu.
        Animated.timing(sweep, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
        Animated.delay(1100),
        Animated.timing(sweep, { toValue: 0, duration: 0, useNativeDriver: true }),
        Animated.delay(500),
      ])
    )
    loop.start()
    return () => loop.stop()
  }, [])

  const translateX = sweep.interpolate({ inputRange: [0, 1], outputRange: [-SCREEN_W * 0.9, SCREEN_W * 0.9] })

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: SCREEN_H / 2 - 60,
        left: SCREEN_W / 2 - STREAK_LENGTH / 2,
        width: STREAK_LENGTH,
        height: 120,
        transform: [{ rotate: '-28deg' }, { translateX }],
      }}
    >
      <LinearGradient
        colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.3)', 'rgba(255,255,255,0)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{ flex: 1 }}
      />
    </Animated.View>
  )
}

const SPLASH_BASE_COLOR = '#D251D8'

function SplashScreen({ exiting, onExited }: { exiting: boolean; onExited: () => void }) {
  const exitOpacity = useRef(new Animated.Value(1)).current
  const exitScale = useRef(new Animated.Value(1)).current
  // Entree : le degrade et le logo apparaissent par dessus l'aplat violet du
  // splash natif, plutot que de le remplacer d'un coup.
  const enterOpacity = useRef(new Animated.Value(0)).current
  const logoScale = useRef(new Animated.Value(0.92)).current

  // Premier rendu de ce composant peint : le splash JS est maintenant a
  // l'ecran, on peut retirer le splash natif sans jamais laisser un blanc.
  useEffect(() => {
    NativeSplash.hideAsync().catch(() => {})
    Animated.parallel([
      Animated.timing(enterOpacity, { toValue: 1, duration: 340, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(logoScale, { toValue: 1, duration: 520, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start()
  }, [])

  useEffect(() => {
    if (!exiting) return
    Animated.parallel([
      Animated.timing(exitOpacity, { toValue: 0, duration: 380, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
      Animated.timing(exitScale, { toValue: 1.06, duration: 380, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
    ]).start(({ finished }) => {
      if (finished) onExited()
    })
  }, [exiting])

  return (
    <Animated.View
      style={{
        flex: 1,
        backgroundColor: SPLASH_BASE_COLOR,
        opacity: exitOpacity,
        transform: [{ scale: exitScale }],
      }}
    >
      <StatusBar style="light" />
      <Animated.View style={{ flex: 1, opacity: enterOpacity }}>
        <LinearGradient
          colors={[SPLASH_BASE_COLOR, '#FD7F3C']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}
        >
          <AmbientBlobs />
          <DiagonalStreak />

          <View style={{ alignItems: 'center', justifyContent: 'center' }}>
            <PulseRings />
            <Animated.Image
              source={require('../assets/images/logo-white.png')}
              style={{ width: 260, height: 100, resizeMode: 'contain', transform: [{ scale: logoScale }] }}
            />
          </View>

          <View style={{ position: 'absolute', bottom: 64 }}>
            <SignalBars color="rgba(255,255,255,0.75)" />
          </View>
        </LinearGradient>
      </Animated.View>
    </Animated.View>
  )
}

export default function RootLayout() {
  return (
    <CurrencyProvider>
      <RootLayoutInner />
    </CurrencyProvider>
  )
}

function RootLayoutInner() {
  const { setCurrency } = useCurrency()
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [showSplash, setShowSplash] = useState(true)
  const [minTimeDone, setMinTimeDone] = useState(false)
  const [splashExiting, setSplashExiting] = useState(false)
  const [currencyConfirmed, setCurrencyConfirmed] = useState(false)
  // Une session issue d'un lien de recuperation de mot de passe ne doit jamais
  // etre traitee comme une connexion normale : sinon le garde ci-dessous
  // renverrait l'utilisateur vers l'accueil authentifie au lieu de l'ecran de
  // changement de mot de passe.
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false)
  const router = useRouter()
  const segments = useSegments()

  useEffect(() => {
    // Duree minimum d'affichage du splash (hors animation de sortie) : assez
    // long pour laisser l'entree du logo se terminer (520 ms) et un cycle
    // d'animation se voir, assez court pour ne pas faire attendre alors que
    // getSession() repond en general en moins d'une seconde. La verification
    // de session peut depasser cette duree si elle est plus lente.
    const splashTimer = setTimeout(() => setMinTimeDone(true), 1800)

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') setIsPasswordRecovery(true)
      if (event === 'SIGNED_OUT') setIsPasswordRecovery(false)
      setSession(session)
    })

    return () => {
      subscription.unsubscribe()
      clearTimeout(splashTimer)
    }
  }, [])

  useEffect(() => {
    if (!loading && minTimeDone && showSplash && !splashExiting) setSplashExiting(true)
  }, [loading, minTimeDone, showSplash, splashExiting])

  // Plus de mur d'authentification a l'entree : un visiteur non connecte accede
  // au catalogue et aux prix, et n'est invite a creer un compte qu'au moment ou
  // il achete (cf. lib/authGate). Seule la recuperation de mot de passe reste
  // une redirection forcee, car la session issue du lien de recuperation ne
  // doit servir qu'a changer le mot de passe.
  // Les ecrans de connexion et d'inscription decident eux-memes ou aller apres
  // succes (parametre `redirect`) : un garde global qui renverrait vers
  // /(tabs) des l'apparition de la session ecraserait ce retour.
  useEffect(() => {
    if (loading || showSplash || !currencyConfirmed) return
    if (isPasswordRecovery) {
      const current: string[] = segments
      if (current[1] !== 'reset-password') router.replace('/(auth)/reset-password')
    }
  }, [session, loading, showSplash, currencyConfirmed, segments, isPasswordRecovery])

  if (showSplash || loading) {
    return <SplashScreen exiting={splashExiting} onExited={() => setShowSplash(false)} />
  }

  if (!currencyConfirmed) {
    return (
      <CurrencyPicker
        onSelect={(c) => {
          setCurrency(c)
          setCurrencyConfirmed(true)
        }}
      />
    )
  }

  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }} />
    </>
  )
}
