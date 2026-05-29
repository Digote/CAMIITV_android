import React, { useContext, useEffect, useRef, useState } from 'react';
import { SafeAreaView, ScrollView } from 'react-native';
import Header from '../components/Header';
import Section_An from '../components/AN/Section_An';
import api from '@/services/api';
import SideMenuLayout, { MenuItem } from '../components/SideMenuLayout';


// import { AuthContext } from '../context/AuthContext';

export default function Home() {
  // const { logout } = useContext(AuthContext);

  const [animes, setAnimes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/an/lancamento")
      .then((response) => {
        const data = response.data;

        // console.log(data)

        const mapped = Array.isArray(data)
          ? data.map((item) => ({
              id: String(item.id),
              title: item.nome,
              thumbnail: item.anime.img,
              link: item.link,
            }))
          : [] as any;

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

  const menuItems: MenuItem[] = [
    { icon: 'home', label: 'Início', route: '/' },
    { icon: 'home', label: 'Temporadas', route: '/seasons' },
    { icon: 'home', label: 'AN', route: '/an' },
    { icon: 'user', label: 'Perfil', route: '/perfil' },
  ];


  return (
    
    <SafeAreaView style={{ flex: 1, backgroundColor: '#000001', flexDirection: 'row' }}>
      <SideMenuLayout menuItems={menuItems}>
        <Header />
        <ScrollView>
          <ScrollView >
          <Section_An title="Lançamentos" data={animes} />
          {/* <Section title="Em Alta" data={animes} />
          <Section title="Lançamentos da Semana" data={animes} />
          <Section title="Recomendados para Você" data={animes} /> */}
        </ScrollView>
        </ScrollView>
      </SideMenuLayout>

    </SafeAreaView>
  );

}
