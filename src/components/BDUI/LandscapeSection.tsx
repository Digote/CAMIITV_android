// components/BDUI/LandscapeSection.tsx
import React from 'react';
import { FlatList, StyleSheet, Text, View, Pressable, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { FlashList } from '@shopify/flash-list'; // 1. Importar FlashList
import { Image } from 'expo-image'; // 2. Importar o motor de imagem otimizado

export default function LandscapeSection({ title, data }:any) {
  const router = useRouter();
  
  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <FlatList
        horizontal
        data={data}
        keyExtractor={(item) => item.id}
        showsHorizontalScrollIndicator={false}
        
        // --- MODIFICAÇÕES AQUI ---
        // 1. Desativa o corte agressivo da lista
        removeClippedSubviews={false} 
        // 2. Trocamos o marginVertical do container por paddingVertical aqui dentro
        contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 16 }}
        // -------------------------

        renderItem={({ item }) => (
          <Pressable
            focusable={true} // <-- ADICIONADO: Importante para o controle da TV reconhecer
            onPress={() => router.push(`/anime/${item.id}`)}
            style={({ focused }) => [
              styles.cardContainer,
              focused && styles.cardFocused
            ]}
          >
            {({ focused }) => (
              <View>
                {/* <Image 
                  source={{ uri: item.image }} 
                  style={[styles.image, focused && styles.imageFocused]} 
                /> */}
                <Image 
                  source={{ uri: item.image }} 
                   style={[styles.image, focused && styles.imageFocused]} 
                  contentFit="cover"
                  transition={150} // Suaviza a aparição da imagem quando terminar o download
                  cachePolicy="disk" // Força salvar as capas dos animes no armazenamento da TV
                />
                <Text 
                  style={[styles.animeTitle, focused && styles.titleFocused]}
                  numberOfLines={1}
                >
                  {item.title}
                </Text>
              </View>
            )}
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  // REMOVIDO: marginVertical: 16 (passou a ser paddingVertical na FlatList)
  container: { }, 
  sectionTitle: { 
    fontSize: 14, 
    marginLeft: 16, 
    marginBottom: 12, 
    color: '#888', 
    fontWeight: 'bold' 
  },
  cardContainer: {
    width: Platform.OS === 'android' && Platform.isTV ? 260 : 200,
    marginRight: 16,
    borderRadius: 8,
  },
  cardFocused: {
    transform: [{ scale: 1.05 }], // Como o scale aqui é maior (1.05), o padding é ainda mais essencial
    zIndex: 1, // <-- ADICIONADO: Garante que o card ampliado não fique por baixo dos itens vizinhos
  },
  image: {
    width: '100%',
    height: Platform.OS === 'android' && Platform.isTV ? 146 : 112,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: '#1A1A1A',
  },
  imageFocused: {
    borderColor: '#3399FF',
  },
  animeTitle: {
    marginTop: 8,
    fontSize: 14,
    color: '#AAA',
    fontWeight: '500',
    textAlign: 'center',
  },
  titleFocused: {
    color: '#FFF',
    fontWeight: 'bold',
  }
});