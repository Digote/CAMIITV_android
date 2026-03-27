import React, { useEffect, useRef, useState } from 'react';
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
  Button,
  ImageBackground,
} from 'react-native';

import TemporadasSelector from '@/components/AnimeData/TemporadasSelector';
import { useLocalSearchParams } from 'expo-router';
import axios from 'axios';
import api from '@/services/api';
import SendIntentAndroid from 'react-native-send-intent';

const screenHeight = Dimensions.get('window').height;

export default function AnimeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  // REFERÊNCIAS
  const scrollRef = useRef<ScrollView>(null);
  const watchButtonRef = useRef<View>(null);
  const addButtonRef = useRef<View>(null);
  const tabVideosRef = useRef<View>(null);
  const appState = useRef(AppState.currentState);

  // ESTADOS DE UI E FOCO
  const [focusedButton, setFocusedButton] = useState<'add' | 'watch' | null>('watch');
  const [selectedTab, setSelectedTab] = useState<'videos' | 'details'>('videos');
  const [scrollY, setScrollY] = useState(0);
  const [isSeasonColumnFocused, setIsSeasonColumnFocused] = useState(false); // Antigo 'cl1'

  // ESTADOS DE DADOS
  const [anime, setAnime] = useState<any>({});
  const [temporadas, setTemporadas] = useState<any[]>([]);
  const [episodiosLista, setEpisodiosLista] = useState<any[]>([]);
  
  const [selectedTemporadaButton, setSelectedTemporadaButton] = useState('');
  const [preferredTemporadaIndex, setPreferredTemporadaIndex] = useState(0);

  // ESTADOS DO PLAYER (VLC)
  const [modalVisible, setModalVisible] = useState(false);
  const [episodioEmExecucao, setEpisodioEmExecucao] = useState<any>(null);
  const esperandoRetornoRef = useRef(false);
  const epExecucaoRef = useRef<any>(null);
  // Guarda o momento em que o VLC foi aberto (em milissegundos)
  const tempoInicioVlcRef = useRef<number | null>(null);

  // ==========================================
  // EFEITOS
  // ==========================================

  // Busca inicial dos dados
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
          setSelectedTemporadaButton(mapped[0].id);
          setPreferredTemporadaIndex(0);
          setEpisodiosLista(mapped[0].episodios);
        } else {
          setTemporadas([]);
        }
      } catch (error) {
        console.error("Erro ao buscar dados do anime", error);
        setTemporadas([]);
      }
    };

    fetchAnimeData();
  }, [id]);

  // Monitora quando o usuário volta do VLC para o App
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      
      if (appState.current.match(/inactive|background/) && nextAppState === "active") {
        
        if (esperandoRetornoRef.current && epExecucaoRef.current) {
          
          // ---> CALCULA O TEMPO GASTO <---
          if (tempoInicioVlcRef.current) {
            const tempoFim = Date.now();
            const tempoGastoMs = tempoFim - tempoInicioVlcRef.current;
            
            // Converte de milissegundos para minutos e segundos
            const minutosGastos = Math.floor(tempoGastoMs / 60000);
            const segundosGastos = Math.floor((tempoGastoMs % 60000) / 1000);
            
            console.log(`Tempo no VLC: ${minutosGastos}m ${segundosGastos}s`);

            // Exemplo de regra de negócio inteligente:
            // Só exibe o modal se o usuário ficou pelo menos 3 minutos fora
            if (minutosGastos >= 3) {
              setModalVisible(true);
            } else {
              console.log("Assistiu muito pouco tempo, não vou exibir o modal.");
              // Limpa o episódio em execução já que cancelamos
              setEpisodioEmExecucao(null);
              epExecucaoRef.current = null;
            }
          } else {
            // Se por algum motivo não pegou o tempo, abre o modal por garantia
            setModalVisible(true);
          }

          esperandoRetornoRef.current = false;
          tempoInicioVlcRef.current = null; // Reseta o tempo
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

      setEpisodiosLista(prev => 
        prev.map(ep => 
          ep.id === episodioEmExecucao.id ? { ...ep, assistido: { completo: 1 } } : ep
        )
      );
    } catch (error) {
      console.error("Erro ao marcar como assistido", error);
    } finally {
      setModalVisible(false);
      setEpisodioEmExecucao(null);
      epExecucaoRef.current = null; // <-- Limpa a Ref do episódio
    }
  };
  const vlcPress = async (ep: any) => {
    const item = ep.links[0];
    if (!item) return;

    // 1. Atualiza o estado visual e a Ref instantaneamente
    setEpisodioEmExecucao(ep);
    epExecucaoRef.current = ep; 
    esperandoRetornoRef.current = true; // <-- Já avisa que estamos esperando a volta do VLC!
    tempoInicioVlcRef.current = Date.now(); // ---> SALVA A HORA EXATA QUE ABRIU O VLC <---

    const title = `${ep.numero} - ${ep.nome}`;

    try {
      if (item.toLowerCase().startsWith("magnet")) {
        const result = await axios.post("https://tx.camii.com.br/create", { magnet: item });
        const url = `https://tx.camii.com.br${result.data.streamUrl}`;
        SendIntentAndroid.openAppWithData("org.videolan.vlc", url, "video/*", { title });
      } else {
        SendIntentAndroid.openAppWithData("org.videolan.vlc", item, "video/*", { title });
      }
    } catch (error) {
      console.error("Erro ao abrir VLC:", error);
      esperandoRetornoRef.current = false; // Cancela a espera se der erro ao abrir o VLC
    }
  };

  const setEpisodesByTemporada = (id: string = '') => {
    setSelectedTemporadaButton(id);
    const temp = temporadas.find((t: any) => t.id === id);
    if (temp) setEpisodiosLista(temp.episodios);
  };

  function getEpisodeLinks(linksString: string): string[][] {
    if (!linksString) return [];
    return linksString.split('\n').map(line =>
      line.split(';').map(link => link.trim()).filter(Boolean)
    );
  }

  function focusLastButton() {
    if (addButtonRef.current && 'focus' in addButtonRef.current) {
      (addButtonRef.current as any).focus();
      setFocusedButton('add');
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    }
  }

  function setSelectedTabView(tab: 'videos' | 'details') {
    setSelectedTab(tab);
    tabVideosRef.current?.measure((x, y, width, height, pageX, pageY) => {
      if (scrollY === 0) scrollRef.current?.scrollTo({ y: pageY, animated: true });
    });
  }


  // ==========================================
  // RENDERIZAÇÃO
  // ==========================================

  return (
    <>
      <ScrollView
        ref={scrollRef}
        onScroll={(e) => setScrollY(e.nativeEvent.contentOffset.y)}
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        scrollEnabled={false}
      >
        {/* HEADER E BANNER */}
        <ImageBackground source={{ uri: anime.banner }} resizeMode="cover" style={styles.headerSection}>
          <View style={styles.overlay} />
          
          <View style={styles.left}>
            <Text style={styles.title}>{anime.nome}</Text>
            <Text style={styles.description} ellipsizeMode="tail" numberOfLines={10}>
              {anime.descricao}
            </Text>

            <View style={styles.buttonsContainer}>
              <Pressable
                ref={watchButtonRef as any}
                focusable={true}
                onFocus={() => setFocusedButton('watch')}
                onBlur={() => setFocusedButton(null)}
                onPress={() => console.log('Começar a assistir')}
                style={[styles.button, focusedButton === 'watch' && styles.buttonFocused]}
              >
                <Text style={styles.buttonText}>▶️ Começar a assistir: S1 E1</Text>
              </Pressable>

              <Pressable
                ref={addButtonRef as any}
                focusable={true}
                onFocus={focusLastButton}
                onBlur={() => setFocusedButton(null)}
                onPress={() => console.log('Adicionado à fila')}
                style={[styles.button, focusedButton === 'add' && styles.buttonFocused]}
              >
                <Text style={styles.buttonText}>➕ Adicionar à Fila</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.right}>
            <Image source={{ uri: anime.imagem }} style={styles.banner} resizeMode="cover" />
          </View>
        </ImageBackground>

        {/* TABS */}
        <View style={styles.tabsSection}>
          <View style={styles.tabsContainer}>
            <Pressable
              ref={tabVideosRef as any}
              focusable={true}
              onFocus={() => setSelectedTabView('videos')}
              style={[styles.tabButton, selectedTab === 'videos' && styles.tabSelected]}
            >
              <Text style={styles.tabText}>EPISÓDIOS</Text>
            </Pressable>
          </View>

          {/* CONTEÚDO DAS TABS */}
          {selectedTab === 'videos' && (
            <View style={styles.tabContent}>
              
              {/* LADO ESQUERDO: SELEÇÃO DE TEMPORADA */}
              <View 
                style={styles.columnLeft} 
                focusable={true} 
                onFocus={() => setIsSeasonColumnFocused(true)}
              >
                <TemporadasSelector
                  temporadas={temporadas}
                  selected={selectedTemporadaButton}
                  onSelect={setEpisodesByTemporada}
                  isFocusedColumn={isSeasonColumnFocused}
                  preferredFocusIndex={preferredTemporadaIndex}
                  setPreferredFocusIndex={setPreferredTemporadaIndex}
                />
              </View>

              {/* LADO DIREITO: LISTA DE EPISÓDIOS */}
              <View 
                style={styles.columnRight} 
                onFocus={() => setIsSeasonColumnFocused(false)}
              >
                <ScrollView>
                  {episodiosLista.map((ep: any, index) => (
                    <Pressable
                      key={ep.id || index}
                      android_ripple={{ color: "#9f9c9c80" }}
                      style={({ focused }) => [
                        styles.cardContainer,
                        ep.assistido?.completo === 1 && styles.assistidoCard,
                        focused && { backgroundColor: '#9f9c9c80' }
                      ]}
                      onPress={() => vlcPress(ep)}
                      // CLIQUE LONGO (SEGURAR): Abre o modal direto
                      onLongPress={() => {
                        console.log("Segurou o botão! Abrindo modal...");
                        setEpisodioEmExecucao(ep); // Diz pro modal qual episódio é
                        setModalVisible(true);     // Abre o modal
                      }}
                      
                      // Opcional: Tempo que o usuário precisa segurar (em milissegundos). 
                      // O padrão do Android costuma ser 500ms.
                      delayLongPress={600}
                    >
                      <View style={styles.thumbnailWrapper}>
                        <Image
                          source={{ uri: ep.imagem }}
                          style={[styles.thumbnail, ep.assistido?.completo === 1 && styles.thumbnailAssistido]}
                        />
                        <Text style={styles.duracao}>{ep.duracao}</Text>

                        {ep.assistido?.completo === 1 && (
                          <View style={styles.checkIcon}>
                            <Text style={{ color: "#fff", fontSize: 10 }}>✓</Text>
                          </View>
                        )}
                      </View>

                      <View style={styles.textContainer}>
                        <Text style={styles.titleEP}>E{ep.numero} - {ep.nome}</Text>
                        <Text style={styles.descriptionEP}>{ep.sinopse}</Text>
                      </View>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>

            </View>
          )}
        </View>
      </ScrollView>

      {/* MODAL MOVIDO PARA A RAIZ DO COMPONENTE */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalBackground}>
          <View style={styles.modalContainer}>
            
            <Text style={styles.modalTitle}>Episódio Concluído?</Text>
            <Text style={styles.modalSubtitle}>
              Deseja marcar "{episodioEmExecucao?.nome}" como assistido?
            </Text>

            <View style={styles.modalButtonContainer}>
              {/* Botão Cancelar */}
              <Pressable
                style={({ focused }) => [
                  styles.modalButton,
                  focused && styles.modalButtonFocused
                ]}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.modalButtonText}>Cancelar</Text>
              </Pressable>

              {/* Botão Confirmar */}
              <Pressable
                style={({ focused }) => [
                  styles.modalButton,
                  styles.modalButtonConfirm, // Dá uma cor base diferente (verde)
                  focused && styles.modalButtonFocused
                ]}
                onPress={marcarComoAssistido}
              >
                <Text style={styles.modalButtonText}>Sim, marcar</Text>
              </Pressable>
            </View>

          </View>
        </View>
      </Modal>
    </>
  );
}

// ... SEUS STYLES MANTIDOS EXATAMENTE IGUAIS ...
const styles = StyleSheet.create({
  // Coloque seu StyleSheet original aqui
  scroll: { flex: 1, backgroundColor: '#000' },
  scrollContent: { flexGrow: 1 },
  headerSection: { flexDirection: 'row', padding: 30 },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0, 0, 0, 0.70)' },
  left: { flex: 1, justifyContent: 'center' },
  right: { width: 300, justifyContent: 'center', alignItems: 'center' },
  banner: { width: 250, height: 380, borderRadius: 12 },
  title: { fontSize: 34, color: '#fff', marginBottom: 12, fontWeight: 'bold' },
  description: { fontSize: 18, color: '#ccc', marginBottom: 30, maxWidth: 500, maxHeight: 255, minHeight: 195 },
  buttonsContainer: { flexDirection: 'column', gap: 5 },
  button: { backgroundColor: '#333', paddingVertical: 10, paddingHorizontal: 10, width: 400 },
  buttonFocused: { backgroundColor: '#12bbf3ff' },
  buttonText: { fontSize: 18, color: '#fff' },
  tabsSection: { height: screenHeight, justifyContent: 'flex-start' },
  tabsContainer: { justifyContent: 'center', flexDirection: 'row-reverse', gap: 24, marginBottom: 24 },
  tabButton: { paddingBottom: 8, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabSelected: { borderBottomColor: '#f39c12' },
  tabText: { fontSize: 20, color: '#fff' },
  tabContent: { flex: 1, flexDirection: 'row', width: '100%' },
  columnLeft: { flex: 3, paddingRight: 8 },
  columnRight: { flex: 7, paddingLeft: 8 },
  cardContainer: { flexDirection: 'row', padding: 10, backgroundColor: '#000', alignItems: 'flex-start' },
  thumbnailWrapper: { position: 'relative', width: 120, height: 68, marginRight: 10 },
  thumbnail: { width: '100%', height: '100%', borderRadius: 4 },
  duracao: { position: 'absolute', bottom: 4, right: 4, backgroundColor: 'rgba(0,0,0,0.7)', color: '#fff', fontSize: 12, paddingHorizontal: 4, borderRadius: 3 },
  textContainer: { flex: 1 },
  titleEP: { color: '#fff', fontWeight: 'bold', fontSize: 14, marginBottom: 2 },
  descriptionEP: { color: '#aaa', fontSize: 12 },
  assistidoCard: { opacity: 0.6 },
  thumbnailAssistido: { borderWidth: 2, borderColor: "#4caf50" },
  checkIcon: { position: 'absolute', top: 5, right: 5, backgroundColor: '#4caf50', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2 },
 
  // --- ESTILOS DO MODAL ---
  modalBackground: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)', // Fundo mais escuro para destacar o modal
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: 500, // Tamanho bom para TV
    backgroundColor: '#1E1E1E', // Cinza escuro moderno
    borderRadius: 12,
    padding: 30,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333',
  },
  modalTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 12,
  },
  modalSubtitle: {
    fontSize: 18,
    color: '#AAA',
    textAlign: 'center',
    marginBottom: 35,
  },
  modalButtonContainer: {
    flexDirection: 'row', // Coloca os botões lado a lado
    gap: 20,
    width: '100%',
    justifyContent: 'center',
  },
  modalButton: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 8,
    minWidth: 160,
    alignItems: 'center',
    backgroundColor: '#333', // Cor padrão de fundo do botão
    borderWidth: 2,
    borderColor: 'transparent',
  },
  modalButtonConfirm: {
    backgroundColor: '#2e7d32', // Verde base para o confirmar
  },
  modalButtonFocused: {
    backgroundColor: '#12bbf3ff', // O seu azul padrão de foco
    borderColor: '#FFF', // Borda branca para destacar bem na TV
    transform: [{ scale: 1.05 }], // Leve zoom quando focado
  },
  modalButtonText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
});