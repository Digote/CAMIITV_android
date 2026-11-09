import { useRouter } from 'expo-router';
import React from 'react';
import { Image, Platform, Pressable, StyleSheet, Text } from 'react-native';
import { Anime } from '../../types';
import { launchVideoPlayback } from '@/utils/playerSettings';

interface Props {
  anime: Anime;
}

function formatDateBR(isoString: string) {
  if (!isoString) return '';
  const [datePart] = isoString.split('T');
  const [year, month, day] = datePart.split('-');
  return `${day}/${month}/${year}`;
}

export default function AnimeCard({ anime }: Props) {
  const router = useRouter();

  const vlcPress = async (ep: any) => {
    const title = ep.nome || ep.title || 'Episódio';
    const url = ep.link;
    if (!url) return;

    await launchVideoPlayback(router, {
      url,
      title,
      poster: ep.thumbnail,
    });
  };

  return (
    <Pressable
      onPress={() => vlcPress(anime)}
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
            style={[styles.title, focused && styles.titleFocused]}
            numberOfLines={3}
          >
            {anime.title}
          </Text>
          <Text
            style={[styles.title, focused && styles.titleFocused]}
            numberOfLines={3}
          >
            {formatDateBR(anime.date)}
          </Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
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
  title: {
    marginTop: 8,
    fontWeight: 'bold',
    fontSize: Platform.OS === 'android' && Platform.isTV ? 12 : 12,
    color: '#FFF',
    textAlign: 'center',
  },
  titleFocused: {
    color: '#FFF',
    fontWeight: 'bold',
  },
});
