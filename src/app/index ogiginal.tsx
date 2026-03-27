import React, { useEffect, useState } from 'react';
import { SafeAreaView, ScrollView } from 'react-native';
import Header from '../components/Header';
import Section from '../components/Section';
import axios from 'axios';
// import { Anime } from '../types';

// Removido dummyData, agora os dados vêm da API

export default function Home() {
  const [animes, setAnimes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get('https://tv.camii.com.br/api/animes')
      .then((response) => {
        const data = response.data;

        const mapped = Array.isArray(data)
          ? data.map((item) => ({
              id: String(item.id),
              title: item.nome,
              thumbnail: item.imagem,
            }))
          : [];

        setAnimes(mapped);
        setLoading(false);
      })
      .catch((error) => {
        console.error('Erro ao buscar animes:', error);
        console.log(error)
        setLoading(false);
      });
  }, []);

  // console.log(Platform.OS)
  // if (Platform.OS === 'android' && Platform.isTV) {
  //   return <SideMenu current="Home" />;
  // }


  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#000001', paddingTop: 5 }}>
      <Header />
      <ScrollView>
        <Section title="Continue Assistindo" data={animes} />
        {/* <Section title="Em Alta" data={animes} />
        <Section title="Lançamentos da Semana" data={animes} />
        <Section title="Recomendados para Você" data={animes} /> */}
      </ScrollView>
    </SafeAreaView>
  );
}