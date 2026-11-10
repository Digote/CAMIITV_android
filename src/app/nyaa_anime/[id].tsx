import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Header from '../../components/Header';
import SideMenuLayout, { MenuItem } from '../../components/SideMenuLayout';
import { useTheme } from '../../theme/ThemeContext';
import api from '@/services/api';
import { normalizeImageUrl } from '@/utils/episodeStore';
import { launchVideoPlayback } from '@/utils/playerSettings';

interface NyaaAnimeDetails {
  id: number;
  slug: string;
  nome: string;
  img: string;
  created_at: string;
  updated_at: string;
}

interface EpisodioOpcao {
  id: number;
  resolution: string;
  ptbr: number;
  slug: string;
  created_at: string;
}

interface NyaaEpisodioGroup {
  id: number;
  id_anime: number;
  nome: string;
  resolution: string;
  ptbr: number;
  created_at: string;
  opcoes: EpisodioOpcao[];
}

function formatDateBR(isoString: string) {
  if (!isoString) return '';
  const [datePart] = isoString.split(/[T ]/);
  if (!datePart) return '';
  const [year, month, day] = datePart.split('-');
  return `${day}/${month}/${year}`;
}

export default function NyaaAnimeDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { theme } = useTheme();

  const [anime, setAnime] = useState<NyaaAnimeDetails | null>(null);
  const [episodios, setEpisodios] = useState<NyaaEpisodioGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingEpisodeId, setLoadingEpisodeId] = useState<number | null>(null);

  useEffect(() => {
    if (!id) return;

    setLoading(true);
    api
      .get(`/nyaa/anime/${id}`)
      .then((response) => {
        setAnime(response.data.anime);
        setEpisodios(response.data.episodios || []);
      })
      .catch((error) => {
        console.error('Erro ao buscar detalhes do anime Nyaa:', error);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [id]);

  const playOption = async (epNome: string, opcao: EpisodioOpcao) => {
    if (loadingEpisodeId !== null) return;

    setLoadingEpisodeId(opcao.id);
    try {
      const response = await api.get(`/nyaa/episodio/${opcao.id}/stream`);
      const streamUrl =
        response.data?.link ||
        response.data?.download_url ||
        response.data?.stream_url;

      if (!streamUrl) {
        Alert.alert('Erro', 'Não foi possível obter o link de reprodução no Webtor.');
        return;
      }

      await launchVideoPlayback(router, {
        url: streamUrl,
        title: `${epNome} [${opcao.resolution}]`,
        animeName: anime?.nome,
        poster: anime?.img,
        episodeId: String(opcao.id),
        nyaaOptionId: opcao.id,
        fallbackStreamUrl: response.data?.stream_url,
        isNyaaOnly: true,
      });
    } catch (error) {
      console.error('Erro ao obter stream do Webtor:', error);
      Alert.alert('Erro', 'Falha ao gerar o link de reprodução no Webtor.');
    } finally {
      setLoadingEpisodeId(null);
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

  if (loading) {
    return (
      <SafeAreaView style={styles.loaderScreen}>
        <ActivityIndicator size="large" color="#3399FF" />
      </SafeAreaView>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />

      <SafeAreaView style={styles.screen}>
        <SideMenuLayout menuItems={menuItems}>
          <Header />

          <FlatList
            data={episodios}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={{ padding: 16, paddingBottom: 48 }}
            ListHeaderComponent={
              anime ? (
                <View style={styles.headerContainer}>
                  <Image source={{ uri: normalizeImageUrl(anime.img) }} style={styles.poster} />
                  <View style={styles.infoContainer}>
                    <Text style={[styles.animeTitle, { fontFamily: theme.fonts.heading }]}>
                      {anime.nome}
                    </Text>
                    <Text style={styles.animeDate}>
                      Cadastrado em: {formatDateBR(anime.created_at)}
                    </Text>
                    <Text style={styles.episodesSectionTitle}>
                      Episódios ({episodios.length}) • Escolha a resolução para reproduzir
                    </Text>
                  </View>
                </View>
              ) : null
            }
            renderItem={({ item }) => {
              const opcoes =
                Array.isArray(item.opcoes) && item.opcoes.length > 0
                  ? item.opcoes
                  : [
                      {
                        id: item.id,
                        resolution: item.resolution || 'Padrão',
                        ptbr: item.ptbr,
                        slug: '',
                        created_at: item.created_at,
                      },
                    ];

              return (
                <View style={styles.episodeCard}>
                  <View style={styles.episodeInfo}>
                    <View style={styles.episodeTitleRow}>
                      <Text style={styles.episodeTitle}>{item.nome}</Text>
                      {item.ptbr === 1 && (
                        <View style={styles.ptbrTag}>
                          <Text style={styles.ptbrTagText}>Legenda PT-BR</Text>
                        </View>
                      )}
                    </View>
                    {!!item.created_at && (
                      <Text style={styles.episodeDateText}>
                        Lançado em {formatDateBR(item.created_at)}
                      </Text>
                    )}
                  </View>

                  <View style={styles.resolutionsRow}>
                    {opcoes.map((opcao) => {
                      const isThisLoading = loadingEpisodeId === opcao.id;

                      return (
                        <Pressable
                          key={opcao.id}
                          onPress={() => playOption(item.nome, opcao)}
                          focusable={true}
                          android_ripple={{ color: 'rgba(51, 153, 255, 0.3)' }}
                          style={({ focused, pressed }) => [
                            styles.resolutionBtn,
                            (focused || pressed) && styles.resolutionBtnFocused,
                          ]}
                        >
                          {({ focused, pressed }) => {
                            const isActive = focused || pressed;
                            return (
                              <View style={styles.resolutionBtnContent}>
                                {isThisLoading ? (
                                  <ActivityIndicator size="small" color="#FFF" />
                                ) : (
                                  <Ionicons
                                    name="play"
                                    size={13}
                                    color={isActive ? '#FFF' : '#3399FF'}
                                  />
                                )}
                                <Text
                                  style={[
                                    styles.resolutionBtnText,
                                    isActive && styles.resolutionBtnTextFocused,
                                  ]}
                                >
                                  {opcao.resolution || 'Play'}
                                </Text>
                              </View>
                            );
                          }}
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              );
            }}
          />
        </SideMenuLayout>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  loaderScreen: {
    flex: 1,
    backgroundColor: '#0B0B0C',
    justifyContent: 'center',
    alignItems: 'center',
  },
  screen: {
    flex: 1,
    backgroundColor: '#0B0B0C',
    flexDirection: 'row',
  },
  headerContainer: {
    flexDirection: 'row',
    marginBottom: 24,
    backgroundColor: '#14161D',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  poster: {
    width: 140,
    height: 200,
    borderRadius: 8,
    backgroundColor: '#181A20',
  },
  infoContainer: {
    flex: 1,
    marginLeft: 16,
    justifyContent: 'flex-start',
  },
  animeTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 8,
  },
  animeDate: {
    fontSize: 14,
    color: '#9CA3AF',
    marginBottom: 16,
  },
  episodesSectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFF',
    marginTop: 'auto',
  },
  episodeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 10,
    backgroundColor: '#14161D',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    gap: 12,
  },
  episodeInfo: {
    flex: 1,
  },
  episodeTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  episodeTitle: {
    color: '#F3F4F6',
    fontSize: 15,
    fontWeight: '600',
  },
  ptbrTag: {
    backgroundColor: 'rgba(16, 185, 129, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.5)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 5,
  },
  ptbrTagText: {
    color: '#34D399',
    fontSize: 10,
    fontWeight: '700',
  },
  episodeDateText: {
    color: '#9CA3AF',
    fontSize: 11,
    marginTop: 4,
  },
  resolutionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  resolutionBtn: {
    backgroundColor: 'rgba(51, 153, 255, 0.14)',
    borderWidth: 2,
    borderColor: 'rgba(51, 153, 255, 0.45)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  resolutionBtnFocused: {
    backgroundColor: '#3399FF',
    borderColor: '#FFFFFF',
    transform: [{ scale: 1.06 }],
  },
  resolutionBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  resolutionBtnText: {
    color: '#E5E7EB',
    fontSize: 13,
    fontWeight: '700',
  },
  resolutionBtnTextFocused: {
    color: '#FFFFFF',
  },
});
