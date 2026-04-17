import { Platform } from 'react-native';

export const LightColors = {
  primary: '#c47c30',
  primaryLight: '#e8a55a',
  secondary: '#ffe8cc',
  secondaryDark: '#ffd4a1',
  background: '#fffdf8',
  surface: '#ffffff',
  text: '#333333',
  textSecondary: '#777777',
  border: '#e0d8ce',
  cardBackground: '#ffffff',
  tabBar: '#ffffff',
  tabBarActive: '#c47c30',
  tabBarInactive: '#aaaaaa',
  footer: '#fff2e1',
  danger: '#E74C3C',
  codeBg: '#1e1e1e',
  codeText: '#d4d4d4',
  overlayDark: '#2a2a2a',
};

export const DarkColors: typeof LightColors = {
  primary: '#d4923e',
  primaryLight: '#e8a55a',
  secondary: '#3d2e1e',
  secondaryDark: '#4a3828',
  background: '#1a1a1a',
  surface: '#242424',
  text: '#e8e8e8',
  textSecondary: '#999999',
  border: '#3a3a3a',
  cardBackground: '#242424',
  tabBar: '#1e1e1e',
  tabBarActive: '#d4923e',
  tabBarInactive: '#666666',
  footer: '#2a2218',
  danger: '#E74C3C',
  codeBg: '#1e1e1e',
  codeText: '#d4d4d4',
  overlayDark: '#111111',
};

// Default export for backwards compatibility — components that haven't
// migrated to useThemeColors() yet still work.
export const Colors = LightColors;

export type ColorPalette = typeof LightColors;

export const Layout = {
  maxWidth: 960,
  headerTop: Platform.OS === 'web' ? 16 : 60,
};
