// app/login.tsx
import React, { useContext, useEffect, useState } from 'react';
import { View, TextInput, Button, Text, ActivityIndicator } from 'react-native';
// import { AuthContext } from '../context/AuthContext';
import api from '../services/api';
import { router } from 'expo-router';
import { saveToken } from '@/utils/authToken';


const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export default function TelaCodigo() {
  const [codigo, setCodigo] = useState(''); // código vindo do backend
  const [token, setToken] = useState(null);
  const [checando, setChecando] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function checarTokenLoop() {
      setChecando(true);

      while (isMounted && !token) {
        try {
          const response = await api.post('/auth/android', {
            code: codigo,
          });

          console.log(response.data)

          if (response.data && response.data.code){
            setCodigo(response.data.code)
          }

          // Supondo que o token vem em response.data.token
          if (response.data && response.data.token) {
            if (isMounted) {
              await saveToken(response.data.token);
              setToken(response.data.token); // <- atualiza o estado
            }
            break; // Sai do loop
          }

          // Não recebeu token, aguarda 5 segundos para tentar novamente
          await delay(5000);
        } catch (error) {
          console.error('Erro ao verificar token:', error);
          await delay(5000);
        }
      }
      // router.replace('/index');
      setChecando(false);
    }

    checarTokenLoop();

    return () => {
      isMounted = false; // para evitar setState após desmontar
    };
  }, [codigo, token]);


  useEffect(() => {
    if (token) {
      router.replace('/'); // ou a rota que você quiser
    }
  }, [token]);

  if (token) {
    
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text>Token recebido:</Text>
        <Text style={{ fontWeight: 'bold', fontSize: 18 }}>{token}</Text>
        {/* Aqui pode navegar para outra tela */}
      </View>
    );
  }

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Text>Código para verificação:</Text>
      <Text style={{ fontSize: 24, fontWeight: 'bold' }}>{codigo}</Text>
      {checando ? (
        <ActivityIndicator style={{ marginTop: 20 }} size="large" />
      ) : (
        <Text style={{ marginTop: 20 }}>Aguardando token...</Text>
      )}
    </View>
  );
}
