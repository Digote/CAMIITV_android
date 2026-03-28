import React, { useState, useEffect } from 'react';
import { SafeAreaView, ScrollView, View, Text } from 'react-native';
import Header from '../components/Header';
import SideMenuLayout, { MenuItem } from '../components/SideMenuLayout';

// Importe os novos componentes que vamos criar abaixo
import HeroSection from '../components/BDUI/HeroSection';
import GenreSection from '../components/BDUI/GenreSection';
import LandscapeSection from '../components/BDUI/LandscapeSection';
import ContinueWatchingSection from '../components/BDUI/ContinueWatchingSection';
import api from '@/services/api';


const bduiMockData = [
  {
    id: 'sec-hero',
    type: 'HERO_CAROUSEL',
    data: [
      { id: '1', title: 'Attack on Titan: Final Season', subtitle: 'Batalha Final Começa. Assista Agora.', image: 'https://myanimelist.net/images/anime/1404/154931l.jpg' },
      { id: '2', title: 'Jujutsu Kaisen Season 2', subtitle: 'Incidente de Shibuya.', image: 'https://cdn.myanimelist.net/images/anime/1935/127974l.jpg' },
    ]
  },
  {
    id: 'sec-continue',
    type: 'CONTINUE_WATCHING',
    title: 'CONTINUAR ASSISTINDO',
    data: [
      { id: '20', title: 'Naruto Shippuden', episode: 'Episode 350', progress: 0.7, image: 'https://cdn.myanimelist.net/images/anime/1935/127974l.jpg' },
      { id: '21', title: 'Death Note', episode: 'Episode 27', progress: 0.4, image: 'https://cdn.myanimelist.net/images/anime/1935/127974l.jpg' },
    ]
  },
  {
    id: 'sec-genres',
    type: 'GENRE_ROW',
    title: 'GÊNEROS RECOMENDADOS',
    data: [
      { id: 'g1', title: 'AÇÃO', color: '#1E90FF' },
      { id: 'g2', title: 'ISEKAI', color: '#446655' },
      { id: 'g3', title: 'FANTASIA', color: '#6A5ACD' },
      { id: 'g4', title: 'COMÉDIA', color: '#B8860B' },
    ]
  },
  {
    id: 'sec-recent',
    type: 'LANDSCAPE_LIST',
    title: 'LANÇAMENTOS RECENTES',
    data: [
      { id: '10', title: 'Chainsaw Man', image: 'https://cdn.myanimelist.net/images/anime/1935/127974l.jpg' },
      { id: '11', title: 'Spy x Family', image: 'https://cdn.myanimelist.net/images/anime/1935/127974l.jpg' },
    ]
  },
  
];

export default function Home() {

  const [layout, setLayout] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulando a chamada para a sua futura rota do Laravel (ex: api.get("/home-layout"))
    setTimeout(() => {
      setLayout(bduiMockData); // Usando o mock definido acima
      setLoading(false);
    }, 500);
  }, []);

  const renderSection = (section) => {
    switch (section.type) {
      case 'HERO_CAROUSEL':
        return <HeroSection key={section.id} data={section.data} />;
      case 'GENRE_ROW':
        return <GenreSection key={section.id} title={section.title} data={section.data} />;
      case 'LANDSCAPE_LIST':
        return <LandscapeSection key={section.id} title={section.title} data={section.data} />;
      case 'CONTINUE_WATCHING':
        return <ContinueWatchingSection key={section.id} title={section.title} data={section.data} />;
      default:
        // Fallback caso o Laravel envie um tipo novo que o App ainda não conhece
        return <View key={section.id}><Text style={{color: 'red'}}>Componente Desconhecido: {section.type}</Text></View>;
    }
  };

  const menuItems: MenuItem[] = [
    { icon: 'home', label: 'Início', route: '/' },
    { icon: 'home', label: 'AN', route: '/an' },
    { icon: 'user', label: 'Perfil', route: '/perfil' },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0B0B0C', flexDirection: 'row' }}>
      <SideMenuLayout menuItems={menuItems}>
        <Header />
        <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
          {loading ? (
            <Text style={{ color: '#FFF', padding: 20 }}>Carregando interface...</Text>
          ) : (
            layout.map(renderSection)
          )}
        </ScrollView>
      </SideMenuLayout>
    </SafeAreaView>
  );
}