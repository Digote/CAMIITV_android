import { useRouter } from 'expo-router';
import React from 'react';
import { Image, Platform, Pressable, StyleSheet, Text } from 'react-native';
import { Anime } from '../../types';
import SendIntentAndroid from 'react-native-send-intent';

interface Props {
  anime: Anime;
}

function formatDateBR(isoString: string) {
  if (!isoString) return '';

  // 1. Pega apenas a parte antes do 'T' ("2026-01-17")
  const [datePart] = isoString.split('T');

  // 2. Separa ano, mês e dia
  const [year, month, day] = datePart.split('-');

  // Retorna "17/01/2026"
  return `${day}/${month}/${year}`;
}

export default function AnimeCard({ anime }: Props) {
  const router = useRouter();

  const vlcPress = async (ep:any) => {
    
    const title = ep.nome
    const url = ep.link;

    SendIntentAndroid.openAppWithData("org.videolan.vlc",
      url,
      "video/*", {
        title: title,
      } 
    );

  };


  return (
    <Pressable
      onPress={() =>  vlcPress(anime)}
      style={({ focused, pressed }) => [
        styles.card,
        (focused || pressed) && styles.cardFocused
      ]}
      android_ripple={{ color: 'rgba(255, 255, 255, 0.22)' }}
      focusable={true}
    >
      {({ focused }) => (
        <>
          <Image
            source={{ uri: anime.thumbnail }}
            style={[
              styles.image,
              focused && styles.imageFocused
            ]}
          />
          <Text
            style={[
              styles.title,
              focused && styles.titleFocused
            ]}
            numberOfLines={3}
          >
            {anime.title}
          </Text>
          <Text
            style={[
              styles.title,
              focused && styles.titleFocused
            ]}
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
    // borderWidth: 2,
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
    // borderWidth: 1,
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
