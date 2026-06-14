import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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

import { Switch } from '@/components/ui/switch';
const DAYS = ['', 'Pazartesi', 'Sal─▒', '├çar┼şamba', 'Per┼şembe', 'Cuma', 'Cumartesi', 'Pazar'];

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
      if (error) throw error;
      return data;
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
      toast.success('Ayarlar g├╝ncellendi');
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
      toast.success('Haftal─▒k izin atand─▒/g├╝ncellendi!');
      setIsOpen(false);
      setForm({ personnel_id: '', day_of_week: '', description: '', requested_shift: 'farketmez', admin_response: '', status: 'approved' });
    },
    onError: (error: any) => toast.error('─░┼şlem ba┼şar─▒s─▒z: ' + error.message)
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
      toast.success('Haftal─▒k izin silindi');
    },
    onError: (error: any) => toast.error('Silme ba┼şar─▒s─▒z: ' + error.message)
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
      toast.success(`${data.length} haftal─▒k izin silindi`);
      setSelectedWeeklyIds([]);
    },
    onError: (error: any) => toast.error('Toplu silme ba┼şar─▒s─▒z: ' + error.message)
  });

  const handleDeleteWeeklyDayOff = (id: string) => {
    if (confirm('Haftal─▒k izni silmek istedi─şinizden emin misiniz?')) {
      deleteMutation.mutate(id);
    }
  };

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status, admin_response }: { id: string, status: string, admin_response?: string }) => {
      const payload: any = { status, admin_response };
      const { error } = await supabase.from('weekly_day_off').update(payload).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['weekly_day_offs'] });
      queryClient.invalidateQueries({ queryKey: ['shift_engine_context'] });
      toast.success('─░zin durumu g├╝ncellendi');
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
      toast.success('Vardiya tercihi atand─▒/g├╝ncellendi!');
      setIsPrefOpen(false);
    },
    onError: (error: any) => toast.error('─░┼şlem ba┼şar─▒s─▒z: ' + error.message)
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
    onError: (error: any) => toast.error('Silme ba┼şar─▒s─▒z: ' + error.message)
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
      toast.success('Vardiya tercihi durumu g├╝ncellendi');
    }
  });

  const handleBulkDeleteWeekly = () => {
    if (selectedWeeklyIds.length === 0) return;
    if (confirm(`${selectedWeeklyIds.length} adet kayd─▒ silmek istedi─şinize emin misiniz?`)) {
      bulkDeleteMutation.mutate(selectedWeeklyIds);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.personnel_id || !form.day_of_week) {
      toast.error('L├╝tfen personel ve g├╝n se├ğiniz');
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
      toast.error('L├╝tfen personel, g├╝n ve vardiya se├ğiniz');
      return;
    }
    upsertPrefMutation.mutate(prefForm);
  };

  const isLoading = pLoading || wLoading || spLoading;

  // Merge personnel with their day offs for display
  const data = personnel.map(p => ({
    ...p,
    weeklyDayOffs: weeklyDayOffs.filter(d => d.personnel_id === p.id),
    shiftPreference: shiftPreferences.find((d:any) => d.personnel_id === p.id)
  }));

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Calendar className="h-6 w-6" /> ─░zin ve Vardiya Tercihleri Y├Ânetimi
        </h2>
        
        <div className="flex items-center gap-6 bg-muted/30 p-3 rounded-lg border">
           <div className="flex items-center space-x-2">
             <Switch 
               id="leaveSwitch"
               checked={settingsData?.setting_value?.isLeaveSelectionActive ?? true} 
               onCheckedChange={(c) => updateSettingsMutation.mutate({ isLeaveSelectionActive: c })}
             />
             <Label htmlFor="leaveSwitch" className="cursor-pointer">Personel ─░zin G├╝n├╝ Se├ğebilsin</Label>
           </div>
           <div className="flex items-center space-x-2">
             <Switch 
               id="shiftSwitch"
               checked={settingsData?.setting_value?.isShiftSelectionActive ?? true} 
               onCheckedChange={(c) => updateSettingsMutation.mutate({ isShiftSelectionActive: c })}
             />
             <Label htmlFor="shiftSwitch" className="cursor-pointer">Personel Vardiya Tercihi Yapabilsin</Label>
           </div>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={() => refetch()} title="Yenile">
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Dialog open={isOpen} onOpenChange={(o) => { setIsOpen(o); if(!o) setForm({personnel_id:'', day_of_week:'', description:'', requested_shift: 'farketmez', admin_response: '', status: 'approved'}); }}>
            <DialogTrigger asChild>
              <Button><Plus className="w-4 h-4 mr-2"/> Yeni ─░zin Ata / De─şi┼ştir</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>─░zin G├╝n├╝ D├╝zenle</DialogTitle></DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4 mt-2">
                <div>
                  <Label>Personel</Label>
                  <Select value={form.personnel_id} onValueChange={(v) => setForm({...form, personnel_id: v})}>
                    <SelectTrigger><SelectValue placeholder="Personel Se├ğin" /></SelectTrigger>
                    <SelectContent>
                      {personnel.map(p => (
                        <SelectItem key={p.id} value={p.id}>{p.first_name} {p.last_name} ({p.department})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>─░zin G├╝n├╝</Label>
                  <Select value={form.day_of_week} onValueChange={(v) => setForm({...form, day_of_week: v})}>
                    <SelectTrigger><SelectValue placeholder="G├╝n Se├ğin (Pzt-Cuma)" /></SelectTrigger>
                    <SelectContent>
                      {DAYS.slice(1, 6).map((d, i) => (
                        <SelectItem key={i+1} value={(i+1).toString()}>{d}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>A├ğ─▒klama (─░ste─şe ba─şl─▒)</Label>
                  <Input 
                    value={form.description} 
                    onChange={(e) => setForm({...form, description: e.target.value})} 
                    placeholder="─░zin hakk─▒nda not..."
                  />
                </div>
                <Button type="submit" className="w-full" disabled={upsertMutation.isPending}>
                  {upsertMutation.isPending ? 'Kaydediliyor...' : 'Kaydet'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card className="glass-card">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle>Haftal─▒k ─░zin G├╝nleri</CardTitle>
          {selectedWeeklyIds.length > 0 && (
            <Button variant="destructive" size="sm" onClick={handleBulkDeleteWeekly} disabled={bulkDeleteMutation.isPending}>
              <Trash2 className="w-4 h-4 mr-2" /> Toplu Sil ({selectedWeeklyIds.length})
            </Button>
          )}
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                     <Checkbox 
                       checked={data.filter(p => p.weeklyDayOffs.length > 0).length > 0 && selectedWeeklyIds.length === data.filter(p => p.weeklyDayOffs.length > 0).length}
                       onCheckedChange={(c) => setSelectedWeeklyIds(c ? data.filter(p => p.weeklyDayOffs.length > 0).map(p => p.weeklyDayOffs[0].id) : [])}
                     />
                  </TableHead>
                  <TableHead>Personel</TableHead>
                  <TableHead>Departman</TableHead>
                  <TableHead>─░zin G├╝n├╝</TableHead>
                  <TableHead>A├ğ─▒klama</TableHead>
                  <TableHead>Durum</TableHead>
                  <TableHead className="text-right">─░┼şlemler</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground animate-pulse">Veriler y├╝kleniyor...</TableCell></TableRow>
                ) : data.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Aktif personel bulunamad─▒</TableCell></TableRow>
                ) : data.map(p => (
                  <TableRow key={p.id}>
                    <TableCell>
                      {p.weeklyDayOffs.length > 0 ? (
                        <Checkbox 
                          checked={selectedWeeklyIds.includes(p.weeklyDayOffs[0].id)}
                          onCheckedChange={() => setSelectedWeeklyIds(prev => prev.includes(p.weeklyDayOffs[0].id) ? prev.filter(i => i !== p.weeklyDayOffs[0].id) : [...prev, p.weeklyDayOffs[0].id])}
                        />
                      ) : null}
                    </TableCell>
                    <TableCell className="font-medium">{p.first_name} {p.last_name}</TableCell>
                    <TableCell>{p.department}</TableCell>
                    <TableCell>
                      <div className="flex gap-1 flex-wrap">
                        {p.weeklyDayOffs.length > 0 ? p.weeklyDayOffs.map((d: any) => (
                          <Badge key={d.id} variant="secondary">{d.day_of_week === 0 ? 'Sadece Not' : (DAYS[d.day_of_week] || 'Bilinmiyor')}</Badge>
                        )) : <span className="text-muted-foreground">Se├ğilmemi┼ş</span>}
                      </div>
                    </TableCell>
                    <TableCell>
                       {p.weeklyDayOffs.length > 0 && p.weeklyDayOffs[0].description ? (
                          <span className="text-sm text-foreground font-medium">{p.weeklyDayOffs[0].description}</span>
                       ) : <span className="text-muted-foreground">-</span>}
                    </TableCell>
                    <TableCell>
                      {p.weeklyDayOffs.length > 0 ? (
                        (() => {
                           const s = (p.weeklyDayOffs[0] as any).status;
                           if (s === 'approved') return <Badge className="bg-green-100 text-green-800 border-none">Onayland─▒</Badge>
                           if (s === 'rejected') return <Badge className="bg-red-100 text-red-800 border-none">Reddedildi</Badge>
                           return <Badge variant="outline" className="bg-orange-50 text-orange-600 border-orange-200 animate-pulse">Bekliyor</Badge>
                        })()
                      ) : <span className="text-muted-foreground">-</span>}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1 flex-wrap">
                        {p.weeklyDayOffs.length > 0 && (p.weeklyDayOffs[0] as any).status === 'pending' && (
                           <>
                             <Button size="sm" variant="outline" className="bg-green-50 hover:bg-green-100 text-green-700 h-8 px-2" onClick={() => updateStatusMutation.mutate({ id: p.weeklyDayOffs[0].id, status: 'approved' })}>Onayla</Button>
                             <Button size="sm" variant="outline" className="bg-red-50 hover:bg-red-100 text-red-700 h-8 px-2" onClick={() => {
                               const rationale = window.prompt("Reddetme sebebi?");
                               if (rationale !== null) updateStatusMutation.mutate({ id: p.weeklyDayOffs[0].id, status: 'rejected', admin_response: rationale });
                             }}>Reddet</Button>
                           </>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(p, p.weeklyDayOffs[0])}
                        >
                          <Pencil className="h-4 w-4 text-blue-500 hover:text-blue-700" />
                        </Button>
                        {p.weeklyDayOffs.length > 0 && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteWeeklyDayOff(p.weeklyDayOffs[0].id)}
                            disabled={deleteMutation.isPending}
                            className="text-red-500 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Shift Preferences Table */}
      <Card className="glass-card mt-6 border-indigo-100 dark:border-indigo-900/30">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-indigo-600 dark:text-indigo-400">Personel Vardiya Tercihleri</CardTitle>
          <Dialog open={isPrefOpen} onOpenChange={(o) => { setIsPrefOpen(o); if(!o) setPrefForm({id:'', personnel_id:'', day_of_week:'', requested_shift: 'sabah', description: '', admin_response: '', status: 'approved'}); }}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="w-4 h-4 mr-2"/> Yeni Tercih Ata</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Vardiya Tercihi D├╝zenle</DialogTitle></DialogHeader>
              <form onSubmit={handlePrefSubmit} className="space-y-4 mt-2">
                <div>
                  <Label>Personel</Label>
                  <Select value={prefForm.personnel_id} onValueChange={(v) => setPrefForm({...prefForm, personnel_id: v})}>
                    <SelectTrigger><SelectValue placeholder="Personel Se├ğin" /></SelectTrigger>
                    <SelectContent>
                      {personnel.map((p: any) => (
                        <SelectItem key={`pref-p-${p.id}`} value={p.id}>{p.first_name} {p.last_name} ({p.department})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Tercih Edilen G├╝n</Label>
                  <Select value={prefForm.day_of_week} onValueChange={(v) => setPrefForm({...prefForm, day_of_week: v})}>
                    <SelectTrigger><SelectValue placeholder="G├╝n Se├ğin" /></SelectTrigger>
                    <SelectContent>
                      {DAYS.slice(1, 8).map((d, i) => (
                        <SelectItem key={`pref-d-${i+1}`} value={(i+1).toString()}>{d}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>─░stenen Vardiya</Label>
                  <Select value={prefForm.requested_shift} onValueChange={(v) => setPrefForm({...prefForm, requested_shift: v})}>
                    <SelectTrigger><SelectValue placeholder="Vardiya Se├ğin" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sabah">Sabah</SelectItem>
                      <SelectItem value="aksam">Ak┼şam</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>A├ğ─▒klama / Mazeret (Opsiyonel)</Label>
                  <Input 
                    value={prefForm.description} 
                    onChange={(e) => setPrefForm({...prefForm, description: e.target.value})} 
                    placeholder="Tercih a├ğ─▒klamas─▒..."
                  />
                </div>
                <div>
                  <Label>Y├Ânetici Notu (Opsiyonel)</Label>
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
                  <TableHead>Tercih Edilen G├╝n</TableHead>
                  <TableHead>Vardiya Tercihi</TableHead>
                  <TableHead>A├ğ─▒klama</TableHead>
                  <TableHead>Durum</TableHead>
                  <TableHead className="text-right">─░┼şlemler</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground animate-pulse">Veriler y├╝kleniyor...</TableCell></TableRow>
                ) : data.filter(p => p.shiftPreference).length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Vardiya tercihi yapan personel bulunamad─▒.</TableCell></TableRow>
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
                       {sp.requested_shift === 'sabah' ? <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300 hover:bg-yellow-200">Sabah ─░stiyor</Badge> : <Badge className="bg-indigo-100 text-indigo-800 border-indigo-300 hover:bg-indigo-200">Ak┼şam ─░stiyor</Badge>}
                    </TableCell>
                    <TableCell>
                       {sp.description ? <span className="text-sm text-foreground font-medium">{sp.description}</span> : <span className="text-muted-foreground">-</span>}
                    </TableCell>
                    <TableCell>
                       {sp.status === 'approved' ? <Badge className="bg-green-100 text-green-800 border-none">Onayland─▒</Badge> : sp.status === 'rejected' ? <Badge className="bg-red-100 text-red-800 border-none">Reddedildi</Badge> : <Badge variant="outline" className="bg-orange-50 text-orange-600 border-orange-200 animate-pulse">Bekliyor</Badge>}
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
                            if (confirm('Vardiya tercihini silmek istedi─şinizden emin misiniz?')) {
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
    </div>
  );
};

export default DayOffView;
