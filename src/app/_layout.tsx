// app/_layout.tsx
import { Stack } from 'expo-router';
import * as Updates from 'expo-updates';
import React, { useEffect } from 'react';
import { StatusBar } from 'react-native';
import 'react-native-gesture-handler';

export default function RootLayout() {
  useEffect(() => {
    async function checkAndApplyUpdates() {
      if (__DEV__ || !Updates.isEnabled) return;
      try {
        const update = await Updates.checkForUpdateAsync();
        if (update.isAvailable) {
          await Updates.fetchUpdateAsync();
          await Updates.reloadAsync();
        }
      } catch (error) {
        console.warn('Erro ao verificar atualizações:', error);
      }
    }

    checkAndApplyUpdates();
  }, []);

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor="#000001" />
      <Stack>
        {/* <Stack.Screen name="(drawer)" options={{ headerShown: false }} /> */}
        <Stack.Screen name="index" options={{ headerShown: false,}} />
        <Stack.Screen name="perfil" options={{ headerShown: false,}} />
        <Stack.Screen name="seasons" options={{ headerShown: false,}} />
        <Stack.Screen name="an" options={{ headerShown: false,}} />

        {/* Rota dinâmica fica aqui, fora das abas */}
        <Stack.Screen name="anime/[id]" options={{ headerShown: false, title: 'Detalhes' }}/>
      </Stack>
    </>
  );
}
