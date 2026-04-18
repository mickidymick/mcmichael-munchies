import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Image,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/colors';
import { useThemeColors } from '../lib/useTheme';
import { supabase, Ingredient, Step, RecipeFamily } from '../lib/supabase';
import { estimateCalories } from '../lib/nutrition';
import { useUserRole } from '../lib/useUserRole';
import { CATEGORIES, CUISINES } from '../constants/recipes';
import { invalidateSearchCache } from '../components/SearchBar';
import { fetchAndDownscale, blobToBase64 } from '../lib/images';

const MAX_PHOTOS = 6;

type ImportedRecipe = {
  title: string;
  description?: string;
  notes?: string;
  categories?: string[];
  cuisine?: string;
  family?: RecipeFamily | null;
  prep_time?: number | null;
  cook_time?: number | null;
  servings?: number | null;
  tags?: string[];
  ingredients: Ingredient[];
  steps: { order: number; instruction: string }[];
};

type RecipeStatus = 'pending' | 'saving' | 'saved' | 'failed';

const AI_PROMPT = `I'm going to show you photos of recipes from a cookbook. For each recipe, extract the information into this exact JSON format. Return ONLY a JSON array, no other text.

[
  {
    "title": "Recipe Name",
    "description": "Brief description of the dish",
    "notes": "Source, tips, or personal notes about this recipe",
    "categories": ["Chicken", "Quick & Easy"],
    "cuisine": "American",
    "family": null,
    "prep_time": 15,
    "cook_time": 30,
    "servings": 4,
    "tags": ["tag1", "tag2"],
    "ingredients": [
      { "amount": "2", "unit": "cup", "item": "flour" },
      { "amount": "1", "unit": "tsp", "item": "salt" }
    ],
    "steps": [
      { "order": 1, "instruction": "First step..." },
      { "order": 2, "instruction": "Second step..." }
    ]
  }
]

Rules:
- For "unit", use one of: tsp, tbsp, cup, oz, fl oz, pt, qt, gal, ml, l, lb, g, kg, pinch, dash, piece, slice, clove, can, bag, bunch, sprig, whole, or "" (empty string if no unit)
- For "categories", use an ARRAY of one or more of: ${CATEGORIES.join(', ')}. A recipe can belong to multiple categories.
- For "notes", include the source (e.g. "From Grandma's cookbook, p.42") or leave as empty string
- For "cuisine", use one of: ${CUISINES.join(', ')}
- For "family", use null (I'll set this later)
- Times are in minutes, use null if not specified
- Keep ingredient amounts as strings (e.g. "1/2", "2-3")
- If you can't read something clearly, make your best guess and add "[?]" to flag it`;

export default function AutoImportScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const { isMemberOrAdmin, loading: roleLoading } = useUserRole();
  const [mode, setMode] = useState<'photos' | 'paste'>('photos');
  const [photos, setPhotos] = useState<string[]>([]);
  const [extracting, setExtracting] = useState(false);
  const [jsonInput, setJsonInput] = useState('');
  const [recipes, setRecipes] = useState<ImportedRecipe[]>([]);
  const [statuses, setStatuses] = useState<RecipeStatus[]>([]);
  const [parseError, setParseError] = useState('');
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState<'paste' | 'importing'>('paste');
  const [promptCopied, setPromptCopied] = useState(false);
  const [savedIds, setSavedIds] = useState<string[]>([]);

  function handleParse() {
    parseAndImport(jsonInput);
  }

  function parseAndImport(rawText: string) {
    setParseError('');
    try {
      let text = rawText.trim();
      if (text.startsWith('```')) {
        text = text.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
      }
      // Gemini sometimes wraps JSON in prose — grab the first [...] or {...} block.
      if (!text.startsWith('[') && !text.startsWith('{')) {
        const arrayMatch = text.match(/\[[\s\S]*\]/);
        const objMatch = text.match(/\{[\s\S]*\}/);
        text = arrayMatch?.[0] ?? objMatch?.[0] ?? text;
      }
      const parsed = JSON.parse(text);
      const arr = Array.isArray(parsed) ? parsed : [parsed];

      const validated: ImportedRecipe[] = arr.map((r: any, i: number) => {
        if (!r.title?.trim()) throw new Error(`Recipe ${i + 1} is missing a title`);
        return {
          title: r.title.trim(),
          description: r.description?.trim() || '',
          notes: r.notes?.trim() || '',
          categories: Array.isArray(r.categories) ? r.categories :
            (r.category ? [r.category] : ['Other']),
          cuisine: r.cuisine || 'Other',
          family: r.family || null,
          prep_time: r.prep_time ?? null,
          cook_time: r.cook_time ?? null,
          servings: r.servings ?? null,
          tags: Array.isArray(r.tags) ? r.tags.map((t: string) => t.toLowerCase().trim()) : [],
          ingredients: Array.isArray(r.ingredients)
            ? r.ingredients.map((ing: any) => ({
                amount: String(ing.amount ?? ''),
                unit: String(ing.unit ?? ''),
                item: String(ing.item ?? ''),
              }))
            : [],
          steps: Array.isArray(r.steps)
            ? r.steps.map((s: any, idx: number) => ({
                order: s.order ?? idx + 1,
                instruction: String(s.instruction ?? ''),
              }))
            : [],
        };
      });

      setRecipes(validated);
      setStatuses(validated.map(() => 'pending'));
      setSavedIds([]);
      setStep('importing');
      // Auto-start import
      runImport(validated);
    } catch (e: any) {
      setParseError(e.message || 'Invalid JSON');
    }
  }

  async function runImport(recipesToSave: ImportedRecipe[]) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      Alert.alert('Sign in required', 'You must be signed in to import recipes.');
      return;
    }

    setSaving(true);
    const newStatuses = [...statuses];
    const newSavedIds = [...savedIds];

    for (let i = 0; i < recipesToSave.length; i++) {
      // Find the index in the full recipes array
      const fullIndex = recipes.indexOf(recipesToSave[i]);
      const idx = fullIndex >= 0 ? fullIndex : i;

      newStatuses[idx] = 'saving';
      setStatuses([...newStatuses]);

      const r = recipesToSave[i];
      const cleanIngredients = r.ingredients.filter((ing) => ing.item.trim());
      const cleanSteps = r.steps
        .filter((s) => s.instruction.trim())
        .map((s, si) => ({ ...s, order: si + 1 }));

      const calories = await estimateCalories(cleanIngredients);

      const { data, error } = await supabase.from('recipes').insert({
        title: r.title,
        description: r.description || '',
        notes: r.notes || null,
        categories: r.categories || ['Other'],
        cuisine: r.cuisine || 'Other',
        family: r.family || null,
        prep_time: r.prep_time,
        cook_time: r.cook_time,
        servings: r.servings,
        estimated_calories: calories,
        tags: r.tags || [],
        image_url: null,
        ingredients: cleanIngredients,
        steps: cleanSteps,
        created_by: user.id,
      }).select('id').single();

      if (error) {
        newStatuses[idx] = 'failed';
      } else {
        newStatuses[idx] = 'saved';
        newSavedIds.push(data.id);
      }
      setStatuses([...newStatuses]);
    }

    // Add saved recipes to review queue
    if (newSavedIds.length > 0) {
      const { error: queueError } = await supabase.from('review_queue').insert(
        newSavedIds.map((recipe_id) => ({ user_id: user.id, recipe_id }))
      );
      if (queueError) {
        Alert.alert('Warning', 'Recipes were saved but could not be added to the review queue. You can find them in Browse.');
      }
    }

    setSavedIds(newSavedIds);
    if (newSavedIds.length > 0) invalidateSearchCache();
    setSaving(false);
  }

  function retryFailed() {
    const failed = recipes.filter((_, i) => statuses[i] === 'failed');
    if (failed.length === 0) return;
    runImport(failed);
  }

  async function pickPhotos() {
    const remaining = MAX_PHOTOS - photos.length;
    if (remaining <= 0) {
      Alert.alert('Limit reached', `You can upload up to ${MAX_PHOTOS} photos at once.`);
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: remaining,
      quality: 0.85,
    });
    if (!result.canceled) {
      setPhotos((prev) => [...prev, ...result.assets.map((a) => a.uri)].slice(0, MAX_PHOTOS));
    }
  }

  function removePhoto(index: number) {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  }

  async function toImagePart(uri: string): Promise<{ mimeType: string; data: string }> {
    // Gemini does fine with ~1568px — a bit smaller than our upload cap to keep
    // token cost down.
    const { blob, mimeType } = await fetchAndDownscale(uri, { maxDimension: 1568 });
    const data = await blobToBase64(blob);
    return { mimeType, data };
  }

  async function extractFromPhotos() {
    if (photos.length === 0) return;
    setExtracting(true);
    setParseError('');
    try {
      const imageParts = await Promise.all(photos.map(toImagePart));

      // Use direct fetch so we can see error bodies (functions.invoke hides them on non-2xx).
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not signed in');
      const url = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/vision-import`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
          apikey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
        },
        body: JSON.stringify({ images: imageParts, prompt: AI_PROMPT }),
      });
      const raw = await res.text();
      let payload: any = null;
      try { payload = raw ? JSON.parse(raw) : null; } catch { /* leave as raw */ }
      if (!res.ok) {
        const msg = payload?.error ?? raw ?? `HTTP ${res.status}`;
        throw new Error(`${res.status}: ${msg}`);
      }
      if (!payload?.text) throw new Error('No text returned from vision model');
      setJsonInput(payload.text);
      parseAndImport(payload.text);
    } catch (e: any) {
      setParseError(e?.message ?? 'Could not extract recipes from photos.');
    } finally {
      setExtracting(false);
    }
  }

  async function copyPrompt() {
    if (Platform.OS === 'web') {
      await navigator.clipboard.writeText(AI_PROMPT);
    }
    setPromptCopied(true);
    setTimeout(() => setPromptCopied(false), 2000);
  }

  if (roleLoading) {
    return <ActivityIndicator style={{ flex: 1 }} color={Colors.primary} />;
  }

  if (!isMemberOrAdmin) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
        <Ionicons name="lock-closed-outline" size={48} color={Colors.textSecondary} />
        <Text style={{ fontSize: 18, fontWeight: '700', color: Colors.text, marginTop: 16, textAlign: 'center' }}>
          Member Access Required
        </Text>
        <Text style={{ fontSize: 15, color: Colors.textSecondary, marginTop: 8, textAlign: 'center', lineHeight: 22 }}>
          You need member access to import recipes. You can request access from your profile page.
        </Text>
        <TouchableOpacity
          style={{ backgroundColor: Colors.primary, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 8, marginTop: 16 }}
          onPress={() => router.push('/(tabs)/profile')}
        >
          <Text style={{ color: '#FFF', fontWeight: '600', fontSize: 15 }}>Go to Profile</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ─── Import status screen ─────────────────────────────────────────────────────

  if (step === 'importing') {
    const savedCount = statuses.filter((s) => s === 'saved').length;
    const failedCount = statuses.filter((s) => s === 'failed').length;
    const allDone = !saving && statuses.every((s) => s === 'saved' || s === 'failed');
    const allSaved = allDone && failedCount === 0;

    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.importTitle}>
          {saving ? 'Importing Recipes...' : allSaved ? 'All Recipes Imported!' : 'Import Complete'}
        </Text>
        <Text style={styles.importSubtitle}>
          {savedCount} of {recipes.length} saved
          {failedCount > 0 ? ` \u00B7 ${failedCount} failed` : ''}
        </Text>

        {/* Recipe status list */}
        {recipes.map((recipe, index) => {
          const status = statuses[index];
          return (
            <View key={index} style={styles.statusCard}>
              <View style={styles.statusIcon}>
                {status === 'pending' && <Ionicons name="ellipse-outline" size={22} color={Colors.textSecondary} />}
                {status === 'saving' && <ActivityIndicator size="small" color={Colors.primary} />}
                {status === 'saved' && <Ionicons name="checkmark-circle" size={22} color={Colors.primary} />}
                {status === 'failed' && <Ionicons name="close-circle" size={22} color={Colors.danger} />}
              </View>
              <View style={styles.statusInfo}>
                <Text style={styles.statusTitle} numberOfLines={1}>{recipe.title}</Text>
                <Text style={styles.statusMeta}>
                  {recipe.ingredients.length} ingredients, {recipe.steps.length} steps
                </Text>
              </View>
              {status === 'failed' && !saving && (
                <Text style={styles.statusFailed}>Failed</Text>
              )}
            </View>
          );
        })}

        {/* Actions */}
        {allDone && (
          <View style={styles.importActions}>
            {failedCount > 0 && (
              <TouchableOpacity style={styles.retryBtn} onPress={retryFailed}>
                <Ionicons name="refresh" size={16} color="#FFF" />
                <Text style={styles.retryBtnText}>Retry Failed ({failedCount})</Text>
              </TouchableOpacity>
            )}

            {savedCount > 0 && (
              <TouchableOpacity
                style={styles.continueBtn}
                onPress={() => router.push('/review-queue')}
              >
                <Text style={styles.continueBtnText}>Continue to Review</Text>
                <Ionicons name="arrow-forward" size={18} color="#FFF" />
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.importMoreBtn}
              onPress={() => {
                setJsonInput('');
                setRecipes([]);
                setStatuses([]);
                setSavedIds([]);
                setStep('paste');
              }}
            >
              <Text style={styles.importMoreBtnText}>Import More</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    );
  }

  // ─── Paste / Upload screen ────────────────────────────────────────────────────

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Mode toggle */}
      <View style={styles.modeToggle}>
        <TouchableOpacity
          style={[styles.modeBtn, mode === 'photos' && styles.modeBtnActive]}
          onPress={() => setMode('photos')}
        >
          <Ionicons
            name="camera-outline"
            size={16}
            color={mode === 'photos' ? '#FFF' : Colors.text}
          />
          <Text style={[styles.modeBtnText, mode === 'photos' && styles.modeBtnTextActive]}>
            Upload Photos
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modeBtn, mode === 'paste' && styles.modeBtnActive]}
          onPress={() => setMode('paste')}
        >
          <Ionicons
            name="clipboard-outline"
            size={16}
            color={mode === 'paste' ? '#FFF' : Colors.text}
          />
          <Text style={[styles.modeBtnText, mode === 'paste' && styles.modeBtnTextActive]}>
            Paste Text
          </Text>
        </TouchableOpacity>
      </View>

      {mode === 'photos' ? (
        <>
          <View style={styles.instructionCard}>
            <View style={styles.instructionHeader}>
              <Ionicons name="sparkles-outline" size={24} color={Colors.primary} />
              <Text style={styles.instructionTitle}>Extract from Cookbook Photos</Text>
            </View>
            <Text style={styles.instructionText}>
              Upload up to {MAX_PHOTOS} photos of recipe pages. Our vision AI will read them
              and turn them into importable recipes. Clear, well-lit photos work best.
            </Text>
          </View>

          <TouchableOpacity style={styles.uploadBtn} onPress={pickPhotos} disabled={extracting}>
            <Ionicons name="image-outline" size={20} color={Colors.primary} />
            <Text style={styles.uploadBtnText}>
              {photos.length === 0 ? 'Select photos' : `Add more (${photos.length}/${MAX_PHOTOS})`}
            </Text>
          </TouchableOpacity>

          {photos.length > 0 && (
            <View style={styles.thumbGrid}>
              {photos.map((uri, i) => (
                <View key={`${uri}-${i}`} style={styles.thumbWrap}>
                  <Image source={{ uri }} style={styles.thumb} />
                  {!extracting && (
                    <TouchableOpacity
                      style={styles.thumbRemove}
                      onPress={() => removePhoto(i)}
                      accessibilityLabel="Remove photo"
                    >
                      <Ionicons name="close" size={14} color="#FFF" />
                    </TouchableOpacity>
                  )}
                </View>
              ))}
            </View>
          )}

          {parseError ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={16} color={Colors.danger} />
              <Text style={styles.errorText}>{parseError}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={[styles.parseBtn, (photos.length === 0 || extracting) && styles.parseBtnDisabled]}
            onPress={extractFromPhotos}
            disabled={photos.length === 0 || extracting}
          >
            {extracting ? (
              <>
                <ActivityIndicator color="#FFF" />
                <Text style={styles.parseBtnText}>Reading your recipes...</Text>
              </>
            ) : (
              <>
                <Ionicons name="sparkles" size={18} color="#FFF" />
                <Text style={styles.parseBtnText}>Extract Recipes</Text>
              </>
            )}
          </TouchableOpacity>
        </>
      ) : (
        <>
          <View style={styles.instructionCard}>
            <View style={styles.instructionHeader}>
              <Ionicons name="book-outline" size={24} color={Colors.primary} />
              <Text style={styles.instructionTitle}>Import with an External AI Chat</Text>
            </View>
            <Text style={styles.instructionText}>
              1. Copy the prompt below using the Copy button{'\n'}
              2. Open any AI chatbot (ChatGPT, Claude, Gemini, etc.) and start a new chat{'\n'}
              3. Paste the prompt and attach photos of your cookbook pages{'\n'}
              4. The AI will read the recipes and give you formatted text{'\n'}
              5. Copy the entire response{'\n'}
              6. Come back here, paste it in the box below, and hit Import
            </Text>
          </View>

          <View style={styles.promptSection}>
            <View style={styles.promptHeader}>
              <Text style={styles.promptLabel}>Prompt for AI</Text>
              <TouchableOpacity style={styles.copyBtn} onPress={copyPrompt}>
                <Ionicons
                  name={promptCopied ? 'checkmark' : 'copy-outline'}
                  size={16}
                  color={promptCopied ? Colors.primary : Colors.textSecondary}
                />
                <Text style={[styles.copyBtnText, promptCopied && { color: Colors.primary }]}>
                  {promptCopied ? 'Copied!' : 'Copy'}
                </Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.promptBox} nestedScrollEnabled>
              <Text style={styles.promptText} selectable>{AI_PROMPT}</Text>
            </ScrollView>
          </View>

          <Text style={styles.pasteLabel}>Paste the AI response here</Text>
          <TextInput
            style={styles.jsonInput}
            placeholder='Paste the full response from the AI here...'
            placeholderTextColor={Colors.textSecondary}
            value={jsonInput}
            onChangeText={(v) => {
              setJsonInput(v);
              setParseError('');
            }}
            multiline
            numberOfLines={12}
          />

          {parseError ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={16} color={Colors.danger} />
              <Text style={styles.errorText}>{parseError}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={[styles.parseBtn, !jsonInput.trim() && styles.parseBtnDisabled]}
            onPress={handleParse}
            disabled={!jsonInput.trim()}
          >
            <Ionicons name="cloud-upload-outline" size={18} color="#FFF" />
            <Text style={styles.parseBtnText}>Import Recipes</Text>
          </TouchableOpacity>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 20, paddingBottom: 60, maxWidth: 700, width: '100%', alignSelf: 'center' },

  // Mode toggle
  modeToggle: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: 10,
    padding: 4,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
  },
  modeBtnActive: { backgroundColor: Colors.primary },
  modeBtnText: { fontSize: 14, fontWeight: '600', color: Colors.text },
  modeBtnTextActive: { color: '#FFF' },

  // Upload
  uploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.surface,
    borderWidth: 2,
    borderColor: Colors.primary,
    borderStyle: 'dashed',
    borderRadius: 12,
    paddingVertical: 16,
    marginBottom: 16,
  },
  uploadBtnText: { fontSize: 15, color: Colors.primary, fontWeight: '600' },
  thumbGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  thumbWrap: {
    position: 'relative',
    width: 96,
    height: 96,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  thumb: { width: '100%', height: '100%' },
  thumbRemove: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Instructions
  instructionCard: {
    backgroundColor: Colors.secondary,
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
  },
  instructionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  instructionTitle: { fontSize: 18, fontWeight: '700', color: Colors.text },
  instructionText: { fontSize: 14, color: Colors.text, lineHeight: 24 },

  // Prompt
  promptSection: { marginBottom: 24 },
  promptHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  promptLabel: { fontSize: 14, fontWeight: '600', color: Colors.text },
  copyBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, padding: 6 },
  copyBtnText: { fontSize: 13, color: Colors.textSecondary, fontWeight: '500' },
  promptBox: {
    backgroundColor: Colors.codeBg,
    borderRadius: 10,
    padding: 14,
    maxHeight: 200,
  },
  promptText: { fontSize: 12, color: '#d4d4d4', fontFamily: Platform.OS === 'web' ? 'monospace' : undefined, lineHeight: 18 },

  // JSON input
  pasteLabel: { fontSize: 14, fontWeight: '600', color: Colors.text, marginBottom: 8 },
  jsonInput: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 13,
    color: Colors.text,
    fontFamily: Platform.OS === 'web' ? 'monospace' : undefined,
    minHeight: 200,
    textAlignVertical: 'top',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fdecea',
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
  },
  errorText: { fontSize: 13, color: Colors.danger, flex: 1 },
  parseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    marginTop: 16,
  },
  parseBtnDisabled: { opacity: 0.5 },
  parseBtnText: { color: '#FFF', fontWeight: '700', fontSize: 16 },

  // Import status screen
  importTitle: { fontSize: 22, fontWeight: '700', color: Colors.text, marginBottom: 4 },
  importSubtitle: { fontSize: 14, color: Colors.textSecondary, marginBottom: 20 },

  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.surface,
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statusIcon: { width: 24, alignItems: 'center' },
  statusInfo: { flex: 1 },
  statusTitle: { fontSize: 15, fontWeight: '600', color: Colors.text },
  statusMeta: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  statusFailed: { fontSize: 12, fontWeight: '600', color: Colors.danger },

  importActions: { marginTop: 20, gap: 10 },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Colors.danger,
    paddingVertical: 14,
    borderRadius: 10,
  },
  retryBtnText: { color: '#FFF', fontWeight: '600', fontSize: 15 },
  continueBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    borderRadius: 10,
  },
  continueBtnText: { color: '#FFF', fontWeight: '700', fontSize: 16 },
  importMoreBtn: {
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  importMoreBtnText: { color: Colors.primary, fontWeight: '600', fontSize: 15 },
});
