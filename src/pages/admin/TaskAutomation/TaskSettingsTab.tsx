import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';

const DAYS = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];

const TaskSettingsTab = () => {
  const queryClient = useQueryClient();
  const [activeModule, setActiveModule] = useState<'warehouse' | 'kitchen'>('warehouse');

  const { data: settings, isLoading: loadingSettings } = useQuery({
    queryKey: ['task_automation_settings', activeModule],
    queryFn: async () => {
      let { data, error } = await supabase.from('task_automation_settings' as any).select('*').eq('module_name', activeModule).maybeSingle();
      if (error) throw error;
      if (!data) {
        // Create default if not exists
        const defaultData = {
          module_name: activeModule,
          active_days: [1,2,3,4,5,6,7],
          max_capacity: activeModule === 'warehouse' ? 3 : 1,
          rules: {
            departments: [], // empty means all, or selected
            genders: [] // empty means all, or selected
          }
        };
        const { data: inserted, error: insertError } = await supabase.from('task_automation_settings' as any).insert([defaultData]).select().single();
        if (insertError) throw insertError;
        data = inserted;
      }
      return data;
    }
  });

  const { data: personnelList } = useQuery({
    queryKey: ['personnel'],
    queryFn: async () => {
      const { data, error } = await supabase.from('personnel').select('id, name, department, is_active, gender').eq('is_active', true);
      if (error) throw error;
      return data;
    }
  });

  const { data: balances } = useQuery({
    queryKey: ['task_personnel_balances', activeModule],
    queryFn: async () => {
      const { data, error } = await supabase.from('task_personnel_balances' as any).select('*').eq('module_name', activeModule);
      if (error) throw error;
      return data;
    }
  });

  const updateSettingsMutation = useMutation({
    mutationFn: async (newSettings: any) => {
      const { error } = await supabase.from('task_automation_settings' as any).update(newSettings).eq('id', settings.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task_automation_settings'] });
      toast.success('Ayarlar kaydedildi');
    }
  });

  const updateBalanceMutation = useMutation({
    mutationFn: async ({ personnel_id, balance_days }: { personnel_id: string, balance_days: number }) => {
      const existing = balances?.find((b: any) => b.personnel_id === personnel_id);
      if (existing) {
        const { error } = await supabase.from('task_personnel_balances' as any).update({ balance_days }).eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('task_personnel_balances' as any).insert([{ personnel_id, module_name: activeModule, balance_days }]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task_personnel_balances'] });
      toast.success('Bakiye güncellendi');
    }
  });

  const toggleDay = (dayIndex: number) => {
    if (!settings) return;
    const current = settings.active_days || [];
    const updated = current.includes(dayIndex) ? current.filter((d: number) => d !== dayIndex) : [...current, dayIndex];
    updateSettingsMutation.mutate({ active_days: updated });
  };

  const updateCapacity = (val: string) => {
    if (!settings) return;
    updateSettingsMutation.mutate({ max_capacity: parseInt(val) || 1 });
  };

  if (loadingSettings) return <div>Yükleniyor...</div>;

  return (
    <div className="space-y-6">
      <Tabs value={activeModule} onValueChange={(v: any) => setActiveModule(v)} className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-4">
          <TabsTrigger value="warehouse">Depo Ayarları</TabsTrigger>
          <TabsTrigger value="kitchen">Mutfak Ayarları</TabsTrigger>
        </TabsList>

        <Card>
          <CardHeader>
            <CardTitle>{activeModule === 'warehouse' ? 'Depo Çalışması' : 'Mutfak Temizlik'} - Genel Ayarlar</CardTitle>
            <CardDescription>Aktif günleri ve eşzamanlı kapasiteyi belirleyin.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <Label>Aktif Günler</Label>
              <div className="flex flex-wrap gap-4">
                {DAYS.map((d, i) => {
                  const dayNum = i + 1;
                  const isActive = settings?.active_days?.includes(dayNum);
                  return (
                    <div key={dayNum} className="flex items-center space-x-2">
                      <Switch id={`day-${dayNum}`} checked={isActive} onCheckedChange={() => toggleDay(dayNum)} />
                      <Label htmlFor={`day-${dayNum}`}>{d}</Label>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="space-y-3 max-w-xs">
              <Label>Maksimum Eşzamanlı Kapasite</Label>
              <Input type="number" min="1" value={settings?.max_capacity || 1} onChange={(e) => updateCapacity(e.target.value)} />
            </div>
            
            {activeModule === 'warehouse' && (
               <div className="bg-muted/50 p-4 rounded-md border text-sm text-muted-foreground mt-4">
                 <strong>Not:</strong> Depo algoritması kuralları sistemde tanımlıdır. (Çocuk: 1S iptal, 2-3 ise 1A ekle | Bayan: 4 ise 1-2A ekle | Erkek: 3A=1, 4A=2, 5A=3 atama)
               </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Personel Görev Bakiye (Adalet) Paneli</CardTitle>
            <CardDescription>
              Aylık devreden gün farklarını (+/-) buraya girerek algoritmanın sonraki atamalarda adalet sağlamasına yardımcı olabilirsiniz.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Personel</TableHead>
                  <TableHead>Reyon</TableHead>
                  <TableHead>Cinsiyet</TableHead>
                  <TableHead>Devreden Bakiye (Gün)</TableHead>
                  <TableHead className="text-right">İşlem</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {personnelList?.map((p: any) => {
                  const bal = balances?.find((b: any) => b.personnel_id === p.id)?.balance_days || 0;
                  return <BalanceRow key={p.id} personnel={p} currentBalance={bal} onSave={(val) => updateBalanceMutation.mutate({ personnel_id: p.id, balance_days: val })} />
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </Tabs>
    </div>
  );
};

const BalanceRow = ({ personnel, currentBalance, onSave }: any) => {
  const [val, setVal] = useState(currentBalance.toString());
  
  return (
    <TableRow>
      <TableCell className="font-medium">{personnel.name}</TableCell>
      <TableCell>{personnel.department}</TableCell>
      <TableCell>{personnel.gender || '-'}</TableCell>
      <TableCell>
        <Input type="number" value={val} onChange={e => setVal(e.target.value)} className="w-24" />
      </TableCell>
      <TableCell className="text-right">
        <Button variant="outline" size="sm" onClick={() => onSave(parseInt(val) || 0)}>Kaydet</Button>
      </TableCell>
    </TableRow>
  );
};

export default TaskSettingsTab;
