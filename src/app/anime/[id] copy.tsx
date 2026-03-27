import React, { useEffect, useRef, useState } from 'react';
import {
  Dimensions,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  NativeSyntheticEvent,
  KeyboardEvent,
  findNodeHandle,
  InteractionManager,
  Linking,
  AppState,
  Modal,
  Button,
  ImageBackground,
} from 'react-native';

import TemporadasSelector from '@/components/AnimeData/TemporadasSelector';
import { useLocalSearchParams, Link } from 'expo-router';
import axios from 'axios';
import api from '@/services/api';
import SendIntentAndroid from 'react-native-send-intent';

const screenHeight = Dimensions.get('window').height;

export default function AnimeScreen() {

  const { id } = useLocalSearchParams<{ id: string }>();

  const [focusedButton, setFocusedButton] = useState<'add' | 'watch' | null>('watch');
  const [selectedTab, setSelectedTab] = useState<'videos' | 'details' >('');
  const scrollRef = useRef<ScrollView>(null);
  const [scrollY, setScrollY] = useState(0);

  const watchButtonRef = useRef<Pressable>(null);
  const addButtonRef = useRef<Pressable>(null);
  

  // Função para focar o último botão (add)
  function focusLastButton() {
    if (addButtonRef.current && 'focus' in addButtonRef.current) {
      addButtonRef.current.focus();
      setFocusedButton('add');
      scrollRef.current.scrollTo({ y: 0, animated: true });
    }
  }

  const tabVideosRef = useRef(null);
  function setSelectedTabView(tab){
    setSelectedTab(tab);
    
    tabVideosRef.current?.measure((x, y, width, height, pageX, pageY) => {
      if(scrollY == 0)
        scrollRef.current.scrollTo({ y: pageY, animated: true });
    });
  }



  // VLC
  const [modalVisible, setModalVisible] = useState(false);
  const [esperandoRetorno, setEsperandoRetorno] = useState(false);
  const [episodioEmExecucao, setEpisodioEmExecucao] = useState<any>(null);
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      if (
        appState.current.match(/active/) &&
        nextAppState === "background"
      ) {
        if (episodioEmExecucao) {
          setEsperandoRetorno(true);
        }
      }

      if (
        appState.current.match(/background|inactive/) &&
        nextAppState === "active"
      ) {
        if (esperandoRetorno && episodioEmExecucao) {
          setModalVisible(true); // exibe modal ao retornar
          setEsperandoRetorno(false);
        }
      }

      appState.current = nextAppState;
    });

    return () => subscription.remove();
  }, [episodioEmExecucao, esperandoRetorno]);

  const marcarComoAssistido = async () => {
    if (!episodioEmExecucao) return;

    try {
      // await api.post(`/episodios/${episodioEmExecucao.id}/assistir`, {
      await api.post(`/episodio/${episodioEmExecucao.id}/assistido`);
      episodioEmExecucao.assistido = {completo:1};

      console.log("Marcado como assistido");
    } catch (error) {
      console.error("Erro ao marcar como assistido", error);
    }

    setModalVisible(false);
    setEpisodioEmExecucao(null);
  };


  const vlcPress = async (ep:any) => {

    const item =  ep.links[0]
    
    
    if(item.toLowerCase().startsWith("magnet")){
      // console.log(item)

      try {  
        const result = await axios.post("https://tx.camii.com.br/create", {
          magnet: item
        });
        // console.log(result.data.streamUrl)
        // return
        
        
        
        setEpisodioEmExecucao(ep); // salva episódio em execução
        
        // const url = `vlc://https://tx.camii.com.br${result.data.streamUrl}`
        // Linking.openURL(urlT);
        
        const title = ep.numero +" - "+ ep.nome
        const url = `https://tx.camii.com.br${result.data.streamUrl}`
        SendIntentAndroid.openAppWithData("org.videolan.vlc",
          url,
          "video/*", {
            title: title,
        } 
    );

      } catch (error) {
        console.error("Erro na requisição:", error);
      }
      
      return;
    }
    
    // console.log(ep.numero +" - "+ ep.nome)
    // return;
  
    setEpisodioEmExecucao(ep); // salva episódio em execução
    
    // const url = `vlc://${item}`;
    // Linking.openURL(url);
    
    const title = ep.numero +" - "+ ep.nome
    const url = item;

    SendIntentAndroid.openAppWithData("org.videolan.vlc",
      url,
      "video/*", {
        title: title,
      } 
    );



  };

  // ANIME DATA
  const defaultAnime = {
    id: id,
    nome: '',
    imagem: '',
    banner: '',
    descricao: '',
    
    rating: '8.1',
    years: '2006–2018',
    network: 'TV Tokyo',
    seasons: '1 Temp.',
    age: 'TV‑14',
    genre: 'Science Fiction',
  };

  const [anime, setAnime] = React.useState(defaultAnime);

  // TEMPORADA
  const [selectedTemporadaButton, setselectedTemporadaButton] = useState('');
  const [cl1, setcl1] = useState(false);
  const [preferredTemporadaIndex, setPreferredTemporadaIndex] = useState(0);
  const [temporadas, setTemporadas] = React.useState([]);
  const [episodiosLista, setEpisodiosLista] = React.useState([]);

  React.useEffect(() => {
    if (!id) return;
    // axios.get(`https://tv.camii.com.br/api/anime/${id}`)
    api.get(`/anime/${id}`)
      .then(res => {
        const data = res.data;

        // console.log(data)
        const item = Array.isArray(data) ? data[0] : data;
        setAnime({
          ...defaultAnime,
          id: item.id?.toString() || defaultAnime.id,
          nome: item.nome,
          imagem: item.imagem,
          banner: item.banner,
          descricao: item.descricao,
        });
        // Monta temporadas e episódios, incluindo links
        if (item.temporadas && Array.isArray(item.temporadas)) {
          const mapped = item.temporadas.map((temp:any) => {
            // links por episódio
            const episodeLinks = getEpisodeLinks(temp.link || '');
            return {
              id: temp.id?.toString() || '',
              numero: temp.numero,

              episodios: (temp.episodios || []).map((ep:any, idx:any) => ({
                id: ep.id?.toString() || '',
                nome: ep.nome || `Episódio ${ep.numero}`,
                numero: ep.numero,
                epx: ep,
                assistido: ep.assistido,
                duracao: ep.duracao+'m',
                imagem: ep.imagem || anime.imagem,
                sinopse: ep.sinopse || '',
                links: episodeLinks[idx] || [],
              })),

            };
          });
          setTemporadas(mapped);
          setselectedTemporadaButton(mapped[0].id)
          setPreferredTemporadaIndex(0) //hasTVPreferredFocus
          setEpisodiosLista(mapped[0].episodios)
        } else {
          setTemporadas([]);
        }
      })
      .catch(() => {
        setAnime(defaultAnime);
        setTemporadas([]);
      });
  }, [id]);

  function setEpisodesByTemporada(id=''){
    setselectedTemporadaButton(id)
    const temp = temporadas.find((t:any)=> t.id == id) as any
    setEpisodiosLista(temp.episodios);
  }

  // Função para extrair links dos episódios de uma temporada
  function getEpisodeLinks(linksString: string): string[][] {
    if (!linksString) return [];
    // separa por linhas (\n)
    return linksString.split('\n').map(line =>
      line.split(';').map(link => link.trim()).filter(link => link)
    );
  }


  return (
    <ScrollView
      ref={scrollRef}
      onScroll={(e) => {
        setScrollY(e.nativeEvent.contentOffset.y)
      }}
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      scrollEnabled={false}
    >
      <ImageBackground  source={{ uri: anime.banner }} resizeMode="cover" style={styles.headerSection}>
        <View style={styles.overlay} />
        <View style={styles.left}>
          <Text style={styles.title}>{anime.nome}</Text>
          <Text style={styles.description}  ellipsizeMode="tail" numberOfLines={10}>
            {anime.descricao}
          </Text>

          <View style={styles.buttonsContainer}>
            <Pressable
              ref={watchButtonRef}
              focusable={true}
              onFocus={() => setFocusedButton('watch')}
              onBlur={() => setFocusedButton(null)}
              // onKeyDown={onButtonKeyDown}
              onPress={() => console.log('Começar a assistir')}
              style={[styles.button, focusedButton === 'watch' && styles.buttonFocused]}
            >
              <Text style={styles.buttonText}>▶️ Começar a assistir: S1 E1</Text>
            </Pressable>

            <Pressable
              ref={addButtonRef}
              focusable={true}
              onFocus={() => focusLastButton()}
              onBlur={() => setFocusedButton(null)}
              // onKeyDown={onButtonKeyDown}
              onPress={() => console.log('Adicionado à fila')}
              style={[styles.button, focusedButton === 'add' && styles.buttonFocused]}
            >
              <Text style={styles.buttonText}>➕ Adicionar à Fila</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.right}>
          <Image
            source={{ uri: anime.imagem }}
            style={styles.banner}
            resizeMode="cover"
          />
        </View>
      </ImageBackground>

      {/* TABS */}
      <View style={styles.tabsSection}>
        <View style={styles.tabsContainer}>

          {/* <Pressable
            focusable={true}
            onFocus={() => setSelectedTabView('details')}
            // onKeyDown={onTabKeyDown}
            style={[styles.tabButton, selectedTab === 'details' && styles.tabSelected]}
          >
            <Text style={styles.tabText}>DETALHES</Text>
          </Pressable> */}

          <Pressable
            ref={tabVideosRef}
            focusable={true}
            onFocus={() => setSelectedTabView('videos')}
            // onKeyDown={onTabKeyDown}
            style={[styles.tabButton, selectedTab === 'videos' && styles.tabSelected]}
          >
            <Text style={styles.tabText}>EPISÓDIOS</Text>
          </Pressable>
        </View>

        {/* COTNENT */}

        {selectedTab == 'details' && (
          <View style={styles.tabContent}>
            <Text style={styles.tabContentText}>
              Conteúdo da aba selecionada: {selectedTab.toUpperCase()}
            </Text>
          </View>
        )}

        {selectedTab == 'videos' && (
          <View style={styles.tabContent}>
            {/* TEMPORADAS */}

            <View style={styles.columnLeft}
              focusable={true}
              onFocus={()=> {setcl1(true)}}
            >
              <TemporadasSelector
                temporadas={temporadas}
                selected={selectedTemporadaButton}
                onSelect={(id:any) => setEpisodesByTemporada(id)}
                isFocusedColumn={cl1}
                preferredFocusIndex={preferredTemporadaIndex}
                setPreferredFocusIndex={setPreferredTemporadaIndex}
              />
            </View>

            <View style={styles.columnRight}
               onFocus={()=> {
                // console.log(29)
                setcl1(false)
              }}
            >

              <ScrollView>
                {episodiosLista.map((ep:any, index) => {
                  return (
                    <Pressable 
                      key={index}
                      onFocus={() => console.log("bbb")}
                      android_ripple={{ color: "#9f9c9c80" }}
                      // style={[
                      //   styles.cardContainer,
                      //   ep.assistido?.completo === 1 && styles.assistidoCard // aplica estilo se assistido
                      // ]}
                      style={({ focused }) => [
                        styles.cardContainer,
                        ep.assistido?.completo === 1 && styles.assistidoCard,
                        focused && { backgroundColor: '#9f9c9c80' } // <- Aqui entra a cor/estilo quando em foco
                        // focused && styles.cardFocado // (Alternativa usando StyleSheet)
                      ]}
                      onPress={() => vlcPress(ep)}
                    >
                      {/* Thumbnail */}
                      <View style={styles.thumbnailWrapper}>
                        <Image
                          source={{ uri: ep.imagem }}
                          style={[styles.thumbnail, ep.assistido?.completo === 1 && styles.thumbnailAssistido]}
                        />
                        <Text style={styles.duracao}> {ep.duracao}</Text>

                        {/* Check se assistido */}
                        {ep.assistido?.completo === 1 && (
                          <View style={styles.checkIcon}>
                            <Text style={{ color: "#fff", fontSize: 10 }}>✓</Text>
                          </View>
                        )}
                      </View>

                      {/* Text content */}
                      <View style={styles.textContainer}>
                        <Text style={styles.titleEP}>E{ep.numero} - {ep.nome}</Text>
                        <Text style={styles.descriptionEP}>
                          {ep.sinopse}
                        </Text>
                      </View>
                    </Pressable>
                  )}
                )}
              </ScrollView>


              {/* <Pressable
                pointerEvents="none"
                ref={watchButtonRef}
                focusable={false}
                onFocus={() => setFocusedButton('watch')}
                onBlur={() => setFocusedButton(null)}
                onPress={() => vlcPress("1")}
                style={[styles.button, focusedButton === 'watch' && styles.buttonFocused]}
              >
                <Text style={styles.buttonText}>▶️ Começar a assistir: S1 E1</Text>
              </Pressable> */}


            </View>

              <Modal
                visible={modalVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setModalVisible(false)}
              >
                <View style={styles.modalBackground}>
                  <View style={styles.modalContent}>
                    <Text style={styles.modalText}>
                      Marcar episódio como assistido?
                    </Text>
                    <Text style={styles.modalTitle}>
                      {episodioEmExecucao?.nome}
                    </Text>

                    <Button title="Sim, marcar como assistido" onPress={marcarComoAssistido} />
                    <Button title="Cancelar" onPress={() => setModalVisible(false)} />
                  </View>
                </View>
              </Modal>


          </View>
        )}


      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: '#000',
  },
  scrollContent: {
    flexGrow: 1,
  },
  headerSection: {
    flexDirection: 'row',
    padding: 30,
    // height: "50%",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject, // ocupa toda área da ImageBackground
    backgroundColor: 'rgba(0, 0, 0, 0.70)', // preto com 40% de opacidade (transparente)
  },
  left: {
    flex: 1,
    justifyContent: 'center',
  },
  right: {
    width: 300,
    justifyContent: 'center',
    alignItems: 'center',
  },
  banner: {
    width: 250,
    height: 380,
    borderRadius: 12,
  },
  title: {
    fontSize: 34,
    color: '#fff',
    marginBottom: 12,
    fontWeight: 'bold',
  },
  description: {
    fontSize: 18,
    color: '#ccc',
    marginBottom: 30,
    maxWidth: 500,
    // height: 255,
    maxHeight: 255,
    minHeight: 195,
  },
  buttonsContainer: {
    // paddingTop: 10,
    flexDirection: 'column',
    gap: 5,
  },
  button: {
    backgroundColor: '#333',
    paddingVertical: 10,
    paddingHorizontal: 10,
    // borderRadius: 8,
    // marginBottom: 3,
    width: 400,
  },
  buttonFocused: {
    backgroundColor: '#12bbf3ff',
  },
  buttonText: {
    fontSize: 18,
    color: '#fff',
  },


  tabsSection: {
    height: screenHeight,
    justifyContent: 'flex-start',
  },
  tabsContainer: {
    justifyContent: 'center',
    flexDirection: 'row-reverse',
    gap: 24,
    marginBottom: 24,
  },
  tabButton: {
    paddingBottom: 8,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabSelected: {
    borderBottomColor: '#f39c12',
  },
  tabText: {
    fontSize: 20,
    color: '#fff',
  },
  
  tabContentText: {
    fontSize: 18,
    color: '#fff',
  },

  tabContent: {
    flex: 1,
    flexDirection: 'row',
    width: '100%',
    // padding: 16,

    // borderWidth: 1,
    // borderColor: "#fff",
  },

  columnLeft: {
    flex: 3, // 30%
    paddingRight: 8,
    // borderWidth: 1,
    // borderColor: "#fff",
    
  },
  columnRight: {
    flex: 7, // 70%
    paddingLeft: 8,
  },


    // EPISODIOS
  cardContainer: {
    flexDirection: 'row',
    padding: 10,
    backgroundColor: '#000', // fundo escuro
    alignItems: 'flex-start',
  },
  thumbnailWrapper: {
    position: 'relative',
    width: 120,
    height: 68,
    marginRight: 10,
  },
  thumbnail: {
    width: '100%',
    height: '100%',
    borderRadius: 4,
  },
  duracao: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.7)',
    color: '#fff',
    fontSize: 12,
    paddingHorizontal: 4,
    borderRadius: 3,
  },
  textContainer: {
    flex: 1,
  },
  titleEP: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
    marginBottom: 2,
  },
  descriptionEP: {
    color: '#aaa',
    fontSize: 12,
  },

  assistidoCard: {
  opacity: 0.6, // ou backgroundColor: "#ddd"
},

thumbnailAssistido: {
  borderWidth: 2,
  borderColor: "#4caf50",
},

checkIcon: {
  position: 'absolute',
  top: 5,
  right: 5,
  backgroundColor: '#4caf50',
  borderRadius: 10,
  paddingHorizontal: 6,
  paddingVertical: 2,
},

modalBackground: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 20,
    width: '80%',
    alignItems: 'center',
  },
  modalText: {
    fontSize: 16,
    marginBottom: 10,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 20,
  },
});
