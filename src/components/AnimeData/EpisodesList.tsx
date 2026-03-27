import React from 'react';
import { FlatList, ImageBackground, Linking, Pressable, Text } from 'react-native';

export default function EpisodesList({ episodes, styles, theme }) {
  const handlePress = (item) => {
    if (item.links && item.links.length > 0) {
      // Abrir o primeiro link no VLC, passando o nome do episódio como parâmetro
      const url = `vlc://${item.links[0]}?title=${encodeURIComponent(item.title)}`;
      Linking.openURL(url);
    } else {
      console.log(item);
    }
  };
  return (
    <FlatList
      horizontal
      data={episodes}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (

        <Pressable
            onPress={() => handlePress(item)}
            style={({ focused, pressed }) => [
                styles.epCard,
                (focused || pressed) && styles.cardFocused
            ]}
            android_ripple={{ color: 'rgba(255, 255, 255, 0.22)' }}
            focusable={true}
        >
            {({ focused }) => (
                <>
                    <ImageBackground source={{ uri: item.thumbnail }} style={styles.epImage} />
                    <Text style={[styles.epTitle, { color: '#FFF', fontFamily: theme.fonts.body, paddingHorizontal: 3 }]}>
                    {item.title}
                    </Text>
                    <Text style={[styles.epDuration, { paddingHorizontal: 3 }]}>{item.duration}</Text>
                </>
            )}
        </Pressable>
        
      )}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
    />
  );
}
