'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { User, Session, AuthError } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { initializeUserProfile } from '@/lib/database';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<{ error: AuthError | null }>;
  resetPassword: (email: string) => Promise<{ error: AuthError | null }>;
  updatePassword: (newPassword: string) => Promise<{ error: AuthError | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    const getInitialSession = async () => {
      try {
        // Check if we're offline before trying to get session
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          // Offline: Skip session fetch, check local storage instead
          
          // Try to get cached session from local storage
          const cachedSession = localStorage.getItem('sb-kvzgipwewxdssbixxhqt-auth-token');
          if (cachedSession) {
            try {
              const parsed = JSON.parse(cachedSession);
              if (parsed?.user) {
                setSession(parsed);
                setUser(parsed.user);
                
                // Still try to initialize profile from offline storage
                await initializeUserProfile(parsed.user.id, parsed.user.email || '');
              }
            } catch (e) {
              // Silently fail if cached session is invalid
            }
          }
          setLoading(false);
          return;
        }

        const { data: { session }, error } = await supabase.auth.getSession();
        if (!error) {
          setSession(session);
          setUser(session?.user ?? null);
          
          // Initialize user profile for existing session
          if (session?.user) {
            try {
              await initializeUserProfile(session.user.id, session.user.email || '');
              
              // Don't sync here - the dashboard component will handle initial sync
              // This prevents duplicate syncs on page refresh
            } catch (profileError) {
              // Profile initialization error - non-critical
            }
          }
        }
      } catch (error) {
        // Session initialization error
      } finally {
        setLoading(false);
      }
    };

    getInitialSession();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        // Skip auth state changes when offline to prevent logout
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          // Offline: Ignore auth state changes to prevent logout
          return;
        }

        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
        
        // Initialize user profile when user signs in
        if (event === 'SIGNED_IN' && session?.user) {
          try {
            await initializeUserProfile(session.user.id, session.user.email || '');
            
            // No automatic sync in offline-first mode
            const { offlineService } = await import('@/lib/offline');
            await offlineService.setCurrentUser(session.user.id);
          } catch (error) {
            // Profile initialization error - non-critical
          }
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });
    
    // Initialize user profile if signup was successful
    if (!error && data.user) {
      try {
        await initializeUserProfile(data.user.id, data.user.email || '');
        
        // No automatic sync in offline-first mode
        const { offlineService } = await import('@/lib/offline');
        await offlineService.setCurrentUser(data.user.id);
      } catch (profileError) {
        // Profile initialization error - signup itself was successful
      }
    }
    
    return { error };
  };

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signOut = async () => {
    // Sync and clear data before signing out
    if (user) {
      try {
        const { offlineService } = await import('@/lib/offline');
        await offlineService.logout();
        
        // Clear auto-download flag so it can retry on next login
        localStorage.removeItem(`auto-download-attempted-${user.id}`);
      } catch (error) {
        // Sync cleanup error - non-critical for logout
      }
    }
    
    const { error } = await supabase.auth.signOut();
    return { error };
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    return { error };
  };

  const updatePassword = async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({
      password: newPassword
    });
    return { error };
  };

  const value = {
    user,
    session,
    loading,
    signUp,
    signIn,
    signOut,
    resetPassword,
    updatePassword,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}