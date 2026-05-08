import { Tabs } from 'expo-router'
import { Text, StyleSheet } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { COLORS } from '../../constants/theme'

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: COLORS.violet,
        tabBarInactiveTintColor: '#C8C7CC',
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Accueil',
          tabBarIcon: ({ focused }) => (
            <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.3 }}>home</Text>
          ),
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: 'eSIM',
          tabBarIcon: () => (
            <LinearGradient
              colors={['#D251D8', '#FD7F3C']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.pill}
            >
              <Text style={styles.pillText}>eSIM</Text>
            </LinearGradient>
          ),
          tabBarLabel: () => null,
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: 'Compte',
          tabBarIcon: ({ focused }) => (
            <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.3 }}>user</Text>
          ),
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
  pill: {
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 8,
  },
  pillText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
  },
})
