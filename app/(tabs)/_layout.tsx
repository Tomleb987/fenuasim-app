import { Tabs } from 'expo-router'
import { View, Text, StyleSheet } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { COLORS } from '../../constants/theme'

function TabIcon({ name, focused }: { name: string; focused: boolean }) {
  const icons: Record<string, string> = {
    index: '⌂',
    explore: '◉',
    account: '👤',
  }
  return (
    <View style={{ alignItems: 'center' }}>
      <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.3 }}>{icons[name]}</Text>
      {focused && (
        <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: COLORS.violet, marginTop: 2 }} />
      )}
    </View>
  )
}

function EsimTabButton({ focused }: { focused: boolean }) {
  return (
    <LinearGradient
      colors={['#D251D8', '#FD7F3C']}
      start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
      style={styles.esimBtn}
    >
      <Text style={styles.esimBtnText}>eSIM</Text>
    </LinearGradient>
  )
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarShowLabel: true,
        tabBarActiveTintColor: COLORS.violet,
        tabBarInactiveTintColor: '#C8C7CC',
        tabBarLabelStyle: styles.label,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Accueil',
          tabBarIcon: ({ focused }) => <TabIcon name="index" focused={focused} />,
          tabBarShowLabel: false,
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Explorer',
          tabBarIcon: ({ focused }) => <EsimTabButton focused={focused} />,
          tabBarShowLabel: false,
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: 'Compte',
          tabBarIcon: ({ focused }) => <TabIcon name="account" focused={focused} />,
          tabBarShowLabel: false,
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
    height: 70,
    paddingBottom: 14,
    paddingTop: 8,
  },
  label: {
    fontSize: 10,
    fontWeight: '600',
  },
  esimBtn: {
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 9,
    marginBottom: 2,
  },
  esimBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
  },
})
