import React, { useRef } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  Animated,
  Dimensions,
  Pressable,
  FlatList
} from 'react-native';

// 1. Calculamos o tamanho ideal para caberem vários animes na tela da TV
const { width } = Dimensions.get('window');
const ITEM_WIDTH = width * 0.28; 
const ITEM_HEIGHT = ITEM_WIDTH * 0.5625; 

// 2. Componente do Card Individual (com a animação de foco)
const HeroItem = ({ item }) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handleFocus = () => {
    Animated.spring(scaleAnim, {
      toValue: 1.15,
      useNativeDriver: true,
      speed: 20,
    }).start();
  };

  const handleBlur = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 20,
    }).start();
  };

  return (
    <Pressable
      onFocus={handleFocus}
      onBlur={handleBlur}
      style={styles.pressableContainer}
    >
      {({ focused }) => (
        <Animated.View
          style={[
            styles.card,
            { transform: [{ scale: scaleAnim }] },
            focused && styles.cardFocused,
          ]}
        >
          <Image source={{ uri: item.banner }} style={styles.image} />
          
          {/* Fundo escuro para destacar o texto */}
          <View style={styles.textContainer}>
            <Text style={styles.title} numberOfLines={1}>
              {item.title}
            </Text>
            {focused && item.subtitle && (
              <Text style={styles.subtitle} numberOfLines={1}>
                {item.subtitle}
              </Text>
            )}
          </View>
        </Animated.View>
      )}
    </Pressable>
  );
};

// 3. Componente da Seção Principal (O que você vai importar nas suas telas)
const HeroSection = ({ title, data }) => {
  return (
    <View style={styles.sectionContainer}>
      {/* Título da seção (ex: "Em Alta", "Continuar Assistindo") */}
      {title && <Text style={styles.sectionTitle}>{title}</Text>}
      
      <FlatList
        data={data}
        horizontal
        keyExtractor={(item, index) => item.id ? item.id.toString() : index.toString()}
        renderItem={({ item }) => <HeroItem item={item} />}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
};

// 4. Estilos unificados
const styles = StyleSheet.create({
  sectionContainer: {
    marginVertical: 20,
  },
  sectionTitle: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: 'bold',
    marginLeft: 40, // Alinha com o início do primeiro card
    marginBottom: 10,
  },
  listContent: {
    paddingHorizontal: 28, // Dá espaço nas bordas da TV para os itens não colarem na tela
    paddingVertical: 20, // Espaço para a animação de crescimento não cortar
  },
  pressableContainer: {
    width: ITEM_WIDTH,
    height: ITEM_HEIGHT,
    marginHorizontal: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#2a2a2a',
    borderWidth: 3,
    borderColor: 'transparent',
  },
  cardFocused: {
    borderColor: '#3399FF', // Uma borda branca/cinza clara fica muito bem em TVs
    elevation: 10,
  },
  image: {
    width: '100%',
    height: '100%',
    position: 'absolute',
    resizeMode: 'cover',
  },
  textContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  title: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  subtitle: {
    color: '#cccccc',
    fontSize: 12,
    marginTop: 4,
  },
});

export default HeroSection;