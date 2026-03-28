import React, { useEffect, useState } from 'react';
import { SafeAreaView, ScrollView, Text, View, ActivityIndicator } from 'react-native';
import Header from '../components/Header';
import SideMenuLayout, { MenuItem } from '../components/SideMenuLayout';
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
        console.log(response.data)
        console.log("#####rr")
        setLayout(response.data);
        setLoading(false);
      })
      .catch((error) => {
        console.error('Erro ao buscar o layout da home:', error);
        setLoading(false);
      });
  }, []);

  // Função que lê o "type" vindo do Laravel e decide qual componente desenhar
  const renderSection = (section: any) => {
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
        // Caso o backend mande um tipo que o app não conhece, ignoramos silenciosamente
        return null; 
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
        
        {loading ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator size="large" color="#3399FF" />
            <Text style={{ color: '#FFF', marginTop: 16 }}>Carregando...</Text>
          </View>
        ) : (
          <ScrollView 
            // paddingBottom garante que o último item não fique cortado na TV
            contentContainerStyle={{ paddingBottom: 40 }} 
            showsVerticalScrollIndicator={false}
          >
            {/* O map percorre o array do Laravel e chama a função renderSection para cada item */}
            {layout.map((section) => renderSection(section))}
          </ScrollView>
        )}
      </SideMenuLayout>
    </SafeAreaView>
  );
}