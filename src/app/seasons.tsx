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
import { useRouter } from 'expo-router';
import Header from '../components/Header';
import SideMenuLayout, { MenuItem } from '../components/SideMenuLayout';
import { useTheme } from '../theme/ThemeContext';
import api from '@/services/api';
import { normalizeImageUrl } from '@/utils/episodeStore';

interface SeasonAnimeItem {
  id: string;
  nome: string;
  title: string;
  imagem: string;
  cover: string;
  banner?: string;
  nota_mal?: number | string | null;
  nota_tmdb?: number | string | null;
  status?: number | null;
  temporada_ano?: number | null;
  temporada_estacao?: number | null;
  temporadas_count?: number;
  nyaa_animes_count?: number;
}

interface SeasonGroup {
  id: string;
  temporada_ano: number | null;
  temporada_estacao: number | null;
  estacao_nome: string;
  name: string;
  total: number;
  animes: SeasonAnimeItem[];
}

function getSeasonIconName(estacao: number | null): keyof typeof Ionicons.glyphMap {
  switch (Number(estacao)) {
    case 1:
      return 'snow-outline'; // Inverno
    case 2:
      return 'flower-outline'; // Primavera
    case 3:
      return 'sunny-outline'; // Verão
    case 4:
      return 'leaf-outline'; // Outono
    default:
      return 'calendar-outline';
  }
}

function formatEstacaoLabel(estacao: number | null): string {
  switch (Number(estacao)) {
    case 1:
      return 'Inverno';
    case 2:
      return 'Primavera';
    case 3:
      return 'Verão';
    case 4:
      return 'Outono';
    default:
      return 'Outros';
  }
}

function SeasonAnimeCard({ anime }: { anime: SeasonAnimeItem }) {
  const router = useRouter();
  const posterUrl = normalizeImageUrl(anime.cover || anime.imagem);
  const nota = anime.nota_mal || anime.nota_tmdb;

  return (
    <Pressable
      focusable={true}
      onPress={() => router.push(`/anime/${anime.id}` as any)}
      android_ripple={{ color: 'rgba(51, 153, 255, 0.25)' }}
      style={({ focused, pressed }) => [
        styles.card,
        (focused || pressed) && styles.cardFocused,
      ]}
    >
      {({ focused, pressed }) => {
        const isActive = focused || pressed;
        return (
          <View style={styles.cardInner}>
            <View style={[styles.posterWrapper, isActive && styles.posterWrapperFocused]}>
              <Image
                source={{ uri: posterUrl }}
                style={styles.image}
                contentFit="cover"
                transition={150}
                cachePolicy="disk"
              />

              <LinearGradient
                colors={['transparent', 'rgba(11, 11, 12, 0.35)', 'rgba(11, 11, 12, 0.95)']}
                style={styles.posterGradient}
              />

              {/* Nota no topo esquerdo */}
              {!!nota && (
                <View style={styles.scoreBadge}>
                  <Text style={styles.scoreBadgeText}>★ {Number(nota).toFixed(1)}</Text>
                </View>
              )}

              {/* Badges no topo direito (No Ar / Nyaa) */}
              <View style={styles.rightBadgesRow}>
                {Number(anime.status) === 1 && (
                  <View style={styles.airingBadge}>
                    <Text style={styles.airingBadgeText}>NO AR</Text>
                  </View>
                )}
                {Number(anime.nyaa_animes_count) > 0 && (
                  <View style={styles.nyaaBadge}>
                    <Text style={styles.nyaaBadgeText}>NYAA</Text>
                  </View>
                )}
              </View>

              {/* Indicador de Play ao focar com o controle da TV */}
              {isActive && (
                <View style={styles.playOverlay}>
                  <View style={styles.playButtonCircle}>
                    <Ionicons name="play" size={22} color="#FFF" style={{ marginLeft: 2 }} />
                  </View>
                </View>
              )}

              {/* Quantidade de temporadas na base do poster quando houver mais de 1 */}
              {Number(anime.temporadas_count) > 1 && (
                <View style={styles.seasonCountChip}>
                  <Text style={styles.seasonCountChipText}>
                    {anime.temporadas_count} Temporadas
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.infoContainer}>
              <Text
                style={[styles.cardTitle, isActive && styles.cardTitleFocused]}
                numberOfLines={2}
              >
                {anime.title || anime.nome}
              </Text>
            </View>
          </View>
        );
      }}
    </Pressable>
  );
}

export default function SeasonsScreen() {
  const { theme } = useTheme();
  const [seasons, setSeasons] = useState<SeasonGroup[]>([]);
  const [selectedSeasonId, setSelectedSeasonId] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSeasons = async () => {
      setLoading(true);
      try {
        const response = await api.get('/temporadas/lista');
        const raw = Array.isArray(response.data) ? response.data : [];

        const normalized: SeasonGroup[] = raw
          .map((item: any, idx: number) => {
            const ano = item.temporada_ano ?? null;
            const estacao = item.temporada_estacao ?? null;
            const estacaoNome = item.estacao_nome || formatEstacaoLabel(estacao);
            const id = item.id ? String(item.id) : `${ano || 'sem'}-${estacao || idx}`;
            const name =
              item.name ||
              (ano && estacao ? `${estacaoNome} ${ano}` : 'Sem Temporada');
            const animesList = Array.isArray(item.animes) ? item.animes : [];

            return {
              id,
              temporada_ano: ano,
              temporada_estacao: estacao,
              estacao_nome: estacaoNome,
              name,
              total: item.total ?? animesList.length,
              animes: animesList,
            };
          })
          .filter((s: SeasonGroup) => s.animes.length > 0 || s.temporada_ano !== null);

        setSeasons(normalized);
        if (normalized.length > 0) {
          setSelectedSeasonId(normalized[0].id);
        }
      } catch (error) {
        console.error('Erro ao buscar temporadas de animes:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSeasons();
  }, []);

  const currentSeason = seasons.find((s) => s.id === selectedSeasonId) || seasons[0] || null;
  const filteredAnimes = currentSeason?.animes || [];

  const menuItems: MenuItem[] = [
    { icon: 'home', label: 'Início', route: '/' },
    { icon: 'home', label: 'Temporadas', route: '/seasons' },
    { icon: 'home', label: 'AN', route: '/an' },
    { icon: 'home', label: 'BR', route: '/br' },
    { icon: 'magnet', label: 'NYAA', route: '/nyaa' },
    { icon: 'user', label: 'Perfil', route: '/perfil' },
  ];

  const renderSeasonTab = ({ item }: { item: SeasonGroup }) => {
    const isSelected = item.id === (currentSeason?.id || selectedSeasonId);
    const iconName = getSeasonIconName(item.temporada_estacao);

    return (
      <Pressable
        focusable={true}
        onPress={() => setSelectedSeasonId(item.id)}
        style={({ focused, pressed }) => [
          styles.seasonTab,
          isSelected && styles.seasonTabSelected,
          (focused || pressed) && styles.seasonTabFocused,
        ]}
      >
        {({ focused, pressed }) => {
          const isActive = focused || pressed;
          return (
            <View style={styles.seasonTabInner}>
              <Ionicons
                name={iconName}
                size={15}
                color={isSelected || isActive ? '#FFFFFF' : '#9CA3AF'}
              />
              <Text
                style={[
                  styles.seasonTabText,
                  isSelected && styles.seasonTabTextSelected,
                  isActive && styles.seasonTabTextFocused,
                ]}
              >
                {item.name}
              </Text>
              <View
                style={[
                  styles.seasonCountPill,
                  isSelected && styles.seasonCountPillSelected,
                ]}
              >
                <Text
                  style={[
                    styles.seasonCountPillText,
                    isSelected && styles.seasonCountPillTextSelected,
                  ]}
                >
                  {item.total}
                </Text>
              </View>
            </View>
          );
        }}
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={styles.screen}>
      <SideMenuLayout menuItems={menuItems}>
        <Header />

        {loading ? (
          <View style={styles.centerLoader}>
            <ActivityIndicator size="large" color="#3399FF" />
            <Text style={styles.loaderText}>Carregando temporadas de animes...</Text>
          </View>
        ) : (
          <FlatList
            key={`season-grid-${currentSeason?.id || 'default'}`}
            numColumns={5}
            data={filteredAnimes}
            keyExtractor={(item) => String(item.id)}
            renderItem={({ item }) => <SeasonAnimeCard anime={item} />}
            contentContainerStyle={styles.listContent}
            columnWrapperStyle={styles.columnWrapper}
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={
              <View>
                {/* Banner superior da tela de Temporadas */}
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
                        Temporadas • {currentSeason ? currentSeason.name : 'Catálogo'}
                      </Text>
                      <Text style={styles.headerSubtitle}>
                        Navegue pelos animes lançados em cada estação do ano ({filteredAnimes.length} títulos nesta temporada)
                      </Text>
                    </View>
                  </View>

                  {currentSeason && (
                    <View style={styles.liveBadge}>
                      <Ionicons
                        name={getSeasonIconName(currentSeason.temporada_estacao)}
                        size={13}
                        color="#3399FF"
                      />
                      <Text style={styles.liveBadgeText}>
                        {currentSeason.name.toUpperCase()}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Seletor Horizontal de Temporadas (Estação + Ano) */}
                {seasons.length > 0 && (
                  <View style={styles.seasonsBarWrapper}>
                    <FlatList
                      horizontal
                      data={seasons}
                      keyExtractor={(item) => item.id}
                      renderItem={renderSeasonTab}
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.seasonsListContent}
                    />
                  </View>
                )}
              </View>
            }
            ListEmptyComponent={
              <View style={styles.emptyBox}>
                <Text style={styles.emptyText}>
                  Nenhum anime encontrado para esta temporada.
                </Text>
              </View>
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
    marginBottom: 14,
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
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    gap: 6,
  },
  liveBadgeText: {
    color: '#3399FF',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
  },

  // Barra Horizontal de Temporadas
  seasonsBarWrapper: {
    marginBottom: 22,
  },
  seasonsListContent: {
    paddingVertical: 6,
    paddingHorizontal: 2,
    gap: 10,
  },
  seasonTab: {
    backgroundColor: '#14161D',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginRight: 10,
  },
  seasonTabSelected: {
    backgroundColor: '#3399FF',
    borderColor: '#66B2FF',
  },
  seasonTabFocused: {
    borderColor: '#FFFFFF',
    backgroundColor: '#222733',
    transform: [{ scale: 1.06 }],
  },
  seasonTabInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  seasonTabText: {
    color: '#D1D5DB',
    fontSize: 14,
    fontWeight: '700',
  },
  seasonTabTextSelected: {
    color: '#FFFFFF',
  },
  seasonTabTextFocused: {
    color: '#FFFFFF',
  },
  seasonCountPill: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
  },
  seasonCountPillSelected: {
    backgroundColor: 'rgba(0, 0, 0, 0.28)',
  },
  seasonCountPillText: {
    color: '#9CA3AF',
    fontSize: 11,
    fontWeight: 'bold',
  },
  seasonCountPillTextSelected: {
    color: '#FFFFFF',
  },

  // Cards de Anime no Grid
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
  scoreBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(11, 11, 12, 0.82)',
    borderWidth: 1,
    borderColor: 'rgba(243, 156, 18, 0.5)',
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 6,
  },
  scoreBadgeText: {
    color: '#FBBF24',
    fontSize: 10,
    fontWeight: '800',
  },
  rightBadgesRow: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'row',
    gap: 4,
  },
  airingBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.9)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
  },
  airingBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
  },
  nyaaBadge: {
    backgroundColor: 'rgba(147, 51, 234, 0.9)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
  },
  nyaaBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
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
  seasonCountChip: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    right: 8,
    backgroundColor: 'rgba(20, 22, 29, 0.85)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  seasonCountChipText: {
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
  emptyBox: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  emptyText: {
    color: '#9CA3AF',
    fontSize: 15,
  },
});
