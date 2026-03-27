import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Dimensions,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  AppState,
  Modal,
} from 'react-native';

import { useLocalSearchParams } from 'expo-router';
import axios from 'axios';
import api from '@/services/api';
import SendIntentAndroid from 'react-native-send-intent';

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
  border: '#333333',
};

export default function AnimeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  // REFERÊNCIAS
  const scrollRef = useRef<ScrollView>(null);
  const firstSeasonRef = useRef<View>(null);
  const appState = useRef(AppState.currentState);

  // ESTADOS DE DADOS
  const [anime, setAnime] = useState<any>({});
  const [temporadas, setTemporadas] = useState<any[]>([]);
  const [episodiosLista, setEpisodiosLista] = useState<any[]>([]);
  const [selectedTemporadaId, setSelectedTemporadaId] = useState('');

  // ESTADOS DO PRÓXIMO EPISÓDIO
  const [proximoEpisodio, setProximoEpisodio] = useState<any>(null);
  const [temporadaProximoEp, setTemporadaProximoEp] = useState<any>(null);

  // ESTADOS DE UI
  const [seasonFocusedIndex, setSeasonFocusedIndex] = useState<number | null>(null);

  // ESTADOS DO PLAYER (VLC)
  const [modalVisible, setModalVisible] = useState(false);
  const [episodioEmExecucao, setEpisodioEmExecucao] = useState<any>(null);
  const esperandoRetornoRef = useRef(false);
  const epExecucaoRef = useRef<any>(null);
  const tempoInicioVlcRef = useRef<number | null>(null);

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

        setAnime({
          id: item.id?.toString() || id,
          nome: item.nome,
          imagem: item.imagem,   // Capa (Poster)
          banner: item.banner,   // Fundo
          descricao: item.descricao,
          ano: '2023',
          nota: '8.9',
          classificacao: '16+',
          generos: ['Ação', 'Sci-Fi', 'Aventura']
        });

        if (item.temporadas && Array.isArray(item.temporadas)) {
          const mapped = item.temporadas.map((temp: any) => {
            const episodeLinks = getEpisodeLinks(temp.link || '');
            return {
              id: temp.id?.toString() || '',
              numero: temp.numero,
              episodios: (temp.episodios || []).map((ep: any, idx: number) => ({
                id: ep.id?.toString() || '',
                nome: ep.nome || `Episódio ${ep.numero}`,
                numero: ep.numero,
                assistido: ep.assistido,
                duracao: ep.duracao + 'm',
                imagem: ep.imagem || item.imagem,
                sinopse: ep.sinopse || '',
                links: episodeLinks[idx] || [],
              })),
            };
          });

          setTemporadas(mapped);
          
          if (mapped.length > 0) {
            setSelectedTemporadaId(mapped[0].id);
            setEpisodiosLista(mapped[0].episodios);
          }
        }
      } catch (error) {
        console.error("Erro ao buscar dados do anime", error);
      }
    };

    fetchAnimeData();
  }, [id]);

  // Lógica para calcular automaticamente o Próximo Episódio
  useEffect(() => {
    if (temporadas.length === 0) return;

    let foundUnwatched = false;

    // Varre todas as temporadas e episódios em ordem
    for (const temp of temporadas) {
      for (const ep of temp.episodios) {
        if (ep.assistido?.completo !== 1) {
          setProximoEpisodio(ep);
          setTemporadaProximoEp(temp);
          foundUnwatched = true;
          break; // Para no primeiro não assistido
        }
      }
      if (foundUnwatched) break;
    }

    // Se assistiu tudo, exibe o primeiro episódio da série por padrão
    if (!foundUnwatched && temporadas[0]?.episodios?.length > 0) {
      setProximoEpisodio(temporadas[0].episodios[0]);
      setTemporadaProximoEp(temporadas[0]);
    }
  }, [temporadas]); // Recalcula sempre que as 'temporadas' atualizarem

  // Monitoramento do Retorno do VLC
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      if (appState.current.match(/inactive|background/) && nextAppState === "active") {
        if (esperandoRetornoRef.current && epExecucaoRef.current) {
          if (tempoInicioVlcRef.current) {
            const tempoGastoMs = Date.now() - tempoInicioVlcRef.current;
            const minutosGastos = Math.floor(tempoGastoMs / 60000);
            
            if (minutosGastos >= 2) {
              setModalVisible(true);
            } else {
              setEpisodioEmExecucao(null);
              epExecucaoRef.current = null;
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
  }, []);

  // ==========================================
  // FUNÇÕES DE AÇÃO
  // ==========================================

  const marcarComoAssistido = async () => {
    if (!episodioEmExecucao) return;
    try {
      await api.post(`/episodio/${episodioEmExecucao.id}/assistido`);
      
      // Atualiza o estado raiz 'temporadas' para disparar o recalculador do próximo episódio
      setTemporadas(prevTemps => {
        const newTemps = prevTemps.map(temp => ({
          ...temp,
          episodios: temp.episodios.map(ep => 
            ep.id === episodioEmExecucao.id ? { ...ep, assistido: { completo: 1 } } : ep
          )
        }));

        // Mantém a lista da temporada selecionada atualizada visualmente
        const currentTemp = newTemps.find(t => t.id === selectedTemporadaId);
        if (currentTemp) setEpisodiosLista(currentTemp.episodios);

        return newTemps;
      });

    } catch (error) {
      console.error("Erro ao marcar como assistido", error);
    } finally {
      setModalVisible(false);
      setEpisodioEmExecucao(null);
      epExecucaoRef.current = null;
    }
  };

  const vlcPress = async (ep: any) => {
    const item = ep.links[0];
    if (!item) return;

    setEpisodioEmExecucao(ep);
    epExecucaoRef.current = ep; 
    esperandoRetornoRef.current = true;
    tempoInicioVlcRef.current = Date.now();

    const title = `E${ep.numero} - ${ep.nome}`;

    try {
      if (item.toLowerCase().startsWith("magnet")) {
        const result = await axios.post("https://tx.camii.com.br/create", { magnet: item });
        SendIntentAndroid.openAppWithData("org.videolan.vlc", `https://tx.camii.com.br${result.data.streamUrl}`, "video/*", { title });
      } else {
        SendIntentAndroid.openAppWithData("org.videolan.vlc", item, "video/*", { title });
      }
    } catch (error) {
      console.error("Erro ao abrir VLC:", error);
      esperandoRetornoRef.current = false;
    }
  };

  const handleSelectTemporada = useCallback((tempId: string) => {
    setSelectedTemporadaId(tempId);
    const temp = temporadas.find((t: any) => t.id === tempId);
    if (temp) {
      setEpisodiosLista(temp.episodios);
    }
  }, [temporadas]);

  function getEpisodeLinks(linksString: string): string[][] {
    if (!linksString) return [];
    return linksString.split('\n').map(line =>
      line.split(';').map(link => link.trim()).filter(Boolean)
    );
  }

  // Define o texto dinâmico (Começar vs Continuar)
  const getWatchButtonText = () => {
    if (!proximoEpisodio || !temporadas[0]) return "Assistir";
    const isFirstEpOfAnime = proximoEpisodio.id === temporadas[0].episodios[0]?.id;
    const hasNotWatchedFirst = proximoEpisodio.assistido?.completo !== 1;
    
    return (isFirstEpOfAnime && hasNotWatchedFirst) ? "Começar a Assistir" : "Continuar Assistindo";
  };

  // ==========================================
  // RENDERIZAÇÃO
  // ==========================================

  return (
    <View style={styles.container}>
      {/* BACKGROUND COM VIEW DE SOBREPOSIÇÃO ESCURA */}
      <Image source={{ uri: anime.banner }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      <View style={styles.gradientReplacement} />

      <ScrollView
        ref={scrollRef}
        style={styles.mainScroll}
        contentContainerStyle={styles.mainScrollContent}
      >
        {/* HEADER: TEXTOS NA ESQUERDA, POSTER NA DIREITA */}
        <View style={styles.headerContainer}>
          <View style={styles.headerLeft}>
            <Text style={styles.animeTitle} numberOfLines={2}>{anime.nome}</Text>
            
            <View style={styles.metadataRow}>
              <Text style={styles.metaNota}>★ {anime.nota}</Text>
              <Text style={styles.metaText}>{anime.ano}</Text>
              <View style={styles.metaBadge}><Text style={styles.metaBadgeText}>{anime.classificacao}</Text></View>
              <Text style={styles.metaText}>{temporadas.length} Temps</Text>
            </View>

            <Text style={styles.animeDescription} ellipsizeMode="tail" numberOfLines={4}>
              {anime.descricao}
            </Text>
            <Text style={styles.genresText}>{anime.generos?.join(' • ')}</Text>

            {/* BOTÃO ASSISTIR DINÂMICO COM IMAGEM DO EPISÓDIO */}
            {proximoEpisodio && (
              <Pressable
                hasTVPreferredFocus={true} // Inicia a página focado aqui
                focusable={true}
                onPress={() => vlcPress(proximoEpisodio)}
                style={({ focused }) => [
                  styles.btnAssistirDinamico,
                  focused && styles.btnAssistirDinamicoFocused
                ]}
              >
                {({ focused }) => (
                  <>
                    <Image source={{ uri: proximoEpisodio.imagem }} style={styles.btnAssistirImg} resizeMode="cover" />
                    <View style={styles.btnAssistirContent}>
                      <Text style={[styles.btnAssistirLabel, focused && { color: COLORS.textRef }]}>
                        {getWatchButtonText()}
                      </Text>
                      <Text style={[styles.btnAssistirEpNome, focused && { color: COLORS.primary }]} numberOfLines={1}>
                        T{temporadaProximoEp?.numero} : E{proximoEpisodio.numero} - {proximoEpisodio.nome}
                      </Text>
                    </View>
                    <View style={[styles.btnAssistirPlay, focused && styles.btnAssistirPlayFocused]}>
                      <Text style={styles.btnAssistirPlayIcon}>▶</Text>
                    </View>
                  </>
                )}
              </Pressable>
            )}
          </View>

          {/* CAPA (POSTER) DO ANIME NA DIREITA */}
          <View style={styles.headerRight}>
             <Image source={{ uri: anime.imagem }} style={styles.animePoster} resizeMode="cover" />
          </View>
        </View>

        {/* CONTEÚDO (TEMPORADAS E EPISÓDIOS) */}
        <View style={styles.contentSection}>
          <View style={styles.seasonsContainer}>
            <Text style={styles.sectionTitle}>Episódios</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.seasonsListContent}>
              {temporadas.map((item, index) => {
                const isSelected = selectedTemporadaId === item.id;
                return (
                  <Pressable
                    key={item.id}
                    focusable={true}
                    onFocus={() => {
                      setSeasonFocusedIndex(index);
                      handleSelectTemporada(item.id);
                    }}
                    onBlur={() => setSeasonFocusedIndex(null)}
                    style={({ focused }) => [
                      styles.seasonButton,
                      isSelected && styles.seasonButtonSelected,
                      focused && styles.seasonButtonFocused
                    ]}
                  >
                    {({ focused }) => (
                      <Text style={[
                        styles.seasonButtonText,
                        isSelected && styles.seasonButtonTextSelected,
                        focused && styles.seasonButtonTextFocused
                      ]}>
                        T{item.numero}
                      </Text>
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          <View style={styles.episodesContainer}>
            {episodiosLista.map((ep: any, index: number) => {
              const isAssistido = ep.assistido?.completo === 1;
              return (
                <Pressable
                  key={ep.id || index}
                  focusable={true}
                  android_ripple={{ color: COLORS.border }}
                  style={({ focused }) => [
                    styles.epCard,
                    focused && styles.epCardFocused,
                    isAssistido && styles.epCardAssistido
                  ]}
                  onPress={() => vlcPress(ep)}
                  onLongPress={() => {
                    setEpisodioEmExecucao(ep);
                    setModalVisible(true);
                  }}
                  delayLongPress={600}
                >
                  {({ focused }) => (
                    <>
                      <View style={styles.epThumbnailWrapper}>
                        <Image source={{ uri: ep.imagem }} style={styles.epThumbnail} resizeMode="cover" />
                        <View style={styles.epDurationBadge}><Text style={styles.epDurationText}>{ep.duracao}</Text></View>
                        {isAssistido && <View style={styles.epCheckBadge}><Text style={styles.epCheckText}>✓</Text></View>}
                      </View>
                      <View style={styles.epTextContainer}>
                        <Text style={[styles.epTitle, focused && styles.epTitleFocused]} numberOfLines={1}>
                          {ep.numero}. {ep.nome}
                        </Text>
                        <Text style={styles.epSinopse} numberOfLines={2}>
                          {ep.sinopse || 'Sem sinopse disponível para este episódio.'}
                        </Text>
                      </View>
                      {focused && <View style={styles.epFocusBorder} />}
                    </>
                  )}
                </Pressable>
              );
            })}
          </View>
        </View>
        <View style={{ height: 50 }} />
      </ScrollView>

      {/* MODAL */}
      <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalBackground}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>Marcar como assistido?</Text>
            <Text style={styles.modalSubtitle}>"{episodioEmExecucao?.nome}"</Text>
            <View style={styles.modalButtonContainer}>
              <Pressable style={({ focused }) => [styles.modalButton, focused && styles.modalButtonFocused]} onPress={() => setModalVisible(false)}>
                <Text style={styles.modalButtonText}>Cancelar</Text>
              </Pressable>
              <Pressable style={({ focused }) => [styles.modalButton, styles.modalButtonConfirm, focused && styles.modalButtonFocused]} onPress={marcarComoAssistido}>
                <Text style={styles.modalButtonText}>Sim, marcar</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ==========================================
// ESTILOS ATUALIZADOS
// ==========================================
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  gradientReplacement: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.75)', 
  },
  mainScroll: { flex: 1 },
  mainScrollContent: { flexGrow: 1 },
  
  // LAYOUT DO HEADER (DUAS COLUNAS)
  headerContainer: {
    flexDirection: 'row',
    paddingTop: screenHeight * 0.15, // Pouco mais alto para caber a capa
    paddingHorizontal: 50,
    paddingBottom: 40,
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerLeft: {
    flex: 1,
    paddingRight: 40,
    justifyContent: 'center',
  },
  headerRight: {
    width: 250, // Largura do poster
    justifyContent: 'flex-end',
  },
  animePoster: {
    width: 250,
    height: 375, // Aspect ratio padrão 2:3 de posters
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#333',
  },

  animeTitle: { fontSize: 48, fontWeight: '900', color: COLORS.textRef, letterSpacing: -1, marginBottom: 10, textShadowColor: 'rgba(0, 0, 0, 0.8)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 4 },
  metadataRow: { flexDirection: 'row', alignItems: 'center', gap: 15, marginBottom: 15 },
  metaNota: { fontSize: 18, color: COLORS.accent, fontWeight: 'bold' },
  metaText: { fontSize: 16, color: COLORS.textSec },
  metaBadge: { backgroundColor: '#333', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  metaBadgeText: { color: COLORS.textRef, fontSize: 14, fontWeight: 'bold' },
  animeDescription: { fontSize: 18, color: COLORS.textSec, lineHeight: 26, marginBottom: 10 },
  genresText: { fontSize: 14, color: COLORS.textSec, fontStyle: 'italic', marginBottom: 25 },
  
  // BOTÃO ASSISTIR DINÂMICO
  btnAssistirDinamico: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    alignItems: 'center',
    padding: 8,
    width: 500, // Largura fixa para ficar bonito na TV
    borderWidth: 2,
    borderColor: 'transparent',
  },
  btnAssistirDinamicoFocused: {
    borderColor: COLORS.textRef,
    transform: [{ scale: 1.05 }],
    backgroundColor: 'rgba(255,255,255,0.2)',
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
    fontSize: 14,
    color: COLORS.textSec,
    textTransform: 'uppercase',
    fontWeight: 'bold',
    marginBottom: 2,
  },
  btnAssistirEpNome: {
    fontSize: 18,
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
    marginLeft: 3, // Centraliza o ícone de play visualmente
  },

  contentSection: { backgroundColor: COLORS.bg, paddingHorizontal: 50, marginTop: -20, paddingTop: 20 },
  seasonsContainer: { marginBottom: 20 },
  sectionTitle: { fontSize: 24, fontWeight: 'bold', color: COLORS.textRef, marginBottom: 15 },
  seasonsListContent: { gap: 10, paddingVertical: 5 },
  seasonButton: { width: 70, height: 45, backgroundColor: COLORS.bgCard, borderRadius: 8, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: 'transparent' },
  seasonButtonSelected: { backgroundColor: COLORS.primary },
  seasonButtonFocused: { borderColor: COLORS.textRef, transform: [{ scale: 1.1 }], backgroundColor: COLORS.bgCardFocused },
  seasonButtonText: { fontSize: 18, fontWeight: 'bold', color: COLORS.textSec },
  seasonButtonTextSelected: { color: '#000' },
  seasonButtonTextFocused: { color: COLORS.textRef },
  episodesContainer: { gap: 15 },
  epCard: { flexDirection: 'row', backgroundColor: COLORS.bgCard, borderRadius: 12, overflow: 'hidden', height: 110, alignItems: 'center', position: 'relative' },
  epCardFocused: { backgroundColor: COLORS.bgCardFocused, transform: [{ scale: 1.02 }] },
  epCardAssistido: { opacity: 0.5 },
  epFocusBorder: { ...StyleSheet.absoluteFillObject, borderWidth: 3, borderColor: COLORS.textRef, borderRadius: 12 },
  epThumbnailWrapper: { width: 180, height: '100%', position: 'relative' },
  epThumbnail: { width: '100%', height: '100%' },
  epDurationBadge: { position: 'absolute', bottom: 5, right: 5, backgroundColor: 'rgba(0,0,0,0.75)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  epDurationText: { color: COLORS.textRef, fontSize: 12, fontWeight: 'bold' },
  epCheckBadge: { position: 'absolute', top: 5, left: 5, backgroundColor: COLORS.success, width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  epCheckText: { color: '#FFF', fontSize: 14, fontWeight: 'bold' },
  epTextContainer: { flex: 1, paddingHorizontal: 20, justifyContent: 'center' },
  epTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.textRef, marginBottom: 5 },
  epTitleFocused: { color: COLORS.primary },
  epSinopse: { fontSize: 14, color: COLORS.textSec, lineHeight: 20 },
  modalBackground: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.9)', justifyContent: 'center', alignItems: 'center' },
  modalContainer: { width: 500, backgroundColor: '#1A1A1A', borderRadius: 15, padding: 35, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border },
  modalTitle: { fontSize: 28, fontWeight: 'bold', color: COLORS.textRef, marginBottom: 10 },
  modalSubtitle: { fontSize: 20, color: COLORS.textSec, textAlign: 'center', marginBottom: 35 },
  modalButtonContainer: { flexDirection: 'row', gap: 20 },
  modalButton: { paddingVertical: 15, paddingHorizontal: 30, borderRadius: 10, minWidth: 180, alignItems: 'center', backgroundColor: '#333', borderWidth: 3, borderColor: 'transparent' },
  modalButtonConfirm: { backgroundColor: COLORS.success },
  modalButtonFocused: { borderColor: COLORS.textRef, transform: [{ scale: 1.08 }] },
  modalButtonText: { color: COLORS.textRef, fontSize: 20, fontWeight: 'bold' },
});