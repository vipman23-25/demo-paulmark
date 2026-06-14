import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface DemoRestrictions {
  max_personnel_count: number;
  disable_delete_operations: boolean;
  global_access_locked: boolean;
  blocked_ips: string[];
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isAdmin: boolean;
  isLoading: boolean;
  demoRestrictions: DemoRestrictions | null;
  signOut: () => Promise<void>;
  setMockUser: (userData: { isAdmin: boolean; email: string; id?: string; name?: string }) => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  isAdmin: false,
  isLoading: true,
  demoRestrictions: null,
  signOut: async () => {},
  setMockUser: () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [demoRestrictions, setDemoRestrictions] = useState<DemoRestrictions | null>(null);
  const [isIpBlocked, setIsIpBlocked] = useState(false);

  useEffect(() => {
    const fetchRestrictions = async () => {
      try {
        let ip = '';
        try {
          const res = await fetch('https://api.ipify.org?format=json');
          const data = await res.json();
          ip = data.ip;
        } catch(e) {
          console.error("IP fetch failed", e);
        }

        const { data } = await supabase.from('system_settings').select('setting_value').eq('setting_key', 'demo_restrictions').maybeSingle();
        if (data && data.setting_value) {
          const restr = data.setting_value as DemoRestrictions;
          setDemoRestrictions(restr);
          
          if (ip && restr.blocked_ips && restr.blocked_ips.includes(ip)) {
            setIsIpBlocked(true);
          }
        }
      } catch(e) {}
    };
    fetchRestrictions();
  }, []);

  const createMockUser = (email: string, isAdminRole: boolean, id?: string, name?: string) => {
    return {
      id: id || `mock-user-${Date.now()}`,
      email,
      aud: 'authenticated',
      role: 'authenticated',
      user_metadata: { display_name: name || (isAdminRole ? 'Admin' : 'Personel'), isAdmin: isAdminRole },
      app_metadata: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as unknown as User;
  };

  const checkRole = async (userId: string) => {
    const { data } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .eq('role', 'admin')
      .maybeSingle();
    setIsAdmin(!!data);
  };

  const validateUserExistence = async (userObj: User) => {
    // Legacy mock sessions without real personnel IDs are completely broken now.
    // Force them to log out and log in again to get their real personnel ID.
    if (userObj.id?.startsWith('mock-user-')) {
        console.error('Legacy mock session detected. Forcing logout.');
        localStorage.removeItem('mock_user_session');
        await supabase.auth.signOut();
        window.location.href = '/login';
        return false;
    }

    // Admins may not be in personnel table, skip check for them if they have admin role
    if (userObj.user_metadata?.display_name === 'Admin') return true;
    
    try {
      // Also check user_roles directly in case metadata is missing
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userObj.id)
        .eq('role', 'admin')
        .maybeSingle();
        
      if (roleData) return true;
      const { data, error } = await supabase
        .from('personnel')
        .select('id')
        .eq('id', userObj.id)
        .maybeSingle();

      // Sadece sorgu BAŞARILI olursa ve KAYIT YOKSA çıkış yaptır.
      // Eğer ağ hatası (error) varsa kullanıcının oturumunu KORU!
      if (!error && !data) {
        console.error('Personnel record definitely not found in DB. Forcing logout.');
        localStorage.removeItem('mock_user_session');
        await supabase.auth.signOut();
        window.location.href = '/login';
        return false;
      }
      return true;
    } catch (e) {
      console.error('Validation error:', e);
      return true; // fail safe
    }
  };

  useEffect(() => {
    // Fallback timeout to ensure isLoading never gets stuck
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 1500);

    // Rescue stuck Supabase locks
    const rescueTimer = setTimeout(() => {
      let cleared = false;
      try {
        Object.keys(localStorage).forEach(key => {
          if (key.includes('supabase.auth.lock')) {
            localStorage.removeItem(key);
            cleared = true;
          }
        });
      } catch(e) {}
      if (cleared) {
        console.warn("Stuck Supabase lock detected. Cleared locks and reloading...");
        window.location.reload();
      }
    }, 3000);

    let savedUserStr = null;
    try {
      savedUserStr = localStorage.getItem('mock_user_session');
    } catch(e) {}
    
    let hasMockSession = false;
    if (savedUserStr) {
      try {
        const parsedUser = JSON.parse(savedUserStr);
        setUser(parsedUser);
        setIsAdmin(parsedUser.user_metadata?.isAdmin === true || parsedUser.user_metadata?.display_name === 'Admin');
        hasMockSession = true;
        setIsLoading(false);
        
        // MOCK KULLANICI İÇİN SUPABASE AUTH KİLİTLERİNİ TEMİZLE!
        // Supabase gotrue-js kilitlenip diğer tüm sorguları askıda bırakmasın.
        try {
          Object.keys(localStorage).forEach(key => {
            if (key.includes('supabase.auth.lock') || (key.startsWith('sb-') && key.includes('auth-token'))) {
              localStorage.removeItem(key);
            }
          });
        } catch(e) {}
        
        validateUserExistence(parsedUser);
      } catch(e) {
        console.error('Invalid mock_user_session JSON, clearing it.', e);
        localStorage.removeItem('mock_user_session');
      }
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        try {
          if (localStorage.getItem('mock_user_session')) {
             setIsLoading(false);
             return;
          }
        } catch(e) {}
        
        if (session?.user) {
          setSession(session);
          setUser(session.user);
          await checkRole(session.user.id);
        } else {
          setIsAdmin(false);
          let hasMock = false;
          try { hasMock = !!localStorage.getItem('mock_user_session'); } catch(e) {}
          if (!hasMock) {
            setUser(null);
          }
        }
        setIsLoading(false);
      }
    );

    supabase.auth.getSession().then(async ({ data: { session }, error }) => {
      let hasMock = false;
      try { hasMock = !!localStorage.getItem('mock_user_session'); } catch(e) {}
      
      if (hasMock) {
        clearTimeout(rescueTimer);
        setIsLoading(false);
        return;
      }
      
      if (error) {
        clearTimeout(rescueTimer);
        setIsLoading(false);
        return;
      }

      if (session?.user) {
        setSession(session);
        setUser(session.user);
        try {
          await checkRole(session.user.id);
        } catch(e) {
          console.error('Role check failed', e);
        }
        // Only validate if not using mock session
        if (!hasMockSession) {
           validateUserExistence(session.user);
        }
      }
      clearTimeout(rescueTimer);
      setIsLoading(false);
    }).catch(err => {
      console.error('getSession error', err);
      clearTimeout(rescueTimer);
      setIsLoading(false);
    });

    return () => {
      subscription.unsubscribe();
      clearTimeout(timer);
      clearTimeout(rescueTimer);
    };
  }, []);

  const setMockUser = (userData: { isAdmin: boolean; email: string; id?: string; name?: string }) => {
    const mockUser = createMockUser(userData.email, userData.isAdmin, userData.id, userData.name);
    setUser(mockUser);
    localStorage.setItem('mock_user_session', JSON.stringify(mockUser));
    setSession(null);
    setIsAdmin(userData.isAdmin);
  };

  const signOut = async () => {
    localStorage.removeItem('mock_user_session');
    try {
      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 2000));
      await Promise.race([supabase.auth.signOut(), timeoutPromise]);
    } catch(e) {}
    
    // Tüm önbellekleri (caches, local/session storage) temizle
    try {
      Object.keys(localStorage).forEach(key => {
        if (key.includes('supabase.auth.lock') || key.startsWith('sb-') || key.includes('viewed_reminders')) {
          localStorage.removeItem(key);
        }
      });
      const keys = await caches.keys();
      await Promise.all(keys.map(key => caches.delete(key)));
      sessionStorage.clear();
    } catch(e) {}
    
    setUser(null);
    setSession(null);
    setIsAdmin(false);
    
    window.location.href = '/login';
  };

  if (isIpBlocked && user?.email !== 'turgaydolu23@gmail.com') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4 text-center">
        <h1 className="text-3xl font-bold text-red-500 mb-4">Erişim Engellendi</h1>
        <p className="text-muted-foreground mb-6">Bu cihazın veya ağın sisteme erişimi sistem yöneticisi tarafından engellenmiştir.</p>
      </div>
    );
  }

  if (demoRestrictions?.global_access_locked && user?.email !== 'turgaydolu23@gmail.com' && !isLoading && window.location.pathname !== '/login') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4 text-center">
        <h1 className="text-3xl font-bold text-orange-500 mb-4">Sistem Bakımda / Kapalı</h1>
        <p className="text-muted-foreground mb-6">Demo uygulaması şu an testlere kapatılmıştır. Lütfen daha sonra tekrar deneyin.</p>
        <button onClick={signOut} className="px-6 py-2 bg-primary text-primary-foreground rounded-md font-medium">
          Çıkış Yap
        </button>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, session, isAdmin, isLoading, demoRestrictions, signOut, setMockUser }}>
      {children}
    </AuthContext.Provider>
  );
};
