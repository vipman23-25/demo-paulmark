import { Users, Clock, Calendar, Bell, Timer, LogOut, LayoutDashboard, Activity, Settings, Umbrella, Target, Package, Truck, CalendarRange, ClipboardList, BellRing } from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const menuItems = [
  { title: 'Kontrol Paneli', url: '/admin', icon: LayoutDashboard },
  { title: 'Personeller', url: '/admin/personnel', icon: Users },
  { title: 'Mola Takibi', url: '/admin/breaks', icon: Clock },
  { title: 'Mola Planlama', url: '/admin/break-planning', icon: Target },
  { title: 'Hareketler', url: '/admin/movements', icon: Activity },
  { title: 'İzin Günleri', url: '/admin/day-off', icon: Calendar },
  { title: 'Fazla Mesai', url: '/admin/overtime', icon: Timer },
  { title: 'Vardiya Yönetimi', url: '/admin/shifts', icon: CalendarRange },
  { title: 'Koli/Sevkiyat', url: '/admin/cargo', icon: Package },
  { title: 'Kargo Takip', url: '/admin/logistics', icon: Truck },
  { title: 'Duyurular', url: '/admin/reminders', icon: Bell },
  { title: 'Bildirim Ayarları', url: '/admin/notifications', icon: BellRing },
  { title: 'Satış Hedefleri', url: '/admin/sales-targets', icon: Target },
  { title: 'Sistem Ayarları', url: '/admin/settings', icon: Settings },
  { title: 'Sistem Logları', url: '/admin/system-logs', icon: ClipboardList },
];

export function AdminSidebar() {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const location = useLocation();
  const { signOut, user } = useAuth();
  const isActive = (path: string) => location.pathname === path;

  const [isPwdOpen, setIsPwdOpen] = useState(false);
  const [pwdForm, setPwdForm] = useState({ currentPass: '', newPass: '', confirmPass: '' });
  const [isUpdatingPwd, setIsUpdatingPwd] = useState(false);

  const handlePasswordChange = async () => {
    if (!pwdForm.currentPass || !pwdForm.newPass || !pwdForm.confirmPass) {
      toast.error('Lütfen tüm alanları doldurun');
      return;
    }
    if (pwdForm.newPass !== pwdForm.confirmPass) {
      toast.error('Yeni şifreler eşleşmiyor');
      return;
    }
    
    setIsUpdatingPwd(true);

    try {
      const { data: adminSettings, error } = await supabase
        .from('system_settings' as any)
        .select('*')
        .eq('setting_key', 'admin_credentials')
        .maybeSingle();

      const creds: any = (adminSettings as any)?.setting_value || { username: 'admin', password: 'admin' };
      
      if (pwdForm.currentPass !== creds.password) {
        toast.error('Mevcut şifre yanlış');
        setIsUpdatingPwd(false);
        return;
      }

      const newCreds = { ...creds, password: pwdForm.newPass };
      
      if (adminSettings) {
        await supabase.from('system_settings' as any).update({ setting_value: newCreds }).eq('id', (adminSettings as any).id);
      } else {
        await supabase.from('system_settings' as any).insert({ setting_key: 'admin_credentials', setting_value: newCreds });
      }

      toast.success('Şifreniz başarıyla değiştirildi');
      setIsPwdOpen(false);
      setPwdForm({ currentPass: '', newPass: '', confirmPass: '' });
    } catch (e: any) {
      toast.error('Şifre değiştirme hatası: ' + e.message);
    } finally {
      setIsUpdatingPwd(false);
    }
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="h-auto py-4 flex flex-col items-center justify-center gap-2">
            <img src="/logo.png" alt="Logo" className={`object-contain rounded-xl shadow-sm transition-all duration-200 ${collapsed ? 'w-8 h-8' : 'w-16 h-16'}`} />
            {!collapsed && <span className="text-sm font-semibold text-center mt-2">Admin Panel</span>}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === '/admin'}
                      className="hover:bg-sidebar-accent/50"
                      activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                    >
                      <item.icon className="mr-2 h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <Dialog open={isPwdOpen} onOpenChange={setIsPwdOpen}>
          <DialogTrigger asChild>
            <Button variant="ghost" className="w-full justify-start text-sidebar-foreground mb-1">
              <Settings className="mr-2 h-4 w-4" />
              {!collapsed && <span>Şifre Değiştir</span>}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Admin Şifre Değişimi</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="currentPass">Mevcut Şifre</Label>
                <Input id="currentPass" type="password" value={pwdForm.currentPass} onChange={e => setPwdForm({ ...pwdForm, currentPass: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="newPass">Yeni Şifre</Label>
                <Input id="newPass" type="password" value={pwdForm.newPass} onChange={e => setPwdForm({ ...pwdForm, newPass: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPass">Yeni Şifre (Tekrar)</Label>
                <Input id="confirmPass" type="password" value={pwdForm.confirmPass} onChange={e => setPwdForm({ ...pwdForm, confirmPass: e.target.value })} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsPwdOpen(false)}>İptal</Button>
              <Button onClick={handlePasswordChange} disabled={isUpdatingPwd}>Şifreyi Güncelle</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <Button variant="ghost" className="w-full justify-start text-sidebar-foreground" onClick={signOut}>
          <LogOut className="mr-2 h-4 w-4" />
          {!collapsed && <span>Çıkış Yap</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
