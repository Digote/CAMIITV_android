export interface NyaaOption {
  id: number;
  nome: string;
  resolution: string;
  ptbr: number;
  slug: string;
  created_at?: string;
}

export interface EpisodePagePayload {
  anime: {
    id: string;
    nome: string;
    imagem: string;
    banner: string;
    ano?: string | number;
    nota?: string | number;
  };
  temporadaNumero?: string | number;
  totalTemporadas?: number;
  episode: {
    id: string;
    nome: string;
    numero: number | null;
    duracao: string;
    imagem: string;
    sinopse: string;
    assistido?: { completo?: number } | null;
    normalLinks?: string[];
    digitalLinks?: string[];
    nyaaOptions?: NyaaOption[];
    opcoes?: NyaaOption[];
    isNyaaOnly?: boolean;
  };
  onMarkedWatched?: (episodeId: string) => void;
}

let currentPayload: EpisodePagePayload | null = null;

export function setCurrentEpisodePayload(payload: EpisodePagePayload) {
  currentPayload = payload;
}

export function getCurrentEpisodePayload(): EpisodePagePayload | null {
  return currentPayload;
}

/**
 * Normaliza URLs de imagens (especialmente do erai-raws.info que possuem query string ?x23129
 * e bloqueio DDoS-Guard 502 no acesso direto), redirecionando pelo CDN i0.wp.com.
 */
export function normalizeImageUrl(url?: string | null, fallback: string = ''): string {
  if (!url || typeof url !== 'string' || !url.trim()) {
    return fallback;
  }

  let clean = url.trim();

  if (clean.toLowerCase().includes('erai-raws.info')) {
    clean = clean.split('?')[0];
    const match = clean.match(/^https?:\/\/((?:www\.)?erai-raws\.info\/.+)$/i);
    if (match && match[1]) {
      return `https://i0.wp.com/${match[1]}`;
    }
  }

  return clean;
}
