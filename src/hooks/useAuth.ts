import { useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export interface UserProfile {
  id: string;
  user_id: string;
  full_name: string;
  phone?: string;
  role?: 'admin' | 'seller';
  is_active?: boolean;
}

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [role, setRole] = useState<'admin' | 'seller' | null>(null);
  const [isActive, setIsActive] = useState<boolean>(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const fetchProfile = async (userId: string) => {
      try {
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle();

        if (profileError) throw profileError;

        const { data: roleData, error: roleError } = await supabase
          .from('user_roles')
          .select('role, is_active')
          .eq('user_id', userId)
          .maybeSingle();

        if (roleError) throw roleError;

        if (!isMounted) return;

        setIsActive(roleData?.is_active ?? true);

        if (profileData) {
          setProfile({
            ...profileData,
            role: (roleData?.role as any),
            is_active: roleData?.is_active
          });
          setRole(roleData?.role as 'admin' | 'seller' | null);
        } else {
          // Graceful fallback when profile row doesn't exist yet
          setProfile({
            id: userId,
            user_id: userId,
            full_name: '',
            role: (roleData?.role as any),
            is_active: roleData?.is_active
          });
          setRole(roleData?.role as 'admin' | 'seller' | null);
        }
      } catch (error) {
        console.error('Error fetching profile:', error);
        if (isMounted) {
          toast({
            title: "Erreur",
            description: "Impossible de charger le profil utilisateur",
            variant: "destructive"
          });
        }
      }
    };

    // Set up auth state listener (sync only). Defer network calls.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isMounted) return;

      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false); // do not block UI while fetching profile/role

      if (session?.user) {
        setTimeout(() => {
          if (isMounted) fetchProfile(session.user!.id);
        }, 0);
      } else {
        setProfile(null);
        setRole(null);
        setIsActive(true);
      }
    });

    // Initialize from existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!isMounted) return;

      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);

      if (session?.user) {
        setTimeout(() => {
          if (isMounted) fetchProfile(session.user!.id);
        }, 0);
      } else {
        setProfile(null);
        setRole(null);
        setIsActive(true);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signUp = async (email: string, password: string, fullName: string, phone?: string) => {
    try {
      const redirectUrl = `${window.location.origin}/`;
      
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            full_name: fullName,
            phone: phone || ''
          }
        }
      });

      if (error) {
        if (error.message.includes('User already registered')) {
          toast({
            title: "Compte existant",
            description: "Un compte avec cet email existe déjà. Essayez de vous connecter.",
            variant: "destructive"
          });
        } else {
          toast({
            title: "Erreur d'inscription",
            description: error.message,
            variant: "destructive"
          });
        }
        return { error };
      }

      toast({
        title: "Inscription réussie",
        description: "Votre compte a été créé avec succès !",
      });

      return { error: null };
    } catch (error) {
      console.error('Signup error:', error);
      return { error };
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          toast({
            title: "Erreur de connexion",
            description: "Email ou mot de passe incorrect",
            variant: "destructive"
          });
        } else {
          toast({
            title: "Erreur de connexion",
            description: error.message,
            variant: "destructive"
          });
        }
        return { error };
      }

      toast({
        title: "Connexion réussie",
        description: "Bienvenue sur Complexe Petit Pas !",
      });

      return { error: null };
    } catch (error) {
      console.error('Signin error:', error);
      return { error };
    }
  };

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        toast({
          title: "Erreur de déconnexion",
          description: error.message,
          variant: "destructive"
        });
      } else {
        toast({
          title: "Déconnexion réussie",
          description: "À bientôt !",
        });
        // Redirect to auth page after successful sign out
        window.location.href = '/auth';
      }
    } catch (error) {
      console.error('Signout error:', error);
    }
  };

  return { 
    user, 
    session, 
    profile, 
    role,
    isActive,
    loading, 
    signUp, 
    signIn, 
    signOut 
  };
};