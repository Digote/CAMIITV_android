import React from 'react';
import { FlatList, StyleSheet, Text, View, Pressable, ImageBackground, Platform } from 'react-native';
import { useRouter } from 'expo-router';

export default function HeroSection({ data }) {
  const router = useRouter();
  return (
    <View style={styles.container}>
      <FlatList
        horizontal
        data={data}
        keyExtractor={(item) => item.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 20 }}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push(`/anime/${item.id}`)}
            style={({ focused }) => [
              styles.cardContainer,
              focused && styles.cardFocused
            ]}
          >
            {({ focused }) => (
              <ImageBackground 
                source={{ uri: item.image }} 
                style={styles.imageBackground}
                imageStyle={{ borderRadius: 8 }}
              >
                {/* Uma camada escura por cima da imagem para o texto destacar */}
                <View style={styles.overlay}>
                  <Text style={[styles.title, focused && styles.textFocused]}>
                    {item.title}
                  </Text>
                  {/* {item.subtitle && (
                    <Text style={styles.subtitle}>{item.subtitle}</Text>
                  )} */}
                </View>
              </ImageBackground>
            )}
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: 24, marginBottom: 16 },
  cardContainer: {
    width: Platform.OS === 'android' && Platform.isTV ? 540 : 320,
    height: Platform.OS === 'android' && Platform.isTV ? 260 : 180,
    marginRight: 20,
    borderRadius: 10,
    backgroundColor: '#1A1A1A',
  },
  cardFocused: {
    borderColor: '#3399FF', // Azul vibrante do print
    borderWidth: 3,
    transform: [{ scale: 1.03 }],
    elevation: 10,
  },
  imageBackground: {
    width: '100%',
    height: '100%',
    justifyContent: 'flex-end',
  },
  overlay: {
    padding: 16,
    backgroundColor: 'rgba(0,0,0,0.6)', // Gradiente/Fundo escuro
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
  },
  title: {
    color: '#E0E0E0',
    fontSize: 18,
    fontWeight: 'bold',
  },
  textFocused: {
    color: '#FFF',
  },
  subtitle: {
    color: '#AAA',
    fontSize: 14,
    marginTop: 4,
  }
});