import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Session, User } from '@supabase/supabase-js';
import { logActivity } from '@/utils/logger';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: any | null;
  loading: boolean;
  isAdmin: boolean;
  isDev: boolean;
  isSales: boolean;
  isAgent: boolean;
  role: string | null;
  signOut: () => Promise<void>;
  fetchProfile: (userId: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  profile: null,
  loading: true,
  isAdmin: false,
  isDev: false,
  isSales: false,
  isAgent: false,
  role: null,
  signOut: async () => {},
  fetchProfile: async () => {},
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (!error && data) {
        setProfile(data);
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) fetchProfile(session.user.id);
      else setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) fetchProfile(session.user.id);
      else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await logActivity({
      action: 'LOGOUT',
      resource: 'AUTH',
      description: 'Usuario cerró sesión',
      status: 'OK'
    });
    await supabase.auth.signOut();
  };

  const userRole = profile?.role?.toLowerCase() || 'agent';

  const value = {
    session,
    user,
    profile,
    loading,
    role: userRole,
    isAdmin: userRole === 'admin' || userRole === 'dev',
    isDev: userRole === 'dev',
    isSales: userRole === 'sales',
    isAgent: userRole === 'agent',
    signOut,
    fetchProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);