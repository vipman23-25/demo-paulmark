import { Outlet, useNavigate } from 'react-router-dom';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AdminSidebar } from '@/components/AdminSidebar';
import { useReminders } from '@/hooks/useReminders';
import { Button } from '@/components/ui/button';
import { UserCheck, RefreshCw } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

const AdminLayout = () => {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  useReminders();

  const handleManagerLogin = () => {
    navigate('/employee');
  };
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <div className="print:hidden">
            <AdminSidebar />
        </div>
        <div className="flex-1 flex flex-col">
          <header className="h-14 flex items-center justify-between border-b bg-card px-4 print:hidden">
            <div className="flex items-center">
              <SidebarTrigger className="mr-4" />
              <h1 className="text-lg font-semibold text-foreground hidden sm:block">Personel Yönetim Sistemi</h1>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={async () => {
                try {
                  if ('serviceWorker' in navigator) {
                    const registrations = await navigator.serviceWorker.getRegistrations();
                    for (const reg of registrations) await reg.unregister();
                  }
                  const cacheKeys = await caches.keys();
                  for (const key of cacheKeys) await caches.delete(key);
                  const keysToRemove = [];
                  for (let i = 0; i < localStorage.length; i++) {
                    const k = localStorage.key(i);
                    if (k && !k.includes('sb-') && !k.includes('supabase.auth.token') && k !== 'mock_user_session') keysToRemove.push(k);
                  }
                  keysToRemove.forEach(k => localStorage.removeItem(k));
                  window.location.href = window.location.href.split('?')[0] + '?t=' + new Date().getTime();
                } catch(e) {
                  window.location.reload();
                }
              }} className="text-muted-foreground hover:text-foreground" title="Sayfa Yüklenmiyorsa Tıklayın">
                <RefreshCw className="w-4 h-4 mr-1" /> Sorun Gider
              </Button>
              <Button variant="outline" size="sm" onClick={handleManagerLogin} className="border-primary text-primary hover:bg-primary/10 font-semibold">
                <UserCheck className="w-4 h-4 mr-1 sm:mr-2" /> <span className="hidden sm:inline">Müdür Paneli</span>
              </Button>
            </div>
          </header>
          <main className="flex-1 p-6 print:p-0 print:m-0 overflow-auto print:overflow-visible">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default AdminLayout;
