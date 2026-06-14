import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { toast } from 'sonner';
import { Users, Shield } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { logAction } from '@/utils/logger';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [searchParams] = useSearchParams();
  const [userType, setUserType] = useState<'personnel' | 'admin'>(searchParams.get('type') === 'manager' ? 'admin' : 'personnel');
  const navigate = useNavigate();
  const { setMockUser } = useAuth() as any;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    // Fallback timeout to rescue stuck Supabase locks
    const timeoutId = setTimeout(() => {
      setIsLoading(false);
      // Clear Supabase locks and tokens from localStorage
      Object.keys(localStorage).forEach(key => {
        if (key.includes('supabase.auth.lock') || key.startsWith('sb-') || key.includes('mock_user_session')) {
          localStorage.removeItem(key);
        }
      });
      toast.error('Giriş işlemi çok uzun sürdü. Oturum önbelleği temizlendi. Lütfen tekrar deneyin.', { duration: 5000 });
      setTimeout(() => window.location.reload(), 1500);
    }, 15000);

    try {
      if (userType === 'personnel') {
        const cleanUsername = username.trim();
        const cleanPassword = password.trim();
        
        let foundPersonnel = null;
        let fetchError = null;

        try {
          const result = await supabase
            .from('personnel')
            .select('*')
            .eq('tc_no', cleanUsername)
            .eq('is_active', true)
            .maybeSingle();
          foundPersonnel = result.data;
          fetchError = result.error;
        } catch (e: any) {
          fetchError = e;
        }

        // Auto-retry once for Supabase lock collision or throw
        if (fetchError && fetchError.message && (fetchError.message.includes('steal') || fetchError.message.includes('stole it') || fetchError.name === 'AbortError')) {
          console.log("Supabase lock error caught, retrying...");
          await new Promise(r => setTimeout(r, 1000)); // wait for lock to release
          
          try {
            const retry = await supabaseAnon.from('personnel').select('*').eq('tc_no', cleanUsername).eq('is_active', true).maybeSingle();
            foundPersonnel = retry.data;
            fetchError = retry.error;
          } catch (retryErr: any) {
            fetchError = retryErr;
          }
        }

        if (fetchError) {
          console.error("Supabase error during personnel login:", fetchError);
          if (fetchError.message?.includes('Lock') || fetchError.message?.includes('stole it')) {
            toast.error('Oturum kilidi yenileniyor, lütfen bekleyin...');
            setTimeout(() => window.location.reload(), 1000);
            return;
          }
          toast.error(`Sistem hatası: ${fetchError.message}`);
          setIsLoading(false);
          return;
        }

        if (foundPersonnel && cleanPassword === foundPersonnel.password_hash) {
          try { await supabase.auth.signOut(); } catch(e) {}
          const isManager = foundPersonnel.department?.toLowerCase().includes('müdür') || foundPersonnel.role === 'admin';
          setMockUser({ 
            isAdmin: isManager, 
            email: foundPersonnel.tc_no, 
            id: foundPersonnel.id,
            name: `${foundPersonnel.first_name} ${foundPersonnel.last_name}`
          });
          toast.success(`Hoş geldiniz ${foundPersonnel.first_name}!`);
          await logAction('SİSTEM_GİRİŞİ', 'Personel girişi yapıldı', foundPersonnel.id, `${foundPersonnel.first_name} ${foundPersonnel.last_name}`);
          
          try {
            const keys = await caches.keys();
            await Promise.all(keys.map(key => caches.delete(key)));
          } catch(e) {}
          window.location.href = '/';
        } else {
          toast.error('Kullanıcı adı veya şifre hatalı veya hesabınız pasif!');
        }
        setIsLoading(false);
        return;
      }

      const email = username.includes('@') ? username : `${username}@paulmark.com`;
      
      let authData, authError;
      
      const attemptLogin = async () => {
         return await supabase.auth.signInWithPassword({
            email: email,
            password: password,
         });
      };

      const res = await attemptLogin();
      authData = res.data;
      authError = res.error;

      if (authError && authError.message && (authError.message.includes('steal') || authError.message.includes('stole it') || authError.name === 'AbortError')) {
          console.log("Supabase lock error on admin login, retrying...");
          await new Promise(r => setTimeout(r, 1000));
          const retryRes = await attemptLogin();
          authData = retryRes.data;
          authError = retryRes.error;
      }

      if (authError) {
        throw authError;
      }

      if (authData?.session) {
        toast.success('Giriş başarılı!');
        await logAction('SİSTEM_GİRİŞİ', 'Müdür/Admin girişi yapıldı', authData.user?.id, email);
        try {
          const keys = await caches.keys();
          await Promise.all(keys.map(key => caches.delete(key)));
        } catch(e) {}
        window.location.href = '/';
      } else {
        toast.error('Giriş yapılamadı.');
      }
    } catch (error: any) {
      toast.error(error.message || 'Giriş sırasında hata oluştu');
    } finally {
      clearTimeout(timeoutId);
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!username) {
      toast.error('Lütfen önce "Kullanıcı Adı (Müdür)" alanına kayıtlı e-posta adresinizi veya kullanıcı adınızı girin.');
      return;
    }
    const email = username.includes('@') ? username : `${username}@paulmark.com`;
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin,
      });
      if (error) throw error;
      toast.success('Şifre sıfırlama bağlantısı gönderildi! Lütfen e-posta kutunuzu kontrol edin.', {
        duration: 5000,
      });
    } catch (error: any) {
      toast.error('Şifre sıfırlama hatası: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md animate-fade-in">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-24 h-24 mb-4">
            <img src="/logo.png" alt="Mağaza Takibi Logo" className="w-full h-full object-contain rounded-2xl shadow-sm" />
          </div>
          <h1 className="text-3xl font-bold text-foreground">
            {import.meta.env.VITE_APP_BRAND === 'demo' || import.meta.env.VITE_APP_BRAND === 'magazatakibi' ? 'MAĞAZA TAKİBİ' : 'PAULMARK MAĞAZA TAKİBİ'}
          </h1>
          <p className="text-muted-foreground mt-2 font-medium">Tasarlayan Turgay DOLU</p>
        </div>

        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-xl">Giriş Yap</CardTitle>
            <CardDescription>
              {userType === 'admin' ? 'Müdür/Admin girişi' : 'Personel girişi'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2 mb-6">
              <button
                type="button"
                onClick={() => setUserType('personnel')}
                className={`flex-1 py-2 px-4 rounded-lg font-medium transition ${userType === 'personnel'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                  }`}
              >
                <Users className="w-4 h-4 inline mr-2" />
                Personel
              </button>
              <button
                type="button"
                onClick={() => setUserType('admin')}
                className={`flex-1 py-2 px-4 rounded-lg font-medium transition ${userType === 'admin'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                  }`}
              >
                <Shield className="w-4 h-4 inline mr-2" />
                Müdür
              </button>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">{userType === 'admin' ? 'Kullanıcı Adı (Müdür)' : 'Kullanıcı Adı (TC No)'}</Label>
                <Input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder={userType === 'admin' ? 'admin' : 'Kullanıcı adınızı girin'}
                  required
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Şifre</Label>
                  {userType === 'admin' && (
                    <button type="button" onClick={handleForgotPassword} disabled={isLoading} className="text-xs font-semibold text-primary hover:underline focus:outline-none">
                      Şifremi Unuttum
                    </button>
                  )}
                </div>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={userType === 'admin' ? 'admin' : 'personel'}
                  required
                />
              </div>

              <div className="bg-secondary/50 p-3 rounded-lg text-sm">
                <p className="font-semibold mb-1">💡 Bilgi:</p>
                <p className="text-sm">Kullanıcı adı ve şifre ile giriş yapabilirsiniz.</p>
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                <Users className="w-4 h-4 mr-2" />
                {isLoading ? 'Yükleniyor...' : 'Giriş Yap'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Login;
