import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Platform, View } from 'react-native';
import { useFonts, Pacifico_400Regular } from '@expo-google-fonts/pacifico';
import { Colors } from '../constants/colors';
import NavBar from '../components/NavBar';

export default function RootLayout() {
  const [fontsLoaded] = useFonts({ Pacifico_400Regular });

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
