import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LightColors, DarkColors, ColorPalette } from '../constants/colors';

const THEME_KEY = 'theme_preference';

type ThemeMode = 'light' | 'dark' | 'system';

type ThemeContextType = {
  mode: ThemeMode;
  isDark: boolean;
  setMode: (mode: ThemeMode) => void;
};

const ThemeContext = createContext<ThemeContextType>({
  mode: 'system',
  isDark: false,
  setMode: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('system');

  useEffect(() => {
    AsyncStorage.getItem(THEME_KEY).then((stored) => {
      if (stored === 'light' || stored === 'dark' || stored === 'system') {
        setModeState(stored);
      }
    }).catch(() => {});
  }, []);

  function setMode(m: ThemeMode) {
    setModeState(m);
    AsyncStorage.setItem(THEME_KEY, m).catch(() => {});
  }

  const isDark = mode === 'dark' || (mode === 'system' && systemScheme === 'dark');

  return (
    <ThemeContext.Provider value={{ mode, isDark, setMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

export function useThemeColors(): ColorPalette {
  const { isDark } = useTheme();
  return isDark ? DarkColors : LightColors;
}
