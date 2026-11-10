import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  Dimensions,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useRouter } from 'expo-router';
import api from '@/services/api';
import {
  EpisodePagePayload,
  getCurrentEpisodePayload,
  NyaaOption,
  normalizeImageUrl,
} from '@/utils/episodeStore';
import {
  launchVideoPlayback,
  usePlayerSettings,
} from '@/utils/playerSettings';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

const NETFLIX = {
  bg: '#000000',
  surface: '#141414',
  surfaceHover: '#262626',
  red: '#E50914',
  white: '#FFFFFF',
  textMuted: '#B3B3B3',
  textDark: '#000000',
  matchGreen: '#46D369',
  digitalBlue: '#12bbf3',
  nyaaPurple: '#A855F7',
  vlcOrange: '#FF8800',
  border: 'rgba(255, 255, 255, 0.18)',
};

export default function EpisodioNetflixScreen() {
  const router = useRouter();
  const appState = useRef(AppState.currentState);
  const { settings, updateSettings } = usePlayerSettings();

  const [payload, setPayload] = useState<EpisodePagePayload | null>(() =>
    getCurrentEpisodePayload()
  );
  const [isWatched, setIsWatched] = useState<boolean>(
    () => getCurrentEpisodePayload()?.episode?.assistido?.completo === 1
  );
  const [loadingNyaaId, setLoadingNyaaId] = useState<number | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  const esperandoRetornoRef = useRef(false);
  const tempoInicioVlcRef = useRef<number | null>(null);

  useEffect(() => {
    const current = getCurrentEpisodePayload();
    if (!current) {
      if (router.canGoBack()) router.back();
      return;
    }
    setPayload(current);
    setIsWatched(current.episode?.assistido?.completo === 1);
  }, [router]);

  // Monitora o retorno do VLC externo para perguntar se deseja marcar como assistido
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        if (esperandoRetornoRef.current && payload && !payload.episode.isNyaaOnly) {
          if (tempoInicioVlcRef.current) {
            const minutosGastos = Math.floor(
              (Date.now() - tempoInicioVlcRef.current) / 60000
            );
            if (minutosGastos >= 2) {
              setModalVisible(true);
            }
          } else {
            setModalVisible(true);
          }
          esperandoRetornoRef.current = false;
          tempoInicioVlcRef.current = null;
        }
      }
      appState.current = nextAppState;
    });
    return () => subscription.remove();
  }, [payload]);

  if (!payload) {
    return <View style={styles.container} />;
  }

  const { anime, episode, temporadaNumero, totalTemporadas } = payload;
  const normalLinks = episode.normalLinks || [];
  const digitalLinks = episode.digitalLinks || [];
  const nyaaOptions = episode.nyaaOptions || episode.opcoes || [];

  const isInternalPlayer = settings.playerType === 'internal';
  const playerSubLabel = isInternalPlayer
    ? 'Reproduzir no Player Interno'
    : 'Reproduzir no VLC Externo';

  const marcarAssistido = async () => {
    if (!episode.id || episode.isNyaaOnly) return;
    try {
      await api.post(`/episodio/${episode.id}/assistido`);
      setIsWatched(true);
      payload.onMarkedWatched?.(episode.id);
    } catch (error) {
      console.error('Erro ao marcar como assistido:', error);
    } finally {
      setModalVisible(false);
    }
  };

  const playDirectLink = async (url: string, label?: string) => {
    if (!url) return;

    const title = episode.numero
      ? `E${episode.numero} - ${episode.nome}${label ? ` [${label}]` : ''}`
      : `${episode.nome}${label ? ` [${label}]` : ''}`;

    try {
      if (settings.playerType === 'external_vlc' && !episode.isNyaaOnly) {
        esperandoRetornoRef.current = true;
        tempoInicioVlcRef.current = Date.now();
      }

      await launchVideoPlayback(router, {
        url,
        title,
        animeName: anime.nome,
        poster: episode.imagem || anime.banner || anime.imagem,
        episodeId: episode.id,
        isNyaaOnly: episode.isNyaaOnly,
        onShouldPromptWatched: () => {
          if (!episode.isNyaaOnly) {
            setModalVisible(true);
          }
        },
      });
    } catch (error) {
      console.error('Erro ao iniciar reprodução:', error);
      esperandoRetornoRef.current = false;
    }
  };

  const playNyaaOption = async (opcao: NyaaOption) => {
    if (loadingNyaaId !== null) return;

    setLoadingNyaaId(opcao.id);
    try {
      const response = await api.get(`/nyaa/episodio/${opcao.id}/stream`);
      const streamUrl =
        response.data?.link ||
        response.data?.download_url ||
        response.data?.stream_url;

      if (!streamUrl) {
        Alert.alert(
          'Erro',
          'Não foi possível obter o link de reprodução no Webtor.'
        );
        return;
      }

      if (settings.playerType === 'external_vlc' && !episode.isNyaaOnly) {
        esperandoRetornoRef.current = true;
        tempoInicioVlcRef.current = Date.now();
      }

      const title = episode.numero
        ? `E${episode.numero} - ${episode.nome} [Nyaa ${opcao.resolution}]`
        : `${episode.nome} [${opcao.resolution}]`;

      await launchVideoPlayback(router, {
        url: streamUrl,
        title,
        animeName: anime.nome,
        poster: episode.imagem || anime.banner || anime.imagem,
        episodeId: episode.id,
        nyaaOptionId: opcao.id,
        fallbackStreamUrl: response.data?.stream_url,
        isNyaaOnly: episode.isNyaaOnly,
        onShouldPromptWatched: () => {
          if (!episode.isNyaaOnly) {
            setModalVisible(true);
          }
        },
      });
    } catch (error) {
      console.error('Erro ao obter stream do Webtor:', error);
      Alert.alert('Erro', 'Falha ao gerar o link de reprodução no Webtor.');
    } finally {
      setLoadingNyaaId(null);
    }
  };

  // Ação do botão principal "Assistir Agora" estilo Netflix (prioriza Link Normal > Digital > Nyaa 1ª opção)
  const handleQuickPlay = () => {
    if (normalLinks.length > 0) {
      playDirectLink(normalLinks[0], 'Opção 1');
    } else if (digitalLinks.length > 0) {
      playDirectLink(digitalLinks[0], 'Anime Digital');
    } else if (nyaaOptions.length > 0) {
      playNyaaOption(nyaaOptions[0]);
    }
  };

  const togglePlayerModeQuick = () => {
    updateSettings({
      playerType: isInternalPlayer ? 'external_vlc' : 'internal',
    });
  };

  const hasAnySource =
    normalLinks.length > 0 || digitalLinks.length > 0 || nyaaOptions.length > 0;

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.container}>
        {/* Artwork de Fundo em Tela Cheia estilo Netflix */}
        <ExpoImage
          source={{
            uri: normalizeImageUrl(
              episode.imagem || anime.banner || anime.imagem,
              anime.imagem
            ),
          }}
          style={styles.backdropImage}
          contentFit="cover"
          transition={250}
        />

        {/* Gradiente Horizontal (Esquerda escura -> Direita transparente) */}
        <LinearGradient
          colors={[
            'rgba(0,0,0,0.96)',
            'rgba(0,0,0,0.82)',
            'rgba(0,0,0,0.35)',
          ]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />

        {/* Gradiente Vertical (Topo sutil -> Base preta sólida) */}
        <LinearGradient
          colors={[
            'rgba(0,0,0,0.65)',
            'transparent',
            'rgba(0,0,0,0.90)',
            '#000000',
          ]}
          locations={[0, 0.3, 0.72, 1]}
          style={StyleSheet.absoluteFill}
        />

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Topo: Botão Voltar + Seletor Rápido do Player + Branding */}
          <View style={styles.topBar}>
            <View style={styles.topLeftGroup}>
              <Pressable
                focusable={true}
                onPress={() => router.back()}
                style={({ focused, pressed }) => [
                  styles.backBtn,
                  (focused || pressed) && styles.backBtnFocused,
                ]}
              >
                <Text style={styles.backBtnText}>← Voltar</Text>
              </Pressable>

              <Pressable
                focusable={true}
                onPress={togglePlayerModeQuick}
                onLongPress={() => router.push('/configuracoes' as any)}
                style={({ focused, pressed }) => [
                  styles.playerModeBtn,
                  isInternalPlayer
                    ? styles.playerModeBtnInternal
                    : styles.playerModeBtnExternal,
                  (focused || pressed) && styles.backBtnFocused,
                ]}
              >
                <Text style={styles.playerModeBtnText}>
                  {isInternalPlayer
                    ? '🎬 Player: Interno (LibVLC)'
                    : '🟠 Player: VLC Externo'}
                </Text>
              </Pressable>

              <Pressable
                focusable={true}
                onPress={() => router.push('/configuracoes' as any)}
                style={({ focused, pressed }) => [
                  styles.backBtn,
                  (focused || pressed) && styles.backBtnFocused,
                ]}
              >
                <Text style={styles.backBtnText}>⚙ Configurar Player</Text>
              </Pressable>
            </View>

            <View style={styles.seriesBadgeRow}>
              <View style={styles.netflixBar} />
              <Text style={styles.seriesLabelText} numberOfLines={1}>
                {anime.nome}
              </Text>
            </View>
          </View>

          {/* Bloco Hero Estilo Netflix */}
          <View style={styles.heroBlock}>
            {/* Subtítulo de Temporada / Episódio */}
            <View style={styles.metaRow}>
              <Text style={styles.matchText}>
                {isWatched ? '✓ Assistido' : 'Disponível agora'}
              </Text>

              {(totalTemporadas || 0) > 1 && temporadaNumero && (
                <Text style={styles.metaTagText}>
                  Temporada {temporadaNumero}
                </Text>
              )}

              {episode.numero !== null && (
                <Text style={styles.metaTagText}>
                  Episódio {episode.numero}
                </Text>
              )}

              {!!episode.duracao && episode.duracao !== '--m' && (
                <View style={styles.hdPill}>
                  <Text style={styles.hdPillText}>{episode.duracao}</Text>
                </View>
              )}

              {digitalLinks.length > 0 && (
                <View
                  style={[
                    styles.hdPill,
                    { borderColor: NETFLIX.digitalBlue },
                  ]}
                >
                  <Text
                    style={[styles.hdPillText, { color: NETFLIX.digitalBlue }]}
                  >
                    DIGITAL
                  </Text>
                </View>
              )}

              {nyaaOptions.length > 0 && (
                <View
                  style={[
                    styles.hdPill,
                    { borderColor: NETFLIX.nyaaPurple },
                  ]}
                >
                  <Text
                    style={[styles.hdPillText, { color: NETFLIX.nyaaPurple }]}
                  >
                    NYAA HD • MKV/ASS
                  </Text>
                </View>
              )}
            </View>

            {/* Título Grande do Episódio */}
            <Text style={styles.episodeTitle} numberOfLines={2}>
              {episode.numero !== null
                ? `${episode.numero}. ${episode.nome}`
                : episode.nome}
            </Text>

            {/* Sinopse */}
            <Text style={styles.episodeSynopsis} numberOfLines={4}>
              {episode.sinopse ||
                'Selecione uma das opções de servidor ou resolução abaixo para iniciar a reprodução.'}
            </Text>

            {/* Linha de Ações Principais (Estilo Netflix: Botão Branco Assistir + Botão Secundário) */}
            <View style={styles.primaryActionsRow}>
              {hasAnySource && (
                <Pressable
                  hasTVPreferredFocus={true}
                  focusable={true}
                  onPress={handleQuickPlay}
                  style={({ focused, pressed }) => [
                    styles.netflixPlayBtn,
                    (focused || pressed) && styles.netflixPlayBtnFocused,
                  ]}
                >
                  {loadingNyaaId !== null ? (
                    <ActivityIndicator size="small" color="#000" />
                  ) : (
                    <Text style={styles.netflixPlayIcon}>▶</Text>
                  )}
                  <Text style={styles.netflixPlayText}>
                    {isInternalPlayer
                      ? 'Assistir Agora (Interno)'
                      : 'Assistir no VLC Externo'}
                  </Text>
                </Pressable>
              )}

              {!episode.isNyaaOnly && (
                <Pressable
                  focusable={true}
                  onPress={marcarAssistido}
                  style={({ focused, pressed }) => [
                    styles.netflixSecondaryBtn,
                    isWatched && styles.netflixSecondaryBtnWatched,
                    (focused || pressed) && styles.netflixSecondaryBtnFocused,
                  ]}
                >
                  <Text style={styles.netflixSecondaryIcon}>
                    {isWatched ? '✓' : '+'}
                  </Text>
                  <Text style={styles.netflixSecondaryText}>
                    {isWatched ? 'Episódio Assistido' : 'Marcar como Assistido'}
                  </Text>
                </Pressable>
              )}
            </View>
          </View>

          {/* Seções de Servidores e Qualidades Separadas */}
          <View style={styles.sourcesContainer}>
            {/* 1. LINKS NORMAIS */}
            {normalLinks.length > 0 && (
              <View style={styles.sourceSection}>
                <Text style={styles.sourceSectionTitle}>
                  Servidor Principal
                </Text>
                <View style={styles.cardsRow}>
                  {normalLinks.map((url, idx) => (
                    <Pressable
                      key={`normal-${idx}`}
                      focusable={true}
                      onPress={() => playDirectLink(url, `Opção ${idx + 1}`)}
                      style={({ focused, pressed }) => [
                        styles.sourceCard,
                        (focused || pressed) && styles.sourceCardFocused,
                      ]}
                    >
                      <View
                        style={[
                          styles.sourceAccentBar,
                          { backgroundColor: NETFLIX.red },
                        ]}
                      />
                      <View style={styles.sourceCardBody}>
                        <Text style={styles.sourceCardLabel}>DIRETO</Text>
                        <Text style={styles.sourceCardTitle}>
                          Opção {idx + 1}
                        </Text>
                        <Text style={styles.sourceCardSub}>
                          {playerSubLabel}
                        </Text>
                      </View>
                      <Text style={styles.sourceCardPlay}>▶</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}

            {/* 2. ANIME DIGITAL */}
            {digitalLinks.length > 0 && (
              <View style={styles.sourceSection}>
                <Text style={styles.sourceSectionTitle}>Anime Digital</Text>
                <View style={styles.cardsRow}>
                  {digitalLinks.map((url, idx) => (
                    <Pressable
                      key={`digital-${idx}`}
                      focusable={true}
                      onPress={() => playDirectLink(url, 'Anime Digital')}
                      style={({ focused, pressed }) => [
                        styles.sourceCard,
                        (focused || pressed) && styles.sourceCardFocused,
                      ]}
                    >
                      <View
                        style={[
                          styles.sourceAccentBar,
                          { backgroundColor: NETFLIX.digitalBlue },
                        ]}
                      />
                      <View style={styles.sourceCardBody}>
                        <Text
                          style={[
                            styles.sourceCardLabel,
                            { color: NETFLIX.digitalBlue },
                          ]}
                        >
                          STREAM DIGITAL
                        </Text>
                        <Text style={styles.sourceCardTitle}>
                          Anime Digital{' '}
                          {digitalLinks.length > 1 ? `#${idx + 1}` : 'HD'}
                        </Text>
                        <Text style={styles.sourceCardSub}>
                          {playerSubLabel}
                        </Text>
                      </View>
                      <Text style={styles.sourceCardPlay}>▶</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}

            {/* 3. NYAA TORRENTS (QUALIDADES DE VÍDEO) */}
            {nyaaOptions.length > 0 && (
              <View style={styles.sourceSection}>
                <Text style={styles.sourceSectionTitle}>
                  Nyaa • Qualidades de Vídeo (MKV + Legendas ASS)
                </Text>
                <View style={styles.cardsRow}>
                  {nyaaOptions.map((opcao) => {
                    const isThisLoading = loadingNyaaId === opcao.id;
                    return (
                      <Pressable
                        key={`nyaa-${opcao.id}`}
                        focusable={true}
                        disabled={loadingNyaaId !== null}
                        onPress={() => playNyaaOption(opcao)}
                        style={({ focused, pressed }) => [
                          styles.sourceCard,
                          (focused || pressed) && styles.sourceCardFocused,
                        ]}
                      >
                        <View
                          style={[
                            styles.sourceAccentBar,
                            { backgroundColor: NETFLIX.nyaaPurple },
                          ]}
                        />
                        <View style={styles.sourceCardBody}>
                          <View style={styles.nyaaTopTagRow}>
                            <Text
                              style={[
                                styles.sourceCardLabel,
                                { color: NETFLIX.nyaaPurple },
                              ]}
                            >
                              NYAA TORRENT
                            </Text>
                            {opcao.ptbr === 1 && (
                              <View style={styles.ptbrMiniBadge}>
                                <Text style={styles.ptbrMiniBadgeText}>
                                  PT-BR
                                </Text>
                              </View>
                            )}
                          </View>
                          <Text style={styles.sourceCardTitle}>
                            {opcao.resolution
                              ? opcao.resolution.toUpperCase()
                              : 'PADRÃO'}
                          </Text>
                          <Text style={styles.sourceCardSub}>
                            {isInternalPlayer
                              ? 'Player Interno (ASS)'
                              : 'VLC Externo (Intent)'}
                          </Text>
                        </View>
                        {isThisLoading ? (
                          <ActivityIndicator size="small" color="#FFF" />
                        ) : (
                          <Text style={styles.sourceCardPlay}>▶</Text>
                        )}
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            )}
          </View>
        </ScrollView>

        {/* Modal de confirmação após assistir */}
        <Modal
          visible={modalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setModalVisible(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalBox}>
              <Text style={styles.modalTitle}>Marcar como assistido?</Text>
              <Text style={styles.modalSubtitle}>"{episode.nome}"</Text>
              <View style={styles.modalButtonsRow}>
                <Pressable
                  hasTVPreferredFocus={true}
                  focusable={true}
                  onPress={marcarAssistido}
                  style={({ focused, pressed }) => [
                    styles.modalBtn,
                    { backgroundColor: NETFLIX.red },
                    (focused || pressed) && styles.modalBtnFocused,
                  ]}
                >
                  <Text style={styles.modalBtnText}>Sim, marcar</Text>
                </Pressable>
                <Pressable
                  focusable={true}
                  onPress={() => setModalVisible(false)}
                  style={({ focused, pressed }) => [
                    styles.modalBtn,
                    (focused || pressed) && styles.modalBtnFocused,
                  ]}
                >
                  <Text style={styles.modalBtnText}>Agora não</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: NETFLIX.bg,
  },
  backdropImage: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: screenWidth * 0.78,
    height: screenHeight * 0.85,
  },
  scrollContent: {
    paddingHorizontal: 56,
    paddingTop: 32,
    paddingBottom: 60,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 28,
  },
  topLeftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  backBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    backgroundColor: 'rgba(20, 20, 20, 0.75)',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  backBtnFocused: {
    borderColor: NETFLIX.white,
    backgroundColor: NETFLIX.surfaceHover,
    transform: [{ scale: 1.05 }],
  },
  backBtnText: {
    color: NETFLIX.white,
    fontSize: 14,
    fontWeight: 'bold',
  },
  playerModeBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 6,
    borderWidth: 2,
  },
  playerModeBtnInternal: {
    backgroundColor: 'rgba(255, 136, 0, 0.18)',
    borderColor: 'rgba(255, 136, 0, 0.55)',
  },
  playerModeBtnExternal: {
    backgroundColor: 'rgba(18, 187, 243, 0.18)',
    borderColor: 'rgba(18, 187, 243, 0.55)',
  },
  playerModeBtnText: {
    color: NETFLIX.white,
    fontSize: 13,
    fontWeight: 'bold',
  },
  seriesBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  netflixBar: {
    width: 4,
    height: 20,
    backgroundColor: NETFLIX.red,
    borderRadius: 2,
  },
  seriesLabelText: {
    color: '#E5E5E5',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    maxWidth: 420,
  },

  heroBlock: {
    maxWidth: screenWidth * 0.62,
    marginBottom: 34,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 14,
    marginBottom: 12,
  },
  matchText: {
    color: NETFLIX.matchGreen,
    fontSize: 15,
    fontWeight: 'bold',
  },
  metaTagText: {
    color: NETFLIX.textMuted,
    fontSize: 15,
    fontWeight: '600',
  },
  hdPill: {
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.45)',
    paddingHorizontal: 7,
    paddingVertical: 1.5,
    borderRadius: 3,
  },
  hdPillText: {
    color: '#E5E5E5',
    fontSize: 11,
    fontWeight: 'bold',
  },
  episodeTitle: {
    color: NETFLIX.white,
    fontSize: 42,
    fontWeight: '900',
    letterSpacing: -0.5,
    lineHeight: 48,
    marginBottom: 14,
    textShadowColor: 'rgba(0, 0, 0, 0.9)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  episodeSynopsis: {
    color: '#D4D4D4',
    fontSize: 17,
    lineHeight: 25,
    marginBottom: 26,
  },

  primaryActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  netflixPlayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: NETFLIX.white,
    paddingVertical: 13,
    paddingHorizontal: 28,
    borderRadius: 6,
    borderWidth: 3,
    borderColor: 'transparent',
  },
  netflixPlayBtnFocused: {
    backgroundColor: '#E5E5E5',
    borderColor: NETFLIX.red,
    transform: [{ scale: 1.06 }],
  },
  netflixPlayIcon: {
    color: NETFLIX.textDark,
    fontSize: 18,
    fontWeight: 'bold',
  },
  netflixPlayText: {
    color: NETFLIX.textDark,
    fontSize: 18,
    fontWeight: 'bold',
  },
  netflixSecondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: 'rgba(109, 109, 110, 0.4)',
    paddingVertical: 13,
    paddingHorizontal: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  netflixSecondaryBtnWatched: {
    borderColor: NETFLIX.matchGreen,
    backgroundColor: 'rgba(70, 211, 105, 0.15)',
  },
  netflixSecondaryBtnFocused: {
    backgroundColor: 'rgba(109, 109, 110, 0.7)',
    borderColor: NETFLIX.white,
    transform: [{ scale: 1.06 }],
  },
  netflixSecondaryIcon: {
    color: NETFLIX.white,
    fontSize: 18,
    fontWeight: 'bold',
  },
  netflixSecondaryText: {
    color: NETFLIX.white,
    fontSize: 16,
    fontWeight: 'bold',
  },

  sourcesContainer: {
    gap: 24,
  },
  sourceSection: {
    gap: 12,
  },
  sourceSectionTitle: {
    color: '#E5E5E5',
    fontSize: 18,
    fontWeight: 'bold',
    letterSpacing: 0.3,
  },
  cardsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  sourceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: NETFLIX.surface,
    borderRadius: 8,
    overflow: 'hidden',
    width: 245,
    height: 80,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    paddingRight: 16,
  },
  sourceCardFocused: {
    backgroundColor: NETFLIX.surfaceHover,
    borderColor: NETFLIX.white,
    transform: [{ scale: 1.05 }],
  },
  sourceAccentBar: {
    width: 6,
    height: '100%',
  },
  sourceCardBody: {
    flex: 1,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  nyaaTopTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sourceCardLabel: {
    color: NETFLIX.red,
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 0.8,
  },
  ptbrMiniBadge: {
    backgroundColor: 'rgba(70, 211, 105, 0.2)',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 3,
  },
  ptbrMiniBadgeText: {
    color: NETFLIX.matchGreen,
    fontSize: 9,
    fontWeight: 'bold',
  },
  sourceCardTitle: {
    color: NETFLIX.white,
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 2,
  },
  sourceCardSub: {
    color: NETFLIX.textMuted,
    fontSize: 12,
    marginTop: 1,
  },
  sourceCardPlay: {
    color: NETFLIX.white,
    fontSize: 18,
    fontWeight: 'bold',
  },

  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.88)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBox: {
    width: 460,
    backgroundColor: '#181818',
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  modalTitle: {
    color: NETFLIX.white,
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  modalSubtitle: {
    color: NETFLIX.textMuted,
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 28,
  },
  modalButtonsRow: {
    flexDirection: 'row',
    gap: 16,
  },
  modalBtn: {
    paddingVertical: 12,
    paddingHorizontal: 26,
    borderRadius: 6,
    backgroundColor: '#333',
    borderWidth: 2,
    borderColor: 'transparent',
    minWidth: 150,
    alignItems: 'center',
  },
  modalBtnFocused: {
    borderColor: NETFLIX.white,
    transform: [{ scale: 1.06 }],
  },
  modalBtnText: {
    color: NETFLIX.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
});
