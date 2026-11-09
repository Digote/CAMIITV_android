// app/_layout.tsx
import { Stack, usePathname, useRouter } from 'expo-router';
import * as Updates from 'expo-updates';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  BackHandler,
  Modal,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import 'react-native-gesture-handler';

const ROOT_ROUTES = ['/', '/an', '/br', '/nyaa', '/seasons', '/perfil'];

export default function RootLayout() {
  const router = useRouter();
  const pathname = usePathname();
  const appState = useRef(AppState.currentState);

  const [exitModalVisible, setExitModalVisible] = useState(false);
  const [checkingUpdate, setCheckingUpdate] = useState(false);

  const checkAndApplyUpdates = useCallback(async (forceReloadIfNone = false) => {
    if (__DEV__ || !Updates.isEnabled) return;
    try {
      setCheckingUpdate(true);
      const update = await Updates.checkForUpdateAsync();
      if (update.isAvailable) {
        await Updates.fetchUpdateAsync();
        await Updates.reloadAsync();
      } else if (forceReloadIfNone) {
        await Updates.reloadAsync();
      }
    } catch (error) {
      console.warn('Erro ao verificar atualizações:', error);
    } finally {
      setCheckingUpdate(false);
    }
  }, []);

  // 1. Checa atualização ao abrir o app E toda vez que o app volta do segundo plano na TV!
  useEffect(() => {
    checkAndApplyUpdates(false);

    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        checkAndApplyUpdates(false);
      }
      appState.current = nextAppState;
    });

    return () => subscription.remove();
  }, [checkAndApplyUpdates]);

  // 2. Intercepta o botão Voltar nas telas principais para abrir o modal de saída
  useEffect(() => {
    const onBackPress = () => {
      if (exitModalVisible) {
        setExitModalVisible(false);
        return true;
      }

      const isRootRoute = ROOT_ROUTES.includes(pathname);
      if (isRootRoute || !router.canGoBack()) {
        setExitModalVisible(true);
        return true;
      }

      return false;
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => backHandler.remove();
  }, [pathname, exitModalVisible, router]);

  const handleExitApp = () => {
    setExitModalVisible(false);
    BackHandler.exitApp();
  };

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor="#000001" />
      <Stack>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="perfil" options={{ headerShown: false }} />
        <Stack.Screen name="seasons" options={{ headerShown: false }} />
        <Stack.Screen name="an" options={{ headerShown: false }} />
        <Stack.Screen name="nyaa" options={{ headerShown: false }} />

        {/* Rotas dinâmicas */}
        <Stack.Screen name="anime/[id]" options={{ headerShown: false, title: 'Detalhes' }} />
        <Stack.Screen name="anime/episodio" options={{ headerShown: false, title: 'Episódio' }} />
        <Stack.Screen name="an_anime/[id]" options={{ headerShown: false, title: 'Detalhes AN' }} />
        <Stack.Screen name="nyaa_anime/[id]" options={{ headerShown: false, title: 'Detalhes NYAA' }} />
      </Stack>

      {/* Modal de confirmação para sair ou atualizar o app */}
      <Modal
        visible={exitModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setExitModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Sair do CAMII TV?</Text>
            <Text style={styles.modalSubtitle}>
              Deseja fechar o aplicativo ou buscar atualizações?
            </Text>

            <View style={styles.buttonsRow}>
              <Pressable
                hasTVPreferredFocus={true}
                focusable={true}
                onPress={() => setExitModalVisible(false)}
                style={({ focused, pressed }) => [
                  styles.btn,
                  styles.btnCancel,
                  (focused || pressed) && styles.btnFocused,
                ]}
              >
                <Text style={styles.btnText}>Cancelar</Text>
              </Pressable>

              <Pressable
                focusable={true}
                onPress={() => checkAndApplyUpdates(true)}
                style={({ focused, pressed }) => [
                  styles.btn,
                  styles.btnUpdate,
                  (focused || pressed) && styles.btnFocused,
                ]}
              >
                {checkingUpdate ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={styles.btnText}>Atualizar App</Text>
                )}
              </Pressable>

              <Pressable
                focusable={true}
                onPress={handleExitApp}
                style={({ focused, pressed }) => [
                  styles.btn,
                  styles.btnExit,
                  (focused || pressed) && styles.btnFocused,
                ]}
              >
                <Text style={styles.btnText}>Sair</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBox: {
    width: 480,
    backgroundColor: '#14161D',
    borderRadius: 14,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    marginBottom: 24,
  },
  buttonsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  btn: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    minWidth: 120,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  btnCancel: {
    backgroundColor: '#262936',
  },
  btnUpdate: {
    backgroundColor: '#3399FF',
  },
  btnExit: {
    backgroundColor: '#DC2626',
  },
  btnFocused: {
    borderColor: '#FFFFFF',
    transform: [{ scale: 1.06 }],
  },
  btnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: 'bold',
  },
});
