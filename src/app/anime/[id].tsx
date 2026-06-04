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
  Animated
} from 'react-native';

import { FlashList } from '@shopify/flash-list';
import { Image as ExpoImage } from 'expo-image'; // Usaremos nas thumbnails dos episódios

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

const SeasonItem = ({ item, isSelected, onSelectSeason, setFocusedIndex, index }:any) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handleFocus = () => {
    setFocusedIndex(index);
    onSelectSeason(item.id);
    // Animação suave ao receber o foco
    Animated.spring(scaleAnim, { toValue: 1.1, useNativeDriver: true, speed: 20 }).start();
  };

  const handleBlur = () => {
    setFocusedIndex(null);
    // Volta ao tamanho normal
    Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, speed: 20 }).start();
  };

  return (
    <Pressable
      focusable={true}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onPress={() => {
        setFocusedIndex(index);
        onSelectSeason(item.id);
      }}
      // Este padding em volta garante que a borda não seja cortada quando o item crescer
      style={{ paddingVertical: 10, paddingHorizontal: 5 }} 
    >
      {({ focused, pressed }) => (
        <Animated.View
          style={[
            styles.seasonButton,
            isSelected && styles.seasonButtonSelected,
            (focused || pressed) && styles.seasonButtonFocused,
            { transform: [{ scale: scaleAnim }] } // O zoom entra aqui de forma animada
          ]}
        >
          <Text style={[
            styles.seasonButtonText,
            isSelected && styles.seasonButtonTextSelected,
            (focused || pressed) && styles.seasonButtonTextFocused
          ]}>
            {item.numero === 'Digital' ? 'Digital' : `T${item.numero}`}
          </Text>
        </Animated.View>
      )}
    </Pressable>
  );
};

export default function AnimeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  // REFERÊNCIAS
  const scrollRef = useRef<ScrollView>(null);
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
          imagem: item.imagem,   
          banner: item.banner,   
          descricao: item.descricao,
          ano: item.temporada_ano,
          nota: item.nota_mal,
          nota_tmdb: item.nota_tmdb,
          generos: ['*dev*','Ação', 'Sci-Fi', 'Aventura']
        });

        if (item.temporadas && Array.isArray(item.temporadas)) {
          const mapped = item.temporadas.map((temp: any) => {
            let eps: any[] = [];
            const episodeLinks = getEpisodeLinks(temp.link || '');

            // 1. Se existem episódios normais cadastrados na temporada
            if (temp.episodios && temp.episodios.length > 0) {
              eps = temp.episodios.map((ep: any, idx: number) => {
                let linksDoEpisodio = episodeLinks[idx] || [];
                let isDigital = false; // <-- NOVA FLAG AQUI
                
                if (linksDoEpisodio.length === 0 && temp.anime_digital && temp.anime_digital.episodios) {
                  const digitalMatch = temp.anime_digital.episodios.find((digEp: any) => {
                    const numeros = digEp.nome ? digEp.nome.match(/\d+/g) : null;
                    const numDigital = numeros ? parseInt(numeros[numeros.length - 1], 10) : -1;
                    return numDigital === Number(ep.numero); 
                  });
                  
                  if (digitalMatch && digitalMatch.link) {
                    linksDoEpisodio = [digitalMatch.link];
                    isDigital = true; // <-- MARCA COMO DIGITAL SE ACHOU O LINK LÁ
                  }
                }

                return {
                  id: ep.id?.toString() || '',
                  nome: ep.nome || `Episódio ${ep.numero}`,
                  numero: Number(ep.numero),
                  assistido: ep.assistido,
                  duracao: ep.duracao ? ep.duracao + 'm' : '--m',
                  imagem: ep.imagem || item.imagem,
                  sinopse: ep.sinopse || '',
                  links: linksDoEpisodio, 
                  isDigital: isDigital, // <-- SALVA A FLAG NO EPISÓDIO
                };
              });

            } 
            // 2. Se a temporada for vazia e usar apenas o anime_digital
            else if (temp.anime_digital && temp.anime_digital.episodios) {
              eps = temp.anime_digital.episodios.map((ep: any, idx: number) => {
                const numeros = ep.nome ? ep.nome.match(/\d+/g) : null;
                const numeroExtraido = numeros ? parseInt(numeros[numeros.length - 1], 10) : idx + 1;

                return {
                  id: ep.id_episode?.toString() || ep.id?.toString() || `dig-${idx}`,
                  nome: ep.nome || `Episódio ${numeroExtraido}`,
                  numero: numeroExtraido,
                  assistido: null,
                  duracao: '--m', 
                  imagem: item.imagem, 
                  sinopse: 'Episódio da versão digital.',
                  links: ep.link ? [ep.link] : [], 
                  isDigital: true, // <-- TODOS AQUI SÃO DIGITAIS
                };
              });
            }

            // Ordena os episódios pelo número para não ficarem bagunçados
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
  }, [temporadas]); 

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
      
      setTemporadas(prevTemps => {
        const newTemps = prevTemps.map(temp => ({
          ...temp,
          episodios: temp.episodios.map((ep:any) => 
            ep.id === episodioEmExecucao.id ? { ...ep, assistido: { completo: 1 } } : ep
          )
        }));

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
    
    // Verifica se tem link
    const hasLink = proximoEpisodio.links && proximoEpisodio.links.length > 0;
    if (!hasLink) return "Indisponível";

    const isFirstEpOfAnime = proximoEpisodio.id === temporadas[0].episodios[0]?.id;
    const hasNotWatchedFirst = proximoEpisodio.assistido?.completo !== 1;
    
    return (isFirstEpOfAnime && hasNotWatchedFirst) ? "Começar a Assistir" : "Continuar Assistindo";
  };

  // Verifica se o próximo episódio no topo tem link ativo
  const mainEpisodeHasLink = proximoEpisodio?.links && proximoEpisodio.links.length > 0;

  // ==========================================
  // RENDERIZAÇÃO
  // ==========================================

  // Tudo o que ficava antes do map() agora é o Header da nossa FlashList
  const renderHeader = () => (
    <>
      <View style={styles.headerContainer}>
        <View style={styles.headerLeft}>
          <Text style={styles.animeTitle} numberOfLines={2}>{anime.nome}</Text>
          
          <View style={styles.metadataRow}>
            <Text style={styles.metaNota}>★ {anime.nota}<Text style={styles.metaNotaType}>MAL</Text></Text>
            <Text style={styles.metaNota}>★ {anime.nota_tmdb}<Text style={styles.metaNotaType}>TMBD</Text></Text>
            <Text style={styles.metaText}>{anime.ano}</Text>
            <Text style={styles.metaText}>{temporadas.length} Temporada(s)</Text>
          </View>

          <Text style={styles.animeDescription} ellipsizeMode="tail" numberOfLines={4}>
            {anime.descricao}
          </Text>
          <Text style={styles.genresText}>{anime.generos?.join(' • ')}</Text>

          {/* BOTÃO ASSISTIR DINÂMICO AQUI (MANTÉM O SEU CÓDIGO ORIGINAL) */}
          {proximoEpisodio && (
            <Pressable
              hasTVPreferredFocus={true} 
              focusable={mainEpisodeHasLink} 
              disabled={!mainEpisodeHasLink} 
              onPress={() => vlcPress(proximoEpisodio)}
              // ADICIONADO: "pressed" para reagir ao toque no celular
              style={({ focused, pressed }) => [
                styles.btnAssistirDinamico,
                (focused || pressed) && styles.btnAssistirDinamicoFocused,
                !mainEpisodeHasLink && styles.btnAssistirDinamicoDisabled 
              ]}
            >
              {({ focused, pressed }) => (
                <>
                  <Image source={{ uri: proximoEpisodio.imagem }} style={styles.btnAssistirImg} resizeMode="cover" />
                  <View style={styles.btnAssistirContent}>
                    <Text style={[styles.btnAssistirLabel, (focused || pressed) && { color: COLORS.textRef }]}>
                      {getWatchButtonText()}
                    </Text>
                    <Text style={[styles.btnAssistirEpNome, (focused || pressed) && { color: COLORS.primary }]} numberOfLines={1}>
                      {temporadaProximoEp?.numero === 'Digital' ? 'Digital' : `T${temporadaProximoEp?.numero}`} : E{proximoEpisodio.numero} - {proximoEpisodio.nome}
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

      <View style={[styles.contentSection, { paddingBottom: 15 }]}>
        <View style={styles.seasonsContainer}>
          <Text style={styles.sectionTitle}>Episódios</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.seasonsListContent}>
            {temporadas.map((item, index) => (
              <SeasonItem
                key={item.id}
                item={item}
                index={index}
                isSelected={selectedTemporadaId === item.id}
                onSelectSeason={handleSelectTemporada}
                setFocusedIndex={setSeasonFocusedIndex}
              />
            ))}
          </ScrollView>
        </View>
      </View>
    </>
  );

  return (
    <View style={styles.container}>
      <Image source={{ uri: anime.banner }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      <View style={styles.gradientReplacement} />

      {/* A FlashList substitui o ScrollView principal */}
      <FlashList
        data={episodiosLista}
        ListHeaderComponent={renderHeader}
        keyExtractor={(item, index) => item.id ? item.id.toString() : index.toString()}
        contentContainerStyle={{ paddingBottom: 50, paddingHorizontal: 50 }}
        showsVerticalScrollIndicator={false}
        // renderItem substitui o seu antigo .map()
        renderItem={({ item: ep }) => {
          const isAssistido = ep.assistido?.completo === 1;
          const hasLink = ep.links && ep.links.length > 0; 
          
          return (
            <Pressable
              focusable={hasLink} 
              disabled={!hasLink} 
              style={({ focused, pressed }) => [
                styles.epCard,
                { marginBottom: 15 }, // Substitui o gap do episodesContainer antigo
                (focused || pressed) && styles.epCardFocused,
                isAssistido && styles.epCardAssistido,
                !hasLink && styles.epCardDisabled 
              ]}
              onPress={() => vlcPress(ep)}
              onLongPress={() => {
                setEpisodioEmExecucao(ep);
                setModalVisible(true);
              }}
            >
              {({ focused, pressed }) => (
                <>
                  <View style={styles.epThumbnailWrapper}>
                    {/* Trocado para o ExpoImage de alta performance */}
                    <ExpoImage 
                       source={{ uri: ep.imagem }} 
                       style={styles.epThumbnail} 
                       contentFit="cover" 
                       cachePolicy="disk"
                    />
                    <View style={styles.epDurationBadge}><Text style={styles.epDurationText}>{ep.duracao}</Text></View>
                    {isAssistido && <View style={styles.epCheckBadge}><Text style={styles.epCheckText}>✓</Text></View>}
                    
                    {ep.isDigital && (
                      <View style={styles.epDigitalBadge}>
                        <Text style={styles.epDigitalText}>DIGITAL</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.epTextContainer}>
                    <Text style={[styles.epTitle, (focused || pressed) && styles.epTitleFocused]} numberOfLines={1}>
                      {ep.numero}. {ep.nome} {!hasLink && "(Em breve)"}
                    </Text>
                    <Text style={styles.epSinopse} numberOfLines={2}>
                      {ep.sinopse || 'Sem sinopse disponível para este episódio.'}
                    </Text>
                  </View>
                  {(focused || pressed) && <View style={styles.epFocusBorder} />}
                </>
              )}
            </Pressable>
          );
        }}
      />

      {/* MODAL */}
      <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalBackground}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>Marcar como assistido?</Text>
            <Text style={styles.modalSubtitle}>"{episodioEmExecucao?.nome}"</Text>
            <View style={styles.modalButtonContainer}>
              <Pressable 
                style={({ focused, pressed }) => [styles.modalButton, styles.modalButtonConfirm, (focused || pressed) && styles.modalButtonFocused]} 
                onPress={marcarComoAssistido}
              >
                <Text style={styles.modalButtonText}>Sim, marcar</Text>
              </Pressable>
              <Pressable 
                style={({ focused, pressed }) => [styles.modalButton, (focused || pressed) && styles.modalButtonFocused]} 
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
  
  headerContainer: {
    flexDirection: 'row',
    paddingTop: screenHeight * 0.15,
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
    width: 250,
    justifyContent: 'flex-end',
  },
  animePoster: {
    width: 250,
    height: 375,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#333',
  },

  animeTitle: { fontSize: 48, fontWeight: '900', color: COLORS.textRef, letterSpacing: -1, marginBottom: 10, textShadowColor: 'rgba(0, 0, 0, 0.8)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 4 },
  metadataRow: { flexDirection: 'row', alignItems: 'center', gap: 15, marginBottom: 15 },
  metaNota: { fontSize: 18, color: COLORS.accent, fontWeight: 'bold' },
  metaNotaType: { fontSize: 5, color: COLORS.accent, fontWeight: 'bold' },
  metaText: { fontSize: 16, color: COLORS.textSec },
  animeDescription: { fontSize: 18, color: COLORS.textSec, lineHeight: 26, marginBottom: 10 },
  genresText: { fontSize: 14, color: COLORS.textSec, fontStyle: 'italic', marginBottom: 25 },
  
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
    opacity: 0.5, // Botão de cima fica opaco se não tiver link
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
    marginLeft: 3,
  },

  contentSection: { backgroundColor: COLORS.bg, paddingHorizontal: 50, marginTop: -20, paddingTop: 20 },
  seasonsContainer: { marginBottom: 20 },
  sectionTitle: { fontSize: 24, fontWeight: 'bold', color: COLORS.textRef, marginBottom: 15 },
  seasonsListContent: { gap: 10, paddingVertical: 5 },
  seasonButton: { minWidth: 70, paddingHorizontal: 15, height: 45, backgroundColor: COLORS.bgCard, borderRadius: 8, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: 'transparent' },
  seasonButtonSelected: { backgroundColor: COLORS.primary },
  seasonButtonFocused: { borderColor: COLORS.textRef, backgroundColor: COLORS.bgCardFocused },
  seasonButtonText: { fontSize: 18, fontWeight: 'bold', color: COLORS.textSec },
  seasonButtonTextSelected: { color: '#000' },
  seasonButtonTextFocused: { color: COLORS.textRef },
  episodesContainer: { gap: 15 },
  
  epCard: { flexDirection: 'row', backgroundColor: COLORS.bgCard, borderRadius: 12, overflow: 'hidden', height: 110, alignItems: 'center', position: 'relative' },
  epCardFocused: { backgroundColor: COLORS.bgCardFocused, transform: [{ scale: 1.02 }] },
  epCardAssistido: { opacity: 0.5 },
  epCardDisabled: { opacity: 0.35 }, // Nova classe de estilo para os episódios desativados
  
  epFocusBorder: { ...StyleSheet.absoluteFillObject, borderWidth: 3, borderColor: COLORS.textRef, borderRadius: 12 },
  epThumbnailWrapper: { width: 180, height: '100%', position: 'relative' },
  epThumbnail: { width: '100%', height: '100%' },
  epDurationBadge: { position: 'absolute', bottom: 5, right: 5, backgroundColor: 'rgba(0,0,0,0.75)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  epDurationText: { color: COLORS.textRef, fontSize: 12, fontWeight: 'bold' },
  epCheckBadge: { position: 'absolute', top: 5, left: 5, backgroundColor: COLORS.success, width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  epCheckText: { color: '#FFF', fontSize: 14, fontWeight: 'bold' },
  epDigitalBadge: { position: 'absolute', top: 5, right: 5, backgroundColor: COLORS.primary, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  epDigitalText: { color: '#000', fontSize: 10, fontWeight: 'bold' },
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