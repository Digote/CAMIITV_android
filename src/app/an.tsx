import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
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

// Componente do Card de Anime modernizado para TV
function AnimeCard_AN({ anime }: { anime: AnimeItem }) {
  const router = useRouter();
  const formattedDate = formatDateBR(anime.date);

  return (
    <Pressable
      onPress={() => router.push(`/an_anime/${anime.id}` as any)}
      style={({ focused, pressed }) => [
        styles.card,
        (focused || pressed) && styles.cardFocused,
      ]}
      android_ripple={{ color: 'rgba(51, 153, 255, 0.25)' }}
      focusable={true}
    >
      {({ focused, pressed }) => {
        const isActive = focused || pressed;
        return (
          <View style={styles.cardInner}>
            <View style={[styles.posterWrapper, isActive && styles.posterWrapperFocused]}>
              <Image
                source={{ uri: anime.thumbnail }}
                style={styles.image}
                contentFit="cover"
                transition={150}
                cachePolicy="disk"
              />

              <LinearGradient
                colors={['transparent', 'rgba(11, 11, 12, 0.4)', 'rgba(11, 11, 12, 0.95)']}
                style={styles.posterGradient}
              />

              {/* Badge de data no topo direito */}
              {!!formattedDate && (
                <View style={[styles.dateBadge, isActive && styles.dateBadgeFocused]}>
                  <Ionicons name="calendar-outline" size={10} color="#FFF" />
                  <Text style={styles.dateBadgeText}>{formattedDate}</Text>
                </View>
              )}

              {/* Indicador de Play ao focar com o controle da TV */}
              {isActive && (
                <View style={styles.playOverlay}>
                  <View style={styles.playButtonCircle}>
                    <Ionicons name="play" size={22} color="#FFF" style={{ marginLeft: 2 }} />
                  </View>
                </View>
              )}

              {/* Episódio ou tag na base do poster */}
              {!!anime.episodio_nome && (
                <View style={styles.episodeChip}>
                  <Text style={styles.episodeChipText} numberOfLines={1}>
                    {anime.episodio_nome}
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.infoContainer}>
              <Text
                style={[styles.cardTitle, isActive && styles.cardTitleFocused]}
                numberOfLines={2}
              >
                {anime.title}
              </Text>
            </View>
          </View>
        );
      }}
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
    if (pageNumber > 1 && pageNumber > lastPage) return;

    if (pageNumber === 1) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }

    try {
      const response = await api.get(`/an/animes?page=${pageNumber}`);

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
    { icon: 'home', label: 'BR', route: '/br' },
    { icon: 'magnet', label: 'NYAA', route: '/nyaa' },
    { icon: 'user', label: 'Perfil', route: '/perfil' },
  ];

  const { theme } = useTheme();

  return (
    <SafeAreaView style={styles.screen}>
      <SideMenuLayout menuItems={menuItems}>
        <Header />

        {loading ? (
          <View style={styles.centerLoader}>
            <ActivityIndicator size="large" color="#3399FF" />
            <Text style={styles.loaderText}>Carregando catálogo AN...</Text>
          </View>
        ) : (
          <FlatList
            numColumns={5}
            data={animes}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => <AnimeCard_AN anime={item} />}
            contentContainerStyle={styles.listContent}
            columnWrapperStyle={styles.columnWrapper}
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={
              <View style={styles.headerBanner}>
                <View style={styles.headerTitleRow}>
                  <View style={styles.accentBar} />
                  <View>
                    <Text
                      style={[
                        styles.headerTitle,
                        { fontFamily: theme.fonts.heading },
                      ]}
                    >
                      Catálogo AN • Lançamentos
                    </Text>
                    <Text style={styles.headerSubtitle}>
                      Explore os últimos animes adicionados ({animes.length} títulos carregados)
                    </Text>
                  </View>
                </View>

                <View style={styles.liveBadge}>
                  <View style={styles.liveDot} />
                  <Text style={styles.liveBadgeText}>ATUALIZADO</Text>
                </View>
              </View>
            }
            onEndReached={handleLoadMore}
            onEndReachedThreshold={0.4}
            ListFooterComponent={
              loadingMore ? (
                <View style={styles.footerLoader}>
                  <ActivityIndicator size="large" color="#3399FF" />
                  <Text style={styles.footerLoaderText}>Carregando mais animes...</Text>
                </View>
              ) : null
            }
          />
        )}
      </SideMenuLayout>
    </SafeAreaView>
  );
}

const isTV = Platform.OS === 'android' && Platform.isTV;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#0B0B0C',
    flexDirection: 'row',
  },
  centerLoader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loaderText: {
    color: '#9CA3AF',
    marginTop: 12,
    fontSize: 14,
    fontWeight: '500',
  },
  listContent: {
    paddingHorizontal: 14,
    paddingBottom: 48,
  },
  columnWrapper: {
    gap: 10,
    marginBottom: 18,
  },
  headerBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    marginBottom: 22,
    paddingVertical: 14,
    paddingHorizontal: 18,
    backgroundColor: '#14161D',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  accentBar: {
    width: 4,
    height: 36,
    borderRadius: 4,
    backgroundColor: '#3399FF',
    marginRight: 14,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(51, 153, 255, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(51, 153, 255, 0.4)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    gap: 6,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#3399FF',
  },
  liveBadgeText: {
    color: '#3399FF',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  card: {
    width: isTV ? 154 : 150,
    borderRadius: 12,
  },
  cardFocused: {
    transform: [{ scale: 1.05 }],
    zIndex: 10,
  },
  cardInner: {
    width: '100%',
  },
  posterWrapper: {
    width: '100%',
    height: isTV ? 230 : 224,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#181A20',
    borderWidth: 2.5,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    position: 'relative',
  },
  posterWrapperFocused: {
    borderColor: '#3399FF',
    shadowColor: '#3399FF',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 12,
    elevation: 10,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  posterGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '55%',
  },
  dateBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
     gap: 4,
    backgroundColor: 'rgba(11, 11, 12, 0.78)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  dateBadgeFocused: {
    backgroundColor: '#3399FF',
    borderColor: '#66B2FF',
  },
  dateBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
  },
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(11, 11, 12, 0.28)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playButtonCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(51, 153, 255, 0.92)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  episodeChip: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    right: 8,
    backgroundColor: 'rgba(20, 22, 29, 0.85)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  episodeChipText: {
    color: '#D1D5DB',
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
  },
  infoContainer: {
    paddingTop: 8,
    paddingHorizontal: 4,
  },
  cardTitle: {
    fontWeight: '600',
    fontSize: 13,
    lineHeight: 18,
    color: '#9CA3AF',
    textAlign: 'center',
  },
  cardTitleFocused: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  footerLoader: {
    marginVertical: 24,
    alignItems: 'center',
    gap: 8,
  },
  footerLoaderText: {
    color: '#9CA3AF',
    fontSize: 12,
  },
});