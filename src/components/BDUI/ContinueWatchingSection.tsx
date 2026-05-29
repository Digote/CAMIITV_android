// components/BDUI/ContinueWatchingSection.tsx
import React from 'react';
import { FlatList, StyleSheet, Text, View, Pressable, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { FlashList } from '@shopify/flash-list'; // 1. Importar FlashList
import { Image } from 'expo-image'; // 2. Importar o motor de imagem otimizado

// @ts-ignore
export default function ContinueWatchingSection({ title, data }) {
  const router = useRouter();
  
  return (
    // REMOVIDO: marginVertical: 16 daqui
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <FlatList
        horizontal
        data={data}
        keyExtractor={(item) => item.id}
        showsHorizontalScrollIndicator={false}
        
        // --- MODIFICAÇÕES AQUI ---
        // 1. removeClippedSubviews={false} impede que a lista corte o item escalado
        removeClippedSubviews={false} 
        // 2. Adicionamos paddingVertical para dar "respiro" para o zoom no topo/base
        contentContainerStyle={styles.flatListContent}
        // -------------------------

        renderItem={({ item }) => (
          <Pressable
            focusable={true}
            onPress={() => router.push(`/anime/${item.id}`)}
            style={({ focused }) => [
              styles.card,
              focused && styles.cardFocused
            ]}
          >
            {({ focused }) => (
              <View style={styles.cardInner}>
                {/* <Image source={{ uri: item.image }} style={styles.image} /> */}
                <Image 
                  source={{ uri: item.image }} 
                  style={[styles.image]} 
                  contentFit="cover"
                  transition={150} // Suaviza a aparição da imagem quando terminar o download
                  cachePolicy="disk" // Força salvar as capas dos animes no armazenamento da TV
                />
                <View style={styles.infoContainer}>
                  <Text style={[styles.title, focused && styles.textFocused]} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Text style={styles.episodeText}>{item.episode}</Text>
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
  // Container principal agora sem margem vertical
  container: { /* marginVertical: 16 removido daqui */ },
  sectionTitle: { fontSize: 14, marginLeft: 16, marginBottom: 12, color: '#888', fontWeight: 'bold' },
  
  // Novo estilo para o conteúdo da FlatList
  flatListContent: {
    paddingHorizontal: 16,
    // Adicionamos espaço extra em cima e embaixo para o zoom. 
    // Como o marginVertical original era 16, usar paddingVertical: 16 mantém o layout consistente.
    paddingVertical: 16, 
  },

  card: {
    width: Platform.OS === 'android' && Platform.isTV ? 280 : 240,
    marginRight: 16,
    borderRadius: 8,
    backgroundColor: '#1A1A1A',
    // overflow: 'hidden', <-- Mantenha isso comentado/removido como na resposta anterior
  },
  cardFocused: {
    borderColor: '#3399FF', 
    borderWidth: 2,
    transform: [{ scale: 1.02 }],
    // Dependendo de como o Android TV renderiza, às vezes ajuda 
    // adicionar uma elevação zIndex no item focado para ele ficar "por cima" dos outros
    zIndex: 1, 
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
});