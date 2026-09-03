import { useRef } from 'react'
import { Tabs } from 'expo-router'
import { View, Text, StyleSheet, Pressable, Animated, GestureResponderEvent } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../../constants/theme'

type IoniconName = React.ComponentProps<typeof Ionicons>['name']

function TabIcon({ focused, name, activeName }: { focused: boolean; name: IoniconName; activeName: IoniconName }) {
  return (
    <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
      <Ionicons name={focused ? activeName : name} size={25} color={focused ? COLORS.violet : COLORS.textMuted} />
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
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: COLORS.violet,
        tabBarInactiveTintColor: COLORS.textMuted,
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
          tabBarLabel: () => null,
          tabBarIcon: ({ focused }) =>
            focused ? (
              <LinearGradient
                colors={['#D251D8', '#FD7F3C']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.pill}
              >
                <Ionicons name="search" size={14} color="#fff" style={{ marginRight: 5 }} />
                <Text style={styles.pillText}>eSIM</Text>
              </LinearGradient>
            ) : (
              <View style={styles.pillInactive}>
                <Ionicons name="search-outline" size={14} color={COLORS.textMuted} style={{ marginRight: 5 }} />
                <Text style={styles.pillTextInactive}>eSIM</Text>
              </View>
            ),
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
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 9,
    marginBottom: 4,
  },
  pillInactive: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 9,
    marginBottom: 4,
    borderWidth: 1.5,
    borderColor: '#EDEDED',
  },
  pillText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
  },
  pillTextInactive: {
    color: COLORS.textMuted,
    fontSize: 13,
    fontWeight: '800',
  },
})
