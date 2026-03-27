import React from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { Anime } from '../../types';
import AnimeCard_AN from '../AN/AnimeCard_AN';



interface Props { title: string; data: Anime[]; }

export default function Section({ title, data }: Props) {
  const { theme } = useTheme();

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: '#FFF', fontFamily: theme.fonts.heading }]}>
        {title} {}
      </Text>
      <FlatList
        numColumns={5}
        data={data}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <AnimeCard_AN anime={item}  />}
        // showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginVertical: 16 },
  title: { fontSize: 18, marginLeft: 16, fontWeight: 'bold' },
});