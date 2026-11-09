import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Dimensions,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import CamiiVlcPlayerView, {
  CamiiVlcPlayerRef,
  isNativeVlcAvailable,
  VlcScaleType,
  VlcTrack,
  VlcTracksPayload,
} from '../../modules/vlc-player';
import {
  getCurrentPlayerSession,
  openExternalVlcIntent,
  usePlayerSettings,
} from '@/utils/playerSettings';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const useTVEventHandler: (cb: (evt: any) => void) => void = Platform.isTV
  ? // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('react-native').useTVEventHandler
  : () => {};

const SCALE_OPTIONS: { id: VlcScaleType; label: string; desc: string }[] = [
  { id: 'BEST_FIT', label: 'Ajustar à Tela', desc: 'Mantém a proporção original sem cortar (Padrão VLC)' },
  { id: 'FIT_SCREEN', label: 'Preencher (Zoom)', desc: 'Preenche toda a tela mantendo proporção' },
  { id: 'FILL', label: 'Esticar', desc: 'Estica o vídeo para ocupar 100% da tela' },
  { id: '16_9', label: '16:9 Widescreen', desc: 'Força proporção panorâmica 16:9' },
  { id: '4_3', label: '4:3 Clássico', desc: 'Força proporção 4:3 de animes clássicos' },
  { id: 'ORIGINAL', label: 'Original (1:1)', desc: 'Tamanho real dos pixels do vídeo' },
];

const SPEED_OPTIONS: number[] = [0.75, 1.0, 1.25, 1.5, 2.0];

function formatTimeMs(ms: number): string {
  if (!ms || ms < 0 || !isFinite(ms)) return '00:00';
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  if (hours > 0) {
    return `${hours}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${pad(minutes)}:${pad(seconds)}`;
}

export default function InternalVlcPlayerScreen() {
  const router = useRouter();
  const { settings } = usePlayerSettings();
  const playerRef = useRef<CamiiVlcPlayerRef>(null);

  const [session] = useState(() => getCurrentPlayerSession());
  const nativeAvailable = isNativeVlcAvailable();

  // Playback state
  const [paused, setPaused] = useState(false);
  const [isBuffering, setIsBuffering] = useState(true);
  const [bufferingPct, setBufferingPct] = useState(0);
  const [currentTimeMs, setCurrentTimeMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Tracks & VLC options state
  const [audioTracks, setAudioTracks] = useState<VlcTrack[]>([]);
  const [subtitleTracks, setSubtitleTracks] = useState<VlcTrack[]>([]);
  const [selectedAudioId, setSelectedAudioId] = useState<number>(-1);
  const [selectedSubtitleId, setSelectedSubtitleId] = useState<number>(-1);
  const [subtitleDelayMs, setSubtitleDelayMs] = useState<number>(0);
  const [scaleType, setScaleType] = useState<VlcScaleType>('BEST_FIT');
  const [playbackRate, setPlaybackRate] = useState<number>(1.0);
  const [videoDimensions, setVideoDimensions] = useState<{ w: number; h: number }>({ w: 0, h: 0 });

  // UI / OSD state
  const [controlsVisible, setControlsVisible] = useState(true);
  const [timelineFocused, setTimelineFocused] = useState(false);
  const [activeModal, setActiveModal] = useState<'none' | 'subtitles' | 'audio' | 'aspect' | 'speed'>('none');

  // Visual seek feedback indicator (+5s / -5s)
  const [seekFeedback, setSeekFeedback] = useState<{
    visible: boolean;
    AccumulatedDeltaSec: number;
    targetTimeMs: number;
  }>({ visible: false, AccumulatedDeltaSec: 0, targetTimeMs: 0 });

  // Refs for accurate access inside TV event listeners
  const currentTimeRef = useRef(0);
  const durationRef = useRef(0);
  const pausedRef = useRef(false);
  const controlsVisibleRef = useRef(true);
  const timelineFocusedRef = useRef(false);
  const activeModalRef = useRef<'none' | 'subtitles' | 'audio' | 'aspect' | 'speed'>('none');
  const autoAppliedTracksRef = useRef(false);
  const startTimeWallRef = useRef(Date.now());
  const hideControlsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seekFeedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const accumulatedSeekSecRef = useRef(0);

  const seekStepSec = settings.seekStepSeconds || 5;

  useEffect(() => {
    currentTimeRef.current = currentTimeMs;
  }, [currentTimeMs]);

  useEffect(() => {
    durationRef.current = durationMs;
  }, [durationMs]);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  useEffect(() => {
    controlsVisibleRef.current = controlsVisible;
  }, [controlsVisible]);

  useEffect(() => {
    timelineFocusedRef.current = timelineFocused;
  }, [timelineFocused]);

  useEffect(() => {
    activeModalRef.current = activeModal;
  }, [activeModal]);

  const scheduleHideControls = useCallback(() => {
    if (hideControlsTimerRef.current) {
      clearTimeout(hideControlsTimerRef.current);
    }
    hideControlsTimerRef.current = setTimeout(() => {
      if (!pausedRef.current && activeModalRef.current === 'none') {
        setControlsVisible(false);
      }
    }, 4500);
  }, []);

  const showControls = useCallback(() => {
    setControlsVisible(true);
    scheduleHideControls();
  }, [scheduleHideControls]);

  useEffect(() => {
    if (!session?.url) {
      if (router.canGoBack()) router.back();
      return;
    }
    scheduleHideControls();
    return () => {
      if (hideControlsTimerRef.current) clearTimeout(hideControlsTimerRef.current);
      if (seekFeedbackTimerRef.current) clearTimeout(seekFeedbackTimerRef.current);
    };
  }, [session, router, scheduleHideControls]);

  const handleExitPlayer = useCallback(() => {
    const minutesSpent = Math.floor((Date.now() - startTimeWallRef.current) / 60000);
    const progressRatio =
      durationRef.current > 0 ? currentTimeRef.current / durationRef.current : 0;

    if (minutesSpent >= 2 || progressRatio >= 0.75) {
      session?.onShouldPromptWatched?.();
    }
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  }, [router, session]);

  // Perform relative seek (e.g. -5s or +5s) with cumulative visual indicator
  const performSeekBySeconds = useCallback((deltaSeconds: number) => {
    const deltaMs = deltaSeconds * 1000;
    const baseTime = currentTimeRef.current;
    const maxTime = durationRef.current;
    const nextTime =
      maxTime > 0
        ? Math.max(0, Math.min(maxTime, baseTime + deltaMs))
        : Math.max(0, baseTime + deltaMs);

    currentTimeRef.current = nextTime;
    setCurrentTimeMs(nextTime);
    playerRef.current?.seekTo(nextTime);

    accumulatedSeekSecRef.current += deltaSeconds;
    setSeekFeedback({
      visible: true,
      AccumulatedDeltaSec: accumulatedSeekSecRef.current,
      targetTimeMs: nextTime,
    });

    if (seekFeedbackTimerRef.current) {
      clearTimeout(seekFeedbackTimerRef.current);
    }
    seekFeedbackTimerRef.current = setTimeout(() => {
      accumulatedSeekSecRef.current = 0;
      setSeekFeedback((prev) => ({ ...prev, visible: false }));
    }, 1100);
  }, []);

  const togglePlayPause = useCallback(() => {
    const nextPaused = !pausedRef.current;
    pausedRef.current = nextPaused;
    setPaused(nextPaused);
    playerRef.current?.setPaused(nextPaused);
    showControls();
  }, [showControls]);

  // Intercept Android hardware Back button
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (activeModalRef.current !== 'none') {
        setActiveModal('none');
        showControls();
        return true;
      }
      if (controlsVisibleRef.current) {
        setControlsVisible(false);
        return true;
      }
      handleExitPlayer();
      return true;
    });
    return () => sub.remove();
  }, [handleExitPlayer, showControls]);

  // Intercept TV Remote D-Pad events (Left/Right for 5s seek, Up/Down/Select for OSD)
  useTVEventHandler((evt: any) => {
    if (!evt || !evt.eventType) return;
    // Only act on key release (1) or when eventKeyAction is undefined
    if (evt.eventKeyAction !== undefined && evt.eventKeyAction !== 1) return;

    const type = evt.eventType;

    // Keep OSD alive when user navigates while OSD is visible
    if (controlsVisibleRef.current && activeModalRef.current === 'none') {
      scheduleHideControls();
    }

    if (type === 'playPause') {
      togglePlayPause();
      return;
    }

    if (type === 'fastForward') {
      performSeekBySeconds(seekStepSec);
      return;
    }

    if (type === 'rewind') {
      performSeekBySeconds(-seekStepSec);
      return;
    }

    // If a modal is open, let standard React Native focus navigation handle D-Pad
    if (activeModalRef.current !== 'none') {
      return;
    }

    // When OSD is hidden -> D-pad Left/Right immediately seeks -5s / +5s like VLC!
    if (!controlsVisibleRef.current) {
      if (type === 'right') {
        performSeekBySeconds(seekStepSec);
        return;
      }
      if (type === 'left') {
        performSeekBySeconds(-seekStepSec);
        return;
      }
      if (type === 'up' || type === 'down') {
        showControls();
        return;
      }
      if (type === 'select') {
        togglePlayPause();
        return;
      }
    } else if (timelineFocusedRef.current) {
      // When focus is on the progress timeline bar, Left/Right also seeks -5s / +5s!
      if (type === 'right') {
        performSeekBySeconds(seekStepSec);
        return;
      }
      if (type === 'left') {
        performSeekBySeconds(-seekStepSec);
        return;
      }
    }
  });

  // Auto-select preferred subtitle/audio language on first track load
  const handleTracksPayload = useCallback(
    (payload: VlcTracksPayload) => {
      if (payload.duration > 0) {
        setDurationMs(payload.duration);
      }
      if (payload.videoWidth && payload.videoHeight) {
        setVideoDimensions({ w: payload.videoWidth, h: payload.videoHeight });
      }

      const aTracks = Array.isArray(payload.audioTracks) ? payload.audioTracks : [];
      const sTracks = Array.isArray(payload.subtitleTracks) ? payload.subtitleTracks : [];

      setAudioTracks(aTracks);
      setSubtitleTracks(sTracks);
      setSelectedAudioId(payload.selectedAudioTrack);
      setSelectedSubtitleId(payload.selectedSubtitleTrack);

      if (!autoAppliedTracksRef.current && (aTracks.length > 0 || sTracks.length > 0)) {
        autoAppliedTracksRef.current = true;

        // Auto-apply subtitle preference
        if (settings.preferredSubtitleLang === 'off') {
          playerRef.current?.setSubtitleTrack(-1);
          setSelectedSubtitleId(-1);
        } else if (settings.preferredSubtitleLang === 'ptbr' && sTracks.length > 0) {
          const ptTrack = sTracks.find((t) =>
            /portugu|pt-br|ptbr|brasil|brazil|\bpor\b|\bpt\b/i.test(t.name)
          );
          if (ptTrack && ptTrack.id !== payload.selectedSubtitleTrack) {
            playerRef.current?.setSubtitleTrack(ptTrack.id);
            setSelectedSubtitleId(ptTrack.id);
          }
        }

        // Auto-apply audio preference
        if (settings.preferredAudioLang !== 'auto' && aTracks.length > 1) {
          const pattern =
            settings.preferredAudioLang === 'jpn'
              ? /japan|japon|\bjpn\b|\bja\b/i
              : /portugu|pt-br|ptbr|brasil|brazil|\bpor\b|\bdub/i;
          const matchAudio = aTracks.find((t) => pattern.test(t.name));
          if (matchAudio && matchAudio.id !== payload.selectedAudioTrack) {
            playerRef.current?.setAudioTrack(matchAudio.id);
            setSelectedAudioId(matchAudio.id);
          }
        }
      }
    },
    [settings.preferredAudioLang, settings.preferredSubtitleLang]
  );

  const handleSelectSubtitle = (trackId: number) => {
    setSelectedSubtitleId(trackId);
    playerRef.current?.setSubtitleTrack(trackId);
    setActiveModal('none');
    showControls();
  };

  const handleSelectAudio = (trackId: number) => {
    setSelectedAudioId(trackId);
    playerRef.current?.setAudioTrack(trackId);
    setActiveModal('none');
    showControls();
  };

  const handleAdjustSubtitleDelay = (deltaMs: number) => {
    const nextDelay = subtitleDelayMs + deltaMs;
    setSubtitleDelayMs(nextDelay);
    playerRef.current?.setSubtitleDelay(nextDelay);
  };

  const handleSelectScale = (nextScale: VlcScaleType) => {
    setScaleType(nextScale);
    playerRef.current?.setScaleType(nextScale);
    setActiveModal('none');
    showControls();
  };

  const handleSelectSpeed = (nextSpeed: number) => {
    setPlaybackRate(nextSpeed);
    playerRef.current?.setRate(nextSpeed);
    setActiveModal('none');
    showControls();
  };

  const handleOpenExternalVlc = () => {
    if (!session?.url) return;
    setPaused(true);
    playerRef.current?.setPaused(true);
    openExternalVlcIntent(session.url, session.title);
  };

  if (!session) {
    return <View style={styles.container} />;
  }

  const progressFraction =
    durationMs > 0 ? Math.min(1, Math.max(0, currentTimeMs / durationMs)) : 0;
  const remainingMs = Math.max(0, durationMs - currentTimeMs);

  const activeSubtitleLabel =
    selectedSubtitleId === -1
      ? 'Desativada'
      : subtitleTracks.find((t) => t.id === selectedSubtitleId)?.name || 'Padrão';

  const activeAudioLabel =
    audioTracks.find((t) => t.id === selectedAudioId)?.name || 'Padrão';

  const activeScaleLabel =
    SCALE_OPTIONS.find((s) => s.id === scaleType)?.label || 'Ajustar';

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar hidden />

      <View style={styles.container}>
        {/* Camada 1: Superfície Nativa LibVLC (MKV + ASS/SSA Subtitles) */}
        {nativeAvailable ? (
          <CamiiVlcPlayerView
            ref={playerRef}
            style={StyleSheet.absoluteFill}
            source={{
              uri: session.url,
              networkCachingMs: 1800,
              hardwareAcceleration: settings.hardwareAcceleration,
            }}
            paused={paused}
            rate={playbackRate}
            scaleType={scaleType}
            subtitleDelayMs={subtitleDelayMs}
            onLoad={(e) => {
              setIsBuffering(false);
              setErrorMsg(null);
              handleTracksPayload(e.nativeEvent);
            }}
            onTracksChanged={(e) => {
              handleTracksPayload(e.nativeEvent);
            }}
            onProgress={(e) => {
              setCurrentTimeMs(e.nativeEvent.currentTime);
              if (e.nativeEvent.duration > 0) {
                setDurationMs(e.nativeEvent.duration);
              }
              setIsBuffering(false);
            }}
            onPlaying={() => {
              setPaused(false);
              setIsBuffering(false);
            }}
            onPaused={() => {
              setPaused(true);
            }}
            onBuffering={(e) => {
              setBufferingPct(Math.round(e.nativeEvent.buffering || 0));
              setIsBuffering(e.nativeEvent.isBuffering);
            }}
            onEnded={() => {
              session.onShouldPromptWatched?.();
              handleExitPlayer();
            }}
            onError={(e) => {
              setIsBuffering(false);
              setErrorMsg(
                e.nativeEvent?.message ||
                  'Não foi possível reproduzir este arquivo MKV/Stream no player interno.'
              );
              setControlsVisible(true);
            }}
          />
        ) : (
          /* Fallback amigável caso o usuário ainda não tenha recompilado o APK com o módulo nativo */
          <View style={styles.missingNativeContainer}>
            <Ionicons name="film-outline" size={64} color="#FF8800" />
            <Text style={styles.missingNativeTitle}>
              Módulo Nativo LibVLC Pendente no APK
            </Text>
            <Text style={styles.missingNativeText}>
              O código do Player Interno (LibVLC com suporte a MKV e legendas ASS) foi configurado!
              Como ele inclui bibliotecas nativas C++/Android (libvlc-all), é necessário gerar um
              novo APK para que o player interno funcione dentro do aplicativo.
            </Text>
            <View style={styles.missingNativeActions}>
              <Pressable
                hasTVPreferredFocus={true}
                focusable={true}
                onPress={handleOpenExternalVlc}
                style={({ focused, pressed }) => [
                  styles.fallbackBtnPrimary,
                  (focused || pressed) && styles.btnFocused,
                ]}
              >
                <Ionicons name="open-outline" size={20} color="#000" />
                <Text style={styles.fallbackBtnPrimaryText}>
                  Abrir Agora no VLC Externo (Intent)
                </Text>
              </Pressable>

              <Pressable
                focusable={true}
                onPress={handleExitPlayer}
                style={({ focused, pressed }) => [
                  styles.fallbackBtnSecondary,
                  (focused || pressed) && styles.btnFocused,
                ]}
              >
                <Text style={styles.fallbackBtnSecondaryText}>← Voltar</Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* Camada 2: Área invisível para manter o foco na TV quando os controles estão ocultos */}
        {!controlsVisible && nativeAvailable && (
          <Pressable
            hasTVPreferredFocus={true}
            focusable={true}
            onPress={showControls}
            style={StyleSheet.absoluteFill}
          />
        )}

        {/* Camada 3: Indicador de Carregamento / Buffering */}
        {nativeAvailable && isBuffering && !errorMsg && (
          <View style={styles.centerOverlay} pointerEvents="none">
            <View style={styles.bufferingBox}>
              <ActivityIndicator size="large" color="#FF8800" />
              <Text style={styles.bufferingText}>
                {bufferingPct > 0 && bufferingPct < 100
                  ? `Carregando buffer... ${bufferingPct}%`
                  : 'Carregando vídeo e legendas ASS...'}
              </Text>
            </View>
          </View>
        )}

        {/* Camada 4: Feedback Visual de Avanço/Retrocesso (+5s / -5s) estilo VLC */}
        {seekFeedback.visible && (
          <View style={styles.seekFeedbackOverlay} pointerEvents="none">
            <View style={styles.seekFeedbackPill}>
              <Ionicons
                name={
                  seekFeedback.AccumulatedDeltaSec >= 0
                    ? 'play-forward'
                    : 'play-back'
                }
                size={28}
                color="#FF8800"
              />
              <View>
                <Text style={styles.seekFeedbackDelta}>
                  {seekFeedback.AccumulatedDeltaSec > 0
                    ? `+${seekFeedback.AccumulatedDeltaSec}s`
                    : `${seekFeedback.AccumulatedDeltaSec}s`}
                </Text>
                <Text style={styles.seekFeedbackTime}>
                  {formatTimeMs(seekFeedback.targetTimeMs)} / {formatTimeMs(durationMs)}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Camada 5: Erro de Reprodução (com opção de tentar no VLC Externo) */}
        {errorMsg && nativeAvailable && (
          <View style={styles.centerOverlay}>
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle-outline" size={46} color="#EF4444" />
              <Text style={styles.errorTitle}>Erro na Reprodução</Text>
              <Text style={styles.errorDesc}>{errorMsg}</Text>
              <View style={styles.missingNativeActions}>
                <Pressable
                  hasTVPreferredFocus={true}
                  focusable={true}
                  onPress={handleOpenExternalVlc}
                  style={({ focused, pressed }) => [
                    styles.fallbackBtnPrimary,
                    (focused || pressed) && styles.btnFocused,
                  ]}
                >
                  <Text style={styles.fallbackBtnPrimaryText}>
                    Abrir no VLC Externo
                  </Text>
                </Pressable>
                <Pressable
                  focusable={true}
                  onPress={handleExitPlayer}
                  style={({ focused, pressed }) => [
                    styles.fallbackBtnSecondary,
                    (focused || pressed) && styles.btnFocused,
                  ]}
                >
                  <Text style={styles.fallbackBtnSecondaryText}>Voltar</Text>
                </Pressable>
              </View>
            </View>
          </View>
        )}

        {/* Camada 6: OSD Completo Estilo VLC Android TV */}
        {controlsVisible && nativeAvailable && (
          <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
            {/* Topo: Título do Episódio + Info Técnica (MKV / Resolução / ASS) */}
            <LinearGradient
              colors={['rgba(0,0,0,0.88)', 'rgba(0,0,0,0.45)', 'transparent']}
              style={styles.topGradient}
            >
              <View style={styles.topRow}>
                <Pressable
                  focusable={true}
                  onPress={handleExitPlayer}
                  style={({ focused, pressed }) => [
                    styles.topBackBtn,
                    (focused || pressed) && styles.osdBtnFocused,
                  ]}
                >
                  <Ionicons name="arrow-back" size={20} color="#FFF" />
                  <Text style={styles.topBackText}>Sair</Text>
                </Pressable>

                <View style={styles.titleBlock}>
                  {!!session.animeName && (
                    <Text style={styles.animeSeriesText} numberOfLines={1}>
                      {session.animeName}
                    </Text>
                  )}
                  <Text style={styles.videoTitleText} numberOfLines={1}>
                    {session.title}
                  </Text>
                </View>

                <View style={styles.techBadgesRow}>
                  <View style={styles.vlcBrandBadge}>
                    <Ionicons name="play" size={12} color="#FF8800" />
                    <Text style={styles.vlcBrandBadgeText}>LibVLC • ASS/MKV</Text>
                  </View>
                  {videoDimensions.h > 0 && (
                    <View style={styles.resTechBadge}>
                      <Text style={styles.resTechBadgeText}>
                        {videoDimensions.h}p
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            </LinearGradient>

            {/* Base: Barra de Progresso + Controles Estilo VLC */}
            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.72)', 'rgba(0,0,0,0.95)']}
              style={styles.bottomGradient}
            >
              {/* Dica rápida das setas do controle */}
              <View style={styles.remoteHintRow}>
                <Text style={styles.remoteHintText}>
                  💡 Dica: Use as setas ◀ e ▶ do controle para retroceder/avançar {seekStepSec}s a qualquer momento
                </Text>
                {subtitleDelayMs !== 0 && (
                  <Text style={styles.subDelayBadgeText}>
                    Sincronia Legenda: {subtitleDelayMs > 0 ? `+${subtitleDelayMs}ms` : `${subtitleDelayMs}ms`}
                  </Text>
                )}
              </View>

              {/* Barra de Progresso / Seekbar Focável */}
              <Pressable
                focusable={true}
                onFocus={() => setTimelineFocused(true)}
                onBlur={() => setTimelineFocused(false)}
                onPress={togglePlayPause}
                style={({ focused }) => [
                  styles.timelinePressable,
                  focused && styles.timelinePressableFocused,
                ]}
              >
                <Text style={styles.timeText}>{formatTimeMs(currentTimeMs)}</Text>

                <View style={styles.progressBarTrack}>
                  <View
                    style={[
                      styles.progressBarFill,
                      { width: `${progressFraction * 100}%` },
                    ]}
                  />
                  <View
                    style={[
                      styles.progressThumb,
                      { left: `${progressFraction * 100}%` },
                      timelineFocused && styles.progressThumbFocused,
                    ]}
                  />
                </View>

                <Text style={styles.timeText}>
                  -{formatTimeMs(remainingMs)} / {formatTimeMs(durationMs)}
                </Text>
              </Pressable>

              {/* Linha de Botões de Controle Estilo VLC */}
              <View style={styles.controlsRow}>
                {/* Grupo Esquerdo: Navegação de Tempo */}
                <View style={styles.controlsGroup}>
                  <Pressable
                    focusable={true}
                    onPress={() => performSeekBySeconds(-seekStepSec)}
                    style={({ focused, pressed }) => [
                      styles.osdIconBtn,
                      (focused || pressed) && styles.osdBtnFocused,
                    ]}
                  >
                    <Ionicons name="play-back" size={20} color="#FFF" />
                    <Text style={styles.osdBtnSubLabel}>-{seekStepSec}s</Text>
                  </Pressable>

                  <Pressable
                    hasTVPreferredFocus={true}
                    focusable={true}
                    onPress={togglePlayPause}
                    style={({ focused, pressed }) => [
                      styles.playPauseMainBtn,
                      (focused || pressed) && styles.playPauseMainBtnFocused,
                    ]}
                  >
                    <Ionicons
                      name={paused ? 'play' : 'pause'}
                      size={26}
                      color="#000"
                    />
                  </Pressable>

                  <Pressable
                    focusable={true}
                    onPress={() => performSeekBySeconds(seekStepSec)}
                    style={({ focused, pressed }) => [
                      styles.osdIconBtn,
                      (focused || pressed) && styles.osdBtnFocused,
                    ]}
                  >
                    <Ionicons name="play-forward" size={20} color="#FFF" />
                    <Text style={styles.osdBtnSubLabel}>+{seekStepSec}s</Text>
                  </Pressable>

                  <Pressable
                    focusable={true}
                    onPress={() => performSeekBySeconds(85)}
                    style={({ focused, pressed }) => [
                      styles.osdPillBtn,
                      (focused || pressed) && styles.osdBtnFocused,
                    ]}
                  >
                    <Ionicons name="play-skip-forward" size={16} color="#FF8800" />
                    <Text style={styles.osdPillBtnText}>+85s OP</Text>
                  </Pressable>
                </View>

                {/* Grupo Direito: Opções VLC (Legendas ASS, Áudio, Proporção, Velocidade, VLC Externo) */}
                <View style={styles.controlsGroup}>
                  <Pressable
                    focusable={true}
                    onPress={() => setActiveModal('subtitles')}
                    style={({ focused, pressed }) => [
                      styles.osdOptionBtn,
                      (focused || pressed) && styles.osdBtnFocused,
                    ]}
                  >
                    <Ionicons name="chatbox-ellipses-outline" size={18} color="#FF8800" />
                    <View>
                      <Text style={styles.osdOptionLabel}>Legendas</Text>
                      <Text style={styles.osdOptionValue} numberOfLines={1}>
                        {activeSubtitleLabel}
                      </Text>
                    </View>
                  </Pressable>

                  <Pressable
                    focusable={true}
                    onPress={() => setActiveModal('audio')}
                    style={({ focused, pressed }) => [
                      styles.osdOptionBtn,
                      (focused || pressed) && styles.osdBtnFocused,
                    ]}
                  >
                    <Ionicons name="volume-high-outline" size={18} color="#3399FF" />
                    <View>
                      <Text style={styles.osdOptionLabel}>Áudio</Text>
                      <Text style={styles.osdOptionValue} numberOfLines={1}>
                        {activeAudioLabel}
                      </Text>
                    </View>
                  </Pressable>

                  <Pressable
                    focusable={true}
                    onPress={() => setActiveModal('aspect')}
                    style={({ focused, pressed }) => [
                      styles.osdOptionBtn,
                      (focused || pressed) && styles.osdBtnFocused,
                    ]}
                  >
                    <Ionicons name="scan-outline" size={18} color="#10B981" />
                    <View>
                      <Text style={styles.osdOptionLabel}>Tela</Text>
                      <Text style={styles.osdOptionValue} numberOfLines={1}>
                        {activeScaleLabel}
                      </Text>
                    </View>
                  </Pressable>

                  <Pressable
                    focusable={true}
                    onPress={() => setActiveModal('speed')}
                    style={({ focused, pressed }) => [
                      styles.osdOptionBtn,
                      (focused || pressed) && styles.osdBtnFocused,
                    ]}
                  >
                    <Ionicons name="speedometer-outline" size={18} color="#A855F7" />
                    <View>
                      <Text style={styles.osdOptionLabel}>Velocidade</Text>
                      <Text style={styles.osdOptionValue}>{playbackRate}x</Text>
                    </View>
                  </Pressable>

                  <Pressable
                    focusable={true}
                    onPress={handleOpenExternalVlc}
                    style={({ focused, pressed }) => [
                      styles.osdIconBtn,
                      (focused || pressed) && styles.osdBtnFocused,
                    ]}
                  >
                    <Ionicons name="open-outline" size={18} color="#FF8800" />
                    <Text style={styles.osdBtnSubLabel}>VLC App</Text>
                  </Pressable>
                </View>
              </View>
            </LinearGradient>
          </View>
        )}

        {/* MODAL 1: Seleção de Legendas (ASS / SSA / SRT) + Sincronia */}
        <Modal
          visible={activeModal === 'subtitles'}
          transparent
          animationType="fade"
          onRequestClose={() => setActiveModal('none')}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalPanel}>
              <View style={styles.modalHeader}>
                <View style={styles.modalHeaderTitleRow}>
                  <Ionicons name="chatbox-ellipses" size={22} color="#FF8800" />
                  <Text style={styles.modalTitle}>
                    Legendas (ASS / SSA / SRT)
                  </Text>
                </View>
                <Pressable
                  focusable={true}
                  onPress={() => setActiveModal('none')}
                  style={({ focused }) => [
                    styles.modalCloseBtn,
                    focused && styles.osdBtnFocused,
                  ]}
                >
                  <Text style={styles.modalCloseText}>Fechar</Text>
                </Pressable>
              </View>

              {/* Ajuste de Atraso/Sincronia de Legenda estilo VLC */}
              <View style={styles.syncRow}>
                <Text style={styles.syncLabel}>
                  Atraso da Legenda: {subtitleDelayMs > 0 ? `+${subtitleDelayMs}ms` : `${subtitleDelayMs}ms`}
                </Text>
                <View style={styles.syncBtns}>
                  <Pressable
                    focusable={true}
                    onPress={() => handleAdjustSubtitleDelay(-250)}
                    style={({ focused }) => [
                      styles.syncSmallBtn,
                      focused && styles.osdBtnFocused,
                    ]}
                  >
                    <Text style={styles.syncSmallBtnText}>-0.25s</Text>
                  </Pressable>
                  <Pressable
                    focusable={true}
                    onPress={() => {
                      setSubtitleDelayMs(0);
                      playerRef.current?.setSubtitleDelay(0);
                    }}
                    style={({ focused }) => [
                      styles.syncSmallBtn,
                      focused && styles.osdBtnFocused,
                    ]}
                  >
                    <Text style={styles.syncSmallBtnText}>Zerar</Text>
                  </Pressable>
                  <Pressable
                    focusable={true}
                    onPress={() => handleAdjustSubtitleDelay(250)}
                    style={({ focused }) => [
                      styles.syncSmallBtn,
                      focused && styles.osdBtnFocused,
                    ]}
                  >
                    <Text style={styles.syncSmallBtnText}>+0.25s</Text>
                  </Pressable>
                </View>
              </View>

              <ScrollView style={styles.trackList}>
                {/* Opção explícita para desativar legendas caso não venha na lista */}
                {!subtitleTracks.some((t) => t.id === -1) && (
                  <Pressable
                    hasTVPreferredFocus={selectedSubtitleId === -1}
                    focusable={true}
                    onPress={() => handleSelectSubtitle(-1)}
                    style={({ focused, pressed }) => [
                      styles.trackItem,
                      selectedSubtitleId === -1 && styles.trackItemSelected,
                      (focused || pressed) && styles.trackItemFocused,
                    ]}
                  >
                    <Text style={styles.trackItemText}>Desativar Legendas</Text>
                    {selectedSubtitleId === -1 && (
                      <Ionicons name="checkmark-circle" size={20} color="#FF8800" />
                    )}
                  </Pressable>
                )}

                {subtitleTracks.length === 0 ? (
                  <Text style={styles.emptyTracksText}>
                    Nenhuma faixa de legenda embutida detectada neste vídeo.
                  </Text>
                ) : (
                  subtitleTracks.map((track, idx) => {
                    const isSelected = track.id === selectedSubtitleId;
                    return (
                      <Pressable
                        key={`sub-${track.id}-${idx}`}
                        hasTVPreferredFocus={isSelected || idx === 0}
                        focusable={true}
                        onPress={() => handleSelectSubtitle(track.id)}
                        style={({ focused, pressed }) => [
                          styles.trackItem,
                          isSelected && styles.trackItemSelected,
                          (focused || pressed) && styles.trackItemFocused,
                        ]}
                      >
                        <Text style={styles.trackItemText}>
                          {track.id === -1 ? 'Desativar Legendas' : track.name}
                        </Text>
                        {isSelected && (
                          <Ionicons name="checkmark-circle" size={20} color="#FF8800" />
                        )}
                      </Pressable>
                    );
                  })
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* MODAL 2: Seleção de Faixa de Áudio */}
        <Modal
          visible={activeModal === 'audio'}
          transparent
          animationType="fade"
          onRequestClose={() => setActiveModal('none')}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalPanel}>
              <View style={styles.modalHeader}>
                <View style={styles.modalHeaderTitleRow}>
                  <Ionicons name="volume-high" size={22} color="#3399FF" />
                  <Text style={styles.modalTitle}>Faixas de Áudio</Text>
                </View>
                <Pressable
                  focusable={true}
                  onPress={() => setActiveModal('none')}
                  style={({ focused }) => [
                    styles.modalCloseBtn,
                    focused && styles.osdBtnFocused,
                  ]}
                >
                  <Text style={styles.modalCloseText}>Fechar</Text>
                </Pressable>
              </View>

              <ScrollView style={styles.trackList}>
                {audioTracks.length === 0 ? (
                  <Text style={styles.emptyTracksText}>
                    Apenas a faixa de áudio padrão está disponível.
                  </Text>
                ) : (
                  audioTracks.map((track, idx) => {
                    const isSelected = track.id === selectedAudioId;
                    return (
                      <Pressable
                        key={`aud-${track.id}-${idx}`}
                        hasTVPreferredFocus={isSelected || idx === 0}
                        focusable={true}
                        onPress={() => handleSelectAudio(track.id)}
                        style={({ focused, pressed }) => [
                          styles.trackItem,
                          isSelected && styles.trackItemSelected,
                          (focused || pressed) && styles.trackItemFocused,
                        ]}
                      >
                        <Text style={styles.trackItemText}>
                          {track.id === -1 ? 'Sem Áudio (Mudo)' : track.name}
                        </Text>
                        {isSelected && (
                          <Ionicons name="checkmark-circle" size={20} color="#3399FF" />
                        )}
                      </Pressable>
                    );
                  })
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* MODAL 3: Proporção de Tela / Escala de Vídeo (VLC Aspect Ratio) */}
        <Modal
          visible={activeModal === 'aspect'}
          transparent
          animationType="fade"
          onRequestClose={() => setActiveModal('none')}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalPanel}>
              <View style={styles.modalHeader}>
                <View style={styles.modalHeaderTitleRow}>
                  <Ionicons name="scan" size={22} color="#10B981" />
                  <Text style={styles.modalTitle}>Proporção de Tela</Text>
                </View>
                <Pressable
                  focusable={true}
                  onPress={() => setActiveModal('none')}
                  style={({ focused }) => [
                    styles.modalCloseBtn,
                    focused && styles.osdBtnFocused,
                  ]}
                >
                  <Text style={styles.modalCloseText}>Fechar</Text>
                </Pressable>
              </View>

              <ScrollView style={styles.trackList}>
                {SCALE_OPTIONS.map((opt) => {
                  const isSelected = opt.id === scaleType;
                  return (
                    <Pressable
                      key={opt.id}
                      hasTVPreferredFocus={isSelected}
                      focusable={true}
                      onPress={() => handleSelectScale(opt.id)}
                      style={({ focused, pressed }) => [
                        styles.trackItem,
                        isSelected && styles.trackItemSelected,
                        (focused || pressed) && styles.trackItemFocused,
                      ]}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={styles.trackItemText}>{opt.label}</Text>
                        <Text style={styles.trackItemSubText}>{opt.desc}</Text>
                      </View>
                      {isSelected && (
                        <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                      )}
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* MODAL 4: Velocidade de Reprodução */}
        <Modal
          visible={activeModal === 'speed'}
          transparent
          animationType="fade"
          onRequestClose={() => setActiveModal('none')}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalPanel}>
              <View style={styles.modalHeader}>
                <View style={styles.modalHeaderTitleRow}>
                  <Ionicons name="speedometer" size={22} color="#A855F7" />
                  <Text style={styles.modalTitle}>Velocidade de Reprodução</Text>
                </View>
                <Pressable
                  focusable={true}
                  onPress={() => setActiveModal('none')}
                  style={({ focused }) => [
                    styles.modalCloseBtn,
                    focused && styles.osdBtnFocused,
                  ]}
                >
                  <Text style={styles.modalCloseText}>Fechar</Text>
                </Pressable>
              </View>

              <ScrollView style={styles.trackList}>
                {SPEED_OPTIONS.map((spd) => {
                  const isSelected = spd === playbackRate;
                  return (
                    <Pressable
                      key={`spd-${spd}`}
                      hasTVPreferredFocus={isSelected}
                      focusable={true}
                      onPress={() => handleSelectSpeed(spd)}
                      style={({ focused, pressed }) => [
                        styles.trackItem,
                        isSelected && styles.trackItemSelected,
                        (focused || pressed) && styles.trackItemFocused,
                      ]}
                    >
                      <Text style={styles.trackItemText}>
                        {spd === 1.0 ? '1.0x (Velocidade Normal)' : `${spd}x`}
                      </Text>
                      {isSelected && (
                        <Ionicons name="checkmark-circle" size={20} color="#A855F7" />
                      )}
                    </Pressable>
                  );
                })}
              </ScrollView>
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
    backgroundColor: '#000000',
  },
  centerOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bufferingBox: {
    backgroundColor: 'rgba(15, 17, 23, 0.85)',
    paddingVertical: 18,
    paddingHorizontal: 28,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 136, 0, 0.35)',
    gap: 10,
  },
  bufferingText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  seekFeedbackOverlay: {
    position: 'absolute',
    top: '38%',
    alignSelf: 'center',
    zIndex: 30,
  },
  seekFeedbackPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: 'rgba(15, 17, 23, 0.92)',
    paddingVertical: 14,
    paddingHorizontal: 26,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: '#FF8800',
  },
  seekFeedbackDelta: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '900',
  },
  seekFeedbackTime: {
    color: '#D1D5DB',
    fontSize: 13,
    fontWeight: '600',
  },

  // Top Bar OSD
  topGradient: {
    paddingTop: 28,
    paddingBottom: 36,
    paddingHorizontal: 42,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  topBackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  topBackText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  titleBlock: {
    flex: 1,
    marginHorizontal: 12,
  },
  animeSeriesText: {
    color: '#FF8800',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  videoTitleText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
  },
  techBadgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  vlcBrandBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 136, 0, 0.18)',
    borderWidth: 1,
    borderColor: '#FF8800',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  vlcBrandBadgeText: {
    color: '#FF8800',
    fontSize: 11,
    fontWeight: '800',
  },
  resTechBadge: {
    backgroundColor: 'rgba(51, 153, 255, 0.2)',
    borderWidth: 1,
    borderColor: '#3399FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  resTechBadgeText: {
    color: '#3399FF',
    fontSize: 11,
    fontWeight: '800',
  },

  // Bottom Bar OSD
  bottomGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 36,
    paddingBottom: 28,
    paddingHorizontal: 42,
  },
  remoteHintRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  remoteHintText: {
    color: '#9CA3AF',
    fontSize: 12,
  },
  subDelayBadgeText: {
    color: '#FBBF24',
    fontSize: 12,
    fontWeight: 'bold',
  },
  timelinePressable: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: 'transparent',
    marginBottom: 14,
  },
  timelinePressableFocused: {
    backgroundColor: 'rgba(255, 136, 0, 0.14)',
    borderColor: '#FF8800',
  },
  timeText: {
    color: '#E5E7EB',
    fontSize: 13,
    fontWeight: '700',
    minWidth: 65,
  },
  progressBarTrack: {
    flex: 1,
    height: 7,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    borderRadius: 4,
    justifyContent: 'center',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#FF8800',
    borderRadius: 4,
  },
  progressThumb: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#FFFFFF',
    marginLeft: -7,
  },
  progressThumbFocused: {
    width: 18,
    height: 18,
    borderRadius: 9,
    marginLeft: -9,
    backgroundColor: '#FF8800',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },

  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 12,
  },
  controlsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  playPauseMainBtn: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#FF8800',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'transparent',
  },
  playPauseMainBtnFocused: {
    backgroundColor: '#FFA333',
    borderColor: '#FFFFFF',
    transform: [{ scale: 1.08 }],
  },
  osdIconBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: 'transparent',
    minWidth: 62,
  },
  osdBtnSubLabel: {
    color: '#D1D5DB',
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
  },
  osdPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 136, 0, 0.15)',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: 'rgba(255, 136, 0, 0.4)',
  },
  osdPillBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  osdOptionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(20, 22, 29, 0.88)',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    maxWidth: 185,
  },
  osdOptionLabel: {
    color: '#9CA3AF',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  osdOptionValue: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
    maxWidth: 120,
  },
  osdBtnFocused: {
    borderColor: '#FFFFFF',
    backgroundColor: 'rgba(255, 136, 0, 0.28)',
    transform: [{ scale: 1.06 }],
  },

  // Modals (Subtitles / Audio / Aspect / Speed)
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.78)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalPanel: {
    width: Math.min(SCREEN_WIDTH * 0.58, 560),
    maxHeight: '78%',
    backgroundColor: '#14161D',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  modalHeaderTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 19,
    fontWeight: 'bold',
  },
  modalCloseBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  modalCloseText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: 'bold',
  },
  syncRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    marginBottom: 14,
  },
  syncLabel: {
    color: '#D1D5DB',
    fontSize: 13,
    fontWeight: '600',
  },
  syncBtns: {
    flexDirection: 'row',
    gap: 8,
  },
  syncSmallBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  syncSmallBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  trackList: {
    maxHeight: 340,
  },
  trackItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderRadius: 10,
    marginBottom: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  trackItemSelected: {
    backgroundColor: 'rgba(255, 136, 0, 0.15)',
    borderColor: 'rgba(255, 136, 0, 0.5)',
  },
  trackItemFocused: {
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    borderColor: '#FFFFFF',
  },
  trackItemText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  trackItemSubText: {
    color: '#9CA3AF',
    fontSize: 12,
    marginTop: 2,
  },
  emptyTracksText: {
    color: '#9CA3AF',
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 24,
  },

  // Missing native module / error fallback
  missingNativeContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 60,
    backgroundColor: '#0B0B0C',
  },
  missingNativeTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 10,
    textAlign: 'center',
  },
  missingNativeText: {
    color: '#9CA3AF',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    maxWidth: 560,
    marginBottom: 28,
  },
  missingNativeActions: {
    flexDirection: 'row',
    gap: 14,
  },
  fallbackBtnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FF8800',
    paddingVertical: 13,
    paddingHorizontal: 24,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  fallbackBtnPrimaryText: {
    color: '#000000',
    fontSize: 15,
    fontWeight: 'bold',
  },
  fallbackBtnSecondary: {
    backgroundColor: '#262936',
    paddingVertical: 13,
    paddingHorizontal: 24,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  fallbackBtnSecondaryText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: 'bold',
  },
  btnFocused: {
    borderColor: '#FFFFFF',
    transform: [{ scale: 1.06 }],
  },
  errorBox: {
    backgroundColor: '#14161D',
    padding: 28,
    borderRadius: 16,
    alignItems: 'center',
    maxWidth: 480,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
  },
  errorTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 10,
    marginBottom: 6,
  },
  errorDesc: {
    color: '#9CA3AF',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 22,
  },
});
