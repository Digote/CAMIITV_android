// app/(drawer)/index.tsx
import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useState } from 'react';

import SideMenuLayout, { MenuItem } from '../components/SideMenuLayout';

export default function HomeScreen() {
  const router = useRouter();
  const [selected, setSelected] = useState(0);

  const menuItems: MenuItem[] = [
    { icon: 'home', label: 'Início', route: '/' },
    { icon: 'home', label: 'AN', route: '/an' },
    { icon: 'user', label: 'Perfil', route: '/perfil' },
  ];

  return (

    <SideMenuLayout menuItems={menuItems}>
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: 'white' }}>Conteúdo principal aqui</Text>
      </View>
    </SideMenuLayout>

  );
}
