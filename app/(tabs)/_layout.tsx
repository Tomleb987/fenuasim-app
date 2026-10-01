import { useRef } from 'react'
import { Tabs } from 'expo-router'
import { View, StyleSheet, Pressable, Animated, GestureResponderEvent } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../../constants/theme'

type IoniconName = React.ComponentProps<typeof Ionicons>['name']

// Trait violet partout dans la navbar (actif comme inactif), juste plus
// estompe au repos -- au lieu d'un gris neutre qui tranchait avec le reste
// de la charte.
const INACTIVE_VIOLET = 'rgba(210,81,216,0.55)'

function TabIcon({ focused, name, activeName }: { focused: boolean; name: IoniconName; activeName: IoniconName }) {
  return (
    <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
      <Ionicons name={focused ? activeName : name} size={25} color={focused ? COLORS.violet : INACTIVE_VIOLET} />
    </View>
  )
}

function BouncyTabButton(props: any) {
  const scale = useRef(new Animated.Value(1)).current

  const onPressIn = (e: GestureResponderEvent) => {
    Animated.spring(scale, { toValue: 0.86, useNativeDriver: true, speed: 50, bounciness: 6 }).start()
    props.onPressIn?.(e)
  }
  const onPressOut = (e: GestureResponderEvent) => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 9 }).start()
    props.onPressOut?.(e)
  }

  return (
    <Pressable {...props} onPressIn={onPressIn} onPressOut={onPressOut}>
      <Animated.View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', transform: [{ scale }] }}>
        {props.children}
      </Animated.View>
    </Pressable>
  )
}

export default function TabsLayout() {
  // Android SDK 35+ impose l'affichage edge-to-edge : la navbar systeme (geste
  // ou 3 boutons) se superpose au contenu. Une hauteur de barre fixe laisserait
  // donc les libelles et les icones sous la barre systeme. On ajoute l'inset
  // reel plutot qu'une valeur devinee.
  const insets = useSafeAreaInsets()

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: [
          styles.tabBar,
          { height: styles.tabBar.height + insets.bottom, paddingBottom: styles.tabBar.paddingBottom + insets.bottom },
        ],
        tabBarActiveTintColor: COLORS.violet,
        tabBarInactiveTintColor: INACTIVE_VIOLET,
        tabBarLabelStyle: styles.tabLabel,
        tabBarButton: (props) => <BouncyTabButton {...props} />,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Accueil',
          tabBarIcon: ({ focused }) => <TabIcon focused={focused} name="home-outline" activeName="home" />,
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: 'eSIM',
          tabBarIcon: ({ focused }) => <TabIcon focused={focused} name="cellular-outline" activeName="cellular" />,
        }}
      />
      <Tabs.Screen
        name="insurance"
        options={{
          title: 'Assurance',
          tabBarIcon: ({ focused }) => <TabIcon focused={focused} name="shield-outline" activeName="shield" />,
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: 'Compte',
          tabBarIcon: ({ focused }) => <TabIcon focused={focused} name="person-outline" activeName="person" />,
        }}
      />
    </Tabs>
  )
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: '#fff',
    borderTopColor: '#F0F0F0',
    borderTopWidth: 1,
    height: 80,
    paddingBottom: 16,
    paddingTop: 8,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -4 },
    elevation: 8,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: 3,
  },
  iconWrap: {
    width: 48,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconWrapActive: {
    backgroundColor: 'rgba(210,81,216,0.16)',
  },
})
