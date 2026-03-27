import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface Props {
  current: string;
}

const items = ['Home', 'Explorar', 'Favoritos', 'Perfil'];

export default function SideMenu({ current }: Props) {
  const router = useRouter();

  return (
    <View style={styles.container}>
      {items.map((item) => (
        <TouchableOpacity
          key={item}
          onPress={() => router.push(`/${item.toLowerCase()}`)}
          style={[styles.item, current === item && styles.active]}
        >
          <Text style={styles.text}>{item}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: 200, backgroundColor: '#000001', paddingTop: 40 },
  item: { padding: 16 },
  active: { backgroundColor: '#2A1F5A' },
  text: { fontSize: 18, color: '#FFF' },
});