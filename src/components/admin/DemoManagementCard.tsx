import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ShieldAlert, Trash2, Shield, Users, Lock, Power } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export const DemoManagementCard = () => {
  const queryClient = useQueryClient();
  const [ipInput, setIpInput] = useState('');
  
  const { data: restrictions, isLoading } = useQuery({
    queryKey: ['demo_restrictions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('system_settings')
        .select('setting_value')
        .eq('setting_key', 'demo_restrictions')
        .maybeSingle();
      
      if (error) throw error;
      if (data?.setting_value) return data.setting_value;
      
      return {
        max_personnel_count: 50,
        disable_delete_operations: false,
        global_access_locked: false,
        blocked_ips: [] as string[]
      };
    }
  });

  const updateMutation = useMutation({
    mutationFn: async (newRestr: any) => {
      const { data, error } = await supabase
        .from('system_settings')
        .upsert({
          setting_key: 'demo_restrictions',
          setting_value: newRestr
        }, { onConflict: 'setting_key' });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['demo_restrictions'] });
      toast.success('Ayarlar başarıyla güncellendi');
    },
    onError: (err: any) => toast.error('Güncelleme hatası: ' + err.message)
  });

  const resetMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('reset_demo_data');
      if (error) throw error;
      return true;
    },
    onSuccess: () => toast.success('Demo sistemi tamamen sıfırlandı!'),
    onError: (err: any) => toast.error('Sıfırlama hatası: ' + err.message)
  });

  const handleToggle = (key: string, value: boolean) => {
    if (!restrictions) return;
    updateMutation.mutate({ ...restrictions, [key]: value });
  };

  const handleChangeLimit = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!restrictions) return;
    updateMutation.mutate({ ...restrictions, max_personnel_count: Number(e.target.value) });
  };

  const handleAddIp = () => {
    if (!restrictions || !ipInput.trim()) return;
    if (restrictions.blocked_ips?.includes(ipInput.trim())) return;
    updateMutation.mutate({
      ...restrictions,
      blocked_ips: [...(restrictions.blocked_ips || []), ipInput.trim()]
    });
    setIpInput('');
  };

  const handleRemoveIp = (ip: string) => {
    if (!restrictions) return;
    updateMutation.mutate({
      ...restrictions,
      blocked_ips: (restrictions.blocked_ips || []).filter((i: string) => i !== ip)
    });
  };

  const handleReset = () => {
    if (window.confirm("DİKKAT! Ayarlar ve şifreler hariç tüm sistem verisi SİLİNECEK! Onaylıyor musunuz?")) {
      resetMutation.mutate();
    }
  };

  if (isLoading) return <div className="animate-pulse p-4">Yükleniyor...</div>;

  return (
    <Card className="border-red-500/50 shadow-lg shadow-red-500/10">
      <CardHeader className="bg-red-500/5 border-b border-red-500/10">
        <CardTitle className="text-xl flex items-center gap-2 text-red-600">
          <ShieldAlert className="h-6 w-6" /> 
          Süper Admin: Demo & Güvenlik Yönetimi
        </CardTitle>
        <CardDescription>
          Bu panel sadece size görünmektedir. Uygulamanın kullanım kısıtlamalarını buradan yönetebilirsiniz.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 pt-6">
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded border">
              <div className="flex items-center gap-3">
                <Lock className="text-muted-foreground w-5 h-5" />
                <div>
                  <p className="font-medium text-sm">Demo Sistemini Kapat</p>
                  <p className="text-xs text-muted-foreground">Sizin dışınızda kimse giriş yapamaz.</p>
                </div>
              </div>
              <Switch 
                checked={restrictions?.global_access_locked || false}
                onCheckedChange={(v) => handleToggle('global_access_locked', v)}
                disabled={updateMutation.isPending}
              />
            </div>

            <div className="flex items-center justify-between p-3 bg-muted/50 rounded border">
              <div className="flex items-center gap-3">
                <Shield className="text-muted-foreground w-5 h-5" />
                <div>
                  <p className="font-medium text-sm">Silme İşlemlerini Yasakla</p>
                  <p className="text-xs text-muted-foreground">Kullanıcılar sistemden hiçbir şey silemez.</p>
                </div>
              </div>
              <Switch 
                checked={restrictions?.disable_delete_operations || false}
                onCheckedChange={(v) => handleToggle('disable_delete_operations', v)}
                disabled={updateMutation.isPending}
              />
            </div>
          </div>

          <div className="space-y-4">
            <div className="p-3 bg-muted/50 rounded border space-y-3">
              <div className="flex items-center gap-3 mb-2">
                <Users className="text-muted-foreground w-5 h-5" />
                <div>
                  <p className="font-medium text-sm">Maksimum Kişi Sayısı Sınırı</p>
                  <p className="text-xs text-muted-foreground">Sisteme eklenebilecek en fazla personel</p>
                </div>
              </div>
              <Input 
                type="number" 
                value={restrictions?.max_personnel_count || 50} 
                onChange={handleChangeLimit}
                disabled={updateMutation.isPending}
              />
            </div>
          </div>
        </div>

        <div className="p-4 border rounded-lg border-red-500/20 bg-red-500/5">
          <div className="flex items-center gap-2 mb-4">
            <Power className="text-red-500 w-5 h-5" />
            <h3 className="font-medium text-red-600">Sistemi Sıfırla (Reset)</h3>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Demo yapan kullanıcılar sistemi fazla kirlettiğinde tek tuşla tüm geçmişi, kayıtları ve personelleri temizleyebilirsiniz. (Şifreler ve Ayarlar bozulmaz).
          </p>
          <Button variant="destructive" onClick={handleReset} disabled={resetMutation.isPending}>
            <Trash2 className="w-4 h-4 mr-2" /> Tüm Verileri Temizle
          </Button>
        </div>

        <div className="p-4 border rounded-lg space-y-4">
          <h3 className="font-medium">Kara Liste (IP Engelleme)</h3>
          <div className="flex gap-2">
            <Input 
              placeholder="IP Adresi Girin (Örn: 192.168.1.1)" 
              value={ipInput}
              onChange={(e) => setIpInput(e.target.value)}
            />
            <Button onClick={handleAddIp}>Ekle</Button>
          </div>
          <div className="space-y-2">
            {(restrictions?.blocked_ips || []).map((ip: string) => (
              <div key={ip} className="flex justify-between items-center bg-muted/30 p-2 rounded">
                <span className="text-sm font-mono">{ip}</span>
                <Button variant="ghost" size="sm" onClick={() => handleRemoveIp(ip)} className="text-red-500 h-8">Sil</Button>
              </div>
            ))}
            {(!restrictions?.blocked_ips || restrictions.blocked_ips.length === 0) && (
              <p className="text-xs text-muted-foreground">Engellenen IP adresi yok.</p>
            )}
          </div>
        </div>

      </CardContent>
    </Card>
  );
};
