import React from 'react';
import { Platform, ViewProps } from 'react-native';
import {
  requireNativeViewManager,
  requireOptionalNativeModule,
} from 'expo-modules-core';

export interface VlcTrack {
  id: number;
  name: string;
}

export type VlcScaleType =
  | 'BEST_FIT'
  | 'FIT_SCREEN'
  | 'FILL'
  | '16_9'
  | '4_3'
  | 'ORIGINAL';

export interface VlcSourceConfig {
  uri: string;
  networkCachingMs?: number;
  hardwareAcceleration?: boolean;
  startPositionMs?: number;
  httpUserAgent?: string;
  headers?: Record<string, string>;
  retryCount?: number;
}

export interface VlcTracksPayload {
  duration: number;
  currentTime: number;
  audioTracks: VlcTrack[];
  subtitleTracks: VlcTrack[];
  selectedAudioTrack: number;
  selectedSubtitleTrack: number;
  videoWidth?: number;
  videoHeight?: number;
}

export interface VlcProgressPayload {
  currentTime: number;
  duration: number;
  position: number;
  isPlaying: boolean;
  /** true no evento emitido logo após um seek, antes da confirmação do libVLC */
  seeking?: boolean;
}

export interface VlcSeekCompletePayload {
  /** Posição real reportada pelo libVLC após o seek */
  currentTime: number;
  /** Posição pedida */
  targetTime: number;
  duration: number;
  /** Tempo entre o pedido e a confirmação */
  tookMs: number;
  /** true quando o seek foi liberado por timeout, sem chegar perto do alvo */
  timedOut: boolean;
}

export interface VlcBufferingPayload {
  buffering: number;
  isBuffering: boolean;
}

export interface VlcStatePayload {
  currentTime: number;
  duration: number;
  isPlaying?: boolean;
}

export interface VlcErrorPayload {
  message: string;
  uri?: string;
}

export interface CamiiVlcPlayerRef {
  seekTo: (timeMs: number) => Promise<void>;
  seekBy: (deltaMs: number) => Promise<void>;
  setPaused: (paused: boolean) => Promise<void>;
  setAudioTrack: (trackId: number) => Promise<void>;
  setSubtitleTrack: (trackId: number) => Promise<void>;
  setSubtitleDelay: (delayMs: number) => Promise<void>;
  setScaleType: (scaleType: VlcScaleType) => Promise<void>;
  setRate: (rate: number) => Promise<void>;
  reload: () => Promise<void>;
}

export interface CamiiVlcPlayerProps extends ViewProps {
  source: VlcSourceConfig | null;
  paused?: boolean;
  muted?: boolean;
  volume?: number;
  rate?: number;
  audioTrack?: number;
  subtitleTrack?: number;
  subtitleDelayMs?: number;
  scaleType?: VlcScaleType;
  onLoad?: (event: { nativeEvent: VlcTracksPayload }) => void;
  onTracksChanged?: (event: { nativeEvent: VlcTracksPayload }) => void;
  onProgress?: (event: { nativeEvent: VlcProgressPayload }) => void;
  onPlaying?: (event: { nativeEvent: VlcStatePayload }) => void;
  onPaused?: (event: { nativeEvent: VlcStatePayload }) => void;
  onBuffering?: (event: { nativeEvent: VlcBufferingPayload }) => void;
  onEnded?: (event: { nativeEvent: VlcStatePayload }) => void;
  onError?: (event: { nativeEvent: VlcErrorPayload }) => void;
  onSeekComplete?: (event: { nativeEvent: VlcSeekCompletePayload }) => void;
}

let cachedModule: any = null;
let cachedNativeView: React.ComponentType<any> | null = null;

export function isNativeVlcAvailable(): boolean {
  if (Platform.OS !== 'android') return false;
  try {
    if (!cachedModule) {
      cachedModule = requireOptionalNativeModule('CamiiVlcPlayer');
    }
    if (!cachedModule) return false;
    if (typeof cachedModule.isAvailable === 'function') {
      return Boolean(cachedModule.isAvailable());
    }
    return true;
  } catch {
    return false;
  }
}

function getNativeView(): React.ComponentType<any> | null {
  if (!isNativeVlcAvailable()) return null;
  if (!cachedNativeView) {
    try {
      cachedNativeView = requireNativeViewManager('CamiiVlcPlayer');
    } catch {
      cachedNativeView = null;
    }
  }
  return cachedNativeView;
}

export const CamiiVlcPlayerView = React.forwardRef<
  CamiiVlcPlayerRef,
  CamiiVlcPlayerProps
>((props, ref) => {
  const NativeView = getNativeView();
  if (!NativeView) {
    return null;
  }
  return React.createElement(NativeView, { ...props, ref });
});

CamiiVlcPlayerView.displayName = 'CamiiVlcPlayerView';
export default CamiiVlcPlayerView;
