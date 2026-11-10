import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import * as Keychain from 'react-native-keychain';
import SendIntentAndroid from 'react-native-send-intent';
import axios from 'axios';

export type PlayerType = 'internal' | 'external_vlc';
export type SubtitleLangPref = 'ptbr' | 'auto' | 'off';
export type AudioLangPref = 'jpn' | 'ptbr' | 'auto';

export interface PlayerSettings {
  playerType: PlayerType;
  seekStepSeconds: number;
  preferredSubtitleLang: SubtitleLangPref;
  preferredAudioLang: AudioLangPref;
  hardwareAcceleration: boolean;
}

export const DEFAULT_PLAYER_SETTINGS: PlayerSettings = {
  playerType: 'internal',
  seekStepSeconds: 5,
  preferredSubtitleLang: 'ptbr',
  preferredAudioLang: 'auto',
  hardwareAcceleration: true,
};

const SETTINGS_SERVICE = 'camii_player_settings_v1';

let cachedSettings: PlayerSettings = { ...DEFAULT_PLAYER_SETTINGS };
let isLoaded = false;
const listeners = new Set<(settings: PlayerSettings) => void>();

function notifyListeners() {
  for (const listener of listeners) {
    listener(cachedSettings);
  }
}

export async function loadPlayerSettings(): Promise<PlayerSettings> {
  if (isLoaded) {
    return cachedSettings;
  }

  try {
    if (Platform.OS === 'web') {
      const raw =
        typeof localStorage !== 'undefined'
          ? localStorage.getItem(SETTINGS_SERVICE)
          : null;
      if (raw) {
        cachedSettings = { ...DEFAULT_PLAYER_SETTINGS, ...JSON.parse(raw) };
      }
    } else {
      const credentials = await Keychain.getGenericPassword({
        service: SETTINGS_SERVICE,
      });
      if (credentials && credentials.password) {
        const parsed = JSON.parse(credentials.password);
        cachedSettings = { ...DEFAULT_PLAYER_SETTINGS, ...parsed };
      }
    }
  } catch (err) {
    console.warn('Aviso ao carregar configurações do player:', err);
  } finally {
    isLoaded = true;
  }

  return cachedSettings;
}

export async function savePlayerSettings(
  partial: Partial<PlayerSettings>
): Promise<PlayerSettings> {
  await loadPlayerSettings();
  cachedSettings = {
    ...cachedSettings,
    ...partial,
  };
  notifyListeners();

  try {
    const serialized = JSON.stringify(cachedSettings);
    if (Platform.OS === 'web') {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(SETTINGS_SERVICE, serialized);
      }
    } else {
      await Keychain.setGenericPassword('player_config', serialized, {
        service: SETTINGS_SERVICE,
      });
    }
  } catch (err) {
    console.warn('Erro ao salvar configurações do player:', err);
  }

  return cachedSettings;
}

export function getPlayerSettingsSync(): PlayerSettings {
  return cachedSettings;
}

export function usePlayerSettings() {
  const [settings, setSettings] = useState<PlayerSettings>(cachedSettings);
  const [loading, setLoading] = useState<boolean>(!isLoaded);

  useEffect(() => {
    let mounted = true;
    loadPlayerSettings().then((loaded) => {
      if (mounted) {
        setSettings(loaded);
        setLoading(false);
      }
    });

    const listener = (updated: PlayerSettings) => {
      if (mounted) {
        setSettings({ ...updated });
      }
    };
    listeners.add(listener);
    return () => {
      mounted = false;
      listeners.delete(listener);
    };
  }, []);

  const updateSettings = async (partial: Partial<PlayerSettings>) => {
    return savePlayerSettings(partial);
  };

  return {
    settings,
    loading,
    updateSettings,
  };
}

export interface PlayerSessionPayload {
  url: string;
  title: string;
  subtitle?: string;
  animeName?: string;
  poster?: string;
  episodeId?: string;
  nyaaOptionId?: number;
  fallbackStreamUrl?: string;
  isNyaaOnly?: boolean;
  onShouldPromptWatched?: () => void;
  onMarkWatched?: () => Promise<void> | void;
}

let currentPlayerSession: PlayerSessionPayload | null = null;

export function setCurrentPlayerSession(session: PlayerSessionPayload | null) {
  currentPlayerSession = session;
}

export function getCurrentPlayerSession(): PlayerSessionPayload | null {
  return currentPlayerSession;
}

export async function resolveStreamUrl(rawUrl: string): Promise<string> {
  const trimmed = rawUrl.trim();
  if (trimmed.toLowerCase().startsWith('magnet')) {
    const result = await axios.post('https://tx.camii.com.br/create', {
      magnet: trimmed,
    });
    return `https://tx.camii.com.br${result.data.streamUrl}`;
  }
  return trimmed;
}

export function openExternalVlcIntent(streamUrl: string, title: string) {
  SendIntentAndroid.openAppWithData('org.videolan.vlc', streamUrl, 'video/*', {
    title,
  });
}

export async function launchVideoPlayback(
  router: { push: (href: any) => void },
  session: PlayerSessionPayload,
  forcePlayerType?: PlayerType
): Promise<{ usedPlayer: PlayerType; streamUrl: string }> {
  const settings = await loadPlayerSettings();
  const targetPlayer = forcePlayerType || settings.playerType;
  const resolvedUrl = await resolveStreamUrl(session.url);

  if (targetPlayer === 'external_vlc') {
    openExternalVlcIntent(resolvedUrl, session.title);
    return { usedPlayer: 'external_vlc', streamUrl: resolvedUrl };
  }

  setCurrentPlayerSession({
    ...session,
    url: resolvedUrl,
  });
  router.push('/player' as any);
  return { usedPlayer: 'internal', streamUrl: resolvedUrl };
}
