import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/colors';
import { supabase } from '../lib/supabase';

type Props = {
  initialPrompt: string;
  onSelect: (url: string) => void;
  onCancel: () => void;
};

function enhancePrompt(prompt: string): string {
  return `wide angle establishing shot of ${prompt} on a set table with napkins and utensils, professional food photography, natural lighting, full dish visible with surrounding props, negative space around the subject`;
}

export default function AIImageGenerator({ initialPrompt, onSelect, onCancel }: Props) {
  const [prompt, setPrompt] = useState(initialPrompt);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    const trimmed = prompt.trim();
    if (!trimmed) return;
    setError(null);
    setLoading(true);
    setImageUrl(null);
    try {
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
      const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${supabaseUrl}/functions/v1/generate-image`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token ?? supabaseKey}`,
        },
        body: JSON.stringify({
          prompt: enhancePrompt(trimmed),
          seed: Math.floor(Math.random() * 1_000_000),
          width: 1536,
          height: 1536,
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text.slice(0, 200) || `Edge function returned ${res.status}`);
      }
      const blob = await res.blob();
      if (!blob.type.startsWith('image/')) throw new Error('Did not receive an image');
      setImageUrl(URL.createObjectURL(blob));
    } catch (e: any) {
      setError(e?.message ?? 'Generation failed. Try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.overlay}>
      <View style={styles.modal}>
        <View style={styles.header}>
          <Text style={styles.title}>Generate with AI</Text>
          <TouchableOpacity onPress={onCancel} accessibilityLabel="Close">
            <Ionicons name="close" size={24} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <Text style={styles.label}>Prompt</Text>
        <TextInput
          style={styles.input}
          value={prompt}
          onChangeText={setPrompt}
          placeholder="Describe the dish..."
          placeholderTextColor={Colors.textSecondary}
          multiline
          numberOfLines={2}
        />
        <Text style={styles.hint}>We add styling cues automatically (food photography, plating, lighting).</Text>

        <View style={styles.previewArea}>
          {!imageUrl && !loading && !error && (
            <View style={styles.previewPlaceholder}>
              <Ionicons name="sparkles-outline" size={32} color={Colors.textSecondary} />
              <Text style={styles.placeholderText}>Click Generate to create an image</Text>
            </View>
          )}

          {error && (
            <View style={styles.previewPlaceholder}>
              <Ionicons name="alert-circle-outline" size={32} color={Colors.danger} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {loading && (
            <View style={styles.previewPlaceholder}>
              <ActivityIndicator color={Colors.primary} size="large" />
              <Text style={styles.placeholderText}>Generating... (5–15s)</Text>
            </View>
          )}

          {imageUrl && !loading && !error && (
            <View style={styles.imageWrap}>
              <Image source={{ uri: imageUrl }} style={styles.preview} resizeMode="cover" />
            </View>
          )}
        </View>

        <View style={styles.buttons}>
          <TouchableOpacity
            style={[styles.secondaryBtn, (loading || !prompt.trim()) && styles.disabledBtn]}
            onPress={generate}
            disabled={loading || !prompt.trim()}
          >
            <Ionicons name={imageUrl ? 'refresh' : 'sparkles'} size={16} color={Colors.primary} />
            <Text style={styles.secondaryBtnText}>{imageUrl ? 'Regenerate' : 'Generate'}</Text>
          </TouchableOpacity>
          {imageUrl && !error && (
            <TouchableOpacity
              style={[styles.primaryBtn, loading && styles.disabledBtn]}
              onPress={() => onSelect(imageUrl)}
              disabled={loading}
            >
              <Text style={styles.primaryBtnText}>Use this photo</Text>
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity onPress={() => Linking.openURL('https://pollinations.ai')}>
          <Text style={styles.attribution}>Powered by Pollinations.ai</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 200,
  },
  modal: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 20,
    width: '94%',
    maxWidth: 600,
    maxHeight: '90%',
    gap: 10,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 18, fontWeight: '700', color: Colors.text },
  label: { fontSize: 13, fontWeight: '600', color: Colors.text, marginTop: 4 },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: Colors.text,
    backgroundColor: Colors.background,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  hint: { fontSize: 11, color: Colors.textSecondary, fontStyle: 'italic' },
  previewArea: { width: '100%', maxWidth: 380, aspectRatio: 1, alignSelf: 'center', backgroundColor: Colors.border, borderRadius: 10, overflow: 'hidden' },
  previewPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 16 },
  placeholderText: { fontSize: 13, color: Colors.textSecondary, textAlign: 'center' },
  errorText: { fontSize: 13, color: Colors.danger, textAlign: 'center' },
  imageWrap: { flex: 1, position: 'relative' },
  preview: { width: '100%', height: '100%' } as any,
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    gap: 8,
  },
  loadingText: { fontSize: 13, color: '#FFF', fontWeight: '600' },
  buttons: { flexDirection: 'row', gap: 10, marginTop: 4 },
  secondaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  secondaryBtnText: { fontSize: 14, fontWeight: '600', color: Colors.primary },
  primaryBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: { fontSize: 14, fontWeight: '700', color: '#FFF' },
  disabledBtn: { opacity: 0.5 },
  attribution: { fontSize: 11, color: Colors.primary, textAlign: 'center', textDecorationLine: 'underline' },
});
