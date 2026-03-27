import React from 'react';
import { Image, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
// import { useSafeAreaInsets } from 'react-native-safe-area-context';
import logo from '../assets/logo.png';
import { useTheme } from '../theme/ThemeContext';

export default function Header() {
  const { theme } = useTheme();
  // const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.primary, }]}>  
      {/* <Image source={logo} style={styles.logo} resizeMode="contain" /> */}
      {/* <TextInput
        placeholder="Buscar animes..."
        placeholderTextColor={theme.colors.textSecondary}
        style={[styles.search, { backgroundColor: theme.colors.cardBackground, color: theme.colors.text }]}
      /> */}
      <TouchableOpacity>{/* Avatar/Icon */}</TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  logo: { width: 80, height: 80 },
  search: {
    flex: 1,
    marginHorizontal: 16,
    borderRadius: 8,
    paddingHorizontal: 12,
  },
});