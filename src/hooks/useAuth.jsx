import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase, isConfigured } from '../services/supabase';

const AuthContext = createContext(null);

// Konfigurasi apakah mode demo diizinkan (default: false untuk keamanan data produksi; aktif hanya jika VITE_ALLOW_DEMO_MODE='true')
const isDemoAllowed = import.meta.env.VITE_ALLOW_DEMO_MODE === 'true';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profileError, setProfileError] = useState(null);
  const [isDemo, setIsDemo] = useState(false);

  // Ambil profil detail resmi dari tabel public.profiles berdasarkan user ID Supabase Auth
  const fetchUserProfile = useCallback(async (userId) => {
    if (!userId) {
      setProfile(null);
      setProfileError(null);
      return { profile: null, error: null };
    }

    if (!isConfigured) {
      const err = new Error('Supabase client belum dikonfigurasi di .env');
      setProfileError(err.message);
      return { profile: null, error: err, isQueryError: true };
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.error('[useAuth] Error fetching profile:', error.message);
        setProfile(null);
        const errMsg = `Gagal memuat data profil dari database: ${error.message}`;
        setProfileError(errMsg);
        return { profile: null, error: new Error(errMsg), isQueryError: true };
      }

      if (!data) {
        console.warn(`[useAuth] Profil dengan ID ${userId} tidak ditemukan di tabel profiles.`);
        setProfile(null);
        const errMsg = 'Profil akun belum terhubung di database (tabel profiles). Hubungi administrator untuk memastikan profil akun Anda telah dibuat.';
        setProfileError(errMsg);
        return { profile: null, error: new Error(errMsg), isNotFound: true };
      }

      // Validasi role resmi: HANYA 'admin' dan 'jamaah' yang sah
      if (data.role !== 'admin' && data.role !== 'jamaah') {
        console.warn(`[useAuth] Role pengguna tidak valid: "${data.role}"`);
        setProfile(null); // Jangan set data profil jika role tidak dikenali
        const errMsg = `Role akun "${data.role || 'kosong'}" tidak dikenali oleh sistem. Hanya role "admin" dan "jamaah" yang diizinkan.`;
        setProfileError(errMsg);
        return { profile: null, error: new Error(errMsg), isInvalidRole: true };
      }

      setProfile(data);
      setProfileError(null);
      return { profile: data, error: null };
    } catch (err) {
      console.error('[useAuth] Exception fetchUserProfile:', err);
      setProfile(null);
      const errMsg = err.message || 'Terjadi kesalahan jaringan saat memeriksa profil pengguna.';
      setProfileError(errMsg);
      return { profile: null, error: err, isQueryError: true };
    }
  }, []);

  // Inisialisasi sesi saat aplikasi dimuat atau di-refresh
  useEffect(() => {
    let mounted = true;

    async function initAuth() {
      // 1. Cek sesi demo dari localStorage HANYA jika demo mode diizinkan secara eksplisit
      const savedDemo = localStorage.getItem('demo_auth_user');
      if (savedDemo && isDemoAllowed) {
        try {
          const parsed = JSON.parse(savedDemo);
          if (parsed?.user && parsed?.profile) {
            if (mounted) {
              setUser(parsed.user);
              setProfile(parsed.profile);
              setIsDemo(true);
              setProfileError(null);
              setLoading(false);
            }
            return;
          }
        } catch (e) {
          localStorage.removeItem('demo_auth_user');
        }
      } else if (savedDemo && !isDemoAllowed) {
        localStorage.removeItem('demo_auth_user');
      }

      // 2. Jika Supabase belum dikonfigurasi
      if (!isConfigured) {
        if (mounted) {
          setUser(null);
          setProfile(null);
          setIsDemo(false);
          setLoading(false);
        }
        return;
      }

      // 3. Ambil sesi Supabase Auth yang aktif (menjaga sesi valid saat refresh)
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) {
          console.error('[useAuth] getSession error:', sessionError.message);
        }

        if (session?.user && mounted) {
          setUser(session.user);
          setIsDemo(false);
          await fetchUserProfile(session.user.id);
        } else if (mounted) {
          setUser(null);
          setProfile(null);
          setIsDemo(false);
        }
      } catch (err) {
        console.error('[useAuth] initAuth error:', err);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    initAuth();

    // 4. Pasang listener perubahan autentikasi Supabase
    if (isConfigured) {
      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        async (event, session) => {
          if (!mounted) return;

          // Jika sedang dalam Demo Mode, abaikan event auth Supabase
          if (localStorage.getItem('demo_auth_user')) {
            return;
          }

          if (event === 'SIGNED_OUT') {
            setUser(null);
            setProfile(null);
            setIsDemo(false);
            setProfileError(null);
            setLoading(false);
            return;
          }

          if (session?.user) {
            setUser(session.user);
            setIsDemo(false);
            // Jika bukan INITIAL_SESSION (yang sudah diproses oleh getSession di initAuth), muat ulang profil
            if (event !== 'INITIAL_SESSION') {
              await fetchUserProfile(session.user.id);
            }
          } else {
            setUser(null);
            setProfile(null);
            setIsDemo(false);
            setProfileError(null);
          }
          setLoading(false);
        }
      );

      return () => {
        mounted = false;
        subscription?.unsubscribe();
      };
    } else {
      return () => {
        mounted = false;
      };
    }
  }, [fetchUserProfile]);

  // Login riil via Supabase Auth
  async function login(email, password) {
    if (!isConfigured) {
      throw new Error('Konfigurasi Supabase belum lengkap di .env. Harap periksa VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY.');
    }

    const cleanEmail = (email || '').trim().toLowerCase();
    if (!cleanEmail) {
      throw new Error('Alamat email wajib diisi.');
    }
    if (!password) {
      throw new Error('Kata sandi wajib diisi.');
    }

    // Bersihkan sesi demo jika pengguna beralih ke login riil
    localStorage.removeItem('demo_auth_user');
    setIsDemo(false);

    const { data, error } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password,
    });

    if (error) {
      if (error.message.includes('Invalid login credentials')) {
        throw new Error('Email atau kata sandi salah. Silakan periksa kembali.');
      } else if (error.message.includes('Email not confirmed')) {
        throw new Error('Email belum dikonfirmasi. Silakan periksa kotak masuk email Anda.');
      }
      throw new Error(error.message || 'Gagal masuk akun. Silakan periksa koneksi atau coba lagi.');
    }

    if (!data?.user) {
      throw new Error('Gagal mendapatkan sesi pengguna dari Supabase.');
    }

    // Ambil dan validasi profil resmi dari tabel profiles
    const { profile: userProfile, error: profileErr } = await fetchUserProfile(data.user.id);
    
    // Tangani kegagalan mengambil profil dengan aman tanpa menganggap sebagai Jamaah otomatis:
    // Jika profil tidak ditemukan, error query, atau role tidak sah, batalkan sesi Supabase agar tidak meninggalkan sesi aktif yang invalid
    if (profileErr || !userProfile || (userProfile.role !== 'admin' && userProfile.role !== 'jamaah')) {
      try {
        await supabase.auth.signOut();
      } catch (signOutErr) {
        console.warn('[useAuth] Error signOut saat verifikasi profil gagal:', signOutErr);
      }
      setUser(null);
      setProfile(null);

      if (profileErr) {
        throw profileErr;
      }
      if (!userProfile) {
        throw new Error('Autentikasi berhasil, namun profil akun Anda belum terhubung di tabel profiles database.');
      }
      throw new Error(`Role akun "${userProfile.role || 'kosong'}" tidak sah. Hanya role "admin" dan "jamaah" yang diizinkan.`);
    }

    setUser(data.user);
    setProfile(userProfile);
    setProfileError(null);

    return {
      user: data.user,
      profile: userProfile,
      role: userProfile.role
    };
  }

  // Register riil via Supabase Auth
  async function register(email, password, fullName, phone) {
    if (!isConfigured) {
      throw new Error('Konfigurasi Supabase belum lengkap di .env.');
    }

    const cleanEmail = (email || '').trim().toLowerCase();
    localStorage.removeItem('demo_auth_user');
    setIsDemo(false);

    // Pendaftaran publik selalu menetapkan role: 'jamaah'
    const { data, error } = await supabase.auth.signUp({
      email: cleanEmail,
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
    return data;
  }

  // Demo Login eksplisit HANYA jika mode demo diizinkan
  function demoLogin(role = 'admin') {
    if (!isDemoAllowed) {
      throw new Error('Mode demo dinonaktifkan di environment ini.');
    }

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
    setIsDemo(true);
    setProfileError(null);
  }

  // Logout resmi
  async function logout() {
    localStorage.removeItem('demo_auth_user');
    setIsDemo(false);
    if (isConfigured) {
      try {
        await supabase.auth.signOut();
      } catch (e) {
        console.warn('Sign out error:', e);
      }
    }
    setUser(null);
    setProfile(null);
    setProfileError(null);
  }

  // Role resmi HANYA diambil dari profile.role yang sah ('admin' atau 'jamaah')
  const validRole = (profile?.role === 'admin' || profile?.role === 'jamaah') ? profile.role : null;

  const value = {
    user,
    profile,
    role: validRole,
    isAdmin: validRole === 'admin',
    isJamaah: validRole === 'jamaah',
    loading,
    profileError,
    isDemo,
    isDemoAllowed,
    login,
    register,
    logout,
    demoLogin,
    refreshProfile: () => user ? fetchUserProfile(user.id) : Promise.resolve({ profile: null }),
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
