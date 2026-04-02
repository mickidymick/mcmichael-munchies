import { useState, useEffect } from 'react';
import { supabase, UserRole } from './supabase';

export function useUserRole() {
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    loadRole();
    const { data: listener } = supabase.auth.onAuthStateChange(() => {
      loadRole();
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  async function loadRole() {
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
    setLoading(false);
  }

  const isMemberOrAdmin = role === 'member' || role === 'admin';
  const isAdmin = role === 'admin';

  return { role, loading, userId, isMemberOrAdmin, isAdmin, refresh: loadRole };
}
