import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Dimensions,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Modal,
  Animated,
  findNodeHandle,
} from 'react-native';

import { FlashList } from '@shopify/flash-list';
import { Image as ExpoImage } from 'expo-image';

import { useLocalSearchParams, useRouter } from 'expo-router';
import api from '@/services/api';
import { setCurrentEpisodePayload, NyaaOption, normalizeImageUrl } from '@/utils/episodeStore';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

// Definição de Cores
const COLORS = {
  bg: '#000000',
  bgCard: '#121212',
  bgCardFocused: '#1E1E1E',
  textRef: '#FFFFFF',
  textSec: '#AAAAAA',
  primary: '#12bbf3',
  accent: '#f39c12',
  success: '#4caf50',
  purple: '#9333ea',
  purpleLight: '#c084fc',
  border: '#333333',
};

interface NyaaGroupItem {
  id: string;
  nome: string;
  numero: number | null;
  ptbr: number;
  opcoes: NyaaOption[];
  isNyaaOnly: true;
  imagem: string;
  sinopse: string;
  duracao: string;
}

/**
 * Extrai o número do episódio a partir do título do release no Nyaa (ex: "Sousou no Frieren - 01", "Anime S2 - 12v2 (1080p)")
 */
function extractEpisodeNumberFromTitle(title: string): number | null {
  if (!title) return null;
  // Remove tags entre colchetes e parênteses (ex: [1080p], (CA91B2)) e resoluções para não confundir com o número
  const cleaned = title
    .replace(/\[.*?\]/g, ' ')
    .replace(/\(.*?\)/g, ' ')
    .replace(/\b(2160p|1080p|720p|576p|480p|x264|x265|hevc|aac|10bit)\b/gi, ' ')
    .replace(/\b(season|s|part|cour)\s*\d+/gi, ' ')
    .replace(/\b\d+(st|nd|rd|th)\s+season\b/gi, ' ');

  // 1. Padrão clássico Erai-raws: "- 01", "- 12v2", "- 05 END"
  const dashMatch = cleaned.match(/-\s*0*(\d+)(?:v\d+|\b|\s|$)/i);
  if (dashMatch) {
    return parseInt(dashMatch[1], 10);
  }

  // 2. Padrão E01 / Ep 01 / Episodio 01
  const epMatch = cleaned.match(/\b(?:ep|episodio|episode|e)\s*0*(\d+)\b/i);
  if (epMatch) {
    return parseInt(epMatch[1], 10);
  }

  // 3. Último número isolado na string
  const allNums = cleaned.match(/\b0*(\d+)\b/g);
  if (allNums && allNums.length > 0) {
    const last = parseInt(allNums[allNums.length - 1], 10);
    if (!isNaN(last) && last < 2000) {
      return last;
    }
  }

  return null;
}

/**
 * Ordena e remove duplicatas da mesma resolução de uma lista de opções do Nyaa
 */
function sortAndUniqueNyaaOptions(rawList: any[]): NyaaOption[] {
  const sorted = [...rawList].sort((a, b) => {
    const resA = parseInt(String(a.resolution || '').replace(/\D/g, ''), 10) || 0;
    const resB = parseInt(String(b.resolution || '').replace(/\D/g, ''), 10) || 0;
    const ptbrA = Number(a.ptbr) === 1 ? 100000 : 0;
    const ptbrB = Number(b.ptbr) === 1 ? 100000 : 0;
    return ptbrB + resB * 10 - (ptbrA + resA * 10);
  });

  const seenRes = new Set<string>();
  const unique: NyaaOption[] = [];
  for (const ep of sorted) {
    const key = String(ep.resolution || 'padrao').toLowerCase();
    if (!seenRes.has(key)) {
      seenRes.add(key);
      unique.push({
        id: ep.id,
        nome: ep.nome,
        resolution: ep.resolution || 'Padrão',
        ptbr: Number(ep.ptbr) === 1 ? 1 : 0,
        slug: ep.slug || '',
        created_at: ep.created_at,
      });
    }
  }
  return unique;
}

const SeasonItem = ({ item, isSelected, onSelectSeason, setFocusedIndex, index, btnAssistirRef }: any) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const [assistirNodeId, setAssistirNodeId] = useState<number | null>(null);

  useEffect(() => {
    if (btnAssistirRef && btnAssistirRef.current) {
      setAssistirNodeId(findNodeHandle(btnAssistirRef.current));
    }
  }, [btnAssistirRef]);

  const handleFocus = () => {
    setFocusedIndex(index);
    Animated.spring(scaleAnim, { toValue: 1.1, useNativeDriver: true, speed: 20 }).start();
  };

  const handleBlur = () => {
    setFocusedIndex(null);
    Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, speed: 20 }).start();
  };

  const isNyaaTab = item.id === 'NYAA_ALL';

  return (
    <Pressable
      focusable={true}
      nextFocusUp={assistirNodeId || undefined}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onPress={() => {
        setFocusedIndex(index);
        onSelectSeason(item.id);
      }}
      style={{ paddingVertical: 10, paddingHorizontal: 5 }}
    >
      {({ focused, pressed }) => (
        <Animated.View
          style={[
            styles.seasonButton,
            isNyaaTab && styles.seasonButtonNyaa,
            isSelected && (isNyaaTab ? styles.seasonButtonNyaaSelected : styles.seasonButtonSelected),
            (focused || pressed) && styles.seasonButtonFocused,
            { transform: [{ scale: scaleAnim }] },
          ]}
        >
          <Text
            style={[
              styles.seasonButtonText,
              isNyaaTab && { color: COLORS.purpleLight },
              isSelected && styles.seasonButtonTextSelected,
              (focused || pressed) && styles.seasonButtonTextFocused,
            ]}
          >
            {item.label || (item.numero === 'Digital' ? 'Digital' : `T${item.numero}`)}
          </Text>
        </Animated.View>
      )}
    </Pressable>
  );
};

export default function AnimeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  // REFERÊNCIAS
  const btnAssistirRef = useRef(null);

  // ESTADOS DE DADOS
  const [anime, setAnime] = useState<any>({});
  const [temporadas, setTemporadas] = useState<any[]>([]);
  const [nyaaTodosEpisodios, setNyaaTodosEpisodios] = useState<NyaaGroupItem[]>([]);
  const [episodiosLista, setEpisodiosLista] = useState<any[]>([]);
  const [selectedTemporadaId, setSelectedTemporadaId] = useState('');

  // ESTADOS DO PRÓXIMO EPISÓDIO
  const [proximoEpisodio, setProximoEpisodio] = useState<any>(null);
  const [temporadaProximoEp, setTemporadaProximoEp] = useState<any>(null);

  // ESTADOS DE UI
  const [seasonFocusedIndex, setSeasonFocusedIndex] = useState<number | null>(null);

  // ESTADOS DO MODAL DE MARCAR COMO ASSISTIDO (LONG PRESS)
  const [modalVisible, setModalVisible] = useState(false);
  const [episodioEmExecucao, setEpisodioEmExecucao] = useState<any>(null);

  // ==========================================
  // EFEITOS E BUSCA DE DADOS
  // ==========================================

  useEffect(() => {
    if (!id) return;

    const fetchAnimeData = async () => {
      try {
        const res = await api.get(`/anime/${id}`);
        const data = res.data;
        const item = Array.isArray(data) ? data[0] : data;

        const generosNomes = Array.isArray(item.generos) && item.generos.length > 0
          ? item.generos.map((g: any) => (typeof g === 'string' ? g : g.nome)).filter(Boolean)
          : [];

        setAnime({
          id: item.id?.toString() || id,
          nome: item.nome,
          imagem: item.imagem,
          banner: item.banner || item.imagem,
          descricao: item.descricao,
          ano: item.temporada_ano,
          nota: item.nota_mal,
          nota_tmdb: item.nota_tmdb,
          generos: generosNomes,
        });

        // 1. Extrai todos os episódios do Nyaa vinculados a este anime (via nyaa_animes)
        const rawNyaaEps: any[] = [];
        if (item.nyaa_animes && Array.isArray(item.nyaa_animes)) {
          for (const na of item.nyaa_animes) {
            if (Array.isArray(na.episodios)) {
              for (const nep of na.episodios) {
                rawNyaaEps.push({
                  ...nep,
                  nyaa_anime_nome: na.nome,
                  nyaa_anime_img: na.img,
                });
              }
            }
          }
        }

        // Indexa episódios Nyaa por número detectado (para casar com os episódios da temporada)
        const nyaaByEpNumber = new Map<number, any[]>();
        const nyaaGroupedByName = new Map<string, any[]>();

        for (const nep of rawNyaaEps) {
          const epNum = extractEpisodeNumberFromTitle(nep.nome);
          if (epNum !== null) {
            if (!nyaaByEpNumber.has(epNum)) {
              nyaaByEpNumber.set(epNum, []);
            }
            nyaaByEpNumber.get(epNum)!.push(nep);
          }

          const groupKey = String(nep.nome || `Episódio #${nep.id}`).trim();
          if (!nyaaGroupedByName.has(groupKey)) {
            nyaaGroupedByName.set(groupKey, []);
          }
          nyaaGroupedByName.get(groupKey)!.push(nep);
        }

        // Mapa de imagens dos episódios por número (para usar na lista "Só Nyaa" quando casar)
        const epThumbByNumber = new Map<number, string>();
        if (item.temporadas && Array.isArray(item.temporadas)) {
          for (const temp of item.temporadas) {
            if (Array.isArray(temp.episodios)) {
              for (const ep of temp.episodios) {
                if (ep.numero && ep.imagem && !epThumbByNumber.has(Number(ep.numero))) {
                  epThumbByNumber.set(Number(ep.numero), ep.imagem);
                }
              }
            }
          }
        }

        // Monta a lista completa "Só Nyaa" (agrupada pelo nome do episódio para acessar inclusive os não identificados)
        const allNyaaList: NyaaGroupItem[] = [];
        for (const [nome, group] of nyaaGroupedByName.entries()) {
          const opcoes = sortAndUniqueNyaaOptions(group);
          const epNum = extractEpisodeNumberFromTitle(nome);
          const hasPtbr = opcoes.some((o) => o.ptbr === 1) ? 1 : 0;
          const first = group[0];
          const matchedEpThumb = epNum !== null ? epThumbByNumber.get(epNum) : undefined;

          allNyaaList.push({
            id: `nyaa-group-${opcoes[0]?.id || nome}`,
            nome,
            numero: epNum,
            ptbr: hasPtbr,
            opcoes,
            isNyaaOnly: true,
            imagem: normalizeImageUrl(matchedEpThumb || first?.nyaa_anime_img || item.banner || item.imagem, item.imagem),
            sinopse: `Qualidades Nyaa disponíveis: ${opcoes.map((o) => o.resolution).join(', ')}${hasPtbr ? ' • Legenda PT-BR' : ''}`,
            duracao: opcoes[0]?.resolution || 'TORRENT',
          });
        }

        allNyaaList.sort((a, b) => {
          if (a.numero !== null && b.numero !== null && a.numero !== b.numero) {
            return a.numero - b.numero;
          }
          return a.nome.localeCompare(b.nome);
        });
        setNyaaTodosEpisodios(allNyaaList);

        // 2. Processa as Temporadas e separa os links: Normal, AnimeDigital e Nyaa (Qualidades)
        if (item.temporadas && Array.isArray(item.temporadas)) {
          const mapped = item.temporadas.map((temp: any) => {
            let eps: any[] = [];
            const episodeLinks = getEpisodeLinks(temp.link || '');

            if (temp.episodios && temp.episodios.length > 0) {
              eps = temp.episodios.map((ep: any, idx: number) => {
                const normalLinks = episodeLinks[idx] || [];
                const digitalLinks: string[] = [];

                // Busca links correspondentes no Anime Digital (separado dos links normais)
                if (temp.anime_digital && Array.isArray(temp.anime_digital.episodios)) {
                  const digitalMatches = temp.anime_digital.episodios.filter((digEp: any) => {
                    const numeros = digEp.nome ? digEp.nome.match(/\d+/g) : null;
                    const numDigital = numeros ? parseInt(numeros[numeros.length - 1], 10) : -1;
                    return numDigital === Number(ep.numero);
                  });

                  for (const dm of digitalMatches) {
                    if (dm.link && !digitalLinks.includes(dm.link)) {
                      digitalLinks.push(dm.link);
                    }
                  }
                }

                // Busca episódios correspondentes no Nyaa e suas qualidades
                const epNumber = Number(ep.numero);
                const matchedNyaaRaw = nyaaByEpNumber.get(epNumber) || [];
                const nyaaOptions = sortAndUniqueNyaaOptions(matchedNyaaRaw);

                const combinedDirectLinks = [...normalLinks, ...digitalLinks];

                return {
                  id: ep.id?.toString() || '',
                  nome: ep.nome || `Episódio ${ep.numero}`,
                  numero: epNumber,
                  assistido: ep.assistido,
                  duracao: ep.duracao ? ep.duracao + 'm' : '--m',
                  imagem: ep.imagem || item.imagem,
                  sinopse: ep.sinopse || '',
                  normalLinks,
                  digitalLinks,
                  nyaaOptions,
                  links: combinedDirectLinks,
                  isDigital: normalLinks.length === 0 && digitalLinks.length > 0,
                  hasNyaa: nyaaOptions.length > 0,
                  hasAnySource: normalLinks.length > 0 || digitalLinks.length > 0 || nyaaOptions.length > 0,
                };
              });
            } else if (temp.anime_digital && Array.isArray(temp.anime_digital.episodios)) {
              eps = temp.anime_digital.episodios.map((ep: any, idx: number) => {
                const numeros = ep.nome ? ep.nome.match(/\d+/g) : null;
                const numeroExtraido = numeros ? parseInt(numeros[numeros.length - 1], 10) : idx + 1;
                const digitalLinks = ep.link ? [ep.link] : [];
                const matchedNyaaRaw = nyaaByEpNumber.get(numeroExtraido) || [];
                const nyaaOptions = sortAndUniqueNyaaOptions(matchedNyaaRaw);

                return {
                  id: ep.id_episode?.toString() || ep.id?.toString() || `dig-${idx}`,
                  nome: ep.nome || `Episódio ${numeroExtraido}`,
                  numero: numeroExtraido,
                  assistido: null,
                  duracao: '--m',
                  imagem: item.imagem,
                  sinopse: 'Episódio da versão digital.',
                  normalLinks: [],
                  digitalLinks,
                  nyaaOptions,
                  links: digitalLinks,
                  isDigital: digitalLinks.length > 0,
                  hasNyaa: nyaaOptions.length > 0,
                  hasAnySource: digitalLinks.length > 0 || nyaaOptions.length > 0,
                };
              });
            }

            eps.sort((a: any, b: any) => a.numero - b.numero);

            return {
              id: temp.id?.toString() || '',
              numero: temp.numero,
              episodios: eps,
            };
          });

          setTemporadas(mapped);

          if (mapped.length > 0) {
            setSelectedTemporadaId(mapped[0].id);
            setEpisodiosLista(mapped[0].episodios);
          } else if (allNyaaList.length > 0) {
            setSelectedTemporadaId('NYAA_ALL');
            setEpisodiosLista(allNyaaList);
          }
        } else if (allNyaaList.length > 0) {
          setSelectedTemporadaId('NYAA_ALL');
          setEpisodiosLista(allNyaaList);
        }
      } catch (error) {
        console.error('Erro ao buscar dados do anime', error);
      }
    };

    fetchAnimeData();
  }, [id]);

  // Lógica para calcular automaticamente o Próximo Episódio
  useEffect(() => {
    if (temporadas.length === 0) return;

    let foundUnwatched = false;

    for (const temp of temporadas) {
      for (const ep of temp.episodios) {
        if (ep.assistido?.completo !== 1) {
          setProximoEpisodio(ep);
          setTemporadaProximoEp(temp);
          foundUnwatched = true;
          break;
        }
      }
      if (foundUnwatched) break;
    }

    if (!foundUnwatched && temporadas[0]?.episodios?.length > 0) {
      setProximoEpisodio(temporadas[0].episodios[0]);
      setTemporadaProximoEp(temporadas[0]);
    }
  }, [temporadas]);

  // ==========================================
  // FUNÇÕES DE AÇÃO E NAVEGAÇÃO PARA A PÁGINA DO EPISÓDIO
  // ==========================================

  const atualizarEstadoEpisodioAssistido = useCallback(
    (episodeId: string) => {
      setTemporadas((prevTemps) => {
        const newTemps = prevTemps.map((temp) => ({
          ...temp,
          episodios: temp.episodios.map((ep: any) =>
            ep.id === episodeId ? { ...ep, assistido: { completo: 1 } } : ep
          ),
        }));

        const currentTemp = newTemps.find((t) => t.id === selectedTemporadaId);
        if (currentTemp) setEpisodiosLista(currentTemp.episodios);

        return newTemps;
      });
    },
    [selectedTemporadaId]
  );

  const marcarComoAssistido = async (targetEp?: any) => {
    const epToMark = targetEp || episodioEmExecucao;
    if (!epToMark || epToMark.isNyaaOnly) return;
    try {
      await api.post(`/episodio/${epToMark.id}/assistido`);
      atualizarEstadoEpisodioAssistido(epToMark.id);
    } catch (error) {
      console.error('Erro ao marcar como assistido', error);
    } finally {
      setModalVisible(false);
      setEpisodioEmExecucao(null);
    }
  };

  /**
   * Abre a página dedicada do Episódio (estilo Netflix) como uma tela real da Stack!
   * Isso isola 100% o foco do controle da TV (sem navegar em segundo plano).
   */
  const openEpisodeOverlay = (ep: any) => {
    const currentTemp =
      temporadas.find((t: any) => t.id === selectedTemporadaId) ||
      temporadaProximoEp ||
      temporadas[0];

    setCurrentEpisodePayload({
      anime: {
        id: anime.id,
        nome: anime.nome,
        imagem: anime.imagem,
        banner: anime.banner,
        ano: anime.ano,
        nota: anime.nota,
      },
      temporadaNumero: currentTemp?.numero,
      totalTemporadas: temporadas.length,
      episode: ep,
      onMarkedWatched: (episodeId: string) => {
        atualizarEstadoEpisodioAssistido(episodeId);
      },
    });

    router.push('/anime/episodio');
  };

  const handleSelectTemporada = useCallback(
    (tempId: string) => {
      setSelectedTemporadaId(tempId);
      if (tempId === 'NYAA_ALL') {
        setEpisodiosLista(nyaaTodosEpisodios);
        return;
      }
      const temp = temporadas.find((t: any) => t.id === tempId);
      if (temp) {
        setEpisodiosLista(temp.episodios);
      }
    },
    [temporadas, nyaaTodosEpisodios]
  );

  function getEpisodeLinks(linksString: string): string[][] {
    if (!linksString) return [];
    return linksString.split('\n').map((line) =>
      line
        .split(';')
        .map((link) => link.trim())
        .filter(Boolean)
    );
  }

  const getWatchButtonText = () => {
    if (!proximoEpisodio || !temporadas[0]) return 'Assistir';
    if (!proximoEpisodio.hasAnySource) return 'Indisponível';

    const isFirstEpOfAnime = proximoEpisodio.id === temporadas[0].episodios[0]?.id;
    const hasNotWatchedFirst = proximoEpisodio.assistido?.completo !== 1;

    return isFirstEpOfAnime && hasNotWatchedFirst ? 'Começar a Assistir' : 'Continuar Assistindo';
  };

  const mainEpisodeHasLink = Boolean(proximoEpisodio?.hasAnySource);

  // Abas de navegação:
  // - Só exibe os botões de temporadas (T1, T2...) se tiver MAIS DE 1 temporada (ou se tiver a aba Nyaa para alternar).
  // - Se tiver apenas 1 temporada e nada no Nyaa, não exibe seletor de temporadas!
  const navigationTabs = React.useMemo(() => {
    const tabs: any[] = [];
    if (temporadas.length > 1) {
      for (const t of temporadas) {
        tabs.push({
          ...t,
          label: t.numero === 'Digital' ? 'Digital' : `Temporada ${t.numero}`,
        });
      }
    }
    return tabs;
  }, [temporadas]);

  // ==========================================
  // RENDERIZAÇÃO
  // ==========================================

  const renderHeader = () => (
    <>
      <View style={styles.headerContainer}>
        <View style={styles.headerLeft}>
          <Text style={styles.animeTitle} numberOfLines={2}>
            {anime.nome}
          </Text>

          <View style={styles.metadataRow}>
            {!!anime.nota && (
              <Text style={styles.metaNota}>
                ★ {anime.nota}
                <Text style={styles.metaNotaType}> MAL</Text>
              </Text>
            )}
            {!!anime.nota_tmdb && (
              <Text style={styles.metaNota}>
                ★ {anime.nota_tmdb}
                <Text style={styles.metaNotaType}> TMDB</Text>
              </Text>
            )}
            {!!anime.ano && <Text style={styles.metaText}>{anime.ano}</Text>}
            {/* Só exibe a contagem de temporadas se tiver mais de 1 */}
            {temporadas.length > 1 && (
              <Text style={styles.metaText}>{temporadas.length} Temporadas</Text>
            )}
            {nyaaTodosEpisodios.length > 0 && (
              <View style={styles.nyaaMetaPill}>
                <Text style={styles.nyaaMetaPillText}>NYAA • {nyaaTodosEpisodios.length} eps</Text>
              </View>
            )}
          </View>

          <Text style={styles.animeDescription} ellipsizeMode="tail" numberOfLines={4}>
            {anime.descricao}
          </Text>
          {anime.generos?.length > 0 && (
            <Text style={styles.genresText}>{anime.generos.join(' • ')}</Text>
          )}

          {/* BOTÃO ASSISTIR DINÂMICO */}
          {proximoEpisodio && (
            <Pressable
              ref={btnAssistirRef}
              focusable={mainEpisodeHasLink}
              disabled={!mainEpisodeHasLink}
              onPress={() => openEpisodeOverlay(proximoEpisodio)}
              style={({ focused, pressed }) => [
                styles.btnAssistirDinamico,
                (focused || pressed) && styles.btnAssistirDinamicoFocused,
                !mainEpisodeHasLink && styles.btnAssistirDinamicoDisabled,
              ]}
            >
              {({ focused, pressed }) => (
                <>
                  <Image
                    source={{ uri: proximoEpisodio.imagem }}
                    style={styles.btnAssistirImg}
                    resizeMode="cover"
                  />
                  <View style={styles.btnAssistirContent}>
                    <Text style={[styles.btnAssistirLabel, (focused || pressed) && { color: COLORS.textRef }]}>
                      {getWatchButtonText()}
                    </Text>
                    <Text
                      style={[styles.btnAssistirEpNome, (focused || pressed) && { color: COLORS.primary }]}
                      numberOfLines={1}
                    >
                      {temporadas.length > 1
                        ? `${temporadaProximoEp?.numero === 'Digital' ? 'Digital' : `T${temporadaProximoEp?.numero}`} : `
                        : ''}
                      E{proximoEpisodio.numero} - {proximoEpisodio.nome}
                    </Text>
                  </View>
                  <View style={[styles.btnAssistirPlay, (focused || pressed) && styles.btnAssistirPlayFocused]}>
                    <Text style={styles.btnAssistirPlayIcon}>▶</Text>
                  </View>
                </>
              )}
            </Pressable>
          )}
        </View>

        <View style={styles.headerRight}>
          <Image source={{ uri: anime.imagem }} style={styles.animePoster} resizeMode="cover" />
        </View>
      </View>

      <View style={[styles.contentSection, { paddingBottom: 15 }]} focusable={false}>
        <View style={styles.seasonsContainer} focusable={false}>
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>
              {selectedTemporadaId === 'NYAA_ALL' ? 'Todos os Episódios no Nyaa' : 'Episódios'}
            </Text>

            {/* Botão separado para alternar para a lista completa do Nyaa (só muda ao clicar!) */}
            {nyaaTodosEpisodios.length > 0 && (
              <Pressable
                focusable={true}
                onPress={() => {
                  if (selectedTemporadaId === 'NYAA_ALL' && temporadas.length > 0) {
                    handleSelectTemporada(temporadas[0].id);
                  } else {
                    handleSelectTemporada('NYAA_ALL');
                  }
                }}
                style={({ focused, pressed }) => [
                  styles.nyaaToggleButton,
                  selectedTemporadaId === 'NYAA_ALL' && styles.nyaaToggleButtonActive,
                  (focused || pressed) && styles.nyaaToggleButtonFocused,
                ]}
              >
                <Text style={styles.nyaaToggleButtonText}>
                  {selectedTemporadaId === 'NYAA_ALL'
                    ? '← Voltar para Episódios da Temporada'
                    : `Ver Lista Só Nyaa (${nyaaTodosEpisodios.length})`}
                </Text>
              </Pressable>
            )}
          </View>

          {/* Só renderiza os botões de temporada se houver MAIS DE 1 temporada */}
          {navigationTabs.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              focusable={false}
              contentContainerStyle={styles.seasonsListContent}
            >
              {navigationTabs.map((item, index) => (
                <SeasonItem
                  key={item.id}
                  item={item}
                  index={index}
                  isSelected={selectedTemporadaId === item.id}
                  onSelectSeason={handleSelectTemporada}
                  setFocusedIndex={setSeasonFocusedIndex}
                  btnAssistirRef={btnAssistirRef}
                />
              ))}
            </ScrollView>
          )}
        </View>
      </View>
    </>
  );

  return (
    <View style={styles.container}>
      <Image source={{ uri: anime.banner }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      <View style={styles.gradientReplacement} />

      <FlashList
        data={episodiosLista}
        ListHeaderComponent={renderHeader}
        drawDistance={1500}
        keyExtractor={(item, index) => item.id || `fallback-${index}`}
        contentContainerStyle={{ paddingBottom: 0 }}
        showsVerticalScrollIndicator={false}
        ListFooterComponent={<View style={{ height: 50, backgroundColor: COLORS.bg }} />}
        renderItem={({ item: ep }) => {
          // Modo "Só Nyaa" (lista todos os releases Nyaa, inclusive os que não casaram com número de episódio)
          if (ep.isNyaaOnly) {
            return (
              <View style={{ backgroundColor: COLORS.bg, paddingHorizontal: 50 }}>
                <Pressable
                  focusable={true}
                  style={({ focused, pressed }) => [
                    styles.epCard,
                    { marginBottom: 15 },
                    (focused || pressed) && styles.epCardFocused,
                  ]}
                  onPress={() => openEpisodeOverlay(ep)}
                >
                  {({ focused, pressed }) => (
                    <>
                      <View style={styles.epThumbnailWrapper}>
                        <ExpoImage
                          source={{ uri: ep.imagem }}
                          style={styles.epThumbnail}
                          contentFit="cover"
                          cachePolicy="disk"
                          transition={0}
                        />
                        <View style={[styles.epDigitalBadge, { backgroundColor: COLORS.purple }]}>
                          <Text style={[styles.epDigitalText, { color: '#FFF' }]}>NYAA</Text>
                        </View>
                        {ep.ptbr === 1 && (
                          <View style={[styles.epDurationBadge, { backgroundColor: COLORS.success }]}>
                            <Text style={styles.epDurationText}>PT-BR</Text>
                          </View>
                        )}
                      </View>
                      <View style={styles.epTextContainer}>
                        <Text style={[styles.epTitle, (focused || pressed) && styles.epTitleFocused]} numberOfLines={1}>
                          {ep.numero !== null ? `Ep. ${ep.numero} • ` : ''}
                          {ep.nome}
                        </Text>
                        <View style={styles.badgesInlineRow}>
                          {ep.opcoes?.map((op: NyaaOption) => (
                            <View key={op.id} style={styles.qualityMiniBadge}>
                              <Text style={styles.qualityMiniBadgeText}>{op.resolution}</Text>
                            </View>
                          ))}
                        </View>
                      </View>
                      {(focused || pressed) && <View style={styles.epFocusBorder} />}
                    </>
                  )}
                </Pressable>
              </View>
            );
          }

          // Modo Episódio Normal da Temporada (com badges de disponibilidade Normal / AnimeDigital / Nyaa + Qualidades)
          const isAssistido = ep.assistido?.completo === 1;
          const hasAnySource = Boolean(ep.hasAnySource);

          return (
            <View style={{ backgroundColor: COLORS.bg, paddingHorizontal: 50 }}>
              <Pressable
                focusable={hasAnySource}
                disabled={!hasAnySource}
                style={({ focused, pressed }) => [
                  styles.epCard,
                  { marginBottom: 15 },
                  (focused || pressed) && styles.epCardFocused,
                  isAssistido && styles.epCardAssistido,
                  !hasAnySource && styles.epCardDisabled,
                ]}
                onPress={() => openEpisodeOverlay(ep)}
                onLongPress={() => {
                  setEpisodioEmExecucao(ep);
                  setModalVisible(true);
                }}
              >
                {({ focused, pressed }) => (
                  <>
                    <View style={styles.epThumbnailWrapper}>
                      <ExpoImage
                        source={{ uri: ep.imagem }}
                        style={styles.epThumbnail}
                        contentFit="cover"
                        cachePolicy="disk"
                        transition={0}
                      />
                      <View style={styles.epDurationBadge}>
                        <Text style={styles.epDurationText}>{ep.duracao}</Text>
                      </View>
                      {isAssistido && (
                        <View style={styles.epCheckBadge}>
                          <Text style={styles.epCheckText}>✓</Text>
                        </View>
                      )}

                      {/* Badges discretas no canto superior direito da thumbnail (apenas DIGITAL e 1 NYAA) */}
                      {(ep.digitalLinks?.length > 0 || ep.nyaaOptions?.length > 0) && (
                        <View style={styles.epTopRightBadges}>
                          {ep.digitalLinks?.length > 0 && (
                            <View style={[styles.epTinyBadge, { backgroundColor: COLORS.primary }]}>
                              <Text style={[styles.epTinyBadgeText, { color: '#000' }]}>DIGITAL</Text>
                            </View>
                          )}
                          {ep.nyaaOptions?.length > 0 && (
                            <View style={[styles.epTinyBadge, { backgroundColor: COLORS.purple }]}>
                              <Text style={styles.epTinyBadgeText}>NYAA</Text>
                            </View>
                          )}
                        </View>
                      )}
                    </View>

                    <View style={styles.epTextContainer}>
                      <Text
                        style={[styles.epTitle, { marginBottom: 5 }, (focused || pressed) && styles.epTitleFocused]}
                        numberOfLines={1}
                      >
                        {ep.numero}. {ep.nome} {!hasAnySource && '(Indisponível)'}
                      </Text>

                      <Text style={styles.epSinopse} numberOfLines={2}>
                        {ep.sinopse || 'Sem sinopse disponível para este episódio.'}
                      </Text>
                    </View>
                    {(focused || pressed) && <View style={styles.epFocusBorder} />}
                  </>
                )}
              </Pressable>
            </View>
          );
        }}
      />

      {/* MODAL DE CONFIRMAÇÃO (LONG PRESS NA LISTA) */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalBackground}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>Marcar como assistido?</Text>
            <Text style={styles.modalSubtitle}>"{episodioEmExecucao?.nome}"</Text>
            <View style={styles.modalButtonContainer}>
              <Pressable
                style={({ focused, pressed }) => [
                  styles.modalButton,
                  styles.modalButtonConfirm,
                  (focused || pressed) && styles.modalButtonFocused,
                ]}
                onPress={() => marcarComoAssistido()}
              >
                <Text style={styles.modalButtonText}>Sim, marcar</Text>
              </Pressable>
              <Pressable
                style={({ focused, pressed }) => [
                  styles.modalButton,
                  (focused || pressed) && styles.modalButtonFocused,
                ]}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.modalButtonText}>Cancelar</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ==========================================
// ESTILOS
// ==========================================
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  gradientReplacement: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
  },

  headerContainer: {
    flexDirection: 'row',
    paddingTop: screenHeight * 0.12,
    paddingHorizontal: 50,
    paddingBottom: 35,
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerLeft: {
    flex: 1,
    paddingRight: 40,
    justifyContent: 'center',
  },
  headerRight: {
    width: 240,
    justifyContent: 'flex-end',
  },
  animePoster: {
    width: 240,
    height: 360,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#333',
  },

  animeTitle: {
    fontSize: 44,
    fontWeight: '900',
    color: COLORS.textRef,
    letterSpacing: -1,
    marginBottom: 10,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  metadataRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 15, marginBottom: 15 },
  metaNota: { fontSize: 18, color: COLORS.accent, fontWeight: 'bold' },
  metaNotaType: { fontSize: 10, color: COLORS.accent, fontWeight: 'bold' },
  metaText: { fontSize: 16, color: COLORS.textSec },
  nyaaMetaPill: {
    backgroundColor: 'rgba(147, 51, 234, 0.25)',
    borderWidth: 1,
    borderColor: COLORS.purpleLight,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 6,
  },
  nyaaMetaPillText: {
    color: COLORS.purpleLight,
    fontSize: 12,
    fontWeight: 'bold',
  },
  animeDescription: { fontSize: 17, color: COLORS.textSec, lineHeight: 24, marginBottom: 10 },
  genresText: { fontSize: 14, color: COLORS.textSec, fontStyle: 'italic', marginBottom: 22 },

  btnAssistirDinamico: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    alignItems: 'center',
    padding: 8,
    width: 500,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  btnAssistirDinamicoFocused: {
    borderColor: COLORS.textRef,
    transform: [{ scale: 1.05 }],
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  btnAssistirDinamicoDisabled: {
    opacity: 0.5,
  },
  btnAssistirImg: {
    width: 100,
    height: 56,
    borderRadius: 6,
  },
  btnAssistirContent: {
    flex: 1,
    paddingHorizontal: 15,
    justifyContent: 'center',
  },
  btnAssistirLabel: {
    fontSize: 13,
    color: COLORS.textSec,
    textTransform: 'uppercase',
    fontWeight: 'bold',
    marginBottom: 2,
  },
  btnAssistirEpNome: {
    fontSize: 17,
    color: COLORS.textRef,
    fontWeight: 'bold',
  },
  btnAssistirPlay: {
    width: 45,
    height: 45,
    borderRadius: 25,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  btnAssistirPlayFocused: {
    backgroundColor: COLORS.primary,
  },
  btnAssistirPlayIcon: {
    color: '#FFF',
    fontSize: 18,
    marginLeft: 3,
  },

  contentSection: { backgroundColor: COLORS.bg, paddingHorizontal: 50, paddingTop: 10 },
  seasonsContainer: { marginBottom: 15 },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 24, fontWeight: 'bold', color: COLORS.textRef, marginBottom: 12 },
  nyaaToggleButton: {
    backgroundColor: 'rgba(147, 51, 234, 0.2)',
    borderWidth: 2,
    borderColor: 'rgba(192, 132, 252, 0.45)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  nyaaToggleButtonActive: {
    backgroundColor: COLORS.purple,
    borderColor: COLORS.purpleLight,
  },
  nyaaToggleButtonFocused: {
    borderColor: '#FFFFFF',
    backgroundColor: '#3b0764',
    transform: [{ scale: 1.05 }],
  },
  nyaaToggleButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  seasonsListContent: { gap: 10, paddingVertical: 5 },
  seasonButton: {
    minWidth: 90,
    paddingHorizontal: 18,
    height: 45,
    backgroundColor: COLORS.bgCard,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  seasonButtonNyaa: {
    backgroundColor: 'rgba(147, 51, 234, 0.18)',
    borderColor: 'rgba(147, 51, 234, 0.45)',
  },
  seasonButtonSelected: { backgroundColor: COLORS.primary },
  seasonButtonNyaaSelected: { backgroundColor: COLORS.purple },
  seasonButtonFocused: { borderColor: COLORS.textRef, backgroundColor: COLORS.bgCardFocused },
  seasonButtonText: { fontSize: 16, fontWeight: 'bold', color: COLORS.textSec },
  seasonButtonTextSelected: { color: '#FFF' },
  seasonButtonTextFocused: { color: COLORS.textRef },

  epCard: {
    flexDirection: 'row',
    backgroundColor: COLORS.bgCard,
    borderRadius: 12,
    overflow: 'hidden',
    height: 112,
    alignItems: 'center',
    position: 'relative',
  },
  epCardFocused: { backgroundColor: COLORS.bgCardFocused, transform: [{ scale: 1.02 }] },
  epCardAssistido: { opacity: 0.55 },
  epCardDisabled: { opacity: 0.35 },

  epFocusBorder: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 3,
    borderColor: COLORS.textRef,
    borderRadius: 12,
  },
  epThumbnailWrapper: { width: 180, height: '100%', position: 'relative' },
  epThumbnail: { width: '100%', height: '100%' },
  epDurationBadge: {
    position: 'absolute',
    bottom: 5,
    right: 5,
    backgroundColor: 'rgba(0,0,0,0.75)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  epDurationText: { color: COLORS.textRef, fontSize: 12, fontWeight: 'bold' },
  epCheckBadge: {
    position: 'absolute',
    top: 5,
    left: 5,
    backgroundColor: COLORS.success,
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  epCheckText: { color: '#FFF', fontSize: 14, fontWeight: 'bold' },
  epDigitalBadge: {
    position: 'absolute',
    top: 5,
    right: 5,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  epDigitalText: { color: '#000', fontSize: 10, fontWeight: 'bold' },
  epTopRightBadges: {
    position: 'absolute',
    top: 5,
    right: 5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  epTinyBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 3,
  },
  epTinyBadgeText: {
    color: '#FFF',
    fontSize: 9,
    fontWeight: 'bold',
  },
  epTextContainer: { flex: 1, paddingHorizontal: 20, justifyContent: 'center' },
  epHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 6,
  },
  epTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.textRef },
  epTitleFocused: { color: COLORS.primary },
  epSinopse: { fontSize: 14, color: COLORS.textSec, lineHeight: 20 },

  badgesInlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  qualityMiniBadge: {
    backgroundColor: 'rgba(147, 51, 234, 0.25)',
    borderWidth: 1,
    borderColor: COLORS.purpleLight,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 5,
    marginTop: 4,
  },
  qualityMiniBadgeText: {
    color: COLORS.purpleLight,
    fontSize: 11,
    fontWeight: 'bold',
  },

  // ==========================================
  // MODAL DE MARCAR COMO ASSISTIDO
  // ==========================================
  modalBackground: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: 500,
    backgroundColor: '#1A1A1A',
    borderRadius: 15,
    padding: 35,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modalTitle: { fontSize: 28, fontWeight: 'bold', color: COLORS.textRef, marginBottom: 10 },
  modalSubtitle: { fontSize: 20, color: COLORS.textSec, textAlign: 'center', marginBottom: 35 },
  modalButtonContainer: { flexDirection: 'row', gap: 20 },
  modalButton: {
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 10,
    minWidth: 180,
    alignItems: 'center',
    backgroundColor: '#333',
    borderWidth: 3,
    borderColor: 'transparent',
  },
  modalButtonConfirm: { backgroundColor: COLORS.success },
  modalButtonFocused: { borderColor: COLORS.textRef, transform: [{ scale: 1.08 }] },
  modalButtonText: { color: COLORS.textRef, fontSize: 20, fontWeight: 'bold' },
});
