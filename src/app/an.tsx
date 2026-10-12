import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Header from '../components/Header';
import SideMenuLayout, { MenuItem } from '../components/SideMenuLayout';
import { useTheme } from '../theme/ThemeContext';
import { useRouter } from 'expo-router';
import api from '@/services/api';

interface AnimeItem {
  id: string;
  title: string;
  thumbnail: string;
  link: string;
  episodio_nome: string;
  date: string;
}

// Função para formatar data ISO (2026-01-17T18:46:29.000000Z) para BR (17/01/2026)
function formatDateBR(isoString: string) {
  if (!isoString) return '';

  const [datePart] = isoString.split('T');
  if (!datePart) return '';

  const [year, month, day] = datePart.split('-');
  return `${day}/${month}/${year}`;
}

// Componente do Card de Anime unificado
function AnimeCard_AN({ anime }: { anime: AnimeItem }) {
  const router = useRouter();

  return (
    <Pressable
      onPress={() => router.push(`/an_anime/${anime.id}` as any)}
      style={({ focused, pressed }) => [
        styles.card,
        (focused || pressed) && styles.cardFocused,
      ]}
      android_ripple={{ color: 'rgba(255, 255, 255, 0.22)' }}
      focusable={true}
    >
      {({ focused }) => (
        <>
          <Image
            source={{ uri: anime.thumbnail }}
            style={[styles.image, focused && styles.imageFocused]}
          />
          <Text
            style={[styles.cardTitle, focused && styles.cardTitleFocused]}
            numberOfLines={3}
          >
            {anime.title}
          </Text>
          <Text
            style={[styles.cardTitle, focused && styles.cardTitleFocused]}
            numberOfLines={1}
          >
            {formatDateBR(anime.date)}
          </Text>
        </>
      )}
    </Pressable>
  );
}

export default function Home() {
  const [animes, setAnimes] = useState<AnimeItem[]>([]);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchAnimes = async (pageNumber: number) => {
    // Evita requisições extras se já chegou na última página
    if (pageNumber > 1 && pageNumber > lastPage) return;

    if (pageNumber === 1) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }

    try {
      const response = await api.get(
        `/an/animes?page=${pageNumber}`
      );

      const data = response.data.data;
      const totalPages = response.data.last_page;

      const mapped: AnimeItem[] = Array.isArray(data)
        ? data.map((item: any) => ({
            id: String(item.id),
            title: item.nome,
            thumbnail: item.img,
            link: item.episodio_link,
            episodio_nome: item.episodio_nome,
            date: item.created_at,
          }))
        : [];

      // Concatena as novas páginas no estado existente
      setAnimes((prev) => (pageNumber === 1 ? mapped : [...prev, ...mapped]));
      setLastPage(totalPages);
    } catch (error) {
      console.error('Erro ao buscar animes:', error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    fetchAnimes(1);
  }, []);

  const handleLoadMore = () => {
    if (!loadingMore && page < lastPage) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchAnimes(nextPage);
    }
  };

  const menuItems: MenuItem[] = [
    { icon: 'home', label: 'Início', route: '/' },
    { icon: 'home', label: 'Temporadas', route: '/seasons' },
    { icon: 'home', label: 'AN', route: '/an' },
    { icon: 'user', label: 'Perfil', route: '/perfil' },
  ];

  const { theme } = useTheme();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#000001', flexDirection: 'row' }}>
      <SideMenuLayout menuItems={menuItems}>
        <Header />

        <FlatList
          numColumns={5}
          data={animes}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <AnimeCard_AN anime={item} />}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
          ListHeaderComponent={
            <Text style={[styles.headerTitle, { color: '#FFF', fontFamily: theme.fonts.heading }]}>
              Lançamentos
            </Text>
          }
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.4}
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.footerLoader}>
                <ActivityIndicator size="large" color="#FFF" />
              </View>
            ) : null
          }
        />
      </SideMenuLayout>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  headerTitle: {
    fontSize: 18,
    marginLeft: 16,
    fontWeight: 'bold',
    marginVertical: 16,
  },
  footerLoader: {
    marginVertical: 20,
    alignItems: 'center',
  },
  card: {
    width: Platform.OS === 'android' && Platform.isTV ? 160 : 160,
    marginRight: Platform.OS === 'android' && Platform.isTV ? 12 : 8,
    borderRadius: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    padding: 4,
  },
  cardFocused: {
    borderColor: '#FFF',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    transform: [{ scale: 1.01 }],
  },
  image: {
    width: '100%',
    height: Platform.OS === 'android' && Platform.isTV ? 260 : 260,
    borderRadius: 0,
  },
  imageFocused: {
    borderColor: '#FFF',
  },
  cardTitle: {
    marginTop: 8,
    fontWeight: 'bold',
    fontSize: Platform.OS === 'android' && Platform.isTV ? 12 : 12,
    color: '#FFF',
    textAlign: 'center',
  },
  cardTitleFocused: {
    color: '#FFF',
    fontWeight: 'bold',
  },
});