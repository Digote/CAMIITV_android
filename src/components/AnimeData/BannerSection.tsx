import React from 'react';
import { Image, ImageBackground, Platform, StatusBar, Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome5';

export default function BannerSection({ anime, theme, styles }) {
  const statusBarHeight = Platform.OS === 'android' ? StatusBar.currentHeight || 0 : 0;
  return (
    <ImageBackground source={{ uri: anime.image }} style={styles.banner}>
      <View style={[styles.topBar, { paddingTop: statusBarHeight }]}> 
        <TouchableOpacity><Icon name="bars" size={20} color="#FFF" /></TouchableOpacity>
        <Image source={require('../../assets/logo.png')} style={styles.logo} />
        <View style={styles.topIcons}>
          <TouchableOpacity><Icon name="cast" size={20} color="#FFF" /></TouchableOpacity>
          <TouchableOpacity><Icon name="user-circle" size={20} color="#FFF" /></TouchableOpacity>
        </View>
      </View>
      <View style={styles.bannerOverlay} />
      <View style={styles.bannerContent}>
        <Text style={[styles.mainTitle, { fontFamily: theme.fonts.heading }]}>{anime.title}</Text>
        <View style={styles.metaRow}>
          <Text style={styles.metaText}>★ {anime.rating}</Text>
          <Text style={styles.metaText}>{anime.years}</Text>
          <Text style={styles.metaText}>{anime.network}</Text>
          <Text style={styles.metaText}>{anime.seasons}</Text>
          <Text style={styles.metaText}>{anime.age}</Text>
          <Text style={styles.metaText}>{anime.genre}</Text>
        </View>
        <View style={styles.buttonRow}>
          <TouchableOpacity style={[styles.playButton, { backgroundColor: theme.colors.secondary }]}>
            <Text style={[styles.playText, { fontFamily: theme.fonts.body }]}>► Reproduzir</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.favButton, { borderColor: '#FFF' }]}>
            <Text style={[styles.favText, { fontFamily: theme.fonts.body }]}>☆ Favoritar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ImageBackground>
  );
}
