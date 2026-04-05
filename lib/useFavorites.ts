import { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabase';

let cachedFavoriteIds: Set<string> = new Set();
let listeners: Array<() => void> = [];

function notifyListeners() {
  listeners.forEach((fn) => fn());
}

export function useFavorites() {
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(cachedFavoriteIds);
  const [loading, setLoading] = useState(true);

  const loadFavorites = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      cachedFavoriteIds = new Set();
      setFavoriteIds(cachedFavoriteIds);
      setLoading(false);
      notifyListeners();
      return;
    }
    const { data } = await supabase
      .from('favorites')
      .select('recipe_id')
      .eq('user_id', user.id);
    cachedFavoriteIds = new Set((data ?? []).map((f) => f.recipe_id));
    setFavoriteIds(cachedFavoriteIds);
    setLoading(false);
    notifyListeners();
  }, []);

  useEffect(() => {
    loadFavorites();
    const { data: listener } = supabase.auth.onAuthStateChange(() => {
      loadFavorites();
    });
    // Subscribe to cache updates from other hook instances
    const sync = () => setFavoriteIds(new Set(cachedFavoriteIds));
    listeners.push(sync);
    return () => {
      listener.subscription.unsubscribe();
      listeners = listeners.filter((fn) => fn !== sync);
    };
  }, [loadFavorites]);

  const isFavorite = useCallback((recipeId: string) => favoriteIds.has(recipeId), [favoriteIds]);

  const toggleFavorite = useCallback(async (recipeId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const wasFavorite = cachedFavoriteIds.has(recipeId);

    // Optimistic update
    if (wasFavorite) {
      cachedFavoriteIds.delete(recipeId);
    } else {
      cachedFavoriteIds.add(recipeId);
    }
    setFavoriteIds(new Set(cachedFavoriteIds));
    notifyListeners();

    // Persist to database
    const { error } = wasFavorite
      ? await supabase.from('favorites').delete().eq('user_id', user.id).eq('recipe_id', recipeId)
      : await supabase.from('favorites').insert({ user_id: user.id, recipe_id: recipeId });

    if (error) {
      // Revert optimistic update
      if (wasFavorite) {
        cachedFavoriteIds.add(recipeId);
      } else {
        cachedFavoriteIds.delete(recipeId);
      }
      setFavoriteIds(new Set(cachedFavoriteIds));
      notifyListeners();
      return false;
    }

    return true;
  }, []);

  return { isFavorite, toggleFavorite, loading, refresh: loadFavorites };
}
