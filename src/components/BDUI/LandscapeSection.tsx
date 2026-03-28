import React from 'react';
import { FlatList, StyleSheet, Text, View, Pressable, Image, Platform } from 'react-native';
import { useRouter } from 'expo-router';

export default function LandscapeSection({ title, data }) {
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
              styles.cardContainer,
              focused && styles.cardFocused
            ]}
          >
            {({ focused }) => (
              <View>
                <Image 
                  source={{ uri: item.image }} 
                  style={[styles.image, focused && styles.imageFocused]} 
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
  container: { marginVertical: 16 },
  sectionTitle: { 
    fontSize: 14, 
    marginLeft: 16, 
    marginBottom: 12, 
    color: '#888', 
    fontWeight: 'bold' 
  },
  cardContainer: {
    // A largura define o tamanho do card todo. A altura vai se ajustar para caber imagem + texto.
    width: Platform.OS === 'android' && Platform.isTV ? 260 : 200,
    marginRight: 16,
    borderRadius: 8,
  },
  cardFocused: {
    transform: [{ scale: 1.05 }],
    // Removemos a elevação daqui para focar o destaque visual na borda da imagem e na cor do texto
  },
  image: {
    width: '100%',
    height: Platform.OS === 'android' && Platform.isTV ? 146 : 112, // Proporção 16:9 mantida
    borderRadius: 8,
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: '#1A1A1A', // Fundo de placeholder
  },
  imageFocused: {
    borderColor: '#3399FF', // Borda azul apenas na imagem ao focar
  },
  animeTitle: {
    marginTop: 8,
    fontSize: 14,
    color: '#AAA',
    fontWeight: '500',
    textAlign: 'center',
  },
  titleFocused: {
    color: '#FFF', // O texto fica branco (acende) quando o card está focado
    fontWeight: 'bold',
  }
});