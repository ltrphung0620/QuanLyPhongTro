import { Tabs } from 'expo-router';
import { Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function TenantTabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: '#fffaf7' },
        headerTintColor: '#241d1b',
        tabBarActiveTintColor: '#7f5f55',
        tabBarInactiveTintColor: '#9b8d87',
        tabBarStyle: {
          height: Platform.OS === 'ios' ? 84 : 64,
          paddingBottom: Platform.OS === 'ios' ? 24 : 10,
          paddingTop: 8,
          backgroundColor: '#fffaf7',
          borderTopColor: '#eadfd9',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Hóa đơn',
          tabBarIcon: ({ color, size }) => <Ionicons name="receipt-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="meter-readings"
        options={{
          title: 'Chỉ số',
          tabBarIcon: ({ color, size }) => <Ionicons name="speedometer-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: 'Tài khoản',
          tabBarIcon: ({ color, size }) => <Ionicons name="person-circle-outline" color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
