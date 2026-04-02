import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/colors';
import { supabase, Ingredient, Step } from '../lib/supabase';
import { useUserRole } from '../lib/useUserRole';

const CATEGORIES = [
  "Zach's Favorites", 'All things Sourdough', 'Pizza',
  'Desserts', 'Quick & Easy', 'The Wok', 'Other',
];

const CUISINES = [
  'American', 'Italian', 'Mexican', 'Japanese', 'Chinese',
  'Indian', 'Comfort Food', 'Other',
];

export default function AddRecipeScreen() {
  const router = useRouter();
  const { isMemberOrAdmin, loading: roleLoading } = useUserRole();
  const [saving, setSaving] = useState(false);

  // Basic fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [cuisine, setCuisine] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [heroImage, setHeroImage] = useState<string | null>(null);

  // Ingredients
  const [ingredients, setIngredients] = useState<Ingredient[]>([
    { amount: '', unit: '', item: '' },
  ]);

  // Steps
  const [steps, setSteps] = useState<Step[]>([
    { order: 1, instruction: '', image_url: undefined },
  ]);

  // ─── Ingredient helpers ──────────────────────────────────────────────────────

  function updateIngredient(index: number, field: keyof Ingredient, value: string) {
    setIngredients((prev) => prev.map((ing, i) => i === index ? { ...ing, [field]: value } : ing));
  }

  function addIngredient() {
    setIngredients((prev) => [...prev, { amount: '', unit: '', item: '' }]);
  }

  function removeIngredient(index: number) {
    setIngredients((prev) => prev.filter((_, i) => i !== index));
  }

  // ─── Step helpers ────────────────────────────────────────────────────────────

  function updateStep(index: number, value: string) {
    setSteps((prev) => prev.map((s, i) => i === index ? { ...s, instruction: value } : s));
  }

  function addStep() {
    setSteps((prev) => [...prev, { order: prev.length + 1, instruction: '', image_url: undefined }]);
  }

  function removeStep(index: number) {
    setSteps((prev) =>
      prev.filter((_, i) => i !== index).map((s, i) => ({ ...s, order: i + 1 }))
    );
  }

  // ─── Image helpers ───────────────────────────────────────────────────────────

  async function pickHeroImage() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
    });
    if (!result.canceled) setHeroImage(result.assets[0].uri);
  }

  async function pickStepImage(index: number) {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.7,
    });
    if (!result.canceled) {
      const url = await uploadImage(result.assets[0].uri, `step-${Date.now()}`);
      if (url) {
        setSteps((prev) => prev.map((s, i) => i === index ? { ...s, image_url: url } : s));
      }
    }
  }

  async function uploadImage(uri: string, name: string): Promise<string | null> {
    const response = await fetch(uri);
    const blob = await response.blob();
    const mimeType = blob.type || 'image/jpeg';
    const fileExt = mimeType.split('/')[1]?.replace('jpeg', 'jpg') ?? 'jpg';
    const path = `${name}.${fileExt}`;

    const { error } = await supabase.storage
      .from('recipe-images')
      .upload(path, blob, { contentType: mimeType, upsert: true });

    if (error) {
      Alert.alert('Image upload failed', error.message);
      return null;
    }

    const { data } = supabase.storage.from('recipe-images').getPublicUrl(path);
    return data.publicUrl;
  }

  // ─── Save ────────────────────────────────────────────────────────────────────

  async function handleSave() {

    if (!title.trim()) {
      Alert.alert('Title required', 'Please enter a recipe title.');
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      Alert.alert('Sign in required', 'You must be signed in to add a recipe.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign In', onPress: () => router.push('/profile') },
      ]);
      return;
    }

    setSaving(true);

    let imageUrl: string | null = null;
    if (heroImage) {
      imageUrl = await uploadImage(heroImage, `hero-${Date.now()}`);
    }

    const tags = tagsInput
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);

    const cleanIngredients = ingredients.filter((i) => i.item.trim());
    const cleanSteps = steps
      .filter((s) => s.instruction.trim())
      .map((s, i) => ({ ...s, order: i + 1 }));


    const { data, error } = await supabase.from('recipes').insert({
      title: title.trim(),
      description: description.trim(),
      category,
      cuisine,
      tags,
      image_url: imageUrl,
      ingredients: cleanIngredients,
      steps: cleanSteps,
      created_by: user.id,
    }).select().single();

    setSaving(false);

    if (error) { Alert.alert('Error saving recipe', error.message); return; }
    router.replace(`/recipe/${data.id}`);
  }

  // ─── Render ──────────────────────────────────────────────────────────────────

  if (roleLoading) {
    return <ActivityIndicator style={{ flex: 1 }} color={Colors.primary} />;
  }

  if (!isMemberOrAdmin) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
        <Ionicons name="lock-closed-outline" size={48} color={Colors.textSecondary} />
        <Text style={{ fontSize: 18, fontWeight: '700', color: Colors.text, marginTop: 16, textAlign: 'center' }}>
          Account Pending Approval
        </Text>
        <Text style={{ fontSize: 15, color: Colors.textSecondary, marginTop: 8, textAlign: 'center', lineHeight: 22 }}>
          Your account needs to be approved by an admin before you can add recipes. Ask Zach to approve you as a family member.
        </Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>

        {/* Hero image */}
        <TouchableOpacity style={styles.heroPickerButton} onPress={pickHeroImage}>
          {heroImage ? (
            <Image source={{ uri: heroImage }} style={styles.heroPreview} />
          ) : (
            <View style={styles.heroPlaceholder}>
              <Ionicons name="camera-outline" size={32} color={Colors.textSecondary} />
              <Text style={styles.heroPlaceholderText}>Add cover photo</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Title */}
        <Text style={styles.label}>Title *</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Grandma's Apple Pie"
          placeholderTextColor={Colors.textSecondary}
          value={title}
          onChangeText={setTitle}
        />

        {/* Description */}
        <Text style={styles.label}>Description</Text>
        <TextInput
          style={[styles.input, styles.multiline]}
          placeholder="A short description of this recipe..."
          placeholderTextColor={Colors.textSecondary}
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={3}
        />

        {/* Category */}
        <Text style={styles.label}>Category</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
          {CATEGORIES.map((c) => (
            <TouchableOpacity
              key={c}
              style={[styles.chip, category === c && styles.chipActive]}
              onPress={() => setCategory(c)}
            >
              <Text style={[styles.chipText, category === c && styles.chipTextActive]}>{c}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Cuisine */}
        <Text style={styles.label}>Cuisine</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
          {CUISINES.map((c) => (
            <TouchableOpacity
              key={c}
              style={[styles.chip, cuisine === c && styles.chipActive]}
              onPress={() => setCuisine(c)}
            >
              <Text style={[styles.chipText, cuisine === c && styles.chipTextActive]}>{c}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Tags */}
        <Text style={styles.label}>Tags</Text>
        <TextInput
          style={styles.input}
          placeholder="apple, family, baking  (comma separated)"
          placeholderTextColor={Colors.textSecondary}
          value={tagsInput}
          onChangeText={setTagsInput}
          autoCapitalize="none"
        />

        {/* Ingredients */}
        <Text style={styles.sectionHeader}>Ingredients</Text>
        {ingredients.map((ing, i) => (
          <View key={i} style={styles.ingredientRow}>
            <TextInput
              style={[styles.input, styles.amountInput]}
              placeholder="Amt"
              placeholderTextColor={Colors.textSecondary}
              value={ing.amount}
              onChangeText={(v) => updateIngredient(i, 'amount', v)}
            />
            <TextInput
              style={[styles.input, styles.unitInput]}
              placeholder="Unit"
              placeholderTextColor={Colors.textSecondary}
              value={ing.unit}
              onChangeText={(v) => updateIngredient(i, 'unit', v)}
            />
            <TextInput
              style={[styles.input, styles.itemInput]}
              placeholder="Ingredient"
              placeholderTextColor={Colors.textSecondary}
              value={ing.item}
              onChangeText={(v) => updateIngredient(i, 'item', v)}
            />
            {ingredients.length > 1 && (
              <TouchableOpacity onPress={() => removeIngredient(i)} style={styles.removeBtn}>
                <Ionicons name="close-circle" size={22} color={Colors.textSecondary} />
              </TouchableOpacity>
            )}
          </View>
        ))}
        <TouchableOpacity style={styles.addRowBtn} onPress={addIngredient}>
          <Ionicons name="add-circle-outline" size={20} color={Colors.primary} />
          <Text style={styles.addRowText}>Add ingredient</Text>
        </TouchableOpacity>

        {/* Steps */}
        <Text style={styles.sectionHeader}>Instructions</Text>
        {steps.map((step, i) => (
          <View key={i} style={styles.stepBlock}>
            <View style={styles.stepHeader}>
              <View style={styles.stepBadge}>
                <Text style={styles.stepBadgeText}>{i + 1}</Text>
              </View>
              {steps.length > 1 && (
                <TouchableOpacity onPress={() => removeStep(i)} style={styles.removeBtn}>
                  <Ionicons name="close-circle" size={22} color={Colors.textSecondary} />
                </TouchableOpacity>
              )}
            </View>
            <TextInput
              style={[styles.input, styles.multiline]}
              placeholder="Describe this step..."
              placeholderTextColor={Colors.textSecondary}
              value={step.instruction}
              onChangeText={(v) => updateStep(i, v)}
              multiline
              numberOfLines={3}
            />
            {step.image_url ? (
              <Image source={{ uri: step.image_url }} style={styles.stepImagePreview} />
            ) : (
              <TouchableOpacity style={styles.stepImageBtn} onPress={() => pickStepImage(i)}>
                <Ionicons name="image-outline" size={18} color={Colors.textSecondary} />
                <Text style={styles.stepImageBtnText}>Add photo for this step</Text>
              </TouchableOpacity>
            )}
          </View>
        ))}
        <TouchableOpacity style={styles.addRowBtn} onPress={addStep}>
          <Ionicons name="add-circle-outline" size={20} color={Colors.primary} />
          <Text style={styles.addRowText}>Add step</Text>
        </TouchableOpacity>

        {/* Save button */}
        <TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={saving}>
          {saving ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.saveButtonText}>Save Recipe</Text>
          )}
        </TouchableOpacity>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 20, paddingBottom: 60 },
  heroPickerButton: { marginBottom: 20, borderRadius: 12, overflow: 'hidden' },
  heroPreview: { width: '100%', height: 200 },
  heroPlaceholder: {
    height: 180,
    backgroundColor: Colors.border,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 2,
    borderColor: Colors.border,
    borderStyle: 'dashed',
  },
  heroPlaceholderText: { fontSize: 14, color: Colors.textSecondary },
  label: { fontSize: 14, fontWeight: '600', color: Colors.text, marginBottom: 6, marginTop: 14 },
  sectionHeader: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
    marginTop: 28,
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 2,
    borderBottomColor: Colors.primary,
  },
  input: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: Colors.text,
  },
  multiline: { minHeight: 80, textAlignVertical: 'top' },
  chipScroll: { marginBottom: 4 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    marginRight: 8,
    marginBottom: 8,
  },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { fontSize: 13, color: Colors.text, fontWeight: '500' },
  chipTextActive: { color: '#FFF' },
  ingredientRow: { flexDirection: 'row', gap: 6, marginBottom: 8, alignItems: 'center' },
  amountInput: { width: 56 },
  unitInput: { width: 70 },
  itemInput: { flex: 1 },
  removeBtn: { padding: 2 },
  addRowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    marginBottom: 4,
  },
  addRowText: { fontSize: 14, color: Colors.primary, fontWeight: '600' },
  stepBlock: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 10,
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stepBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBadgeText: { color: '#FFF', fontWeight: '700', fontSize: 13 },
  stepImageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    borderStyle: 'dashed',
  },
  stepImageBtnText: { fontSize: 13, color: Colors.textSecondary },
  stepImagePreview: { width: '100%', height: 160, borderRadius: 8 },
  saveButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 32,
  },
  saveButtonText: { color: '#FFF', fontWeight: '700', fontSize: 17 },
});
