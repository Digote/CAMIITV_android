// components/BDUI/LandscapeSection.tsx
import React from 'react';
import { StyleSheet, Text, View, Pressable, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { FlashList } from '@shopify/flash-list'; // Motor de lista de alta performance
import { Image } from 'expo-image'; 

export default function LandscapeSection({ title, data }:any) {
  const router = useRouter();
  
  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>{title}</Text>
      
      {/* 1. Trocamos FlatList por FlashList */}
      <FlashList
        horizontal
        data={data}
        keyExtractor={(item:any) => item.id.toString()}
        showsHorizontalScrollIndicator={false}
        
        // 2. Tamanho estimado do card na TV (Largura 260 + Margem 16 = 276)
        // Isso é OBRIGATÓRIO no FlashList e estabiliza o foco horizontal
        // estimatedItemSize={276} 
        
        // 3. Renderiza vários cards fora da tela para o foco nunca "cair no buraco"
        drawDistance={1500} 
        
        contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 16 }}

        renderItem={({ item }) => (
          <Pressable
            focusable={true} 
            onPress={() => router.push(`/anime/${item.id}`)}
            style={({ focused, pressed }) => [
              styles.cardContainer,
              (focused || pressed) && styles.cardFocused // Adicionado pressed para cliques no celular
            ]}
          >
            {({ focused, pressed }) => (
              <View>
                <Image 
                  source={{ uri: item.image }} 
                  style={[styles.image, (focused || pressed) && styles.imageFocused]} 
                  contentFit="cover"
                  transition={0} // Zera a transição (fade) para evitar o "piscar" ao rolar rápido
                  cachePolicy="disk" 
                />
                <Text 
                  style={[styles.animeTitle, (focused || pressed) && styles.titleFocused]}
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
  container: { }, 
  sectionTitle: { 
    fontSize: 14, 
    marginLeft: 16, 
    marginBottom: 12, 
    color: '#888', 
    fontWeight: 'bold' 
  },
  cardContainer: {
    // Mantemos a largura fixa para a TV
    width: Platform.OS === 'android' && Platform.isTV ? 260 : 200,
    marginRight: 16,
    borderRadius: 8,
  },
  cardFocused: {
    transform: [{ scale: 1.05 }], 
    zIndex: 1, 
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