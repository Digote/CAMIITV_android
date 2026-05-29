// app/_layout.tsx
import { Stack } from 'expo-router';
import React from 'react';
import { StatusBar } from 'react-native';
import 'react-native-gesture-handler';

export default function RootLayout() {
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
