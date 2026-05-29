import React from 'react';
import { FlatList, StyleSheet, Text, View, Pressable, Platform } from 'react-native';
import { FlashList } from '@shopify/flash-list'; // 1. Importar FlashList
import { Image } from 'expo-image'; // 2. Importar o motor de imagem otimizado

export default function GenreSection({ title, data }:any) {
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
            style={({ focused }) => [
              styles.card,
              { backgroundColor: item.color || '#333' }, // Cor vinda do backend
              focused && styles.cardFocused
            ]}
          >
            {({ focused }) => (
              <View style={styles.cardInner}>
                <Text style={[styles.genreText, focused && styles.textFocused]}>
                  {item.title}
                </Text>
                {/* Aqui você pode colocar ícones ou pequenas imagens no futuro */}
                <View style={styles.placeholderGrid}>
                  <View style={styles.gridItem} />
                  <View style={styles.gridItem} />
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
    width: Platform.OS === 'android' && Platform.isTV ? 220 : 160,
    height: 80,
    marginRight: 16,
    borderRadius: 8,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  cardFocused: {
    borderColor: '#3399FF', // Quando focado, sobrepõe a cor com a borda azul
    borderWidth: 3,
    backgroundColor: '#3399FF', // O print mostra o item focado todo azul
    transform: [{ scale: 1.05 }],
  },
  cardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: '100%',
  },
  genreText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  textFocused: {
    color: '#FFF',
  },
  placeholderGrid: {
    width: 40,
    height: 40,
    flexWrap: 'wrap',
    flexDirection: 'row',
    gap: 4,
    opacity: 0.8,
  },
  gridItem: {
    width: 18,
    height: 18,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 2,
  }
});