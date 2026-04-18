import { useState, useEffect } from 'react';
import { supabase, UserRole } from './supabase';

export function useUserRole() {
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    loadRole();
    let listener: { subscription: { unsubscribe: () => void } } | null = null;
    try {
      listener = supabase.auth.onAuthStateChange(() => { loadRole(); }).data;
    } catch {}
    return () => { try { listener?.subscription?.unsubscribe(); } catch {} };
  }, []);

  async function loadRole() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setRole(null);
        setUserId(null);
        setLoading(false);
        return;
      }
      setUserId(user.id);
      const { data } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();
      setRole(data?.role ?? 'viewer');
    } catch { /* network error — keep previous state */ }
    setLoading(false);
  }

  const isMemberOrAdmin = role === 'member' || role === 'admin';
  const isAdmin = role === 'admin';

  return { role, loading, userId, isMemberOrAdmin, isAdmin, refresh: loadRole };
}
