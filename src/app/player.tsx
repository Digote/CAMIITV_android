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
import api from '@/services/api';

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

  // Stream URL & retry state (handles Webtor cold-start on 1st execution)
  const [activeStreamUrl, setActiveStreamUrl] = useState<string>(() => session?.url || '');
  const [retryCount, setRetryCount] = useState<number>(0);
  const [resumeFromMs, setResumeFromMs] = useState<number>(0);
  const [loadingElapsedSec, setLoadingElapsedSec] = useState<number>(0);
  const [isRefreshingLink, setIsRefreshingLink] = useState<boolean>(false);

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
  const [activeModal, setActiveModal] = useState<'none' | 'subtitles' | 'audio' | 'aspect' | 'speed' | 'more'>('none');
  const [currentClock, setCurrentClock] = useState(() => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  });

  // Estado de scrubbing / busca na timeline (avanço de 1 em 1 minuto com debounce antes de reproduzir)
  const [scrubbingTimeMs, setScrubbingTimeMs] = useState<number | null>(null);
  const scrubbingTimeRef = useRef<number | null>(null);
  const scrubbingDebounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Atualiza o relógio no topo a cada 10 segundos
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentClock(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`);
    };
    const interval = setInterval(updateTime, 10000);
    return () => clearInterval(interval);
  }, []);

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
  const activeModalRef = useRef<'none' | 'subtitles' | 'audio' | 'aspect' | 'speed' | 'more'>('none');
  const autoAppliedTracksRef = useRef(false);
  const hasStartedPlaybackRef = useRef(false);
  const startTimeWallRef = useRef(Date.now());
  const hideControlsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seekFeedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const accumulatedSeekSecRef = useRef(0);

  // Seek em andamento: alvo pedido ao player nativo ainda não confirmado (onSeekComplete).
  // Cliques seguidos acumulam a partir deste alvo, e não da posição antiga reportada pelo libVLC.
  const pendingSeekTargetRef = useRef<number | null>(null);
  const seekSafetyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isSeeking, setIsSeeking] = useState(false);

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
    // Com os controles ocultos o tempo atual só é mantido no ref (evita re-render a cada 200ms);
    // ao exibir o OSD, sincroniza o estado para a barra mostrar a posição correta.
    setCurrentTimeMs(currentTimeRef.current);
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
      if (scrubbingDebounceTimerRef.current) clearTimeout(scrubbingDebounceTimerRef.current);
      if (seekSafetyTimerRef.current) clearTimeout(seekSafetyTimerRef.current);
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

  const clearPendingSeek = useCallback(() => {
    pendingSeekTargetRef.current = null;
    if (seekSafetyTimerRef.current) {
      clearTimeout(seekSafetyTimerRef.current);
      seekSafetyTimerRef.current = null;
    }
    setIsSeeking(false);
  }, []);

  // Ponto único de seek absoluto (±5s, scrub da timeline e clique na barra).
  // Marca o alvo como pendente até o nativo confirmar via onSeekComplete.
  const requestSeek = useCallback(
    (targetMs: number) => {
      const maxTime = durationRef.current;
      const target =
        maxTime > 0 ? Math.max(0, Math.min(maxTime, targetMs)) : Math.max(0, targetMs);

      pendingSeekTargetRef.current = target;
      currentTimeRef.current = target;
      setCurrentTimeMs(target);
      setIsSeeking(true);
      playerRef.current?.seekTo(target);

      // Rede de segurança: o nativo libera o seek em até 10s; se nenhum evento chegar
      // (ex.: vídeo pausado), libera aqui. currentTimeRef já guarda o alvo, então a
      // acumulação dos próximos cliques continua correta.
      if (seekSafetyTimerRef.current) clearTimeout(seekSafetyTimerRef.current);
      seekSafetyTimerRef.current = setTimeout(() => {
        pendingSeekTargetRef.current = null;
        seekSafetyTimerRef.current = null;
        setIsSeeking(false);
      }, 12000);

      return target;
    },
    []
  );

  // Aplica o seek efetivo após soltar as teclas de avanço na barra (debounce de 900ms)
  const commitTimelineScrub = useCallback(() => {
    if (scrubbingDebounceTimerRef.current) {
      clearTimeout(scrubbingDebounceTimerRef.current);
    }
    scrubbingDebounceTimerRef.current = setTimeout(() => {
      const targetTime = scrubbingTimeRef.current;
      if (targetTime !== null) {
        requestSeek(targetTime);
        scrubbingTimeRef.current = null;
        setScrubbingTimeMs(null);
      }
    }, 900);
  }, [requestSeek]);

  // Ajusta a posição da barra em 1 minuto (+60s ou -60s) sem pular o vídeo na hora
  const adjustTimelineScrub = useCallback(
    (deltaSeconds: number) => {
      const maxTime = durationRef.current;
      const baseTime =
        scrubbingTimeRef.current !== null
          ? scrubbingTimeRef.current
          : currentTimeRef.current;
      const deltaMs = deltaSeconds * 1000;
      const nextTime =
        maxTime > 0
          ? Math.max(0, Math.min(maxTime, baseTime + deltaMs))
          : Math.max(0, baseTime + deltaMs);

      scrubbingTimeRef.current = nextTime;
      setScrubbingTimeMs(nextTime);

      showControls();
      commitTimelineScrub();
    },
    [commitTimelineScrub, showControls]
  );

  // Perform relative seek (e.g. -5s or +5s) with cumulative visual indicator
  const performSeekBySeconds = useCallback((deltaSeconds: number) => {
    // Cliques rápidos acumulam a partir do alvo ainda pendente
    const baseTime = pendingSeekTargetRef.current ?? currentTimeRef.current;
    const nextTime = requestSeek(baseTime + deltaSeconds * 1000);

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
  }, [requestSeek]);

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

  // Intercept TV Remote D-Pad events (Left/Right for seek, Up/Down/Select for OSD)
  useTVEventHandler((evt: any) => {
    if (!evt || !evt.eventType) return;

    // Reconhece tanto eventos com eventKeyAction (1 = up/release, 0 = down) quanto undefined
    const isKeyDown = evt.eventKeyAction === 0;
    const isKeyUp = evt.eventKeyAction === 1 || evt.eventKeyAction === undefined;
    const type = evt.eventType;

    // Se um modal de configuração estiver aberto, deixa a navegação nativa operar
    if (activeModalRef.current !== 'none') {
      return;
    }

    // Ações para playPause / avanço dedicado do controle
    if (isKeyUp && type === 'playPause') {
      togglePlayPause();
      return;
    }
    if (isKeyUp && type === 'fastForward') {
      performSeekBySeconds(seekStepSec);
      return;
    }
    if (isKeyUp && type === 'rewind') {
      performSeekBySeconds(-seekStepSec);
      return;
    }

    // 1. QUANDO OS BOTÕES ESTÃO ESCONDIDOS (Controles ocultos):
    // Pressionar Direita/Esquerda retrocede ou avança imediatamente 5s no vídeo!
    if (!controlsVisibleRef.current) {
      if (isKeyUp && (type === 'right' || type === 'swipeRight')) {
        performSeekBySeconds(seekStepSec);
        return;
      }
      if (isKeyUp && (type === 'left' || type === 'swipeLeft')) {
        performSeekBySeconds(-seekStepSec);
        return;
      }
      if (isKeyUp && (type === 'up' || type === 'down' || type === 'select')) {
        showControls();
        return;
      }
    } else {
      // 2. QUANDO OS CONTROLES ESTÃO VISÍVEIS:
      scheduleHideControls();

      // Se o foco estiver especificamente na BARRA DE PROGRESSO (timeline):
      // As setas Direita/Esquerda agora alteram a barra de 1 em 1 minuto (+60s / -60s)
      // segurando ou clicando, esperando 900ms antes de reproduzir onde parou!
      if (timelineFocusedRef.current && isKeyUp) {
        if (type === 'right' || type === 'swipeRight') {
          adjustTimelineScrub(60);
          return;
        }
        if (type === 'left' || type === 'swipeLeft') {
          adjustTimelineScrub(-60);
          return;
        }
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
    const targetUrl = activeStreamUrl || session?.url;
    if (!targetUrl || !session) return;
    setPaused(true);
    playerRef.current?.setPaused(true);
    openExternalVlcIntent(targetUrl, session.title);
  };

  // Recarrega o stream (e revalida o link no Webtor se for episódio Nyaa/Webtor)
  const handleRetryPlayback = useCallback(
    async (useAlternativeHls?: boolean) => {
      if (!session) return;

      const savedPos = currentTimeRef.current > 2000 ? currentTimeRef.current : 0;
      clearPendingSeek();
      setResumeFromMs(savedPos);
      setErrorMsg(null);
      setIsBuffering(true);
      setBufferingPct(0);
      setLoadingElapsedSec(0);
      setPaused(false);
      pausedRef.current = false;

      if (useAlternativeHls && session.fallbackStreamUrl) {
        setActiveStreamUrl(session.fallbackStreamUrl);
        setRetryCount((prev) => prev + 1);
        return;
      }

      if (session.nyaaOptionId) {
        setIsRefreshingLink(true);
        try {
          const response = await api.get(
            `/nyaa/episodio/${session.nyaaOptionId}/stream`,
            { timeout: 12000 }
          );
          const freshUrl =
            response.data?.link ||
            response.data?.download_url ||
            response.data?.stream_url;
          if (freshUrl) {
            setActiveStreamUrl(freshUrl);
          }
        } catch {
          // Mantém a URL atual caso a renovação falhe
        } finally {
          setIsRefreshingLink(false);
        }
      }

      setRetryCount((prev) => prev + 1);
    },
    [session, clearPendingSeek]
  );

  // Watchdog de carregamento: evita ficar carregando infinitamente quando o Webtor está frio na 1ª execução
  useEffect(() => {
    if (!nativeAvailable || !isBuffering || errorMsg || paused) {
      setLoadingElapsedSec(0);
      return;
    }

    const interval = setInterval(() => {
      setLoadingElapsedSec((prev) => {
        const next = prev + 1;
        if (!hasStartedPlaybackRef.current && next >= 18) {
          setIsBuffering(false);
          setPaused(true);
          playerRef.current?.setPaused(true);
          setErrorMsg(
            'O vídeo demorou para responder na primeira execução (o servidor Webtor ainda estava preparando o torrent). Clique em Tentar Novamente para carregar.'
          );
          setControlsVisible(true);
        }
        return next;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [nativeAvailable, isBuffering, errorMsg, paused, retryCount]);

  if (!session) {
    return <View style={styles.container} />;
  }

  const displayedTimeMs = scrubbingTimeMs !== null ? scrubbingTimeMs : currentTimeMs;
  const progressFraction =
    durationMs > 0 ? Math.min(1, Math.max(0, displayedTimeMs / durationMs)) : 0;
  const remainingMs = Math.max(0, durationMs - displayedTimeMs);

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
            key={`vlc-instance-${retryCount}`}
            ref={playerRef}
            style={StyleSheet.absoluteFill}
            source={{
              uri: activeStreamUrl || session.url,
              networkCachingMs: 2500,
              hardwareAcceleration: settings.hardwareAcceleration,
              startPositionMs: resumeFromMs,
              retryCount,
            }}
            paused={paused}
            rate={playbackRate}
            scaleType={scaleType}
            subtitleDelayMs={subtitleDelayMs}
            onLoad={(e) => {
              hasStartedPlaybackRef.current = true;
              setIsBuffering(false);
              setLoadingElapsedSec(0);
              setErrorMsg(null);
              handleTracksPayload(e.nativeEvent);
            }}
            onTracksChanged={(e) => {
              handleTracksPayload(e.nativeEvent);
            }}
            onProgress={(e) => {
              if (e.nativeEvent.currentTime > 0 || e.nativeEvent.duration > 0) {
                hasStartedPlaybackRef.current = true;
              }
              // Enquanto um seek não é confirmado pelo nativo (onSeekComplete), ignora o progresso
              // para não "puxar" a posição de volta e não usar uma base antiga no próximo clique.
              if (e.nativeEvent.seeking || pendingSeekTargetRef.current !== null) {
                return;
              }
              currentTimeRef.current = e.nativeEvent.currentTime;
              // Só re-renderiza a tela a cada progresso quando o OSD está visível
              if (controlsVisibleRef.current) {
                setCurrentTimeMs(e.nativeEvent.currentTime);
              }
              if (e.nativeEvent.duration > 0) {
                setDurationMs(e.nativeEvent.duration);
              }
              setIsBuffering(false);
              setLoadingElapsedSec(0);
            }}
            onSeekComplete={(e) => {
              clearPendingSeek();
              currentTimeRef.current = e.nativeEvent.currentTime;
              setCurrentTimeMs(e.nativeEvent.currentTime);
              if (e.nativeEvent.duration > 0) {
                setDurationMs(e.nativeEvent.duration);
              }
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
              // Se o stream fechar com duração 0 sem ter reproduzido nada (comum na 1ª execução fria do Webtor),
              // não sai do player — exibe a tela de erro com botão para Tentar Novamente!
              if (
                !hasStartedPlaybackRef.current &&
                durationRef.current <= 0 &&
                currentTimeRef.current <= 0
              ) {
                setIsBuffering(false);
                setErrorMsg(
                  'O servidor Webtor encerrou a primeira tentativa enquanto preparava o torrent. Clique em Tentar Novamente para reproduzir.'
                );
                setControlsVisible(true);
                return;
              }
              session.onShouldPromptWatched?.();
              handleExitPlayer();
            }}
            onError={(e) => {
              setIsBuffering(false);
              setErrorMsg(
                e.nativeEvent?.message ||
                  'Não foi possível carregar o stream de vídeo na primeira tentativa. Clique em Tentar Novamente.'
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
          >
            {/* Invisível, apenas retém foco no Android TV */}
            <View style={{ width: 1, height: 1 }} />
          </Pressable>
        )}

        {/* Camada 3: Indicador de Carregamento / Buffering (com botão Tentar Novamente se demorar > 5s) */}
        {nativeAvailable && isBuffering && !errorMsg && (
          <View
            style={styles.centerOverlay}
            pointerEvents={loadingElapsedSec >= 5 ? 'box-none' : 'none'}
          >
            <View style={styles.bufferingBox}>
              <ActivityIndicator size="large" color="#FF8800" />
              <Text style={styles.bufferingText}>
                {isRefreshingLink
                  ? 'Renovando conexão com o Webtor...'
                  : isSeeking
                  ? 'Buscando posição...'
                  : bufferingPct > 0 && bufferingPct < 100
                  ? `Carregando buffer... ${bufferingPct}%`
                  : 'Carregando vídeo e legendas ASS...'}
              </Text>
              {loadingElapsedSec >= 5 && (
                <>
                  <Text style={styles.bufferingSubText}>
                    {loadingElapsedSec >= 10
                      ? `O Webtor pode demorar na 1ª execução (${loadingElapsedSec}s). Você já pode recarregar o stream:`
                      : `Aguardando resposta do stream (${loadingElapsedSec}s)...`}
                  </Text>
                  <View style={styles.loadingRetryRow}>
                    <Pressable
                      // Só puxa o foco no carregamento inicial. Depois que o vídeo já tocou
                      // (buffering de um seek), roubar o foco fazia um OK no controle recriar
                      // o player do zero (~30s de tela preta no logcat).
                      hasTVPreferredFocus={!hasStartedPlaybackRef.current}
                      focusable={true}
                      onPress={() => handleRetryPlayback(false)}
                      style={({ focused, pressed }) => [
                        styles.fallbackBtnPrimary,
                        (focused || pressed) && styles.btnFocused,
                      ]}
                    >
                      <Ionicons name="refresh" size={18} color="#000" />
                      <Text style={styles.fallbackBtnPrimaryText}>
                        Tentar Novamente
                      </Text>
                    </Pressable>

                    <Pressable
                      focusable={true}
                      onPress={handleOpenExternalVlc}
                      style={({ focused, pressed }) => [
                        styles.fallbackBtnSecondary,
                        (focused || pressed) && styles.btnFocused,
                      ]}
                    >
                      <Text style={styles.fallbackBtnSecondaryText}>
                        VLC Externo
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
                </>
              )}
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

        {/* Camada 5: Erro de Reprodução (com botão principal para Tentar Novamente + opção VLC Externo) */}
        {errorMsg && nativeAvailable && (
          <View style={styles.centerOverlay}>
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle-outline" size={46} color="#EF4444" />
              <Text style={styles.errorTitle}>Não foi possível carregar de primeira</Text>
              <Text style={styles.errorDesc}>{errorMsg}</Text>
              <View style={styles.errorActionsWrap}>
                <Pressable
                  hasTVPreferredFocus={true}
                  focusable={true}
                  onPress={() => handleRetryPlayback(false)}
                  style={({ focused, pressed }) => [
                    styles.fallbackBtnPrimary,
                    (focused || pressed) && styles.btnFocused,
                  ]}
                >
                  <Ionicons name="refresh" size={20} color="#000" />
                  <Text style={styles.fallbackBtnPrimaryText}>
                    Tentar Novamente
                  </Text>
                </Pressable>

                {!!session.fallbackStreamUrl &&
                  activeStreamUrl !== session.fallbackStreamUrl && (
                    <Pressable
                      focusable={true}
                      onPress={() => handleRetryPlayback(true)}
                      style={({ focused, pressed }) => [
                        styles.fallbackBtnSecondary,
                        (focused || pressed) && styles.btnFocused,
                      ]}
                    >
                      <Text style={styles.fallbackBtnSecondaryText}>
                        Tentar Stream Alternativo (HLS)
                      </Text>
                    </Pressable>
                  )}

                <Pressable
                  focusable={true}
                  onPress={handleOpenExternalVlc}
                  style={({ focused, pressed }) => [
                    styles.fallbackBtnSecondary,
                    (focused || pressed) && styles.btnFocused,
                  ]}
                >
                  <Text style={styles.fallbackBtnSecondaryText}>
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
            {/* Topo: Título do Episódio + Hora Atual */}
            <LinearGradient
              colors={['rgba(0,0,0,0.82)', 'rgba(0,0,0,0.35)', 'transparent']}
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
                  <Ionicons name="arrow-back" size={18} color="#FFF" />
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

                {/* Hora Atual no Topo Direito */}
                <View style={styles.clockContainer}>
                  <Ionicons name="time-outline" size={14} color="#9CA3AF" />
                  <Text style={styles.clockText}>{currentClock}</Text>
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

            {/* Base: Barra de Progresso Interativa + Controles Centralizados */}
            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.65)', 'rgba(0,0,0,0.92)']}
              style={styles.bottomGradient}
            >
              {/* Barra de Progresso / Seekbar Focável e Clicável na TV */}
              <View style={styles.timelineRow}>
                <Text style={[styles.timeText, scrubbingTimeMs !== null && styles.timeTextScrubbing]}>
                  {formatTimeMs(displayedTimeMs)}
                </Text>

                <Pressable
                  focusable={true}
                  onFocus={() => {
                    setTimelineFocused(true);
                    showControls();
                  }}
                  onBlur={() => {
                    setTimelineFocused(false);
                    // Se sair da barra antes do debounce, aplica imediatamente
                    if (scrubbingTimeRef.current !== null) {
                      if (scrubbingDebounceTimerRef.current) clearTimeout(scrubbingDebounceTimerRef.current);
                      requestSeek(scrubbingTimeRef.current);
                      scrubbingTimeRef.current = null;
                      setScrubbingTimeMs(null);
                    }
                  }}
                  onPress={() => {
                    // Clicar em OK na barra enquanto busca aplica a posição na hora
                    if (scrubbingTimeRef.current !== null) {
                      if (scrubbingDebounceTimerRef.current) clearTimeout(scrubbingDebounceTimerRef.current);
                      requestSeek(scrubbingTimeRef.current);
                      scrubbingTimeRef.current = null;
                      setScrubbingTimeMs(null);
                    } else {
                      togglePlayPause();
                    }
                  }}
                  style={({ focused }) => [
                    styles.progressBarTrack,
                    focused && styles.progressBarTrackFocused,
                  ]}
                >
                  <View
                    style={[
                      styles.progressBarFill,
                      { width: `${progressFraction * 100}%` },
                      scrubbingTimeMs !== null && styles.progressBarFillScrubbing,
                    ]}
                  />
                  <View
                    style={[
                      styles.progressThumb,
                      { left: `${progressFraction * 100}%` },
                      timelineFocused && styles.progressThumbFocused,
                      scrubbingTimeMs !== null && styles.progressThumbScrubbing,
                    ]}
                  />
                </Pressable>

                <Text style={styles.timeText}>
                  -{formatTimeMs(remainingMs)} / {formatTimeMs(durationMs)}
                </Text>
              </View>

              {/* Controles Centralizados: [-5s] [Play/Pause] [+5s] [Recarregar] [Ajustar Tela] [...] */}
              <View style={styles.bottomBarCenterContainer}>
                <View style={styles.controlsCenterGroup}>
                  {/* 1. Botão -5s */}
                  <Pressable
                    focusable={true}
                    onPress={() => performSeekBySeconds(-seekStepSec)}
                    style={({ focused, pressed }) => [
                      styles.osdCompactBtn,
                      (focused || pressed) && styles.osdBtnFocused,
                    ]}
                  >
                    <Ionicons name="play-back" size={18} color="#FFF" />
                    <Text style={styles.osdCompactBtnText}>-{seekStepSec}s</Text>
                  </Pressable>

                  {/* 2. Play / Pause Central Principal */}
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
                      size={22}
                      color="#000"
                    />
                  </Pressable>

                  {/* 3. Botão +5s */}
                  <Pressable
                    focusable={true}
                    onPress={() => performSeekBySeconds(seekStepSec)}
                    style={({ focused, pressed }) => [
                      styles.osdCompactBtn,
                      (focused || pressed) && styles.osdBtnFocused,
                    ]}
                  >
                    <Ionicons name="play-forward" size={18} color="#FFF" />
                    <Text style={styles.osdCompactBtnText}>+{seekStepSec}s</Text>
                  </Pressable>

                  {/* 4. Pular Abertura (+85s OP) */}
                  <Pressable
                    focusable={true}
                    onPress={() => performSeekBySeconds(85)}
                    style={({ focused, pressed }) => [
                      styles.osdOpBtn,
                      (focused || pressed) && styles.osdBtnFocused,
                    ]}
                  >
                    <Ionicons name="play-skip-forward" size={14} color="#FF8800" />
                    <Text style={styles.osdOpBtnText}>+85s OP</Text>
                  </Pressable>

                  {/* 5. Recarregar (Apenas o Ícone) */}
                  <Pressable
                    focusable={true}
                    onPress={() => handleRetryPlayback(false)}
                    style={({ focused, pressed }) => [
                      styles.osdIconOnlyBtn,
                      (focused || pressed) && styles.osdBtnFocused,
                    ]}
                  >
                    <Ionicons name="refresh" size={19} color="#34D399" />
                  </Pressable>

                  {/* 6. Ajustar a Tela / Proporção (Apenas o Ícone) */}
                  <Pressable
                    focusable={true}
                    onPress={() => setActiveModal('aspect')}
                    style={({ focused, pressed }) => [
                      styles.osdIconOnlyBtn,
                      (focused || pressed) && styles.osdBtnFocused,
                    ]}
                  >
                    <Ionicons name="scan-outline" size={19} color="#10B981" />
                  </Pressable>

                  {/* 7. Botão Mais Opções (...) para Legendas, Áudio, Velocidade, VLC */}
                  <Pressable
                    focusable={true}
                    onPress={() => setActiveModal('more')}
                    style={({ focused, pressed }) => [
                      styles.osdMoreBtn,
                      (focused || pressed) && styles.osdBtnFocused,
                    ]}
                  >
                    <Ionicons name="ellipsis-horizontal" size={20} color="#FFF" />
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

        {/* MODAL 5: Mais Opções (...) - Legendas, Áudio, Velocidade, VLC Externo */}
        <Modal
          visible={activeModal === 'more'}
          transparent
          animationType="fade"
          onRequestClose={() => setActiveModal('none')}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalPanel}>
              <View style={styles.modalHeader}>
                <View style={styles.modalHeaderTitleRow}>
                  <Ionicons name="settings-sharp" size={20} color="#FF8800" />
                  <Text style={styles.modalTitle}>Opções do Vídeo</Text>
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

              <View style={styles.moreOptionsList}>
                {/* 1. Legendas */}
                <Pressable
                  hasTVPreferredFocus={true}
                  focusable={true}
                  onPress={() => setActiveModal('subtitles')}
                  style={({ focused, pressed }) => [
                    styles.moreOptionRow,
                    (focused || pressed) && styles.trackItemFocused,
                  ]}
                >
                  <View style={styles.moreOptionLeft}>
                    <Ionicons name="chatbox-ellipses" size={20} color="#FF8800" />
                    <View>
                      <Text style={styles.moreOptionTitle}>Legendas</Text>
                      <Text style={styles.moreOptionSubtitle}>{activeSubtitleLabel}</Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
                </Pressable>

                {/* 2. Áudio */}
                <Pressable
                  focusable={true}
                  onPress={() => setActiveModal('audio')}
                  style={({ focused, pressed }) => [
                    styles.moreOptionRow,
                    (focused || pressed) && styles.trackItemFocused,
                  ]}
                >
                  <View style={styles.moreOptionLeft}>
                    <Ionicons name="volume-high" size={20} color="#3399FF" />
                    <View>
                      <Text style={styles.moreOptionTitle}>Faixa de Áudio</Text>
                      <Text style={styles.moreOptionSubtitle}>{activeAudioLabel}</Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
                </Pressable>

                {/* 3. Velocidade */}
                <Pressable
                  focusable={true}
                  onPress={() => setActiveModal('speed')}
                  style={({ focused, pressed }) => [
                    styles.moreOptionRow,
                    (focused || pressed) && styles.trackItemFocused,
                  ]}
                >
                  <View style={styles.moreOptionLeft}>
                    <Ionicons name="speedometer" size={20} color="#A855F7" />
                    <View>
                      <Text style={styles.moreOptionTitle}>Velocidade de Reprodução</Text>
                      <Text style={styles.moreOptionSubtitle}>{playbackRate}x</Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
                </Pressable>

                {/* 4. VLC Externo (Intent) */}
                <Pressable
                  focusable={true}
                  onPress={() => {
                    setActiveModal('none');
                    handleOpenExternalVlc();
                  }}
                  style={({ focused, pressed }) => [
                    styles.moreOptionRow,
                    (focused || pressed) && styles.trackItemFocused,
                  ]}
                >
                  <View style={styles.moreOptionLeft}>
                    <Ionicons name="open-outline" size={20} color="#10B981" />
                    <View>
                      <Text style={styles.moreOptionTitle}>Abrir no Aplicativo VLC Externo</Text>
                      <Text style={styles.moreOptionSubtitle}>Alternar para o player externo do Android</Text>
                    </View>
                  </View>
                  <Ionicons name="arrow-forward-circle" size={20} color="#10B981" />
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
    backgroundColor: '#000000',
  },
  centerOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bufferingBox: {
    backgroundColor: 'rgba(15, 17, 23, 0.92)',
    paddingVertical: 20,
    paddingHorizontal: 30,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 136, 0, 0.35)',
    gap: 10,
    maxWidth: 540,
  },
  bufferingText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
  bufferingSubText: {
    color: '#9CA3AF',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 2,
    marginBottom: 6,
  },
  loadingRetryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
    marginTop: 6,
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
    paddingTop: 18,
    paddingBottom: 22,
    paddingHorizontal: 32,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  topBackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  topBackText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: 'bold',
  },
  titleBlock: {
    flex: 1,
    marginHorizontal: 10,
  },
  animeSeriesText: {
    color: '#FF8800',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  videoTitleText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  clockContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  clockText: {
    color: '#F3F4F6',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  resTechBadge: {
    backgroundColor: 'rgba(51, 153, 255, 0.2)',
    borderWidth: 1,
    borderColor: '#3399FF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  resTechBadgeText: {
    color: '#3399FF',
    fontSize: 10,
    fontWeight: '800',
  },

  // Bottom Bar OSD Compacto e Centralizado
  bottomGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 16,
    paddingBottom: 16,
    paddingHorizontal: 36,
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
  },
  timeText: {
    color: '#E5E7EB',
    fontSize: 12,
    fontWeight: '700',
    minWidth: 55,
  },
  timeTextScrubbing: {
    color: '#FF8800',
    fontWeight: '900',
  },
  progressBarTrack: {
    flex: 1,
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    borderRadius: 4,
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  progressBarTrackFocused: {
    borderColor: '#FF8800',
    backgroundColor: 'rgba(255, 136, 0, 0.15)',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#FF8800',
    borderRadius: 4,
  },
  progressBarFillScrubbing: {
    backgroundColor: '#FFA333',
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
  progressThumbScrubbing: {
    width: 20,
    height: 20,
    borderRadius: 10,
    marginLeft: -10,
    backgroundColor: '#FF8800',
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
    transform: [{ scale: 1.15 }],
  },

  bottomBarCenterContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  controlsCenterGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  playPauseMainBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FF8800',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2.5,
    borderColor: 'transparent',
    marginHorizontal: 4,
  },
  playPauseMainBtnFocused: {
    backgroundColor: '#FFA333',
    borderColor: '#FFFFFF',
    transform: [{ scale: 1.1 }],
  },
  osdCompactBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  osdCompactBtnText: {
    color: '#E5E7EB',
    fontSize: 13,
    fontWeight: '700',
  },
  osdOpBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 136, 0, 0.16)',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 136, 0, 0.45)',
  },
  osdOpBtnText: {
    color: '#FF8800',
    fontSize: 13,
    fontWeight: '700',
  },
  osdIconOnlyBtn: {
    width: 38,
    height: 38,
    borderRadius: 7,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  osdMoreBtn: {
    width: 38,
    height: 38,
    borderRadius: 7,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  osdBtnFocused: {
    borderColor: '#FFFFFF',
    backgroundColor: 'rgba(255, 136, 0, 0.35)',
    transform: [{ scale: 1.08 }],
  },

  // Modal Mais Opções (...)
  moreOptionsList: {
    gap: 10,
    marginTop: 6,
  },
  moreOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  moreOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  moreOptionTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: 'bold',
  },
  moreOptionSubtitle: {
    color: '#9CA3AF',
    fontSize: 12,
    marginTop: 2,
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
    maxWidth: 560,
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
    lineHeight: 20,
  },
  errorActionsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
  },
});
