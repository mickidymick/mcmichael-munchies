import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Platform, View } from 'react-native';
import { useFonts, Pacifico_400Regular } from '@expo-google-fonts/pacifico';
import { useEffect } from 'react';
import { Colors } from '../constants/colors';
import NavBar from '../components/NavBar';
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
    // Apple touch icon
    const link = document.createElement('link');
    link.rel = 'apple-touch-icon';
    link.href = '/apple-touch-icon.png';
    document.head.appendChild(link);
    // Page title
    document.title = 'McMichael Munchies';
    return () => { document.head.removeChild(link); };
  }, []);
}

function useWebHoverStyles() {
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const style = document.createElement('style');
    style.textContent = `
      [data-hover="card"] { transition: box-shadow 0.15s ease, border-color 0.15s ease; }
      [data-hover="card"]:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.12); border-color: #c47c30 !important; }
      [data-hover="chip"] { transition: transform 0.1s ease, background-color 0.15s ease; }
      [data-hover="chip"]:hover { transform: scale(1.06); filter: brightness(0.95); }
      [data-hover="btn"] { transition: transform 0.1s ease, opacity 0.15s ease; }
      [data-hover="btn"]:hover { transform: scale(1.05); opacity: 0.85; }
      [data-hover="icon"] { transition: transform 0.15s ease; }
      [data-hover="icon"]:hover { transform: scale(1.2); }
      [data-hover="nav"] { transition: background-color 0.15s ease; }
      [data-hover="nav"]:hover { background-color: ${Colors.secondary}; }
      [data-hover="family"] { transition: box-shadow 0.15s ease, border-color 0.15s ease; }
      [data-hover="family"]:hover { box-shadow: 0 2px 8px rgba(0,0,0,0.1); border-color: #c47c30 !important; }
      [data-hover="catChip"] { transition: transform 0.1s ease, box-shadow 0.1s ease; }
      [data-hover="catChip"]:hover { transform: scale(1.08); box-shadow: 0 2px 6px rgba(0,0,0,0.1); }
    `;
    document.head.appendChild(style);
    return () => { document.head.removeChild(style); };
  }, []);
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({ Pacifico_400Regular });
  useWebMeta();
  useWebHoverStyles();
  useAuthRedirects();

  if (!fontsLoaded) return null;

  return (
    <View style={{ flex: 1 }}>
      <StatusBar style="dark" />
      {Platform.OS === 'web' && <NavBar />}
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="recipe/[id]"
          options={{
            headerShown: true,
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
          name="bulk-import"
          options={{
            headerShown: true,
            headerTitle: 'Bulk Import',
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
    </View>
  );
}
