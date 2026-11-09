import React, { useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, View, StyleProp, ViewStyle, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { FontAwesome5 } from '@expo/vector-icons';
import logo from '../assets/logo.png';

export interface MenuItem {
  icon: string;
  label: string;
  route: string;
}

interface SideMenuLayoutProps {
  children: React.ReactNode;
  menuItems: MenuItem[];
  style?: StyleProp<ViewStyle>;
}

export default function SideMenuLayout({ children, menuItems, style }: SideMenuLayoutProps) {
  const [focusedCount, setFocusedCount] = useState(0);
  const slideAnim = useRef(new Animated.Value(60)).current;
  const router = useRouter();

  const resolvedMenuItems = React.useMemo(() => {
    const hasConfig = menuItems.some((item) => item.route === '/configuracoes');
    if (hasConfig) return menuItems;
    return [
      ...menuItems,
      { icon: 'cog', label: 'Configurações', route: '/configuracoes' },
    ];
  }, [menuItems]);

  // expand on first focus, collapse when no focus
  const expandMenu = () => {
    setFocusedCount((prev) => {
      if (prev === 0) {
        Animated.timing(slideAnim, {
          toValue: 250,
          duration: 200,
          useNativeDriver: false,
        }).start();
      }
      return prev + 1;
    });
  };

  const collapseMenu = () => {
    setFocusedCount((prev) => {
      const next = prev - 1;
      if (next <= 0) {
        Animated.timing(slideAnim, {
          toValue: 60,
          duration: 200,
          useNativeDriver: false,
        }).start();
        return 0;
      }
      return next;
    });
  };

  return (
    <View style={[styles.container, style]}>
      <Animated.View style={[styles.sideMenu, { width: slideAnim }]}>
        <Animated.Image
          source={logo}
          resizeMode="contain"
          style={[
            styles.logo,
            {
              width: slideAnim.interpolate({ inputRange: [60, 250], outputRange: [40, 80] }),
              height: slideAnim.interpolate({ inputRange: [60, 250], outputRange: [40, 80] }),
            },
          ]}
        />
        {resolvedMenuItems.map((item, index) => (
          <Pressable
            key={item.route}
            onFocus={expandMenu}
            onBlur={collapseMenu}
            onPress={() => router.push(item.route as any)}
            hasTVPreferredFocus={index === 0}
            style={({ focused }) => [styles.menuItem, focused && styles.menuItemFocused]}
          >
            <View style={styles.menuItemContent}>
              <FontAwesome5 name={item.icon} size={20} color="#fff" style={styles.menuIconOnly} />
              <Animated.View
                style={[
                  styles.menuTextContainer,
                  {
                    opacity: slideAnim.interpolate({ inputRange: [60, 250], outputRange: [0, 1] }),
                  },
                ]}
              >
                <Text style={styles.menuText}>{item.label}</Text>
              </Animated.View>
            </View>
          </Pressable>
        ))}
      </Animated.View>
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#000001',
  },
  sideMenu: {
    backgroundColor: '#111',
    paddingVertical: 20,
    paddingHorizontal: 10,
    justifyContent: 'flex-start',
    zIndex: 10,
  },
  logo: {
    alignSelf: 'center',
    marginVertical: 20,
  },
  menuItem: {
    paddingVertical: 15,
    paddingHorizontal: 0,
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuItemFocused: {
    backgroundColor: '#333',
  },
  menuIconOnly: {
    width: 40,
    textAlign: 'center',
  },
  menuTextContainer: {
    marginLeft: 10,
    overflow: 'hidden',
  },
  menuText: {
    color: 'white',
    fontSize: 18,
  },
  content: {
    flex: 1,
  },
});
