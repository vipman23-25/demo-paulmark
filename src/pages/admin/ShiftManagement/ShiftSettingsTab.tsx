import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Trash2, Eye, EyeOff } from 'lucide-react';
import { Switch } from '@/components/ui/switch';

const DAYS = ['', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];

const TaskConfigPanel = ({ title, desc, config, onUpdate, personnelList, depts, shiftCodes }: any) => {
    const c = config || { count: 0, gender: 'Tümü', departments: [], included_personnel: [], excluded_personnel: [], active_days: [1,2,3,4,5,6,7], valid_shifts: [] };
    const toggleArray = (arr: string[], val: string) => arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val];

    return (
        <div className="p-4 bg-muted/30 rounded-xl border flex flex-col gap-4 shadow-sm">
            <div>
               <p className="font-semibold text-foreground text-sm">{title}</p>
               <p className="text-xs text-muted-foreground mt-1">{desc}</p>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
               <div>
                  <Label className="text-xs mb-1.5 block font-medium">Günlük Çalışacak Kişi Sayısı</Label>
                  <Input type="number" min="0" value={c.count || 0} onChange={e => onUpdate({...c, count: parseInt(e.target.value) || 0})} className="h-8 bg-background" />
               </div>
               <div>
                  <Label className="text-xs mb-1.5 block font-medium">Cinsiyet Kuralı</Label>
                  <Select value={c.gender || 'Tümü'} onValueChange={v => onUpdate({...c, gender: v})}>
                     <SelectTrigger className="h-8 bg-background"><SelectValue /></SelectTrigger>
                     <SelectContent>
                        <SelectItem value="Tümü">Tümü</SelectItem>
                        <SelectItem value="Erkek">Sadece Erkek</SelectItem>
                        <SelectItem value="Kadın">Sadece Kadın</SelectItem>
                     </SelectContent>
                  </Select>
               </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                   <Label className="text-xs font-medium">Geçerli Günler (Seçilmezse Kapalı)</Label>
                   <div className="max-h-24 overflow-y-auto border rounded-md p-2 bg-background flex flex-col gap-1.5">
                      {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                          <label key={`day-${d}`} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-muted/50 p-1 rounded">
                              <input type="checkbox" checked={c.active_days?.includes(d)} onChange={() => onUpdate({...c, active_days: toggleArray(c.active_days || [], d as any)})} className="rounded text-indigo-600" />
                              {DAYS[d]}
                          </label>
                      ))}
                   </div>
                </div>
                <div className="space-y-1.5">
                   <Label className="text-xs font-medium">Geçerli Vardiyalar (Örn: S, A)</Label>
                   <div className="max-h-24 overflow-y-auto border rounded-md p-2 bg-background flex flex-col gap-1.5">
                      {shiftCodes?.map((sc: any) => sc.code && sc.code !== '-' && (
                          <label key={`sc-${sc.code}`} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-muted/50 p-1 rounded">
                              <input type="checkbox" checked={c.valid_shifts?.includes(sc.code)} onChange={() => onUpdate({...c, valid_shifts: toggleArray(c.valid_shifts || [], sc.code)})} className="rounded text-indigo-600" />
                              {sc.code} - {sc.label}
                          </label>
                      ))}
                   </div>
                </div>
            </div>

            <div className="space-y-1.5">
               <Label className="text-xs font-medium">Geçerli Reyonlar (Boşsa Tümü)</Label>
               <div className="max-h-24 overflow-y-auto border rounded-md p-2 bg-background flex flex-col gap-1.5">
                  {depts?.map((d: string) => (
                      <label key={d} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-muted/50 p-1 rounded">
                          <input type="checkbox" checked={c.departments?.includes(d)} onChange={() => onUpdate({...c, departments: toggleArray(c.departments || [], d)})} className="rounded text-indigo-600" />
                          {d}
                      </label>
                  ))}
               </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                   <Label className="text-xs text-green-700 font-bold flex items-center gap-1">Daima Ekle <span className="text-[10px] text-green-600/70 font-normal">(Öncelikli)</span></Label>
                   <div className="max-h-32 overflow-y-auto border rounded-md p-2 bg-background flex flex-col gap-1.5">
                      {personnelList?.map((p: any) => (
                          <label key={`inc-${p.id}`} className={`flex items-center gap-2 text-xs cursor-pointer hover:bg-muted/50 p-1 rounded ${c.excluded_personnel?.includes(p.id) ? 'opacity-50' : ''}`}>
                              <input type="checkbox" checked={c.included_personnel?.includes(p.id)} onChange={() => onUpdate({...c, included_personnel: toggleArray(c.included_personnel || [], p.id)})} disabled={c.excluded_personnel?.includes(p.id)} className="rounded text-green-600" />
                              {p.first_name} {p.last_name}
                          </label>
                      ))}
                   </div>
                </div>
                <div className="space-y-1.5">
                   <Label className="text-xs text-red-700 font-bold flex items-center gap-1">Asla Ekleme <span className="text-[10px] text-red-600/70 font-normal">(Yasaklı)</span></Label>
                   <div className="max-h-32 overflow-y-auto border rounded-md p-2 bg-background flex flex-col gap-1.5">
                      {personnelList?.map((p: any) => (
                          <label key={`exc-${p.id}`} className={`flex items-center gap-2 text-xs cursor-pointer hover:bg-muted/50 p-1 rounded ${c.included_personnel?.includes(p.id) ? 'opacity-50' : ''}`}>
                              <input type="checkbox" checked={c.excluded_personnel?.includes(p.id)} onChange={() => onUpdate({...c, excluded_personnel: toggleArray(c.excluded_personnel || [], p.id)})} disabled={c.included_personnel?.includes(p.id)} className="rounded text-red-600" />
                              {p.first_name} {p.last_name}
                          </label>
                      ))}
                   </div>
                </div>
            </div>
        </div>
    );
};

const DemandRulesCard = ({ engineConfig, updateEngineConfig, loadingConfig, personnelDepts }: any) => {
  const getSafeRules = (rules: any) => ({
    weekday: Array.from({ length: 12 }, (_, i) => rules?.weekday?.find((x: any) => x.total === i + 2) || { total: i + 2, s: 0, a: 0 }),
    weekend: Array.from({ length: 12 }, (_, i) => rules?.weekend?.find((x: any) => x.total === i + 2) || { total: i + 2, s: 0, a: 0 })
  });

  const [selectedDept, setSelectedDept] = useState("Genel (Varsayılan)");

  const [localRules, setLocalRules] = useState(() => {
      const target = selectedDept === "Genel (Varsayılan)" 
          ? (engineConfig?.department_demand_rules?.["Genel"] || engineConfig?.demand_rules)
          : engineConfig?.department_demand_rules?.[selectedDept];
      return getSafeRules(target);
  });

  useEffect(() => {
      const target = selectedDept === "Genel (Varsayılan)" 
          ? (engineConfig?.department_demand_rules?.["Genel"] || engineConfig?.demand_rules)
          : engineConfig?.department_demand_rules?.[selectedDept];
      setLocalRules(getSafeRules(target));
  }, [selectedDept, engineConfig?.department_demand_rules, engineConfig?.demand_rules]);

  const handleUpdate = (type: 'weekday' | 'weekend', index: number, field: 's' | 'a', value: string) => {
    const val = parseInt(value) || 0;
    const newRules = { ...localRules };
    newRules[type][index][field] = val;
    setLocalRules(newRules);
  };

  const handleSave = () => {
    const key = selectedDept === "Genel (Varsayılan)" ? "Genel" : selectedDept;
    const updatedDepRules = { ...(engineConfig?.department_demand_rules || {}) };
    updatedDepRules[key] = localRules;

    updateEngineConfig.mutate({ 
        ...engineConfig, 
        department_demand_rules: updatedDepRules,
        demand_rules: key === "Genel" ? localRules : engineConfig?.demand_rules 
    });
    toast.success(`${selectedDept} için matris kaydedildi.`);
  };

  const rawDepts = personnelDepts || [];
  const groupDepts = (engineConfig?.department_groups || []).map((g: any) => g.groupName);
  const legacyDepts = ["Kadın & Çocuk Reyon"];
  const allOptions = ["Genel (Varsayılan)", ...Array.from(new Set([...rawDepts, ...groupDepts, ...legacyDepts]))];

  return (
    <Card className="md:col-span-2 border-indigo-100 dark:border-indigo-900/30">
      <CardHeader className="bg-indigo-50/50 dark:bg-indigo-900/10 rounded-t-lg pb-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
                <CardTitle className="text-indigo-900 dark:text-indigo-300">Vardiya Dağılım Matrisi</CardTitle>
                <CardDescription>
                  Seçili reyon için Toplam Aktif Kişi Sayısına göre hedeflenen Sabah/Akşam kişi sayılarını belirleyin.
                </CardDescription>
            </div>
            <div className="w-full md:w-72">
                <Label className="text-xs mb-1.5 block font-medium">Uygulanacak Reyon / Grup</Label>
                <Select value={selectedDept} onValueChange={setSelectedDept}>
                   <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
                   <SelectContent>
                      {allOptions.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
                   </SelectContent>
                </Select>
            </div>
        </div>
      </CardHeader>
      <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-2 gap-8">
        <div>
           <h3 className="font-semibold text-sm mb-3 flex items-center justify-between">
              Hafta İçi (Pzt-Cum)
           </h3>
           <Table className="border rounded-md">
             <TableHeader className="bg-muted/50">
               <TableRow>
                 <TableHead className="w-16">Aktif Kişi</TableHead>
                 <TableHead>Sabah (S)</TableHead>
                 <TableHead>Akşam (A)</TableHead>
               </TableRow>
             </TableHeader>
             <TableBody>
               {localRules.weekday.map((r: any, idx: number) => (
                 <TableRow key={`wd-${r.total}`}>
                   <TableCell className="font-bold text-center">{r.total}</TableCell>
                   <TableCell><Input type="number" min="0" value={r.s || ''} onChange={e => handleUpdate('weekday', idx, 's', e.target.value)} className="h-8" /></TableCell>
                   <TableCell><Input type="number" min="0" value={r.a || ''} onChange={e => handleUpdate('weekday', idx, 'a', e.target.value)} className="h-8" /></TableCell>
                 </TableRow>
               ))}
             </TableBody>
           </Table>
        </div>

        <div>
           <h3 className="font-semibold text-sm mb-3 flex items-center justify-between">
              Hafta Sonu (Cts-Paz)
           </h3>
           <Table className="border rounded-md">
             <TableHeader className="bg-muted/50">
               <TableRow>
                 <TableHead className="w-16">Aktif Kişi</TableHead>
                 <TableHead>Sabah (S)</TableHead>
                 <TableHead>Akşam (A)</TableHead>
               </TableRow>
             </TableHeader>
             <TableBody>
               {localRules.weekend.map((r: any, idx: number) => (
                 <TableRow key={`we-${r.total}`}>
                   <TableCell className="font-bold text-center">{r.total}</TableCell>
                   <TableCell><Input type="number" min="0" value={r.s || ''} onChange={e => handleUpdate('weekend', idx, 's', e.target.value)} className="h-8" /></TableCell>
                   <TableCell><Input type="number" min="0" value={r.a || ''} onChange={e => handleUpdate('weekend', idx, 'a', e.target.value)} className="h-8" /></TableCell>
                 </TableRow>
               ))}
             </TableBody>
           </Table>
           
           <div className="mt-6 flex justify-end">
             <Button onClick={handleSave} disabled={updateEngineConfig.isPending || loadingConfig} className="bg-indigo-600 hover:bg-indigo-700 text-white w-full">
                Matrisi Kaydet
             </Button>
           </div>
           
           <p className="text-xs text-muted-foreground mt-4 leading-relaxed">
             * Bu ayarlar tüm reyonlar için varsayılan kural setidir.<br/>
             * Motor tabloyu çizerken reyondaki mevcut personel sayısına (örneğin 3 kişi ise) bakar ve o sayıya denk gelen satırdaki hedefleri kullanır.
           </p>
        </div>
      </CardContent>
    </Card>
  );
};

const ShiftSettingsTab = () => {
  const queryClient = useQueryClient();
  const [genderForm, setGenderForm] = useState({ gender: '', day_of_week: '', warning_message: '' });
  const [depForm, setDepForm] = useState({ personnel_id: '', target_department: '', trigger_absence_count: '1', trigger_shift_type: 'S', action_shift_type: 'A' });
  const [groupForm, setGroupForm] = useState<{ groupName: string, departments: string[], personnels: string[], isDynamic?: boolean, backupPersonnels?: string[], triggerCodes?: string[] }>({ groupName: '', departments: [], personnels: [], isDynamic: false, backupPersonnels: [], triggerCodes: [] });




  const { data: shiftCodes, isLoading: loadingCodes } = useQuery({
    queryKey: ['system_settings_shift_codes'],
    queryFn: async () => {
      const { data: generalData, error: generalError } = await supabase.from('system_settings' as any).select('setting_value').eq('setting_key', 'general').maybeSingle();
      if (generalError) throw generalError;
      return generalData?.setting_value?.movementTypes || [];
    }
  });

  const { data: engineConfig, isLoading: loadingConfig } = useQuery({
    queryKey: ['shift_engine_config'],
    queryFn: async () => {
      const { data, error } = await supabase.from('system_settings' as any).select('setting_value').eq('setting_key', 'shift_engine_config').maybeSingle();
      if (error) throw error;
      return data?.setting_value || { blockMultipleAbsence: true };
    }
  });

  const updateEngineConfig = useMutation({
    mutationFn: async (newConfig: any) => {
      const { error } = await supabase.from('system_settings' as any).upsert({
        setting_key: 'shift_engine_config',
        setting_value: newConfig
      }, { onConflict: 'setting_key' });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shift_engine_config'] });
      toast.success('Motor ayarları güncellendi');
    }
  });



  const { data: genderRules, isLoading: loadingGender } = useQuery({
    queryKey: ['shift_gender_rules'],
    queryFn: async () => {
      const { data, error } = await supabase.from('shift_gender_rules').select('*').order('day_of_week');
      if (error) throw error;
      return data;
    }
  });

  const { data: deptRules, isLoading: loadingDept } = useQuery({
    queryKey: ['department_shift_rules'],
    queryFn: async () => {
      const { data, error } = await supabase.from('department_shift_rules').select('*');
      if (error) throw error;
      return data;
    }
  });

  const { data: personnelDepts } = useQuery({
    queryKey: ['distinct_departments'],
    queryFn: async () => {
      const { data, error } = await supabase.from('personnel').select('department');
      if (error) throw error;
      const unq = Array.from(new Set(data.map(d => d.department))).filter(Boolean);
      return unq;
    }
  });

  const { data: personnelList } = useQuery({
    queryKey: ['active_personnel_list'],
    queryFn: async () => {
      const { data, error } = await supabase.from('personnel').select('id, first_name, last_name, department').eq('is_active', true).order('first_name');
      if (error) throw error;
      return data;
    }
  });

  const { data: dependencyRules } = useQuery({
    queryKey: ['shift_dependency_rules'],
    queryFn: async () => {
      const { data, error } = await supabase.from('shift_dependency_rules').select(`
        *,
        personnel:personnel_id(first_name, last_name)
      `).order('created_at', { ascending: false });
      // Hata fırlatmadan boş dönelim ki tablo yoksa crash olmasın
      if (error) return [];
      return data;
    }
  });

  const addGenderRule = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('shift_gender_rules').insert({
        gender: genderForm.gender,
        day_of_week: parseInt(genderForm.day_of_week),
        warning_message: genderForm.warning_message
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shift_gender_rules'] });
      setGenderForm({ gender: '', day_of_week: '', warning_message: '' });
      toast.success('Kural eklendi');
    }
  });

  const deleteGenderRule = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('shift_gender_rules').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shift_gender_rules'] });
      toast.success('Kural silindi');
    }
  });

  const addDependencyRule = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('shift_dependency_rules').insert({
        personnel_id: depForm.personnel_id,
        target_department: depForm.target_department,
        trigger_absence_count: parseInt(depForm.trigger_absence_count),
        trigger_shift_type: depForm.trigger_shift_type,
        action_shift_type: depForm.action_shift_type
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shift_dependency_rules'] });
      setDepForm({ personnel_id: '', target_department: '', trigger_absence_count: '1', trigger_shift_type: 'S', action_shift_type: 'A' });
      toast.success('Destek kuralı eklendi');
    }
  });

  const deleteDependencyRule = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('shift_dependency_rules').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shift_dependency_rules'] });
      toast.success('Destek kuralı silindi');
    }
  });

  const upsertDeptRule = useMutation({
    mutationFn: async ({ dept, mCount, eCount }: { dept: string, mCount: string, eCount: string }) => {
      // Basic upsert fallback logic if constraints fail
      const { data: existing } = await supabase.from('department_shift_rules').select('*').eq('department_name', dept).single();
      let error;
      if (existing) {
         const res = await supabase.from('department_shift_rules').update({ override_morning_count: mCount ? parseInt(mCount) : null, override_evening_count: eCount ? parseInt(eCount) : null }).eq('id', existing.id);
         error = res.error;
      } else {
         const res = await supabase.from('department_shift_rules').insert({ department_name: dept, override_morning_count: mCount ? parseInt(mCount) : null, override_evening_count: eCount ? parseInt(eCount) : null });
         error = res.error;
      }
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['department_shift_rules'] });
      toast.success('Reyon kuralı güncellendi');
    }
  });

  const handleAddGenderRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!genderForm.gender || !genderForm.day_of_week) return toast.error('Cinsiyet ve gün seçiniz');
    addGenderRule.mutate();
  };

  const handleAddDeptGroup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupForm.groupName || (groupForm.departments.length === 0 && groupForm.personnels.length === 0 && (!groupForm.isDynamic || (groupForm.backupPersonnels || []).length === 0))) return toast.error('Lütfen grup adı ve en az bir reyon veya personel seçiniz');
    
    const currentGroups = engineConfig?.department_groups || [];
    if (currentGroups.some((g: any) => g.groupName === groupForm.groupName)) return toast.error('Bu isimde bir grup zaten var');
    
    updateEngineConfig.mutate({ 
       ...engineConfig, 
       department_groups: [...currentGroups, groupForm] 
    });
    setGroupForm({ groupName: '', departments: [], personnels: [], isDynamic: false, backupPersonnels: [], triggerCodes: [] });
  };

  const handleDeleteDeptGroup = (groupName: string) => {
    const currentGroups = engineConfig?.department_groups || [];
    updateEngineConfig.mutate({
       ...engineConfig,
       department_groups: currentGroups.filter((g: any) => g.groupName !== groupName)
    });
  };



  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle>Vardiya Motoru Kuralları</CardTitle>
          <CardDescription>Otomatik dağıtım esnasında çalışacak zorunlu kuralları açıp kapatabilirsiniz.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg border">
              <div>
                <p className="font-medium text-foreground">Aynı Reyonda Birden Fazla İzin/Rapor Engellemesi</p>
                <p className="text-xs text-muted-foreground mt-0.5">Aynı gün içerisinde bir reyonda birden fazla personel devamsız ise motor hata vererek tabloyu oluşturmayı durdurur.</p>
              </div>
              <Switch 
                checked={engineConfig?.blockMultipleAbsence ?? true}
                onCheckedChange={(v) => updateEngineConfig.mutate({ ...engineConfig, blockMultipleAbsence: v })}
                disabled={updateEngineConfig.isPending || loadingConfig}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-2 p-4 bg-muted/30 rounded-lg border">
                <div>
                  <p className="font-medium text-foreground">Şube Adı (Vardiya Tablosu Başlığı)</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Vardiya tablosunun en üstünde ve çıktıda görünecek olan mağaza/şube adı (Örn: ERZURUM FORUM).</p>
                </div>
                <Input 
                  className="bg-white mt-1"
                  placeholder="Örn: ERZURUM FORUM"
                  defaultValue={engineConfig?.branchName || 'ERZURUM FORUM'}
                  onBlur={(e) => {
                     const val = e.target.value.toUpperCase();
                     if (val !== (engineConfig?.branchName || 'ERZURUM FORUM')) {
                         updateEngineConfig.mutate({ ...engineConfig, branchName: val });
                     }
                  }}
                />
              </div>

              <div className="flex flex-col gap-4 p-4 bg-pink-50/50 rounded-lg border border-pink-100">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-pink-900">Bayram / Özel Dönem Modu</p>
                    <p className="text-xs text-pink-700/80 mt-0.5">Açık olduğunda Bayram Part-Time personeline özel vardiya saatleri uygulanır.</p>
                  </div>
                  <Switch 
                    checked={engineConfig?.isHolidayModeActive ?? false}
                    onCheckedChange={(v) => updateEngineConfig.mutate({ ...engineConfig, isHolidayModeActive: v })}
                    disabled={updateEngineConfig.isPending || loadingConfig}
                  />
                </div>
                {engineConfig?.isHolidayModeActive && (
                  <div className="flex gap-2 items-center">
                    <div className="flex-1">
                      <Label className="text-xs text-pink-800">Başlangıç Tarihi</Label>
                      <Input 
                        type="date"
                        className="bg-white h-8 text-xs mt-1"
                        value={engineConfig?.holidayStartDate || ''}
                        onChange={(e) => updateEngineConfig.mutate({ ...engineConfig, holidayStartDate: e.target.value })}
                      />
                    </div>
                    <div className="flex-1">
                      <Label className="text-xs text-pink-800">Bitiş Tarihi</Label>
                      <Input 
                        type="date"
                        className="bg-white h-8 text-xs mt-1"
                        value={engineConfig?.holidayEndDate || ''}
                        onChange={(e) => updateEngineConfig.mutate({ ...engineConfig, holidayEndDate: e.target.value })}
                      />
                    </div>
                  </div>
                )}
                
                <div className="flex flex-col gap-2 mt-2 pt-3 border-t border-pink-200">
                   <p className="text-sm font-medium text-pink-900">Çoğunlukta Uygulanacak Çalışma Saatleri (Tüm Personel)</p>
                   <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs text-pink-800">Normal Dönem Saati</Label>
                        <Input 
                          placeholder="Örn: 13:30/22:00"
                          className="bg-white h-8 text-xs mt-1"
                          defaultValue={engineConfig?.holidayNormalHours || '13:30/22:00'}
                          onBlur={(e) => {
                             if (e.target.value !== (engineConfig?.holidayNormalHours || '13:30/22:00')) {
                                 updateEngineConfig.mutate({ ...engineConfig, holidayNormalHours: e.target.value });
                             }
                          }}
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-pink-800">Bayram Dönemi Saati</Label>
                        <Input 
                          placeholder="Örn: 14:30/23:00"
                          className="bg-white h-8 text-xs mt-1"
                          defaultValue={engineConfig?.holidaySpecialHours || '14:30/23:00'}
                          onBlur={(e) => {
                             if (e.target.value !== (engineConfig?.holidaySpecialHours || '14:30/23:00')) {
                                 updateEngineConfig.mutate({ ...engineConfig, holidaySpecialHours: e.target.value });
                             }
                          }}
                        />
                      </div>
                   </div>
                   <p className="text-[10px] text-pink-600 leading-tight">Bu saatler kotalı dağıtım ("Saatleri Dağıt" butonu) yapıldığında <b>tüm personelin büyük çoğunluğuna (en yüksek kota)</b> atanır. Bayram dönemi içindeki tarihlerde Bayram Saati, dışındaki tarihlerde Normal Saat geçerli olur. (Bayram Part Time sözleşmelilere ise bu saatler kotalardan bağımsız olarak %100 atanır).</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <TaskConfigPanel 
                  title="Depo Görevi Atama Kuralları" 
                  desc="Akşam (A) vardiyasındakilerden otomatik olarak depo görevi atanacak kişileri belirleyin."
                  config={engineConfig?.depo_config}
                  onUpdate={(newCfg: any) => updateEngineConfig.mutate({ ...engineConfig, depo_config: newCfg })}
                  personnelList={personnelList}
                  depts={personnelDepts}
                  shiftCodes={shiftCodes}
              />
              <TaskConfigPanel 
                  title="Mutfak Görevi Atama Kuralları" 
                  desc="Sabah (S) vardiyasındakilerden otomatik olarak mutfak görevi atanacak kişileri belirleyin."
                  config={engineConfig?.mutfak_config}
                  onUpdate={(newCfg: any) => updateEngineConfig.mutate({ ...engineConfig, mutfak_config: newCfg })}
                  personnelList={personnelList}
                  depts={personnelDepts}
                  shiftCodes={shiftCodes}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle>Reyon Gruplama Ayarları</CardTitle>
          <CardDescription>Hangi reyonların vardiyalarının "tek bir reyonmuş gibi" birlikte dağıtılacağını belirleyin.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-row items-center justify-between rounded-lg border p-4 bg-muted/20">
            <div className="space-y-0.5">
              <Label className="text-base font-semibold">Grup Üyelerini Tabloda Birleştir</Label>
              <p className="text-xs text-muted-foreground mt-0.5">Açık olduğunda, aynı gruba dahil edilen reyonlar ve personeller vardiya tablosunda tek bir başlık altında listelenir. Kapalı olduğunda, herkes kendi orijinal reyonunda listelenir ancak vardiya planlaması ve alt toplamlar yine gruba göre hesaplanır.</p>
            </div>
            <Switch 
              checked={engineConfig?.mergeDepartmentsInTable ?? false}
              onCheckedChange={(v) => updateEngineConfig.mutate({ ...engineConfig, mergeDepartmentsInTable: v })}
              disabled={updateEngineConfig.isPending || loadingConfig}
            />
          </div>

          <form onSubmit={handleAddDeptGroup} className="grid grid-cols-1 md:grid-cols-3 gap-4 border p-4 rounded-lg bg-orange-50/50 dark:bg-orange-900/10 border-orange-100 dark:border-orange-800/30">
            <div className="space-y-2">
              <Label>Grup Adı</Label>
              <Input placeholder="Örn: Kadın & Çocuk Reyon" value={groupForm.groupName} onChange={e => setGroupForm({...groupForm, groupName: e.target.value})} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Gruba Dahil Edilecek Reyonlar</Label>
              <div className="max-h-24 overflow-y-auto border bg-background rounded p-2 flex flex-wrap gap-2">
                {personnelDepts?.map((d: any) => (
                  <label key={`grp-${d}`} className="flex items-center gap-1.5 text-xs bg-muted/50 px-2 py-1 rounded cursor-pointer hover:bg-muted">
                    <input 
                      type="checkbox" 
                      className="rounded"
                      checked={groupForm.departments.includes(d)} 
                      onChange={(e) => {
                        if (e.target.checked) setGroupForm(prev => ({...prev, departments: [...prev.departments, d]}));
                        else setGroupForm(prev => ({...prev, departments: prev.departments.filter(x => x !== d)}));
                      }} 
                    />
                    {d}
                  </label>
                ))}
              </div>
            </div>
            <div className="space-y-2 md:col-span-3">
              <Label>Gruba Özel Dahil Edilecek Personeller (Asıl Personeller)</Label>
              <div className="max-h-32 overflow-y-auto border bg-background rounded p-2 flex flex-wrap gap-2">
                {personnelList?.map((p: any) => (
                  <label key={`grp-p-${p.id}`} className="flex items-center gap-1.5 text-xs bg-indigo-50/50 px-2 py-1 rounded cursor-pointer hover:bg-indigo-50">
                    <input 
                      type="checkbox" 
                      className="rounded text-indigo-600"
                      checked={groupForm.personnels?.includes(p.id)} 
                      onChange={(e) => {
                        if (e.target.checked) setGroupForm(prev => ({...prev, personnels: [...(prev.personnels || []), p.id]}));
                        else setGroupForm(prev => ({...prev, personnels: (prev.personnels || []).filter(x => x !== p.id)}));
                      }} 
                    />
                    {p.first_name} {p.last_name} <span className="text-[10px] text-muted-foreground ml-1">({p.department})</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-2 md:col-span-3 flex items-center gap-2 mt-2">
              <input 
                type="checkbox" 
                id="isDynamicGroup"
                className="rounded text-orange-600"
                checked={groupForm.isDynamic || false}
                onChange={(e) => setGroupForm(prev => ({...prev, isDynamic: e.target.checked}))}
              />
              <Label htmlFor="isDynamicGroup" className="cursor-pointer text-orange-800">Dinamik Yedekleme Aktif Mi? (Sadece asıl personeller izinliyken yedekleri gruba dahil et)</Label>
            </div>

            {groupForm.isDynamic && (
              <>
                <div className="space-y-2 md:col-span-3 border-l-2 border-orange-300 pl-4">
                  <Label>Tetikleyici İzin/Rapor Durumları</Label>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {shiftCodes?.map((sc: any) => sc.code && sc.code !== '-' && (
                      <label key={`trigger-${sc.code}`} className="flex items-center gap-1 text-xs bg-orange-100 px-2 py-1 rounded cursor-pointer">
                        <input 
                          type="checkbox" 
                          className="rounded text-orange-600"
                          checked={groupForm.triggerCodes?.includes(sc.code)} 
                          onChange={(e) => {
                            if (e.target.checked) setGroupForm(prev => ({...prev, triggerCodes: [...(prev.triggerCodes || []), sc.code]}));
                            else setGroupForm(prev => ({...prev, triggerCodes: (prev.triggerCodes || []).filter(x => x !== sc.code)}));
                          }} 
                        />
                        <span className="font-bold">{sc.code}</span> - {sc.label}
                      </label>
                    ))}
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">Seçili durumlardan birine sahip asıl personel varsa, yedek personeller o gün için bu gruba dahil edilir.</p>
                </div>
                
                <div className="space-y-2 md:col-span-3 border-l-2 border-orange-300 pl-4">
                  <Label>Yedek Personeller (Tetikleyici durum gerçekleştiğinde gruba girecekler)</Label>
                  <div className="max-h-32 overflow-y-auto border bg-background rounded p-2 flex flex-wrap gap-2">
                    {personnelList?.map((p: any) => (
                      <label key={`grp-b-${p.id}`} className="flex items-center gap-1.5 text-xs bg-orange-50 px-2 py-1 rounded cursor-pointer hover:bg-orange-100">
                        <input 
                          type="checkbox" 
                          className="rounded text-orange-600"
                          checked={groupForm.backupPersonnels?.includes(p.id)} 
                          onChange={(e) => {
                            if (e.target.checked) setGroupForm(prev => ({...prev, backupPersonnels: [...(prev.backupPersonnels || []), p.id]}));
                            else setGroupForm(prev => ({...prev, backupPersonnels: (prev.backupPersonnels || []).filter(x => x !== p.id)}));
                          }} 
                        />
                        {p.first_name} {p.last_name} <span className="text-[10px] text-muted-foreground ml-1">({p.department})</span>
                      </label>
                    ))}
                  </div>
                </div>
              </>
            )}

            <div className="md:col-span-3 flex justify-end">
              <Button type="submit" disabled={updateEngineConfig.isPending} className="bg-orange-600 hover:bg-orange-700 text-white">Grup Ekle</Button>
            </div>
          </form>

          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Grup Adı</TableHead>
                  <TableHead>Dahil Olan Reyonlar & Personeller</TableHead>
                  <TableHead className="w-[80px] text-right">İşlem</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {engineConfig?.department_groups?.map((g: any) => (
                  <TableRow key={g.groupName}>
                    <TableCell className="font-bold whitespace-nowrap">{g.groupName}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {g.departments?.map((d: string) => (
                          <span key={d} className="px-1.5 py-0.5 bg-orange-100 text-orange-800 text-[10px] rounded font-medium border border-orange-200">{d}</span>
                        ))}
                        {g.personnels?.map((pid: string) => {
                          const p = personnelList?.find((x: any) => x.id === pid);
                          if (!p) return null;
                          return (
                            <span key={pid} className="px-1.5 py-0.5 bg-indigo-100 text-indigo-800 text-[10px] rounded font-medium border border-indigo-200">+ {p.first_name} {p.last_name} (Asıl)</span>
                          );
                        })}
                        {g.isDynamic && g.backupPersonnels?.map((pid: string) => {
                          const p = personnelList?.find((x: any) => x.id === pid);
                          if (!p) return null;
                          return (
                            <span key={`b-${pid}`} className="px-1.5 py-0.5 bg-red-100 text-red-800 text-[10px] rounded font-medium border border-red-200">+ {p.first_name} {p.last_name} (Yedek)</span>
                          );
                        })}
                      </div>
                      {g.isDynamic && g.triggerCodes?.length > 0 && (
                        <div className="mt-1 text-[10px] text-muted-foreground flex items-center gap-1">
                          <span className="font-semibold text-orange-600">Tetikleyiciler:</span>
                          {g.triggerCodes.map((c: string) => (
                            <span key={c} className="bg-muted px-1 rounded border">{c}</span>
                          ))}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => handleDeleteDeptGroup(g.groupName)}><Trash2 className="w-4 h-4 text-red-500"/></Button>
                    </TableCell>
                  </TableRow>
                ))}
                {(!engineConfig?.department_groups || engineConfig.department_groups.length === 0) && (
                  <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-6">Kayıtlı reyon grubu yok. Tüm reyonlar kendi içinde ayrı değerlendirilecek.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>


      <Card>
        <CardHeader>
          <CardTitle>Cinsiyete Göre İzin Günü Kısıtlaması</CardTitle>
          <CardDescription>Belirli bir günde Erkek/Kadın personellerin izin kullanmasını engelleyebilirsiniz.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleAddGenderRule} className="grid grid-cols-1 sm:grid-cols-2 gap-4 border p-4 rounded-lg bg-muted/10">
            <div className="space-y-2">
              <Label>Cinsiyet</Label>
              <Select value={genderForm.gender} onValueChange={(v) => setGenderForm({...genderForm, gender: v})}>
                <SelectTrigger><SelectValue placeholder="Seçiniz"/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Erkek">Erkek</SelectItem>
                  <SelectItem value="Kadın">Kadın</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Yasaklı Gün</Label>
              <Select value={genderForm.day_of_week} onValueChange={(v) => setGenderForm({...genderForm, day_of_week: v})}>
                <SelectTrigger><SelectValue placeholder="Gün Seçiniz"/></SelectTrigger>
                <SelectContent>
                  {DAYS.map((d, i) => d ? <SelectItem key={i} value={i.toString()}>{d}</SelectItem> : null)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Uyarı Mesajı (Personele görünecek)</Label>
              <Input placeholder="Örn: Hafta sonları yalnızca kadın personeller..." value={genderForm.warning_message} onChange={e => setGenderForm({...genderForm, warning_message: e.target.value})} />
            </div>
            <div className="sm:col-span-2 flex justify-end">
              <Button type="submit" disabled={addGenderRule.isPending}>Kuralı Ekle</Button>
            </div>
          </form>

          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[120px]">Cinsiyet</TableHead>
                  <TableHead className="w-[150px]">Gün</TableHead>
                  <TableHead>Uyarı Mesajı</TableHead>
                  <TableHead className="w-[80px] text-right">İşlem</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {genderRules?.map((r: any) => (
                  <TableRow key={r.id}>
                    <TableCell className="whitespace-nowrap">{r.gender}</TableCell>
                    <TableCell className="whitespace-nowrap">{DAYS[r.day_of_week]}</TableCell>
                    <TableCell className="text-muted-foreground text-xs">{r.warning_message}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => deleteGenderRule.mutate(r.id)}><Trash2 className="w-4 h-4 text-red-500"/></Button>
                    </TableCell>
                  </TableRow>
                ))}
                {!genderRules?.length && (
                  <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">Kayıtlı kural yok.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle>Dinamik Personel Destek ve Eşleşme Kuralları</CardTitle>
          <CardDescription>Belirli bir personelin, başka bir reyondaki eksikliğe veya vardiya durumuna göre otomatik vardiya (S/A) almasını sağlayabilirsiniz.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={(e) => { e.preventDefault(); if (!depForm.personnel_id || !depForm.target_department) return toast.error('Lütfen personel ve reyon seçiniz'); addDependencyRule.mutate(); }} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4 border p-4 rounded-lg bg-indigo-50/50 dark:bg-indigo-900/10 border-indigo-100 dark:border-indigo-800/30">
            <div className="space-y-2">
              <Label>Destek Verecek Personel</Label>
              <Select value={depForm.personnel_id} onValueChange={(v) => setDepForm({...depForm, personnel_id: v})}>
                <SelectTrigger><SelectValue placeholder="Seçiniz"/></SelectTrigger>
                <SelectContent>
                  {personnelList?.map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>{p.first_name} {p.last_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Hedef Reyon</Label>
              <Select value={depForm.target_department} onValueChange={(v) => setDepForm({...depForm, target_department: v})}>
                <SelectTrigger><SelectValue placeholder="Seçiniz"/></SelectTrigger>
                <SelectContent>
                  {personnelDepts?.map((d: any) => (
                    <SelectItem key={d} value={d}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Kaç Kişi İzinliyse?</Label>
              <Input type="number" min="1" value={depForm.trigger_absence_count} onChange={e => setDepForm({...depForm, trigger_absence_count: e.target.value})} />
            </div>
            <div className="space-y-2">
              <Label>Kalanlar Hangi Vardiyadaysa?</Label>
              <Select value={depForm.trigger_shift_type} onValueChange={(v) => setDepForm({...depForm, trigger_shift_type: v})}>
                <SelectTrigger><SelectValue placeholder="Örn: S"/></SelectTrigger>
                <SelectContent>
                  {shiftCodes?.map((c: any) => (
                      <SelectItem key={c.code || '-'} value={c.code || '-'}>{c.code || 'Tümü'}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Destek Vardiyası (Geçeceği)</Label>
              <Select value={depForm.action_shift_type} onValueChange={(v) => setDepForm({...depForm, action_shift_type: v})}>
                <SelectTrigger><SelectValue placeholder="Örn: A"/></SelectTrigger>
                <SelectContent>
                  {shiftCodes?.map((c: any) => (
                      <SelectItem key={c.code || '-'} value={c.code || '-'}>{c.code || 'Tümü'}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-5 flex justify-end">
              <Button type="submit" disabled={addDependencyRule.isPending} className="bg-indigo-600 hover:bg-indigo-700 text-white">Destek Kuralı Ekle</Button>
            </div>
          </form>

          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[200px]">Destek Personeli</TableHead>
                  <TableHead className="w-[150px]">Hedef Reyon</TableHead>
                  <TableHead>Tetiklenme Şartı</TableHead>
                  <TableHead className="w-[150px]">Atanacak Vardiya</TableHead>
                  <TableHead className="w-[80px] text-right">İşlem</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dependencyRules?.map((r: any) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium whitespace-nowrap">{r.personnel?.first_name} {r.personnel?.last_name}</TableCell>
                    <TableCell className="whitespace-nowrap">{r.target_department}</TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      Hedefte en az {r.trigger_absence_count} kişi izinli/yok ve diğerleri {r.trigger_shift_type} vardiyasında ise
                    </TableCell>
                    <TableCell className="font-bold text-indigo-600 whitespace-nowrap">{r.action_shift_type}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => deleteDependencyRule.mutate(r.id)}><Trash2 className="w-4 h-4 text-red-500"/></Button>
                    </TableCell>
                  </TableRow>
                ))}
                {!dependencyRules?.length && (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Kayıtlı destek/eşleşme kuralı yok.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <DemandRulesCard engineConfig={engineConfig} updateEngineConfig={updateEngineConfig} loadingConfig={loadingConfig} personnelDepts={personnelDepts} />



      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle>Vardiya Hücre Seçenekleri</CardTitle>
          <CardDescription>
            Vardiya seçenekleri artık doğrudan <strong>Sistem Ayarları &gt; Personel Hareket Türleri</strong> menüsünden yönetilmektedir. <br/>
            Ekleme ve çıkarma işlemlerini oradan yapabilirsiniz. Aşağıda şu an aktif olan seçenekleri görebilirsiniz.
          </CardDescription>
        </CardHeader>
        <CardContent>
           <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {shiftCodes?.map((c: any) => (
                  <div key={c.code} className="flex items-center justify-between border rounded p-2 bg-primary/5 border-primary/20">
                      <div className="overflow-hidden">
                         <p className="font-bold text-sm truncate" title={c.code}>{c.code}</p>
                         <p className="text-xs text-muted-foreground truncate" title={c.label}>{c.label}</p>
                      </div>
                  </div>
              ))}
              {!shiftCodes?.length && (
                 <div className="col-span-full text-center text-muted-foreground py-4">Kayıtlı hareket türü bulunmuyor.</div>
              )}
           </div>
        </CardContent>
      </Card>
    </div>
  );
};

const RuleRow = ({ dept, rule, onSave }: any) => {
  const [mCount, setMCount] = useState(rule.override_morning_count || '');
  const [eCount, setECount] = useState(rule.override_evening_count || '');

  return (
    <TableRow>
      <TableCell className="font-semibold">{dept}</TableCell>
      <TableCell><Input type="number" min="0" placeholder="Oto" className="w-20" value={mCount} onChange={e => setMCount(e.target.value)} /></TableCell>
      <TableCell><Input type="number" min="0" placeholder="Oto" className="w-20" value={eCount} onChange={e => setECount(e.target.value)} /></TableCell>
      <TableCell className="text-right">
        <Button variant="outline" size="sm" onClick={() => onSave(mCount, eCount)}>Kaydet</Button>
      </TableCell>
    </TableRow>
  );
};

export default ShiftSettingsTab;
