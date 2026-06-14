import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { MatrixTab } from './MatrixTab';
import { SettingsTab } from './SettingsTab';

const DEFAULT_SETTINGS = {
  slots: [
    { id: '1', timeRange: '13:30 - 14:00' },
    { id: '2', timeRange: '15:00 - 15:30' },
    { id: '3', timeRange: '16:30 - 17:00' }
  ],
  departmentGroups: [
    { id: '1', name: 'Giriş Kat', criticalLimit: 2, includedDepartments: ['ERKEK', 'KADIN'] }
  ],
  rules: [
    { id: '1', slotId: '1', targetShifts: ['SABAH'], dayType: 'weekday' },
    { id: '2', slotId: '2', targetShifts: ['SABAH', 'AKŞAM'], dayType: 'weekday' },
    { id: '3', slotId: '3', targetShifts: ['AKŞAM'], dayType: 'weekday' }
  ]
};

export default function BreakPlanning() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('matrix');
  const [localSettings, setLocalSettings] = useState<any>(null);

  const { data: dbSettings, isLoading } = useQuery({
    queryKey: ['break_matrix_settings'],
    queryFn: async () => {
      const { data } = await supabase.from('system_settings' as any).select('*').eq('setting_key', 'break_matrix').maybeSingle();
      const st = data?.setting_value || DEFAULT_SETTINGS;
      setLocalSettings(st);
      return st;
    }
  });

  const saveMutation = useMutation({
    mutationFn: async (newSettings: any) => {
      const { data: existing } = await supabase.from('system_settings' as any).select('id').eq('setting_key', 'break_matrix').maybeSingle();
      if (existing) {
        await supabase.from('system_settings' as any).update({ setting_value: newSettings }).eq('id', existing.id);
      } else {
        await supabase.from('system_settings' as any).insert({ setting_key: 'break_matrix', setting_value: newSettings });
      }
    },
    onSuccess: () => {
      toast.success('Mola planlama ayarları kaydedildi');
      queryClient.invalidateQueries({ queryKey: ['break_matrix_settings'] });
    },
    onError: (err: any) => toast.error('Hata: ' + err.message)
  });

  if (isLoading || !localSettings) return <div className="p-8 text-center">Yükleniyor...</div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-foreground">Akıllı Mola Planlama</h2>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="matrix">Matris Görünümü</TabsTrigger>
          <TabsTrigger value="settings">Ayarlar ve Kurallar</TabsTrigger>
        </TabsList>
        <TabsContent value="matrix">
          <MatrixTab settings={localSettings} />
        </TabsContent>
        <TabsContent value="settings">
          <SettingsTab 
            settings={localSettings} 
            setSettings={setLocalSettings} 
            handleSave={() => saveMutation.mutate(localSettings)} 
            isSaving={saveMutation.isPending} 
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
