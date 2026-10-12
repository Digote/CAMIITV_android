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
import { Stack, useLocalSearchParams } from 'expo-router';
import SendIntentAndroid from 'react-native-send-intent';
import axios from 'axios';
import Header from '../../components/Header';
import SideMenuLayout, { MenuItem } from '../../components/SideMenuLayout';
import { useTheme } from '../../theme/ThemeContext';
import api from '@/services/api';

interface AnimeDetails {
  id: number;
  id_name: string;
  nome: string;
  img: string;
  created_at: string;
  updated_at: string;
}

interface Episodio {
  id: number;
  id_anime: number;
  id_episode: number;
  nome: string;
  link: string;
  created_at: string;
  updated_at: string;
}

function formatDateBR(isoString: string) {
  if (!isoString) return '';
  const [datePart] = isoString.split('T');
  if (!datePart) return '';
  const [year, month, day] = datePart.split('-');
  return `${day}/${month}/${year}`;
}

export default function AnimeDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { theme } = useTheme();

  const [anime, setAnime] = useState<AnimeDetails | null>(null);
  const [episodios, setEpisodios] = useState<Episodio[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;

    setLoading(true);
    api
      .get(`/an/anime/${id}`)
      .then((response) => {
        setAnime(response.data.anime);
        setEpisodios(response.data.episodios || []);
      })
      .catch((error) => {
        console.error('Erro ao buscar detalhes do anime:', error);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [id]);

  const playEpisode = (ep: Episodio) => {
    SendIntentAndroid.openAppWithData('org.videolan.vlc', ep.link, 'video/*', {
      title: ep.nome,
    });
  };

  const menuItems: MenuItem[] = [
    { icon: 'home', label: 'Início', route: '/' },
    { icon: 'home', label: 'Temporadas', route: '/seasons' },
    { icon: 'home', label: 'AN', route: '/an' },
    { icon: 'user', label: 'Perfil', route: '/perfil' },
  ];

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#000001', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#FFF" />
      </SafeAreaView>
    );
  }

  return (
    <>
        <Stack.Screen options={{ headerShown: false }} />

        <SafeAreaView style={{ flex: 1, backgroundColor: '#000001', flexDirection: 'row' }}>
        <SideMenuLayout menuItems={menuItems}>
            <Header />

            <FlatList
            data={episodios}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={{ padding: 16 }}
            ListHeaderComponent={
                anime ? (
                <View style={styles.headerContainer}>
                    <Image source={{ uri: anime.img }} style={styles.poster} />
                    <View style={styles.infoContainer}>
                    <Text style={[styles.animeTitle, { fontFamily: theme.fonts.heading }]}>
                        {anime.nome}
                    </Text>
                    <Text style={styles.animeDate}>
                        Cadastrado em: {formatDateBR(anime.created_at)}
                    </Text>
                    <Text style={styles.episodesSectionTitle}>
                        Episódios ({episodios.length})
                    </Text>
                    </View>
                </View>
                ) : null
            }
            renderItem={({ item }) => (
                <Pressable
                onPress={() => playEpisode(item)}
                style={({ focused, pressed }) => [
                    styles.episodeCard,
                    (focused || pressed) && styles.episodeCardFocused,
                ]}
                android_ripple={{ color: 'rgba(255, 255, 255, 0.22)' }}
                focusable={true}
                >
                {({ focused }) => (
                    <Text style={[styles.episodeTitle, focused && styles.episodeTitleFocused]}>
                    {item.nome}
                    </Text>
                )}
                </Pressable>
            )}
            />
        </SideMenuLayout>
        </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    flexDirection: 'row',
    marginBottom: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    padding: 16,
    borderRadius: 8,
  },
  poster: {
    width: 140,
    height: 200,
    borderRadius: 6,
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
    color: '#AAA',
    marginBottom: 16,
  },
  episodesSectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFF',
    marginTop: 'auto',
  },
  episodeCard: {
    padding: 14,
    marginBottom: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 6,
  },
  episodeCardFocused: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    borderColor: '#FFF',
    borderWidth: 1,
  },
  episodeTitle: {
    color: '#DDD',
    fontSize: 14,
  },
  episodeTitleFocused: {
    color: '#FFF',
    fontWeight: 'bold',
  },
});