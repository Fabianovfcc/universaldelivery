import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    // Segurança: Se demorar mais de 5 segundos, libera o loading de qualquer jeito
    const safetyTimeout = setTimeout(() => {
      if (loading) {
        console.warn('Timeout de segurança atingido no AuthContext');
        setLoading(false);
      }
    }, 5000);

    // Verificar sessão inicial
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('Sessão inicial verificada:', session?.user?.id);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setLoading(false);
        clearTimeout(safetyTimeout);
      }
    });

    // Escutar mudanças na auth
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('Mudança de estado Auth:', event, session?.user?.id);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setProfile(null);
        setLoading(false);
        clearTimeout(safetyTimeout);
      }
    });

    return () => {
      subscription.unsubscribe();
      clearTimeout(safetyTimeout);
    };
  }, []);

  const fetchProfile = async (id) => {
    console.log('Buscando perfil para ID:', id);
    try {
      const { data, error } = await supabase
        .from('usuarios')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      
      if (error) {
        console.error('Erro Supabase ao buscar perfil:', error);
      }
      
      if (data) {
        console.log('Perfil encontrado:', data);
        setProfile(data);
      } else {
        console.warn('Nenhum perfil encontrado na tabela usuarios para este ID.');
      }
    } catch (err) {
      console.error('Crash ao buscar perfil:', err);
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (email, password) => {
    return await supabase.auth.signInWithPassword({ email, password });
  };

  const signOut = async () => {
    return await supabase.auth.signOut();
  };

  const value = {
    user,
    profile,
    loading,
    signIn,
    signOut
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
