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
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) {
          console.error('Error getting session:', error);
        } else {
          setSession(session);
          setUser(session?.user ?? null);
          
          // Initialize user profile for existing session
          if (session?.user) {
            try {
              await initializeUserProfile(session.user.id, session.user.email || '');
              
              // Don't sync here - the dashboard component will handle initial sync
              // This prevents duplicate syncs on page refresh
            } catch (profileError) {
              console.error('Error ensuring user profile for existing session:', profileError);
            }
          }
        }
      } catch (error) {
        console.error('Error in getInitialSession:', error);
      } finally {
        setLoading(false);
      }
    };

    getInitialSession();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
        
        // Initialize user profile when user signs in
        if (event === 'SIGNED_IN' && session?.user) {
          try {
            await initializeUserProfile(session.user.id, session.user.email || '');
            
            // Explicit login sync (user clicked login button)
            const { offlineService } = await import('@/lib/offline');
            offlineService.login(session.user.id, true).catch(error => {
              console.error('Login sync failed:', error);
            });
          } catch (error) {
            console.error('Error initializing user profile:', error);
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
        
        // Explicit login sync for new user (signup is like login)
        const { offlineService } = await import('@/lib/offline');
        offlineService.login(data.user.id, true).catch(error => {
          console.error('Signup sync failed:', error);
        });
      } catch (profileError) {
        console.error('Error initializing user profile after signup:', profileError);
        // Don't return this error as the signup itself was successful
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
      } catch (error) {
        console.error('Error during sync cleanup:', error);
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
    console.error('useAuth called outside AuthProvider');
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}