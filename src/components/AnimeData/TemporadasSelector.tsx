// components/TemporadasSelector.tsx
import React, { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export default function TemporadasSelector({
  temporadas,
  selected,
  onSelect,
  isFocusedColumn,
  preferredFocusIndex,
  setPreferredFocusIndex
}) {
  const refs = useRef([]);

  return (
    <>
      {temporadas.map((temporada, index) => {
        const isSelected = selected === temporada.id;
        // console.log(temporada.id)
        // console.log(selected)

        if (isFocusedColumn) {
          return (
            <Pressable
              key={temporada.id}
              ref={(ref) => { if (ref) refs.current[index] = ref }}
              onFocus={() => {
                onSelect(temporada.id);
                setPreferredFocusIndex(index);
              }}
              onPress={() => console.log(`Selecionou Temporada id: ${temporada.id}`)}
              hasTVPreferredFocus={preferredFocusIndex === index}
              style={[
                styles.tabButtonTemporada,
                isSelected && styles.tabButtonTemporadaFocused,
              ]}
            >
              <Text style={styles.tabContentTextTemporada}>
                Temporada {temporada.numero}
              </Text>
              <Text style={styles.tabContentTextEpisodios}>
                {temporada.episodios.length} Episódios
              </Text>
            </Pressable>
          );
        } else {
          return (
            <View
              key={temporada.id}
              style={[
                styles.tabButtonTemporada,
                isSelected && styles.tabButtonTemporadaFocused,
              ]}
            >
              <Text style={styles.tabContentTextTemporada}>
                Temporada {temporada.numero}
              </Text>
              <Text style={styles.tabContentTextEpisodios}>
                {temporada.episodios.length} Episódios
              </Text>
            </View>
          );
        }
      })}
    </>
  );
}


const styles = StyleSheet.create({

  tabButtonTemporada: {
    backgroundColor: '#333',
    height: 35,
    paddingTop: 5,
    paddingLeft: 5,
    width: "100%",
    flexDirection: 'row',
    marginBottom: 5,
  },
  tabButtonTemporadaFocused: {
    backgroundColor: '#12bbf3ff',
  },
  tabContentTextTemporada: {
    fontSize: 18,
    color: '#fff',
    width: 150,
  },
  tabContentTextEpisodios: {
    fontSize: 18,
    width: 120,
    color: '#fff',
    textAlign: 'right',
  },
});