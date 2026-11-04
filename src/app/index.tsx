import React, { useEffect, useState } from 'react';
import { SafeAreaView, ScrollView, Text, View, ActivityIndicator } from 'react-native';
import Header from '../components/Header';
import SideMenuLayout, { MenuItem } from '../components/SideMenuLayout';
import { FlashList } from "@shopify/flash-list";
import api from '@/services/api';

// Importando os novos componentes BDUI que criamos
import HeroSection from '../components/BDUI/HeroSection';
import GenreSection from '../components/BDUI/GenreSection';
import LandscapeSection from '../components/BDUI/LandscapeSection';
import ContinueWatchingSection from '../components/BDUI/ContinueWatchingSection';

export default function Home() {
  // Agora temos apenas um estado para controlar toda a estrutura da tela
  const [layout, setLayout] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fazemos uma única chamada para a rota do Laravel que montamos
    api.get("/home-layout")
      .then((response) => {
        // O Laravel já manda o array prontinho na ordem certa
        // console.log(response.data)
        // console.log("#####rr")
        setLayout(response.data);
        setLoading(false);
      })
      .catch((error) => {
        console.error('Erro ao buscar o layout da home:', error);
        setLoading(false);
      });
  }, []);

  // Função que lê o "type" vindo do Laravel e decide qual componente desenhar
  const renderSection = ({ item }: { item: any }) => {
    switch (item.type) {
      case 'HERO_CAROUSEL':
        return <HeroSection title={item.title} data={item.data} />;
      case 'GENRE_ROW':
        return <GenreSection title={item.title} data={item.data} />;
      case 'LANDSCAPE_LIST':
        return <LandscapeSection title={item.title} data={item.data} />;
      case 'CONTINUE_WATCHING':
        return <ContinueWatchingSection title={item.title} data={item.data} />;
      default:
        return null; 
    }
  };

  const menuItems: MenuItem[] = [
    { icon: 'home', label: 'Início', route: '/' },
    { icon: 'home', label: 'Temporadas', route: '/seasons' },
    { icon: 'home', label: 'AN', route: '/an' },
    { icon: 'home', label: 'BR', route: '/br' },
    { icon: 'magnet', label: 'NYAA', route: '/nyaa' },
    { icon: 'user', label: 'Perfil', route: '/perfil' },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0B0B0C', flexDirection: 'row' }}>
      <SideMenuLayout menuItems={menuItems}>
        <Header />
        
        {loading ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator size="large" color="#3399FF" />
            <Text style={{ color: '#FFF', marginTop: 16 }}>Carregando...</Text>
          </View>
        ) : (
          <FlashList
            data={layout}
            renderItem={renderSection}
            keyExtractor={(item) => item.id.toString()}
            contentContainerStyle={{ paddingBottom: 40 }}
            showsVerticalScrollIndicator={false}
            // contentContainerStyle={{ paddingBottom: 40 }}
            // showsVerticalScrollIndicator={false}
            // removeClippedSubviews={true} // Melhora agressiva de performance no Android
          />
          
        )}
      </SideMenuLayout>
    </SafeAreaView>
  );
}