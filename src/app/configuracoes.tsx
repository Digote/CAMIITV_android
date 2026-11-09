import React from 'react';
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Header from '../components/Header';
import SideMenuLayout, { MenuItem } from '../components/SideMenuLayout';
import {
  AudioLangPref,
  PlayerType,
  SubtitleLangPref,
  usePlayerSettings,
} from '@/utils/playerSettings';
import { isNativeVlcAvailable } from '../../modules/vlc-player';

const SEEK_STEPS = [5, 10, 15, 30];

const SUBTITLE_PREFS: { id: SubtitleLangPref; label: string; desc: string }[] = [
  {
    id: 'ptbr',
    label: 'Português (PT-BR)',
    desc: 'Seleciona automaticamente a legenda PT-BR nos arquivos MKV',
  },
  {
    id: 'auto',
    label: 'Padrão do Arquivo',
    desc: 'Mantém a faixa de legenda padrão definida no container MKV',
  },
  {
    id: 'off',
    label: 'Desativada',
    desc: 'Inicia a reprodução sem legendas ativadas',
  },
];

const AUDIO_PREFS: { id: AudioLangPref; label: string; desc: string }[] = [
  {
    id: 'auto',
    label: 'Padrão do Arquivo',
    desc: 'Usa a faixa de áudio principal do vídeo',
  },
  {
    id: 'jpn',
    label: 'Japonês (Original)',
    desc: 'Prioriza o áudio original em Japonês quando houver múltiplas faixas',
  },
  {
    id: 'ptbr',
    label: 'Português (Dublado)',
    desc: 'Prioriza o áudio em Português quando disponível no MKV',
  },
];

export default function ConfiguracoesScreen() {
  const { settings, updateSettings } = usePlayerSettings();
  const nativeVlcCompiled = isNativeVlcAvailable();

  const menuItems: MenuItem[] = [
    { icon: 'home', label: 'Início', route: '/' },
    { icon: 'home', label: 'Temporadas', route: '/seasons' },
    { icon: 'home', label: 'AN', route: '/an' },
    { icon: 'home', label: 'BR', route: '/br' },
    { icon: 'magnet', label: 'NYAA', route: '/nyaa' },
    { icon: 'user', label: 'Perfil', route: '/perfil' },
    { icon: 'cog', label: 'Configurações', route: '/configuracoes' },
  ];

  const handleSelectPlayer = (playerType: PlayerType) => {
    updateSettings({ playerType });
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />

      <SafeAreaView style={styles.screen}>
        <SideMenuLayout menuItems={menuItems}>
          <Header />

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Cabeçalho da Página */}
            <View style={styles.headerBanner}>
              <View style={styles.headerTitleRow}>
                <View style={styles.accentBar} />
                <View>
                  <Text style={styles.headerTitle}>
                    Configurações do Reprodutor
                  </Text>
                  <Text style={styles.headerSubtitle}>
                    Escolha entre o Player Interno (LibVLC com suporte a MKV e legendas ASS) ou o VLC Externo por Intent
                  </Text>
                </View>
              </View>

              <View
                style={[
                  styles.statusBadge,
                  settings.playerType === 'internal'
                    ? styles.statusBadgeInternal
                    : styles.statusBadgeExternal,
                ]}
              >
                <Ionicons
                  name={
                    settings.playerType === 'internal'
                      ? 'play-circle'
                      : 'open-outline'
                  }
                  size={15}
                  color="#FFF"
                />
                <Text style={styles.statusBadgeText}>
                  {settings.playerType === 'internal'
                    ? 'PLAYER INTERNO ATIVO'
                    : 'VLC EXTERNO (INTENT)'}
                </Text>
              </View>
            </View>

            {/* SEÇÃO 1: ESCOLHA DO PLAYER (INTERNO vs VLC EXTERNO) */}
            <View style={styles.sectionBlock}>
              <Text style={styles.sectionTitle}>
                1. Modo de Reprodução de Vídeo
              </Text>
              <Text style={styles.sectionDescription}>
                Defina qual reprodutor será aberto ao clicar para assistir um episódio no catálogo, Anime Digital ou Nyaa.
              </Text>

              <View style={styles.playerCardsRow}>
                {/* Opção 1: Player Interno (LibVLC) */}
                <Pressable
                  hasTVPreferredFocus={settings.playerType === 'internal'}
                  focusable={true}
                  onPress={() => handleSelectPlayer('internal')}
                  style={({ focused, pressed }) => [
                    styles.playerCard,
                    settings.playerType === 'internal' &&
                      styles.playerCardSelected,
                    (focused || pressed) && styles.cardFocused,
                  ]}
                >
                  <View style={styles.playerCardHeader}>
                    <View style={styles.playerIconCircleInternal}>
                      <Ionicons name="tv-outline" size={26} color="#FF8800" />
                    </View>
                    <View style={styles.radioIndicator}>
                      {settings.playerType === 'internal' ? (
                        <Ionicons
                          name="checkmark-circle"
                          size={26}
                          color="#FF8800"
                        />
                      ) : (
                        <Ionicons
                          name="ellipse-outline"
                          size={24}
                          color="#6B7280"
                        />
                      )}
                    </View>
                  </View>

                  <Text style={styles.playerCardTitle}>
                    Player Interno (LibVLC Integrado)
                  </Text>
                  <Text style={styles.playerCardDesc}>
                    Reproduz diretamente dentro do CAMII TV usando a engine oficial do VLC. Suporta arquivos{' '}
                    <Text style={styles.highlightText}>.MKV</Text>, legendas estilizadas{' '}
                    <Text style={styles.highlightText}>.ASS / .SSA</Text>, troca de faixa de áudio/legenda e avanço de{' '}
                    {settings.seekStepSeconds}s nas setas do controle.
                  </Text>

                  <View style={styles.playerCardFooter}>
                    <View
                      style={[
                        styles.miniPill,
                        nativeVlcCompiled
                          ? styles.miniPillReady
                          : styles.miniPillWarn,
                      ]}
                    >
                      <Text style={styles.miniPillText}>
                        {nativeVlcCompiled
                          ? '✓ Engine Nativa LibVLC Pronta'
                          : '⚠ Requer novo build do APK para ativar'}
                      </Text>
                    </View>
                  </View>
                </Pressable>

                {/* Opção 2: VLC Externo via Intent */}
                <Pressable
                  hasTVPreferredFocus={settings.playerType === 'external_vlc'}
                  focusable={true}
                  onPress={() => handleSelectPlayer('external_vlc')}
                  style={({ focused, pressed }) => [
                    styles.playerCard,
                    settings.playerType === 'external_vlc' &&
                      styles.playerCardSelectedBlue,
                    (focused || pressed) && styles.cardFocused,
                  ]}
                >
                  <View style={styles.playerCardHeader}>
                    <View style={styles.playerIconCircleExternal}>
                      <Ionicons name="open-outline" size={26} color="#3399FF" />
                    </View>
                    <View style={styles.radioIndicator}>
                      {settings.playerType === 'external_vlc' ? (
                        <Ionicons
                          name="checkmark-circle"
                          size={26}
                          color="#3399FF"
                        />
                      ) : (
                        <Ionicons
                          name="ellipse-outline"
                          size={24}
                          color="#6B7280"
                        />
                      )}
                    </View>
                  </View>

                  <Text style={styles.playerCardTitle}>
                    VLC Externo (via Intent Android)
                  </Text>
                  <Text style={styles.playerCardDesc}>
                    Envia o link do vídeo para o aplicativo{' '}
                    <Text style={styles.highlightText}>VLC for Android</Text>{' '}
                    instalado separadamente na sua TV (`org.videolan.vlc`), e pergunta se deseja marcar como assistido ao retornar.
                  </Text>

                  <View style={styles.playerCardFooter}>
                    <View style={styles.miniPillBlue}>
                      <Text style={styles.miniPillText}>
                        Requer app VLC instalado na TV
                      </Text>
                    </View>
                  </View>
                </Pressable>
              </View>
            </View>

            {/* SEÇÃO 2: TEMPO DE AVANÇO E RETROCESSO NAS SETAS DO CONTROLE */}
            <View style={styles.sectionBlock}>
              <Text style={styles.sectionTitle}>
                2. Avanço / Retrocesso nas Setas do Controle (◀ / ▶)
              </Text>
              <Text style={styles.sectionDescription}>
                Quantidade de segundos ao clicar para a esquerda ou direita no controle remoto durante a reprodução no Player Interno.
              </Text>

              <View style={styles.chipsRow}>
                {SEEK_STEPS.map((sec) => {
                  const isSelected = settings.seekStepSeconds === sec;
                  return (
                    <Pressable
                      key={`seek-${sec}`}
                      focusable={true}
                      onPress={() => updateSettings({ seekStepSeconds: sec })}
                      style={({ focused, pressed }) => [
                        styles.choiceChip,
                        isSelected && styles.choiceChipSelected,
                        (focused || pressed) && styles.cardFocused,
                      ]}
                    >
                      <Ionicons
                        name="play-forward"
                        size={16}
                        color={isSelected ? '#FF8800' : '#9CA3AF'}
                      />
                      <Text
                        style={[
                          styles.choiceChipText,
                          isSelected && styles.choiceChipTextSelected,
                        ]}
                      >
                        {sec} segundos {sec === 5 ? '(Padrão)' : ''}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* SEÇÃO 3: PREFERÊNCIA DE LEGENDA E ÁUDIO */}
            <View style={styles.sectionBlock}>
              <Text style={styles.sectionTitle}>
                3. Seleção Automática de Legendas (.ASS / .SRT)
              </Text>
              <View style={styles.optionsGrid}>
                {SUBTITLE_PREFS.map((item) => {
                  const isSelected = settings.preferredSubtitleLang === item.id;
                  return (
                    <Pressable
                      key={`subpref-${item.id}`}
                      focusable={true}
                      onPress={() =>
                        updateSettings({ preferredSubtitleLang: item.id })
                      }
                      style={({ focused, pressed }) => [
                        styles.optionCard,
                        isSelected && styles.optionCardSelected,
                        (focused || pressed) && styles.cardFocused,
                      ]}
                    >
                      <View style={styles.optionCardTop}>
                        <Text style={styles.optionCardTitle}>{item.label}</Text>
                        {isSelected && (
                          <Ionicons
                            name="checkmark-circle"
                            size={20}
                            color="#FF8800"
                          />
                        )}
                      </View>
                      <Text style={styles.optionCardDesc}>{item.desc}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={styles.sectionBlock}>
              <Text style={styles.sectionTitle}>
                4. Idioma de Áudio Preferencial
              </Text>
              <View style={styles.optionsGrid}>
                {AUDIO_PREFS.map((item) => {
                  const isSelected = settings.preferredAudioLang === item.id;
                  return (
                    <Pressable
                      key={`audpref-${item.id}`}
                      focusable={true}
                      onPress={() =>
                        updateSettings({ preferredAudioLang: item.id })
                      }
                      style={({ focused, pressed }) => [
                        styles.optionCard,
                        isSelected && styles.optionCardSelected,
                        (focused || pressed) && styles.cardFocused,
                      ]}
                    >
                      <View style={styles.optionCardTop}>
                        <Text style={styles.optionCardTitle}>{item.label}</Text>
                        {isSelected && (
                          <Ionicons
                            name="checkmark-circle"
                            size={20}
                            color="#FF8800"
                          />
                        )}
                      </View>
                      <Text style={styles.optionCardDesc}>{item.desc}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* SEÇÃO 5: ACELERAÇÃO DE HARDWARE */}
            <View style={styles.sectionBlock}>
              <Text style={styles.sectionTitle}>
                5. Decodificação por Hardware (LibVLC)
              </Text>
              <View style={styles.chipsRow}>
                <Pressable
                  focusable={true}
                  onPress={() => updateSettings({ hardwareAcceleration: true })}
                  style={({ focused, pressed }) => [
                    styles.choiceChip,
                    settings.hardwareAcceleration && styles.choiceChipSelected,
                    (focused || pressed) && styles.cardFocused,
                  ]}
                >
                  <Ionicons
                    name="hardware-chip-outline"
                    size={18}
                    color={settings.hardwareAcceleration ? '#FF8800' : '#9CA3AF'}
                  />
                  <Text
                    style={[
                      styles.choiceChipText,
                      settings.hardwareAcceleration &&
                        styles.choiceChipTextSelected,
                    ]}
                  >
                    Ativada (Recomendado para MKV 1080p / HEVC)
                  </Text>
                </Pressable>

                <Pressable
                  focusable={true}
                  onPress={() =>
                    updateSettings({ hardwareAcceleration: false })
                  }
                  style={({ focused, pressed }) => [
                    styles.choiceChip,
                    !settings.hardwareAcceleration && styles.choiceChipSelected,
                    (focused || pressed) && styles.cardFocused,
                  ]}
                >
                  <Ionicons
                    name="code-working-outline"
                    size={18}
                    color={!settings.hardwareAcceleration ? '#FF8800' : '#9CA3AF'}
                  />
                  <Text
                    style={[
                      styles.choiceChipText,
                      !settings.hardwareAcceleration &&
                        styles.choiceChipTextSelected,
                    ]}
                  >
                    Desativada (Decodificação via Software)
                  </Text>
                </Pressable>
              </View>
            </View>
          </ScrollView>
        </SideMenuLayout>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#0B0B0C',
    flexDirection: 'row',
  },
  scrollContent: {
    paddingHorizontal: 22,
    paddingBottom: 60,
  },
  headerBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    marginBottom: 24,
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: '#14161D',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 16,
  },
  accentBar: {
    width: 4,
    height: 38,
    borderRadius: 4,
    backgroundColor: '#FF8800',
    marginRight: 14,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#9CA3AF',
    marginTop: 3,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  statusBadgeInternal: {
    backgroundColor: 'rgba(255, 136, 0, 0.22)',
    borderWidth: 1,
    borderColor: '#FF8800',
  },
  statusBadgeExternal: {
    backgroundColor: 'rgba(51, 153, 255, 0.22)',
    borderWidth: 1,
    borderColor: '#3399FF',
  },
  statusBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },

  sectionBlock: {
    marginBottom: 28,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  sectionDescription: {
    color: '#9CA3AF',
    fontSize: 13,
    marginBottom: 14,
  },

  playerCardsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  playerCard: {
    flex: 1,
    minWidth: 300,
    backgroundColor: '#14161D',
    borderRadius: 14,
    padding: 20,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    justifyContent: 'space-between',
  },
  playerCardSelected: {
    borderColor: '#FF8800',
    backgroundColor: 'rgba(255, 136, 0, 0.08)',
  },
  playerCardSelectedBlue: {
    borderColor: '#3399FF',
    backgroundColor: 'rgba(51, 153, 255, 0.08)',
  },
  cardFocused: {
    borderColor: '#FFFFFF',
    transform: [{ scale: 1.03 }],
  },
  playerCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  playerIconCircleInternal: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 136, 0, 0.16)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playerIconCircleExternal: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(51, 153, 255, 0.16)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioIndicator: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  playerCardTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  playerCardDesc: {
    color: '#D1D5DB',
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 16,
  },
  highlightText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  playerCardFooter: {
    flexDirection: 'row',
  },
  miniPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  miniPillReady: {
    backgroundColor: 'rgba(16, 185, 129, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.5)',
  },
  miniPillWarn: {
    backgroundColor: 'rgba(245, 158, 11, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.5)',
  },
  miniPillBlue: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: 'rgba(51, 153, 255, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(51, 153, 255, 0.4)',
  },
  miniPillText: {
    color: '#E5E7EB',
    fontSize: 11,
    fontWeight: '700',
  },

  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  choiceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#14161D',
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  choiceChipSelected: {
    backgroundColor: 'rgba(255, 136, 0, 0.14)',
    borderColor: '#FF8800',
  },
  choiceChipText: {
    color: '#D1D5DB',
    fontSize: 14,
    fontWeight: '600',
  },
  choiceChipTextSelected: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },

  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
    marginTop: 8,
  },
  optionCard: {
    flex: 1,
    minWidth: 220,
    backgroundColor: '#14161D',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  optionCardSelected: {
    borderColor: '#FF8800',
    backgroundColor: 'rgba(255, 136, 0, 0.1)',
  },
  optionCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  optionCardTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: 'bold',
  },
  optionCardDesc: {
    color: '#9CA3AF',
    fontSize: 12,
    lineHeight: 17,
  },
});
