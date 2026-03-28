// components/BDUI/ContinueWatchingSection.tsx
import React from 'react';
import { FlatList, StyleSheet, Text, View, Pressable, Image, Platform } from 'react-native';
import { useRouter } from 'expo-router';

export default function ContinueWatchingSection({ title, data }) {
  const router = useRouter();
  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <FlatList
        horizontal
        data={data}
        keyExtractor={(item) => item.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16 }}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push(`/anime/${item.id}`)}
            style={({ focused }) => [
              styles.card,
              focused && styles.cardFocused
            ]}
          >
            {({ focused }) => (
              <View style={styles.cardInner}>
                <Image source={{ uri: item.image }} style={styles.image} />
                <View style={styles.infoContainer}>
                  <Text style={[styles.title, focused && styles.textFocused]} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Text style={styles.episodeText}>{item.episode}</Text>
                  {/* Barra de Progresso */}
                  {/* <View style={styles.progressBarBackground}>
                    <View style={[styles.progressBarFill, { width: `${item.progress * 100}%` }]} />
                  </View> */}
                </View>
              </View>
            )}
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginVertical: 16 },
  sectionTitle: { fontSize: 14, marginLeft: 16, marginBottom: 12, color: '#888', fontWeight: 'bold' },
  card: {
    width: Platform.OS === 'android' && Platform.isTV ? 280 : 240,
    marginRight: 16,
    borderRadius: 8,
    backgroundColor: '#1A1A1A',
    overflow: 'hidden',
  },
  cardFocused: {
    borderColor: '#3399FF', // Azul do botão focado no print
    borderWidth: 2,
    transform: [{ scale: 1.02 }],
  },
  cardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
  },
  image: {
    width: 100,
    height: 56,
    borderRadius: 4,
  },
  infoContainer: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  title: { color: '#FFF', fontSize: 14, fontWeight: 'bold' },
  textFocused: { color: '#FFF' },
  episodeText: { color: '#AAA', fontSize: 12, marginTop: 2 },
  progressBarBackground: {
    height: 4,
    backgroundColor: '#333',
    borderRadius: 2,
    marginTop: 8,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#3399FF', // Azul da barra de progresso
    borderRadius: 2,
  }
});