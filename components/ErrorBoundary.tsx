import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/colors';

type Props = { children: React.ReactNode };
type State = { hasError: boolean };

export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <Ionicons name="warning-outline" size={48} color={Colors.primary} />
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.subtitle}>The app ran into an unexpected error.</Text>
          <TouchableOpacity
            style={styles.button}
            onPress={() => this.setState({ hasError: false })}
          >
            <Text style={styles.buttonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
    padding: 32,
    gap: 12,
  },
  title: { fontSize: 20, fontWeight: '700', color: Colors.text },
  subtitle: { fontSize: 15, color: Colors.textSecondary, textAlign: 'center' },
  button: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 8,
  },
  buttonText: { color: '#FFF', fontWeight: '700', fontSize: 15 },
});
