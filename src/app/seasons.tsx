import api from '@/services/api';
import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, Image, Pressable, Platform } from 'react-native';

// Dados simulados para o exemplo
const SEASONS = [
  { id: '1', name: 'Outono 2026' },
  { id: '2', name: 'Inverno 2026' },
  { id: '3', name: 'Primavera 2026' },
  { id: '4', name: 'Verão 2026' },
];

const ANIMES = [
  { id: '101', title: 'Jujutsu Kaisen', seasonId: '1', cover: 'https://myanimelist.net/images/anime/1015/151233l.jpg' },
  { id: '102', title: 'Frieren', seasonId: '1', cover: 'https://myanimelist.net/images/anime/1015/151233l.jpg' },
  { id: '103', title: 'Solo Leveling', seasonId: '2', cover: 'https://myanimelist.net/images/anime/1015/151233l.jpg' },
  { id: '104', title: 'Mashle', seasonId: '2', cover: 'https://myanimelist.net/images/anime/1015/151233l.jpg' },
  { id: '105', title: 'Kaiju No. 8', seasonId: '3', cover: 'https://myanimelist.net/images/anime/1015/151233l.jpg' },
  // Adicione mais itens com os IDs correspondentes para preencher o grid
];



export default function SeasonsScreen() {


   useEffect(() => {
    // Fazemos uma única chamada para a rota do Laravel que montamos
    api.get("/temporadas/lista")
      .then((response) => {
        // O Laravel já manda o array prontinho na ordem certa
        // console.log(response.data)
        // console.log("#####rr")
        // setLayout(response.data);
        // setLoading(false);
      })
      .catch((error) => {
        console.error('Erro ao buscar o layout da home:', error);
        // setLoading(false);
      });
  }, []);





  const [selectedSeason, setSelectedSeason] = useState(SEASONS[0].id);

  // Filtra os animes com base na temporada selecionada
  const filteredAnimes = ANIMES.filter(anime => anime.seasonId === selectedSeason);

  // Renderiza as "abas" de seleção de temporada
  const renderSeasonTab = ({ item }:any) => (
    <Pressable
      onPress={() => setSelectedSeason(item.id)}
      style={({ focused }) => [
        styles.seasonTab,
        selectedSeason === item.id && styles.seasonTabActive,
        focused && styles.focusedElement // Destaque ao passar o D-Pad
      ]}
    >
      <Text style={[
        styles.seasonText,
        selectedSeason === item.id && styles.seasonTextActive
      ]}>
        {item.name}
      </Text>
    </Pressable>
  );

  // Renderiza o card do anime no grid
  const renderAnimeCard = ({ item }:any) => (
    <Pressable
      onPress={() => console.log('Navegar para os detalhes do anime: ', item.id)}
      style={({ focused }) => [
        styles.animeCard,
        focused && styles.focusedElement // Efeito visual de foco para TV
      ]}
    >
      <Image source={{ uri: item.cover }} style={styles.coverImage} />
      <Text style={styles.animeTitle} numberOfLines={2}>{item.title}</Text>
    </Pressable>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.screenTitle}>Temporadas</Text>

      {/* Seletor de Temporadas (Lista Horizontal) */}
      <View style={styles.header}>
        <FlatList
          horizontal
          data={SEASONS}
          keyExtractor={item => item.id}
          renderItem={renderSeasonTab}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.seasonsList}
        />
      </View>

      {/* Grid de Animes (Lista Vertical com N colunas) */}
      <FlatList
        key={`grid-${selectedSeason}`} // Força a re-renderização suave ao trocar de temporada
        data={filteredAnimes}
        keyExtractor={item => item.id}
        numColumns={5} // Ajuste para 4, 5 ou 6 dependendo da resolução alvo da TV
        renderItem={renderAnimeCard}
        contentContainerStyle={styles.grid}
        columnWrapperStyle={styles.gridRow} // Espaçamento entre colunas
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F0F0F', // Fundo escuro clássico de apps de mídia
    padding: 20,
  },
  screenTitle: {
    color: '#FFF',
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 20,
    marginLeft: 10,
  },
  header: {
    marginBottom: 30,
  },
  seasonsList: {
    paddingLeft: 10,
    gap: 15, // Espaçamento nativo do Flexbox
  },
  seasonTab: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: '#222',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: 'transparent',
    marginRight: 10, // Fallback se gap não for suportado em versões antigas
  },
  seasonTabActive: {
    backgroundColor: '#E50914', // Vermelho destaque
  },
  seasonText: {
    color: '#AAA',
    fontSize: 16,
    fontWeight: '600',
  },
  seasonTextActive: {
    color: '#FFF',
  },
  grid: {
    paddingBottom: 50,
  },
  gridRow: {
    justifyContent: 'flex-start',
    gap: 20, // Espaço entre os cards na mesma linha
    marginBottom: 20,
  },
  animeCard: {
    width: 180, // Largura fixa ajuda na consistência do grid na TV
    borderRadius: 8,
    borderWidth: 3,
    borderColor: 'transparent',
    overflow: 'hidden',
    backgroundColor: '#1A1A1A',
  },
  coverImage: {
    width: '100%',
    height: 270,
    resizeMode: 'cover',
  },
  animeTitle: {
    color: '#FFF',
    fontSize: 14,
    padding: 10,
    textAlign: 'center',
  },
  focusedElement: {
    // A mágica da TV acontece aqui
    borderColor: '#FFF',
    transform: [{ scale: 1.05 }], // Leve zoom quando o usuário foca com o controle
    elevation: 10, 
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 5,
  },
});