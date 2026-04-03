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
import { useRouter, useNavigation } from 'expo-router';
import { useState, useEffect, useMemo, useRef } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/colors';
import { supabase, Ingredient, Step, RecipeFamily } from '../lib/supabase';
import { getUniqueTags, getUniqueIngredients, invalidateAutocompleteCache } from '../lib/autocomplete';
import { estimateCalories } from '../lib/nutrition';
import { useUserRole } from '../lib/useUserRole';
import DraggableRow from '../components/DraggableRow';
import { CATEGORIES, FAMILIES, UNITS, CUISINES } from '../constants/recipes';

export default function AddRecipeScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { isMemberOrAdmin, loading: roleLoading } = useUserRole();
  const [saving, setSaving] = useState(false);

  // Basic fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  const [family, setFamily] = useState<RecipeFamily | ''>('');
  const [cuisine, setCuisine] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [prepTime, setPrepTime] = useState('');
  const [cookTime, setCookTime] = useState('');
  const [servings, setServings] = useState('');
  const [heroImage, setHeroImage] = useState<string | null>(null);

  const [unitDropdownIndex, setUnitDropdownIndex] = useState<number | null>(null);

  // Tags autocomplete
  const [allTags, setAllTags] = useState<string[]>([]);
  const [tagsFocused, setTagsFocused] = useState(false);

  useEffect(() => {
    getUniqueTags().then(setAllTags);
  }, []);

  const currentTags = tagsInput.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean);
  const currentPartial = tagsInput.split(',').pop()?.trim().toLowerCase() ?? '';

  const tagSuggestions = useMemo(() => {
    if (!currentPartial) return [];
    return allTags
      .filter((t) => t.includes(currentPartial) && !currentTags.includes(t))
      .slice(0, 6);
  }, [currentPartial, allTags, currentTags]);

  function acceptTag(tag: string) {
    const parts = tagsInput.split(',');
    parts[parts.length - 1] = ` ${tag}`;
    setTagsInput(parts.join(',') + ', ');
  }

  // Ingredient autocomplete
  const [allIngredientNames, setAllIngredientNames] = useState<string[]>([]);
  const [ingredientFocusIndex, setIngredientFocusIndex] = useState<number | null>(null);

  useEffect(() => {
    getUniqueIngredients().then(setAllIngredientNames);
  }, []);

  function getIngredientSuggestions(index: number) {
    const partial = ingredients[index]?.item?.trim().toLowerCase() ?? '';
    if (!partial) return [];
    return allIngredientNames
      .filter((name) => name.includes(partial) && name !== partial)
      .slice(0, 6);
  }

  function acceptIngredient(index: number, name: string) {
    updateIngredient(index, 'item', name);
    setIngredientFocusIndex(null);
  }

  // Ingredients
  const [ingredients, setIngredients] = useState<Ingredient[]>([
    { amount: '', unit: '', item: '' },
  ]);

  // Steps
  const [steps, setSteps] = useState<Step[]>([
    { order: 1, instruction: '', image_url: undefined },
  ]);

  // ─── Unsaved changes warning ────────────────────────────────────────────────

  const dirtyRef = useRef(false);

  useEffect(() => {
    dirtyRef.current = !!(
      title.trim() || description.trim() || notes.trim() || categories.length > 0 ||
      family || cuisine || tagsInput.trim() || prepTime || cookTime || servings || heroImage ||
      ingredients.some((i) => i.item.trim()) ||
      steps.some((s) => s.instruction.trim())
    );
  }, [title, description, notes, categories, family, cuisine, tagsInput, prepTime, cookTime, servings, heroImage, ingredients, steps]);

  // Warn on browser tab close
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const handler = (e: BeforeUnloadEvent) => {
      if (dirtyRef.current) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);

  // Warn on in-app navigation (back button, nav links)
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e: any) => {
      if (!dirtyRef.current) return;
      e.preventDefault();
      if (Platform.OS === 'web') {
        if (window.confirm('You have unsaved changes. Discard them and leave?')) {
          dirtyRef.current = false;
          navigation.dispatch(e.data.action);
        }
      } else {
        Alert.alert('Discard changes?', 'You have unsaved changes. Discard them and leave?', [
          { text: 'Keep Editing', style: 'cancel' },
          { text: 'Discard', style: 'destructive', onPress: () => {
            dirtyRef.current = false;
            navigation.dispatch(e.data.action);
          }},
        ]);
      }
    });
    return unsubscribe;
  }, [navigation]);

  // ─── Category multi-select ──────────────────────────────────────────────────

  function toggleCategory(cat: string) {
    setCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  }

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

  function moveIngredient(from: number, to: number) {
    if (to < 0 || to >= ingredients.length) return;
    setIngredients((prev) => {
      const copy = [...prev];
      const [item] = copy.splice(from, 1);
      copy.splice(to, 0, item);
      return copy;
    });
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

  function moveStep(from: number, to: number) {
    if (to < 0 || to >= steps.length) return;
    setSteps((prev) => {
      const copy = [...prev];
      const [item] = copy.splice(from, 1);
      copy.splice(to, 0, item);
      return copy.map((s, i) => ({ ...s, order: i + 1 }));
    });
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

  const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
  const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB

  async function uploadImage(uri: string, name: string): Promise<string | null> {
    const response = await fetch(uri);
    const blob = await response.blob();
    const mimeType = blob.type || 'image/jpeg';

    if (!ALLOWED_IMAGE_TYPES.includes(mimeType)) {
      Alert.alert('Invalid file type', 'Please upload a JPEG, PNG, or WebP image.');
      return null;
    }
    if (blob.size > MAX_IMAGE_SIZE) {
      Alert.alert('File too large', 'Images must be under 5MB.');
      return null;
    }

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

    const calories = await estimateCalories(cleanIngredients);

    const { data, error } = await supabase.from('recipes').insert({
      title: title.trim(),
      description: description.trim(),
      notes: notes.trim() || null,
      categories,
      family: family || null,
      prep_time: prepTime ? parseInt(prepTime, 10) : null,
      cook_time: cookTime ? parseInt(cookTime, 10) : null,
      servings: servings ? parseInt(servings, 10) : null,
      estimated_calories: calories,
      cuisine,
      tags,
      image_url: imageUrl,
      ingredients: cleanIngredients,
      steps: cleanSteps,
      created_by: user.id,
    }).select().single();

    setSaving(false);

    if (error) { Alert.alert('Error saving recipe', error.message); return; }
    invalidateAutocompleteCache();
    dirtyRef.current = false;
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
          maxLength={200}
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
          maxLength={1000}
        />

        {/* Notes */}
        <Text style={styles.label}>Notes</Text>
        <TextInput
          style={[styles.input, styles.multiline]}
          placeholder="Source, tips, variations, personal notes..."
          placeholderTextColor={Colors.textSecondary}
          value={notes}
          onChangeText={setNotes}
          multiline
          numberOfLines={3}
          maxLength={1000}
        />

        {/* Category (multi-select) */}
        <Text style={styles.label}>Categories</Text>
        <View style={styles.chipWrap}>
          {CATEGORIES.map((c) => (
            <TouchableOpacity
              key={c}
              style={[styles.chip, categories.includes(c) && styles.chipActive]}
              onPress={() => toggleCategory(c)}
              // @ts-ignore
              dataSet={{ hover: 'chip' }}
            >
              <Text style={[styles.chipText, categories.includes(c) && styles.chipTextActive]}>{c}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Family */}
        <Text style={styles.label}>Family</Text>
        <View style={styles.chipWrap}>
          {FAMILIES.map((f) => (
            <TouchableOpacity
              key={f}
              style={[styles.chip, family === f && styles.chipActive]}
              // @ts-ignore
              dataSet={{ hover: 'chip' }}
              onPress={() => setFamily(family === f ? '' : f)}
            >
              <Text style={[styles.chipText, family === f && styles.chipTextActive]}>{f}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Cuisine */}
        <Text style={styles.label}>Cuisine</Text>
        <View style={styles.chipWrap}>
          {CUISINES.map((c) => (
            <TouchableOpacity
              key={c}
              style={[styles.chip, cuisine === c && styles.chipActive]}
              onPress={() => setCuisine(c)}
              // @ts-ignore
              dataSet={{ hover: 'chip' }}
            >
              <Text style={[styles.chipText, cuisine === c && styles.chipTextActive]}>{c}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Tags */}
        <Text style={styles.label}>Tags</Text>
        <View>
          <TextInput
            style={styles.input}
            placeholder="apple, family, baking  (comma separated)"
            placeholderTextColor={Colors.textSecondary}
            value={tagsInput}
            onChangeText={setTagsInput}
            onFocus={() => setTagsFocused(true)}
            onBlur={() => setTimeout(() => setTagsFocused(false), 200)}
            onKeyPress={(e: any) => {
              if (e.nativeEvent.key === 'Tab' && tagSuggestions.length > 0) {
                e.preventDefault?.();
                acceptTag(tagSuggestions[0]);
              }
            }}
            autoCapitalize="none"
          />
          {tagsFocused && tagSuggestions.length > 0 && (
            <View style={styles.suggestionsBox}>
              {tagSuggestions.map((tag) => (
                <TouchableOpacity
                  key={tag}
                  style={styles.suggestionItem}
                  onPress={() => acceptTag(tag)}
                >
                  <Text style={styles.suggestionText}>{tag}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Prep Time / Cook Time / Servings */}
        <View style={styles.timeRow}>
          <View style={styles.timeField}>
            <Text style={styles.label}>Prep Time (min)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 15"
              placeholderTextColor={Colors.textSecondary}
              value={prepTime}
              onChangeText={setPrepTime}
              keyboardType="numeric"
            />
          </View>
          <View style={styles.timeField}>
            <Text style={styles.label}>Cook Time (min)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 30"
              placeholderTextColor={Colors.textSecondary}
              value={cookTime}
              onChangeText={setCookTime}
              keyboardType="numeric"
            />
          </View>
          <View style={styles.timeField}>
            <Text style={styles.label}>Servings</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 4"
              placeholderTextColor={Colors.textSecondary}
              value={servings}
              onChangeText={setServings}
              keyboardType="numeric"
            />
          </View>
        </View>

        {/* Ingredients */}
        <Text style={styles.sectionHeader}>Ingredients</Text>
        {ingredients.map((ing, i) => (
          <DraggableRow
            key={i}
            index={i}
            dragType="ingredient"
            onReorder={moveIngredient}
            style={[
              styles.ingredientRow,
              (unitDropdownIndex === i || ingredientFocusIndex === i) && { zIndex: 100 },
            ]}
          >
            <View style={styles.dragHandle}>
              <Ionicons name="reorder-three" size={20} color={Colors.textSecondary} />
            </View>
            <TextInput
              style={[styles.input, styles.amountInput]}
              placeholder="Amt"
              placeholderTextColor={Colors.textSecondary}
              value={ing.amount}
              onChangeText={(v) => updateIngredient(i, 'amount', v)}
              maxLength={20}
            />
            <View style={styles.unitWrapper}>
              <TouchableOpacity
                style={[styles.input, styles.unitInput]}
                onPress={() => setUnitDropdownIndex(unitDropdownIndex === i ? null : i)}
              >
                <Text style={ing.unit ? styles.unitText : styles.unitPlaceholder}>
                  {ing.unit || 'Unit'}
                </Text>
                <Ionicons name="chevron-down" size={14} color={Colors.textSecondary} />
              </TouchableOpacity>
              {unitDropdownIndex === i && (
                <View style={styles.unitDropdown}>
                  <ScrollView style={styles.unitDropdownScroll} nestedScrollEnabled>
                    {UNITS.map((u) => (
                      <TouchableOpacity
                        key={u}
                        style={[styles.unitOption, ing.unit === u && styles.unitOptionActive]}
                        onPress={() => {
                          updateIngredient(i, 'unit', u);
                          setUnitDropdownIndex(null);
                        }}
                      >
                        <Text style={[styles.unitOptionText, ing.unit === u && styles.unitOptionTextActive]}>
                          {u || '(none)'}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>
            <View style={[styles.ingredientItemWrapper, ingredientFocusIndex === i && { zIndex: 100 }]}>
              <TextInput
                style={[styles.input, styles.itemInput]}
                placeholder="Ingredient"
                placeholderTextColor={Colors.textSecondary}
                value={ing.item}
                onChangeText={(v) => updateIngredient(i, 'item', v)}
                maxLength={200}
                onFocus={() => setIngredientFocusIndex(i)}
                onBlur={() => setTimeout(() => setIngredientFocusIndex(null), 200)}
                onKeyPress={(e: any) => {
                  const suggestions = getIngredientSuggestions(i);
                  if (e.nativeEvent.key === 'Tab' && suggestions.length > 0) {
                    e.preventDefault?.();
                    acceptIngredient(i, suggestions[0]);
                  }
                }}
              />
              {ingredientFocusIndex === i && getIngredientSuggestions(i).length > 0 && (
                <View style={styles.ingredientSuggestions}>
                  {getIngredientSuggestions(i).map((name) => (
                    <TouchableOpacity
                      key={name}
                      style={styles.suggestionItem}
                      onPress={() => acceptIngredient(i, name)}
                    >
                      <Text style={styles.suggestionText}>{name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
            {ingredients.length > 1 && (
              <TouchableOpacity onPress={() => removeIngredient(i)} style={styles.removeBtn}>
                <Ionicons name="close-circle" size={22} color={Colors.textSecondary} />
              </TouchableOpacity>
            )}
          </DraggableRow>
        ))}
        <TouchableOpacity style={styles.addRowBtn} onPress={addIngredient}>
          <Ionicons name="add-circle-outline" size={20} color={Colors.primary} />
          <Text style={styles.addRowText}>Add ingredient</Text>
        </TouchableOpacity>

        {/* Steps */}
        <Text style={styles.sectionHeader}>Instructions</Text>
        {steps.map((step, i) => (
          <DraggableRow
            key={i}
            index={i}
            dragType="step"
            onReorder={moveStep}
            style={styles.stepBlock}
          >
            <View style={styles.stepHeader}>
              <View style={styles.stepHeaderLeft}>
                <View style={styles.dragHandle}>
                  <Ionicons name="reorder-three" size={20} color={Colors.textSecondary} />
                </View>
                <View style={styles.stepBadge}>
                  <Text style={styles.stepBadgeText}>{i + 1}</Text>
                </View>
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
              maxLength={2000}
            />
            {step.image_url ? (
              <Image source={{ uri: step.image_url }} style={styles.stepImagePreview} />
            ) : (
              <TouchableOpacity style={styles.stepImageBtn} onPress={() => pickStepImage(i)}>
                <Ionicons name="image-outline" size={18} color={Colors.textSecondary} />
                <Text style={styles.stepImageBtnText}>Add photo for this step</Text>
              </TouchableOpacity>
            )}
          </DraggableRow>
        ))}
        <TouchableOpacity style={styles.addRowBtn} onPress={addStep}>
          <Ionicons name="add-circle-outline" size={20} color={Colors.primary} />
          <Text style={styles.addRowText}>Add step</Text>
        </TouchableOpacity>

        {/* Save button */}
        {/* @ts-ignore */}
        <TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={saving} dataSet={{ hover: 'btn' }}>
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
  heroPickerButton: { marginBottom: 20, borderRadius: 12, overflow: 'hidden', maxWidth: 600, width: '100%', alignSelf: 'center' },
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
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 4 },
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
  timeRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
  timeField: { flex: 1 },
  ingredientRow: { flexDirection: 'row', gap: 6, marginBottom: 8, alignItems: 'center' },
  dragHandle: {
    padding: 4,
    cursor: 'grab' as any,
    opacity: 0.5,
  },
  amountInput: { width: 56 },
  unitWrapper: { position: 'relative', zIndex: 10 },
  unitInput: {
    width: 80,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 2,
  },
  unitText: { fontSize: 15, color: Colors.text },
  unitPlaceholder: { fontSize: 15, color: Colors.textSecondary },
  unitDropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    width: 120,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    marginTop: 4,
    zIndex: 100,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
  },
  unitDropdownScroll: { maxHeight: 200 },
  unitOption: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  unitOptionActive: { backgroundColor: Colors.secondary },
  unitOptionText: { fontSize: 14, color: Colors.text },
  unitOptionTextActive: { color: Colors.primary, fontWeight: '600' },
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
  stepHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
  stepImagePreview: { width: '100%', maxWidth: 600, height: 160, borderRadius: 8, alignSelf: 'center' },
  saveButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 32,
  },
  saveButtonText: { color: '#FFF', fontWeight: '700', fontSize: 17 },
  suggestionsBox: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    marginTop: 4,
    overflow: 'hidden',
  },
  suggestionItem: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  suggestionText: { fontSize: 14, color: Colors.text },
  ingredientItemWrapper: { flex: 1, position: 'relative' },
  ingredientSuggestions: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    marginTop: 4,
    zIndex: 100,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
  },
});
