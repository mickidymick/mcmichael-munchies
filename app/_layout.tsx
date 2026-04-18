import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Platform, View } from 'react-native';
import { useFonts, Pacifico_400Regular } from '@expo-google-fonts/pacifico';
import React, { useEffect } from 'react';
import { Colors } from '../constants/colors';
import { useTheme, useThemeColors } from '../lib/useTheme';
import NavBar from '../components/NavBar';
import ErrorBoundary from '../components/ErrorBoundary';
import { ThemeProvider } from '../lib/useTheme';
import { supabase } from '../lib/supabase';
import { useRouter } from 'expo-router';

function useAuthRedirects() {
  const router = useRouter();
  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        router.replace('/reset-password');
      }
    });
    return () => listener.subscription.unsubscribe();
  }, [router]);
}

function useWebMeta() {
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const elements: HTMLElement[] = [];

    function addMeta(name: string, content: string) {
      // Don't duplicate if already present
      if (document.querySelector(`meta[property="${name}"], meta[name="${name}"]`)) return;
      const meta = document.createElement('meta');
      if (name.startsWith('og:')) {
        meta.setAttribute('property', name);
      } else {
        meta.setAttribute('name', name);
      }
      meta.content = content;
      document.head.appendChild(meta);
      elements.push(meta);
    }

    function addLink(rel: string, href: string, type?: string) {
      const link = document.createElement('link');
      link.rel = rel;
      link.href = href;
      if (type) link.type = type;
      document.head.appendChild(link);
      elements.push(link);
    }

    // Page title
    document.title = 'McMichael Munchies';

    // Favicon & icons
    addLink('icon', '/logo.png', 'image/png');
    addLink('apple-touch-icon', '/apple-touch-icon.png');

    // Default OG tags (recipe detail pages override title/description dynamically)
    addMeta('description', 'Family recipes from the McMichaels, Murthas, Elmores, and Rosses.');
    addMeta('og:title', 'McMichael Munchies');
    addMeta('og:description', 'Family recipes from the McMichaels, Murthas, Elmores, and Rosses.');
    addMeta('og:type', 'website');
    addMeta('og:image', '/logo.png');

    return () => { elements.forEach((el) => el.remove()); };
  }, []);
}

function useWebDarkMode() {
  const { isDark } = useTheme();
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const id = 'dark-mode-overrides';
    let style = document.getElementById(id) as HTMLStyleElement | null;
    if (!style) {
      style = document.createElement('style');
      style.id = id;
      document.head.appendChild(style);
    }
    if (isDark) {
      // Override all hardcoded light-mode colors from StyleSheet.create blocks
      // by targeting the exact hex values React Native Web inlines
      style.textContent = `
        [style*="background-color: rgb(255, 253, 248)"] { background-color: #1a1a1a !important; }
        [style*="background-color: rgb(255, 255, 255)"] { background-color: #242424 !important; }
        [style*="background-color: rgb(255, 232, 204)"] { background-color: #3d2e1e !important; }
        [style*="background-color: rgb(255, 242, 225)"] { background-color: #2a2218 !important; }
        [style*="background-color: rgb(224, 216, 206)"] { background-color: #3a3a3a !important; }
        [style*="color: rgb(51, 51, 51)"] { color: #e8e8e8 !important; }
        [style*="color: rgb(119, 119, 119)"] { color: #999999 !important; }
        [style*="border-color: rgb(224, 216, 206)"] { border-color: #3a3a3a !important; }
        [style*="border-bottom-color: rgb(224, 216, 206)"] { border-bottom-color: #3a3a3a !important; }
        [style*="border-top-color: rgb(224, 216, 206)"] { border-top-color: #3a3a3a !important; }
        input, textarea { color: #e8e8e8 !important; background-color: #1a1a1a !important; border-color: #3a3a3a !important; }
        input::placeholder, textarea::placeholder { color: #999999 !important; }
      `;
    } else {
      style.textContent = '';
    }
    return () => {};
  }, [isDark]);
}

function useWebHoverStyles() {
  const colors = useThemeColors();
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const style = document.createElement('style');
    style.textContent = `
      @media (hover: hover) {
        [data-hover="card"] { transition: box-shadow 0.15s ease, border-color 0.15s ease; }
        [data-hover="card"]:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.12); border-color: #c47c30 !important; }
        [data-hover="chip"] { transition: transform 0.1s ease, background-color 0.15s ease; }
        [data-hover="chip"]:hover { transform: scale(1.06); filter: brightness(0.95); }
        [data-hover="btn"] { transition: transform 0.1s ease, opacity 0.15s ease; }
        [data-hover="btn"]:hover { transform: scale(1.05); opacity: 0.85; }
        [data-hover="icon"] { transition: transform 0.15s ease; }
        [data-hover="icon"]:hover { transform: scale(1.2); }
        [data-hover="nav"] { transition: background-color 0.15s ease; }
        [data-hover="nav"]:hover { background-color: ${colors.secondary}; }
        [data-hover="family"] { transition: box-shadow 0.15s ease, border-color 0.15s ease; }
        [data-hover="family"]:hover { box-shadow: 0 2px 8px rgba(0,0,0,0.1); border-color: #c47c30 !important; }
        [data-hover="catChip"] { transition: transform 0.1s ease, box-shadow 0.1s ease; }
        [data-hover="catChip"]:hover { transform: scale(1.08); box-shadow: 0 2px 6px rgba(0,0,0,0.1); }
      }
      [data-scroll="always"] { overflow-y: auto !important; }
      [data-scroll="always"]::-webkit-scrollbar { width: 6px; }
      [data-scroll="always"]::-webkit-scrollbar-track { background: transparent; }
      [data-scroll="always"]::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.25); border-radius: 3px; }
    `;
    document.head.appendChild(style);
    return () => { document.head.removeChild(style); };
  }, [colors]);
}

function AppShell({ children }: { children: React.ReactNode }) {
  useWebDarkMode();
  useWebHoverStyles();
  useAuthRedirects();
  return (
    <View style={{ flex: 1 }}>
      <StatusBar style="auto" />
      {Platform.OS === 'web' && <NavBar />}
      {children}
    </View>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({ Pacifico_400Regular });
  useWebMeta();

  if (!fontsLoaded) return null;

  return (
    <ThemeProvider>
    <ErrorBoundary>
    <AppShell>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="+not-found" options={{ headerShown: false }} />
        <Stack.Screen
          name="collections"
          options={{
            headerShown: Platform.OS !== 'web',
            headerTitle: 'Collections',
            headerBackTitle: 'Back',
            headerStyle: { backgroundColor: Colors.background },
            headerTintColor: Colors.primary,
          }}
        />
        <Stack.Screen
          name="collection/[id]"
          options={{
            headerShown: Platform.OS !== 'web',
            headerTitle: 'Collection',
            headerBackTitle: 'Back',
            headerStyle: { backgroundColor: Colors.background },
            headerTintColor: Colors.primary,
          }}
        />
        <Stack.Screen
          name="shopping-list"
          options={{
            headerShown: Platform.OS !== 'web',
            headerTitle: 'Shopping List',
            headerBackTitle: 'Back',
            headerStyle: { backgroundColor: Colors.background },
            headerTintColor: Colors.primary,
          }}
        />
        <Stack.Screen
          name="about"
          options={{
            headerShown: Platform.OS !== 'web',
            headerTitle: 'About',
            headerBackTitle: 'Back',
            headerStyle: { backgroundColor: Colors.background },
            headerTintColor: Colors.primary,
          }}
        />
        <Stack.Screen
          name="recipe/[id]"
          options={{
            headerShown: Platform.OS !== 'web',
            headerBackTitle: 'Back',
            headerTitle: '',
            headerStyle: { backgroundColor: Colors.background },
            headerTintColor: Colors.primary,
          }}
        />
        <Stack.Screen
          name="add-recipe"
          options={{
            headerShown: true,
            headerTitle: 'Add Recipe',
            headerBackTitle: 'Cancel',
            headerStyle: { backgroundColor: Colors.background },
            headerTintColor: Colors.primary,
          }}
        />
        <Stack.Screen
          name="edit-recipe/[id]"
          options={{
            headerShown: true,
            headerTitle: 'Edit Recipe',
            headerBackTitle: 'Cancel',
            headerStyle: { backgroundColor: Colors.background },
            headerTintColor: Colors.primary,
          }}
        />
        <Stack.Screen
          name="review-queue"
          options={{
            headerShown: true,
            headerTitle: 'Review Queue',
            headerBackTitle: 'Back',
            headerStyle: { backgroundColor: Colors.background },
            headerTintColor: Colors.primary,
          }}
        />
        <Stack.Screen
          name="auto-import"
          options={{
            headerShown: true,
            headerTitle: 'Auto Import',
            headerBackTitle: 'Back',
            headerStyle: { backgroundColor: Colors.background },
            headerTintColor: Colors.primary,
          }}
        />
        <Stack.Screen
          name="forgot-password"
          options={{
            headerShown: true,
            headerTitle: '',
            headerBackTitle: 'Back',
            headerStyle: { backgroundColor: Colors.background },
            headerTintColor: Colors.primary,
          }}
        />
        <Stack.Screen
          name="reset-password"
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="pending-requests"
          options={{
            headerShown: true,
            headerTitle: 'Pending Requests',
            headerBackTitle: 'Back',
            headerStyle: { backgroundColor: Colors.background },
            headerTintColor: Colors.primary,
          }}
        />
        <Stack.Screen
          name="admin"
          options={{
            headerShown: true,
            headerTitle: 'Manage Members',
            headerBackTitle: 'Back',
            headerStyle: { backgroundColor: Colors.background },
            headerTintColor: Colors.primary,
          }}
        />
      </Stack>
    </AppShell>
    </ErrorBoundary>
    </ThemeProvider>
  );
}
