import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase, isConfigured } from '../services/supabase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // Ambil profil detail dari tabel public.profiles
  async function fetchUserProfile(userId, fallbackUser = null) {
    if (!isConfigured) {
      // Mock data jika Supabase belum dihubungkan
      const demoRole = fallbackUser?.user_metadata?.role || 'admin';
      const mockProfile = {
        id: userId,
        full_name: demoRole === 'admin' ? 'Ustadz Abdullah (Admin Biro)' : 'Ahmad Fauzan (Jamaah)',
        role: demoRole,
        phone: '081234567890'
      };
      setProfile(mockProfile);
      return mockProfile;
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.warn('Gagal memuat profil Supabase:', error.message);
        // Fallback ke metadata auth jika profil belum ter-insert
        const metaRole = fallbackUser?.user_metadata?.role || 'jamaah';
        const fallbackProfile = {
          id: userId,
          full_name: fallbackUser?.user_metadata?.full_name || fallbackUser?.email || 'User Pengguna',
          role: metaRole,
          phone: fallbackUser?.user_metadata?.phone || ''
        };
        setProfile(fallbackProfile);
        return fallbackProfile;
      }

      setProfile(data);
      return data;
    } catch (err) {
      console.error('Error fetchUserProfile:', err);
      return null;
    }
  }

  useEffect(() => {
    // 1. Cek local storage demo user terlebih dahulu jika offline/prototyping
    const savedDemo = localStorage.getItem('demo_auth_user');
    if (savedDemo) {
      try {
        const parsed = JSON.parse(savedDemo);
        setUser(parsed.user);
        setProfile(parsed.profile);
        setLoading(false);
        return;
      } catch (e) {
        localStorage.removeItem('demo_auth_user');
      }
    }

    if (!isConfigured) {
      setLoading(false);
      return;
    }

    // 2. Ambil sesi Supabase Auth yang aktif
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user);
        fetchUserProfile(session.user.id, session.user).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    // 3. Pasang pendengar perubahan autentikasi
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (session?.user) {
          setUser(session.user);
          await fetchUserProfile(session.user.id, session.user);
        } else {
          setUser(null);
          setProfile(null);
        }
        setLoading(false);
      }
    );

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  // Login riil via Supabase Auth
  async function login(email, password) {
    if (!isConfigured) {
      throw new Error('Supabase belum dikonfigurasi. Harap gunakan tombol "Demo Mode" di bawah form.');
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;
    setUser(data.user);
    await fetchUserProfile(data.user.id, data.user);
    return data;
  }

  // Register riil via Supabase Auth
  async function register(email, password, fullName, phone) {
    if (!isConfigured) {
      throw new Error('Supabase belum dikonfigurasi. Harap gunakan tombol "Demo Mode" di bawah form.');
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          phone: phone,
          role: 'jamaah'
        }
      }
    });

    if (error) throw error;
    
    // Supabase will automatically create the profile because we have a trigger setup
    return data;
  }

  // Demo Login instan untuk presentasi prototipe
  function demoLogin(role = 'admin') {
    const isAdm = role === 'admin';
    const mockUser = {
      id: isAdm ? 'demo-admin-id-123' : 'demo-jamaah-id-456',
      email: isAdm ? 'admin@travelhaji.com' : 'jamaah@gmail.com',
      user_metadata: { role }
    };

    const mockProfile = {
      id: mockUser.id,
      full_name: isAdm ? 'Ustadz Ahmad Rasyid (Admin Travel)' : 'H. Muhammad Fauzan',
      role: role,
      phone: isAdm ? '08119876543' : '081234567890'
    };

    localStorage.setItem('demo_auth_user', JSON.stringify({ user: mockUser, profile: mockProfile }));
    setUser(mockUser);
    setProfile(mockProfile);
  }

  // Logout
  async function logout() {
    localStorage.removeItem('demo_auth_user');
    if (isConfigured) {
      try {
        await supabase.auth.signOut();
      } catch (e) {
        console.warn('Sign out error:', e);
      }
    }
    setUser(null);
    setProfile(null);
  }

  const role = profile?.role || 'jamaah';

  const value = {
    user,
    profile,
    role,
    isAdmin: role === 'admin',
    isJamaah: role === 'jamaah',
    loading,
    login,
    register,
    logout,
    demoLogin,
    isConfigured
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
