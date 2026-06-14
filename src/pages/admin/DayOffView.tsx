import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Calendar, Trash2, RefreshCw, Plus, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
const DAYS = ['', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];

const DayOffView = () => {
  const queryClient = useQueryClient();
  const [selectedWeeklyIds, setSelectedWeeklyIds] = useState<string[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState({ personnel_id: '', day_of_week: '', description: '', requested_shift: 'farketmez', admin_response: '', status: 'approved' });
  const [isPrefOpen, setIsPrefOpen] = useState(false);
  const [prefForm, setPrefForm] = useState({ id: '', personnel_id: '', day_of_week: '', requested_shift: 'sabah', description: '', admin_response: '', status: 'approved' });

  const { data: personnel = [], isLoading: pLoading } = useQuery({
    queryKey: ['active_personnel'],
    queryFn: async () => {
      const { data, error } = await supabase.from('personnel').select('*').eq('is_active', true);
      if (error) throw error;
      return data;
    }
  });

  const { data: weeklyDayOffs = [], isLoading: wLoading, refetch } = useQuery({
    queryKey: ['weekly_day_offs'],
    queryFn: async () => {
      const { data, error } = await supabase.from('weekly_day_off').select('*');
      if (error) throw error;
      return data;
    }
  });

  const { data: shiftPreferences = [], isLoading: spLoading } = useQuery({
    queryKey: ['shift_preferences'],
    queryFn: async () => {
      const { data, error } = await supabase.from('shift_preferences' as any).select('*');
      return data || [];
    }
  });

  const { data: shiftSwaps = [], isLoading: ssLoading } = useQuery({
    queryKey: ['shift_swaps'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shift_swap_requests' as any)
        .select('*, requester:requester_id(first_name, last_name, department), target:target_personnel_id(first_name, last_name)')
        .order('created_at', { ascending: false });
      return data || [];
    }
  });

  const { data: settingsData, refetch: refetchSettings } = useQuery({
    queryKey: ['system_settings_dayoff'],
    queryFn: async () => {
      const { data, error } = await supabase.from('system_settings' as any).select('id, setting_value').eq('setting_key', 'general').maybeSingle();
      if (error) throw error;
      return data;
    }
  });

  const updateSettingsMutation = useMutation({
    mutationFn: async (newVal: any) => {
      const currentVal = settingsData?.setting_value || {};
      const updated = { ...currentVal, ...newVal };
      if (settingsData?.id) {
         const { error } = await supabase.from('system_settings' as any).update({ setting_value: updated }).eq('id', settingsData.id);
         if (error) throw error;
      } else {
         const { error } = await supabase.from('system_settings' as any).insert({ setting_key: 'general', setting_value: updated });
         if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system_settings_dayoff'] });
      toast.success('Ayarlar güncellendi');
    }
  });

  const upsertMutation = useMutation({
    mutationFn: async ({ personnel_id, day_of_week, description, requested_shift, admin_response, status }: { personnel_id: string, day_of_week: number, description?: string, requested_shift?: string, admin_response?: string, status?: string }) => {
      await supabase.from('weekly_day_off').delete().eq('personnel_id', personnel_id);
      const payload: any = { personnel_id, day_of_week, description, requested_shift, admin_response, status };
      const { data, error } = await supabase.from('weekly_day_off').insert(payload).select();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['weekly_day_offs'] });
      queryClient.invalidateQueries({ queryKey: ['shift_engine_context'] });
      toast.success('Haftalık izin atandı/güncellendi!');
      setIsOpen(false);
      setForm({ personnel_id: '', day_of_week: '', description: '', requested_shift: 'farketmez', admin_response: '', status: 'approved' });
    },
    onError: (error: any) => toast.error('İşlem başarısız: ' + error.message)
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('weekly_day_off').delete().eq('id', id);
      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['weekly_day_offs'] });
      queryClient.invalidateQueries({ queryKey: ['shift_engine_context'] });
      toast.success('Haftalık izin silindi');
    },
    onError: (error: any) => toast.error('Silme başarısız: ' + error.message)
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from('weekly_day_off').delete().in('id', ids);
      if (error) throw error;
      return ids;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['weekly_day_offs'] });
      queryClient.invalidateQueries({ queryKey: ['shift_engine_context'] });
      toast.success(`${data.length} haftalık izin silindi`);
      setSelectedWeeklyIds([]);
    },
    onError: (error: any) => toast.error('Toplu silme başarısız: ' + error.message)
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status, admin_response }: { id: string, status: string, admin_response?: string }) => {
      const payload: any = { status, admin_response };
      const { error } = await supabase.from('weekly_day_off').update(payload).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['weekly_day_offs'] });
      queryClient.invalidateQueries({ queryKey: ['shift_engine_context'] });
      toast.success('İzin durumu güncellendi');
    }
  });

  const upsertPrefMutation = useMutation({
    mutationFn: async (payload: any) => {
      await supabase.from('shift_preferences' as any).delete().eq('personnel_id', payload.personnel_id);
      const { data, error } = await supabase.from('shift_preferences' as any).insert({
        personnel_id: payload.personnel_id,
        day_of_week: Number(payload.day_of_week),
        requested_shift: payload.requested_shift,
        description: payload.description,
        admin_response: payload.admin_response,
        status: payload.status
      }).select();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shift_preferences'] });
      toast.success('Vardiya tercihi atandı/güncellendi!');
      setIsPrefOpen(false);
    },
    onError: (error: any) => toast.error('İşlem başarısız: ' + error.message)
  });

  const deletePrefMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('shift_preferences' as any).delete().eq('id', id);
      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shift_preferences'] });
      toast.success('Vardiya tercihi silindi');
    },
    onError: (error: any) => toast.error('Silme başarısız: ' + error.message)
  });

  const updatePreferenceStatusMutation = useMutation({
    mutationFn: async ({ id, status, admin_response }: { id: string, status: string, admin_response?: string }) => {
      const payload: any = { status, admin_response };
      const { error } = await supabase.from('shift_preferences' as any).update(payload).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shift_preferences'] });
      queryClient.invalidateQueries({ queryKey: ['shift_engine_context'] });
      toast.success('Vardiya tercihi durumu güncellendi');
    }
  });

  const updateShiftSwapStatusMutation = useMutation({
    mutationFn: async ({ id, status, reqId, targetId, date, reqShift, targetShift }: any) => {
      const { error } = await supabase.from('shift_swap_requests').update({ status }).eq('id', id);
      if (error) throw error;
      if (status === 'approved' && reqId) {
        // Here you would implement logic to trigger swap record update in shifts table
        await supabase.from('shift_schedules').update({ personnel_id: targetId }).match({ personnel_id: reqId, shift_date: date, shift_type: reqShift });
        await supabase.from('shift_schedules').update({ personnel_id: reqId }).match({ personnel_id: targetId, shift_date: date, shift_type: targetShift });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shift_swaps'] });
      toast.success('Takas talebi işlendi');
    }
  });

  const handleBulkDeleteWeekly = () => {
    if (selectedWeeklyIds.length === 0) return;
    if (confirm(`${selectedWeeklyIds.length} adet kaydı silmek istediğinize emin misiniz?`)) {
      bulkDeleteMutation.mutate(selectedWeeklyIds);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.personnel_id || !form.day_of_week) {
      toast.error('Lütfen personel ve gün seçiniz');
      return;
    }
    upsertMutation.mutate({ personnel_id: form.personnel_id, day_of_week: Number(form.day_of_week), description: form.description, requested_shift: form.requested_shift, admin_response: form.admin_response, status: form.status });
  };

  const handleEdit = (p: any, dayOff: any) => {
    setForm({ 
      personnel_id: p.id, 
      day_of_week: dayOff ? dayOff.day_of_week.toString() : '', 
      description: dayOff?.description || '',
      requested_shift: dayOff?.requested_shift || 'farketmez',
      admin_response: dayOff?.admin_response || '',
      status: dayOff?.status || 'approved'
    });
    setIsOpen(true);
  };

  const handleEditPref = (p: any, sp: any) => {
    setPrefForm({
      id: sp?.id || '',
      personnel_id: p.id,
      day_of_week: sp ? sp.day_of_week.toString() : '',
      requested_shift: sp?.requested_shift || 'sabah',
      description: sp?.description || '',
      admin_response: sp?.admin_response || '',
      status: sp?.status || 'approved'
    });
    setIsPrefOpen(true);
  };

  const handlePrefSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prefForm.personnel_id || !prefForm.day_of_week || !prefForm.requested_shift) {
      toast.error('Lütfen personel, gün ve vardiya seçiniz');
      return;
    }
    upsertPrefMutation.mutate(prefForm);
  };

  const isLoading = pLoading || wLoading || spLoading || ssLoading;

  const data = personnel.map(p => ({
    ...p,
    weeklyDayOffs: weeklyDayOffs.filter(d => d.personnel_id === p.id),
    shiftPreference: shiftPreferences.find((d:any) => d.personnel_id === p.id)
  }));

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Calendar className="h-6 w-6" /> İzin ve Vardiya Tercihleri Yönetimi
        </h2>
        
        <div className="flex items-center gap-6 bg-muted/30 p-3 rounded-lg border">
           <div className="flex items-center space-x-2">
             <Switch 
               id="leaveSwitch"
               checked={settingsData?.setting_value?.isLeaveSelectionActive ?? true} 
               onCheckedChange={(c) => updateSettingsMutation.mutate({ isLeaveSelectionActive: c })}
             />
             <Label htmlFor="leaveSwitch" className="cursor-pointer">Personel İzin Günü Seçebilsin</Label>
           </div>
           <div className="flex items-center space-x-2">
             <Switch 
               id="shiftSwitch"
               checked={settingsData?.setting_value?.isShiftSelectionActive ?? true} 
               onCheckedChange={(c) => updateSettingsMutation.mutate({ isShiftSelectionActive: c })}
             />
             <Label htmlFor="shiftSwitch" className="cursor-pointer">Personel Vardiya Tercihi Yapabilsin</Label>
           </div>
           <div className="flex items-center space-x-2 border-l pl-6 ml-2 border-border/50">
             <Switch 
               id="swapSwitch"
               checked={settingsData?.setting_value?.employeeDashboardFeatures?.showShiftSwaps ?? true} 
               onCheckedChange={(c) => {
                 const currentFeatures = settingsData?.setting_value?.employeeDashboardFeatures || {};
                 updateSettingsMutation.mutate({ employeeDashboardFeatures: { ...currentFeatures, showShiftSwaps: c } });
               }}
             />
             <Label htmlFor="swapSwitch" className="cursor-pointer">Personel Vardiya Takası Yapabilsin</Label>
           </div>
        </div>
      </div>

      <Tabs defaultValue="dayoffs" className="w-full">
        <div className="flex gap-2 mb-4">
           <TabsList className="bg-muted/50 border">
             <TabsTrigger value="dayoffs" className="data-[state=active]:bg-background data-[state=active]:shadow-sm">Haftalık İzin Seçimleri</TabsTrigger>
             <TabsTrigger value="preferences" className="data-[state=active]:bg-background data-[state=active]:shadow-sm">Vardiya Tercihleri</TabsTrigger>
             <TabsTrigger value="swaps" className="data-[state=active]:bg-background data-[state=active]:shadow-sm flex gap-2">
               Vardiya Takasları
               {shiftSwaps.filter((s:any) => s.status === 'pending_manager').length > 0 && (
                 <Badge className="bg-blue-500 hover:bg-blue-600 h-5 px-1.5">{shiftSwaps.filter((s:any) => s.status === 'pending_manager').length}</Badge>
               )}
             </TabsTrigger>
           </TabsList>
        </div>

        <TabsContent value="dayoffs" className="space-y-4">
          <Card className="glass-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle>Haftalık İzin Günleri</CardTitle>
              {selectedWeeklyIds.length > 0 && (
                <Button variant="destructive" size="sm" onClick={handleBulkDeleteWeekly} disabled={bulkDeleteMutation.isPending}>
                  <Trash2 className="w-4 h-4 mr-2" /> Toplu Sil ({selectedWeeklyIds.length})
                </Button>
              )}
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Personel</TableHead>
                    <TableHead>Departman</TableHead>
                    <TableHead>İzin Günü</TableHead>
                    <TableHead>Durum</TableHead>
                    <TableHead className="text-right">İşlemler</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map(p => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.first_name} {p.last_name}</TableCell>
                      <TableCell>{p.department}</TableCell>
                      <TableCell>
                        {p.weeklyDayOffs.length > 0 ? p.weeklyDayOffs.map((d: any) => <Badge key={d.id} variant="secondary">{DAYS[d.day_of_week]}</Badge>) : '-'}
                      </TableCell>
                      <TableCell>
                        {p.weeklyDayOffs.length > 0 ? (
                           (p.weeklyDayOffs[0] as any).status === 'approved' ? <Badge className="bg-green-100 text-green-800">Onaylandı</Badge> : <Badge variant="outline">Bekliyor</Badge>
                        ) : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(p, p.weeklyDayOffs[0])}><Pencil className="h-4 w-4" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

                <TabsContent value="preferences" className="space-y-4">
          <Card className="glass-card mt-6 border-indigo-100 dark:border-indigo-900/30">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-indigo-600 dark:text-indigo-400">Personel Vardiya Tercihleri</CardTitle>
          <Dialog open={isPrefOpen} onOpenChange={(o) => { setIsPrefOpen(o); if(!o) setPrefForm({id:'', personnel_id:'', day_of_week:'', requested_shift: 'sabah', description: '', admin_response: '', status: 'approved'}); }}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="w-4 h-4 mr-2"/> Yeni Tercih Ata</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Vardiya Tercihi Düzenle</DialogTitle></DialogHeader>
              <form onSubmit={handlePrefSubmit} className="space-y-4 mt-2">
                <div>
                  <Label>Personel</Label>
                  <Select value={prefForm.personnel_id} onValueChange={(v) => setPrefForm({...prefForm, personnel_id: v})}>
                    <SelectTrigger><SelectValue placeholder="Personel Seçin" /></SelectTrigger>
                    <SelectContent>
                      {personnel.map((p: any) => (
                        <SelectItem key={`pref-p-${p.id}`} value={p.id}>{p.first_name} {p.last_name} ({p.department})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Tercih Edilen Gün</Label>
                  <Select value={prefForm.day_of_week} onValueChange={(v) => setPrefForm({...prefForm, day_of_week: v})}>
                    <SelectTrigger><SelectValue placeholder="Gün Seçin" /></SelectTrigger>
                    <SelectContent>
                      {DAYS.slice(1, 8).map((d, i) => (
                        <SelectItem key={`pref-d-${i+1}`} value={(i+1).toString()}>{d}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>İstenen Vardiya</Label>
                  <Select value={prefForm.requested_shift} onValueChange={(v) => setPrefForm({...prefForm, requested_shift: v})}>
                    <SelectTrigger><SelectValue placeholder="Vardiya Seçin" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sabah">Sabah</SelectItem>
                      <SelectItem value="aksam">Akşam</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Açıklama / Mazeret (Opsiyonel)</Label>
                  <Input 
                    value={prefForm.description} 
                    onChange={(e) => setPrefForm({...prefForm, description: e.target.value})} 
                    placeholder="Tercih a├ğ─▒klamas─▒..."
                  />
                </div>
                <div>
                  <Label>Yönetici Notu (Opsiyonel)</Label>
                  <Input 
                    value={prefForm.admin_response} 
                    onChange={(e) => setPrefForm({...prefForm, admin_response: e.target.value})} 
                    placeholder="Onay/Ret a├ğ─▒klamas─▒..."
                  />
                </div>
                <Button type="submit" className="w-full" disabled={upsertPrefMutation.isPending}>
                  {upsertPrefMutation.isPending ? 'Kaydediliyor...' : 'Kaydet'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Personel</TableHead>
                  <TableHead>Departman</TableHead>
                  <TableHead>Tercih Edilen Gün</TableHead>
                  <TableHead>Vardiya Tercihi</TableHead>
                  <TableHead>Açıklama</TableHead>
                  <TableHead>Durum</TableHead>
                  <TableHead className="text-right">İşlemler</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground animate-pulse">Veriler y├╝kleniyor...</TableCell></TableRow>
                ) : data.filter(p => p.shiftPreference).length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Vardiya tercihi yapan personel bulunamadı.</TableCell></TableRow>
                ) : data.filter(p => p.shiftPreference).map(p => {
                  const sp = p.shiftPreference as any;
                  return (
                  <TableRow key={`sp-${p.id}`}>
                    <TableCell className="font-medium">{p.first_name} {p.last_name}</TableCell>
                    <TableCell>{p.department}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{DAYS[sp.day_of_week] || 'Bilinmiyor'}</Badge>
                    </TableCell>
                    <TableCell>
                       {sp.requested_shift === 'sabah' ? <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300 hover:bg-yellow-200">Sabah İstiyor</Badge> : <Badge className="bg-indigo-100 text-indigo-800 border-indigo-300 hover:bg-indigo-200">Akşam İstiyor</Badge>}
                    </TableCell>
                    <TableCell>
                       {sp.description ? <span className="text-sm text-foreground font-medium">{sp.description}</span> : <span className="text-muted-foreground">-</span>}
                    </TableCell>
                    <TableCell>
                       {sp.status === 'approved' ? <Badge className="bg-green-100 text-green-800 border-none">Onaylandı</Badge> : sp.status === 'rejected' ? <Badge className="bg-red-100 text-red-800 border-none">Reddedildi</Badge> : <Badge variant="outline" className="bg-orange-50 text-orange-600 border-orange-200 animate-pulse">Bekliyor</Badge>}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1 flex-wrap">
                        {sp.status === 'pending' && (
                           <>
                             <Button size="sm" variant="outline" className="bg-green-50 hover:bg-green-100 text-green-700 h-8 px-2" onClick={() => updatePreferenceStatusMutation.mutate({ id: sp.id, status: 'approved' })}>Onayla</Button>
                             <Button size="sm" variant="outline" className="bg-red-50 hover:bg-red-100 text-red-700 h-8 px-2" onClick={() => {
                               const rationale = window.prompt("Reddetme sebebi?");
                               if (rationale !== null) updatePreferenceStatusMutation.mutate({ id: sp.id, status: 'rejected', admin_response: rationale });
                             }}>Reddet</Button>
                           </>
                        )}
                        {sp.status !== 'pending' && (
                           <Button size="sm" variant="outline" className="h-8 px-2" onClick={() => updatePreferenceStatusMutation.mutate({ id: sp.id, status: 'pending', admin_response: '' })}>Beklemeye Al</Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEditPref(p, sp)}
                        >
                          <Pencil className="h-4 w-4 text-blue-500 hover:text-blue-700" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            if (confirm('Vardiya tercihini silmek istediğinizden emin misiniz?')) {
                              deletePrefMutation.mutate(sp.id);
                            }
                          }}
                          disabled={deletePrefMutation.isPending}
                          className="text-red-500 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )})}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
        </TabsContent>

<TabsContent value="swaps" className="space-y-4">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle>Bekleyen Vardiya Takas Talepleri</CardTitle>
              <CardDescription>Personeller arasında onaylanmış ve müdür onayı bekleyen vardiya değişim talepleri</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tarih</TableHead>
                      <TableHead>Talep Eden (A)</TableHead>
                      <TableHead>Hedef Personel (B)</TableHead>
                      <TableHead>A'nın Vardiyası</TableHead>
                      <TableHead>B'nin Vardiyası</TableHead>
                      <TableHead>Durum</TableHead>
                      <TableHead className="text-right">İşlem</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {shiftSwaps.length === 0 ? (
                      <TableRow><TableCell colSpan={7} className="text-center py-6 text-muted-foreground">Henüz bir takas talebi bulunmuyor.</TableCell></TableRow>
                    ) : shiftSwaps.map((sw: any) => (
                      <TableRow key={sw.id}>
                        <TableCell className="font-medium">{new Date(sw.swap_date).toLocaleDateString('tr-TR')}</TableCell>
                        <TableCell>{sw.requester?.first_name} {sw.requester?.last_name}</TableCell>
                        <TableCell>{sw.target?.first_name} {sw.target?.last_name}</TableCell>
                        <TableCell>{sw.requester_shift}</TableCell>
                        <TableCell>{sw.target_shift}</TableCell>
                        <TableCell>
                           {sw.status === 'approved' ? <Badge className="bg-green-100 text-green-800 border-none">Onaylandı</Badge> : 
                            sw.status === 'rejected' ? <Badge className="bg-red-100 text-red-800 border-none">Reddedildi</Badge> : 
                            sw.status === 'pending_colleague' ? <Badge variant="outline" className="bg-orange-50 text-orange-600 border-orange-200">Personel Onayı Bekliyor</Badge> : 
                            <Badge variant="outline" className="bg-blue-50 text-blue-600 border-blue-200 animate-pulse">Müdür Onayı Bekliyor</Badge>}
                        </TableCell>
                        <TableCell className="text-right">
                           {sw.status === 'pending_manager' && (
                             <div className="flex justify-end gap-2">
                               <Button size="sm" variant="outline" className="bg-green-50 hover:bg-green-100 text-green-700 h-8 px-2" onClick={() => updateShiftSwapStatusMutation.mutate({ id: sw.id, status: 'approved', reqId: sw.requester_id, targetId: sw.target_personnel_id, date: sw.swap_date, reqShift: sw.requester_shift, targetShift: sw.target_shift })}>Onayla</Button>
                               <Button size="sm" variant="outline" className="bg-red-50 hover:bg-red-100 text-red-700 h-8 px-2" onClick={() => {
                                 if (window.confirm('Bu takas talebini reddetmek istediğinize emin misiniz?')) {
                                   updateShiftSwapStatusMutation.mutate({ id: sw.id, status: 'rejected' });
                                 }
                               }}>Reddet</Button>
                             </div>
                           )}
                           {sw.status === 'approved' && <span className="text-xs text-muted-foreground">İşlem Tamam</span>}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default DayOffView;
