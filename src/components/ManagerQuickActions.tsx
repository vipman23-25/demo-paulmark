import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Send, Package, Timer, Calendar, Activity, Briefcase, Target } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';

const DAYS = ['', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];

interface ManagerQuickActionsProps {
  personnel: any;
}

const ManagerQuickActions: React.FC<ManagerQuickActionsProps> = ({ personnel }) => {
  const queryClient = useQueryClient();

  // Dialog States
  const [openReminder, setOpenReminder] = useState(false);
  const [openLogistics, setOpenLogistics] = useState(false);
  const [openOvertime, setOpenOvertime] = useState(false);
  const [openMovement, setOpenMovement] = useState(false);
  const [openLeave, setOpenLeave] = useState(false);
  const [openSales, setOpenSales] = useState(false);

  // Form States
  const [reminderForm, setReminderForm] = useState({ title: '', description: '', target: 'department' });
  const [cargoForm, setCargoForm] = useState({ 
    arrival_date: format(new Date(), 'yyyy-MM-dd'), total_boxes: 0, counted_boxes: 0, notes: '', driver_info: '' 
  });
  const [overtimeForm, setOvertimeForm] = useState({ 
    personnel_id: '', record_date: format(new Date(), 'yyyy-MM-dd'), 
    days: '', hours: '', minutes: '', record_type: 'Fazla Mesai', description: '' 
  });
  const [movementForm, setMovementForm] = useState({ 
    personnel_id: '', movement_type: 'B', start_date: format(new Date(), 'yyyy-MM-dd'), 
    end_date: '', total_days: 1, description: '' 
  });
  const [dayOffForm, setDayOffForm] = useState({ 
    personnel_id: '', day_of_week: '', description: '', requested_shift: 'farketmez', status: 'approved' 
  });
  const [salesForm, setSalesForm] = useState({
    personnel_id: '',
    target_month: new Date().toISOString().substring(0, 7),
    target_quota: '',
    realized_sales: ''
  });

  // Fetch All Personnel
  const { data: allPersonnel = [] } = useQuery({
    queryKey: ['active_personnel_all'],
    queryFn: async () => {
      const { data, error } = await supabase.from('personnel').select('*').eq('is_active', true).order('first_name');
      if (error) throw error;
      return data;
    }
  });
  
  const groupedPersonnel = allPersonnel.reduce((acc: any, p: any) => {
    const dept = p.department || 'Diğer';
    if (!acc[dept]) acc[dept] = [];
    acc[dept].push(p);
    return acc;
  }, {});

  // Fetch Cargo Companies
  const { data: companies = [] } = useQuery({
    queryKey: ['cargo_companies'],
    queryFn: async () => {
      const { data, error } = await supabase.from('cargo_companies' as any).select('*').order('name');
      if (error) throw error;
      return data;
    }
  });

  // Fetch Movement Types
  const { data: movementTypes = [] } = useQuery({
    queryKey: ['system_settings_movement_types'],
    queryFn: async () => {
      const { data, error } = await supabase.from('system_settings' as any).select('setting_value').eq('setting_key', 'general').single();
      if (!error && data?.setting_value?.movementTypes) {
        return data.setting_value.movementTypes;
      }
      return [{ code: 'İ', label: 'İzin' }, { code: 'R', label: 'Hastalık İzni' }, { code: 'M', label: 'Muafiyet' }, { code: 'B', label: 'Başka Görev' }];
    }
  });

  // Fetch Sales Targets for selected month
  const { data: salesTargets = [] } = useQuery({
    queryKey: ['sales_targets', salesForm.target_month],
    queryFn: async () => {
      const { data, error } = await supabase.from('sales_targets' as any).select('*').eq('target_month', salesForm.target_month);
      if (error) throw error;
      return data || [];
    }
  });

  // Fetch Cargo Drivers
  const { data: drivers = [] } = useQuery({
    queryKey: ['cargo_drivers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('system_settings')
        .select('setting_value')
        .eq('setting_key', 'cargo_drivers')
        .maybeSingle();
      
      if (error && error.code !== 'PGRST116') throw error;
      return data?.setting_value || [];
    }
  });

  // Mutations
  const addReminder = useMutation({
    mutationFn: async () => {
      if (!reminderForm.title.trim()) throw new Error('Başlık zorunludur');
      const payload = {
        title: reminderForm.title,
        description: reminderForm.description,
        department_name: reminderForm.target === 'department' ? personnel.department : 'Tümü',
        is_active: true,
        recurrence: 'none',
        display_type: 'popup',
        send_to_telegram: true,
        send_to_telegram_group: true
      };
      const { error } = await supabase.from('reminders').insert([payload]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reminders'] });
      toast.success('Duyuru başarıyla oluşturuldu');
      setOpenReminder(false);
      setReminderForm({ title: '', description: '', target: 'department' });
    },
    onError: (e: any) => toast.error('Hata: ' + e.message)
  });

  const addCargo = useMutation({
    mutationFn: async () => {
      const isComplete = Number(cargoForm.counted_boxes) >= Number(cargoForm.total_boxes);
      
      let finalNotes = cargoForm.notes || '';
      if (cargoForm.driver_info && cargoForm.driver_info.trim() !== '') {
        finalNotes = `[Şoför: ${cargoForm.driver_info.trim()}]\n${finalNotes}`;
      }

      const payload = {
        arrival_date: cargoForm.arrival_date,
        total_boxes: Number(cargoForm.total_boxes),
        counted_boxes: Number(cargoForm.counted_boxes),
        notes: finalNotes,
        status: isComplete ? 'Tamamlandı' : 'Sayılıyor',
        completion_date: isComplete ? new Date().toISOString() : null
      };
      
      const { error } = await supabase.from('cargo_shipments' as any).insert([payload]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cargo_shipments'] });
      toast.success('Sevkiyat eklendi');
      setOpenLogistics(false);
      setCargoForm({ arrival_date: format(new Date(), 'yyyy-MM-dd'), total_boxes: 0, counted_boxes: 0, notes: '', driver_info: '' });
    },
    onError: (e: any) => toast.error('Hata: ' + e.message)
  });

  const addOvertime = useMutation({
    mutationFn: async () => {
      if (!overtimeForm.personnel_id || !overtimeForm.record_date) {
        throw new Error('Lütfen tüm zorunlu alanları doldurun');
      }
      
      const d = parseFloat(overtimeForm.days.toString().replace(',', '.') || '0');
      const h = parseFloat(overtimeForm.hours.toString().replace(',', '.') || '0');
      const m = parseFloat(overtimeForm.minutes.toString().replace(',', '.') || '0');
      const totalHours = Number(((d * 8) + h + (m / 60)).toFixed(2));

      if (totalHours <= 0) {
        throw new Error('Lütfen en az 1 dakika mesai süresi girin');
      }

      const payload = {
        personnel_id: overtimeForm.personnel_id,
        record_date: overtimeForm.record_date,
        hours: totalHours,
        record_type: overtimeForm.record_type,
        description: overtimeForm.description
      };
      
      const { error } = await supabase.from('overtime_records').insert([payload]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['overtime_records'] });
      toast.success('Kayıt başarıyla eklendi');
      setOpenOvertime(false);
      setOvertimeForm({ personnel_id: '', record_date: format(new Date(), 'yyyy-MM-dd'), days: '', hours: '', minutes: '', record_type: 'Fazla Mesai', description: '' });
    },
    onError: (e: any) => toast.error('Hata: ' + e.message)
  });

  const addMovement = useMutation({
    mutationFn: async () => {
      const f = movementForm;
      if (!f.personnel_id || !f.start_date) throw new Error('Personel ve başlangıç tarihi seçilmelidir');
      
      const payload = {
        personnel_id: f.personnel_id,
        movement_type: f.movement_type,
        start_date: f.start_date,
        end_date: f.end_date || null,
        total_days: f.total_days,
        description: f.description
      };
      const { error } = await supabase.from('personnel_movements').insert([payload]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['personnel_movements'] });
      toast.success('Hareket eklendi');
      setOpenMovement(false);
    },
    onError: (e: any) => toast.error('Hata: ' + e.message)
  });

  const addWeeklyDayOff = useMutation({
    mutationFn: async () => {
      if (!dayOffForm.personnel_id || !dayOffForm.day_of_week) {
        throw new Error('Lütfen personel ve gün seçiniz');
      }
      
      await supabase.from('weekly_day_off').delete().eq('personnel_id', dayOffForm.personnel_id);
      
      const payload = {
        personnel_id: dayOffForm.personnel_id,
        day_of_week: Number(dayOffForm.day_of_week),
        description: dayOffForm.description,
        requested_shift: dayOffForm.requested_shift,
        status: dayOffForm.status
      };
      
      const { error } = await supabase.from('weekly_day_off').insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['weekly_day_offs'] });
      queryClient.invalidateQueries({ queryKey: ['shift_engine_context'] });
      toast.success('İzin/Vardiya tercihi atandı!');
      setOpenLeave(false);
      setDayOffForm({ personnel_id: '', day_of_week: '', description: '', requested_shift: 'farketmez', status: 'approved' });
    },
    onError: (e: any) => toast.error('Hata: ' + e.message)
  });

  const addSalesTarget = useMutation({
    mutationFn: async () => {
      if (!salesForm.personnel_id) throw new Error('Personel seçin');
      const existing = salesTargets.find((s: any) => s.personnel_id === salesForm.personnel_id);
      const payload = {
        personnel_id: salesForm.personnel_id,
        target_month: salesForm.target_month,
        target_quota: Number(salesForm.target_quota) || 0,
        realized_sales: Number(salesForm.realized_sales) || 0
      };
      if (existing) {
         const { error } = await supabase.from('sales_targets' as any).update({
           target_quota: payload.target_quota,
           realized_sales: payload.realized_sales
         }).eq('id', existing.id);
         if (error) throw error;
      } else {
         const { error } = await supabase.from('sales_targets' as any).insert([payload]);
         if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales_targets'] });
      toast.success('Satış hedefi/gerçekleşen kaydedildi');
      setSalesForm(prev => ({ ...prev, personnel_id: '', realized_sales: '' }));
    },
    onError: (e: any) => toast.error('Hata: ' + e.message)
  });

  const handleSalesPersonnelChange = (val: string) => {
    const existing = salesTargets.find((s: any) => s.personnel_id === val);
    setSalesForm({
      ...salesForm,
      personnel_id: val,
      target_quota: existing?.target_quota?.toString() || '',
      realized_sales: existing?.realized_sales?.toString() || ''
    });
  };

  const handleDateChange = (field: 'start_date' | 'end_date', value: string) => {
    setMovementForm(prev => {
      const next = { ...prev, [field]: value };
      if (next.start_date && next.end_date) {
        const d = Math.max(1, differenceInDays(new Date(next.end_date), new Date(next.start_date)) + 1);
        next.total_days = d;
      }
      return next;
    });
  };

  return (
    <div className="mt-8 pt-8 border-t border-muted-foreground/20 px-4 max-w-7xl mx-auto">
      <div className="mb-6">
        <h3 className="text-xl font-bold flex items-center gap-2 text-foreground">
          <Briefcase className="w-6 h-6 text-primary" />
          Yönetici Hızlı İşlemler
        </h3>
        <p className="text-sm text-muted-foreground">Admin paneline giriş yapmadan hızlı kayıt oluşturun. (Tüm personeller listelenir)</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">

        {/* Koli / Sevkiyat */}
        <Dialog open={openLogistics} onOpenChange={setOpenLogistics}>
          <DialogTrigger asChild>
            <Button variant="outline" className="flex flex-col h-auto py-4 gap-2 items-center justify-center border-orange-200 hover:bg-orange-50 dark:border-orange-900/30 dark:hover:bg-orange-900/20">
              <Package className="w-6 h-6 text-orange-500" />
              <span className="text-xs font-semibold whitespace-normal text-center">Koli / Sevkiyat</span>
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Yeni Sevkiyat Ekle</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-4">
              <div>
                <Label>Geliş Tarihi</Label>
                <Input type="date" value={cargoForm.arrival_date} onChange={e => setCargoForm({ ...cargoForm, arrival_date: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Toplam Koli Adedi</Label>
                  <Input type="number" min="0" value={cargoForm.total_boxes} onChange={e => setCargoForm({ ...cargoForm, total_boxes: parseInt(e.target.value) || 0 })} />
                </div>
                <div>
                  <Label>Sayılan Koli</Label>
                  <Input type="number" min="0" max={cargoForm.total_boxes} value={cargoForm.counted_boxes} onChange={e => setCargoForm({ ...cargoForm, counted_boxes: Math.min(parseInt(e.target.value) || 0, cargoForm.total_boxes) })} />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>Kayıtlı Şoför Seç</Label>
                  <Select onValueChange={(val) => {
                    const d = drivers.find((x: any) => x.id === val);
                    if(d) setCargoForm({...cargoForm, driver_info: `${d.name} | ${d.plate} | ${d.phone}`});
                  }}>
                    <SelectTrigger><SelectValue placeholder="Şoför seçin" /></SelectTrigger>
                    <SelectContent>
                      {drivers.length === 0 ? (
                        <SelectItem value="none" disabled>Kayıtlı şoför yok</SelectItem>
                      ) : (
                        drivers.map((d: any) => (
                          <SelectItem key={d.id} value={d.id}>{d.name} ({d.plate})</SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Tır Şoförü / Plaka Bilgisi</Label>
                  <Input 
                    placeholder="Ad Soyad | Plaka | İletişim"
                    value={cargoForm.driver_info} 
                    onChange={e => setCargoForm({...cargoForm, driver_info: e.target.value})} 
                  />
                </div>
              </div>
              <div>
                <Label>Admin Notu / Açıklama</Label>
                <Input value={cargoForm.notes} onChange={e => setCargoForm({ ...cargoForm, notes: e.target.value })} placeholder="Araç plakası veya ek notlar..." />
              </div>
              <Button className="w-full" onClick={() => addCargo.mutate()} disabled={addCargo.isPending}>
                {addCargo.isPending ? 'Kaydediliyor...' : 'Kaydet'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Fazla Mesai Ekle */}
        <Dialog open={openOvertime} onOpenChange={setOpenOvertime}>
          <DialogTrigger asChild>
            <Button variant="outline" className="flex flex-col h-auto py-4 gap-2 items-center justify-center border-purple-200 hover:bg-purple-50 dark:border-purple-900/30 dark:hover:bg-purple-900/20">
              <Timer className="w-6 h-6 text-purple-500" />
              <span className="text-xs font-semibold whitespace-normal text-center">Fazla Mesai / Alacak Takibi</span>
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Yeni Kayıt</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-4">
              <div>
                <Label>Personel</Label>
                <Select value={overtimeForm.personnel_id} onValueChange={(v) => setOvertimeForm({ ...overtimeForm, personnel_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Personel seçin" /></SelectTrigger>
                  <SelectContent>
                    {Object.keys(groupedPersonnel).map(dept => (
                      <SelectGroup key={dept}>
                        <SelectLabel>{dept}</SelectLabel>
                        {groupedPersonnel[dept].map((c: any) => (
                          <SelectItem key={c.id} value={c.id}>{c.first_name} {c.last_name}</SelectItem>
                        ))}
                      </SelectGroup>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Tür</Label>
                <Select value={overtimeForm.record_type} onValueChange={(v) => setOvertimeForm({ ...overtimeForm, record_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Fazla Mesai">Fazla Mesai</SelectItem>
                    <SelectItem value="Alacak (Kullanım)">Alacak (Kullanım)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Tarih</Label>
                <Input type="date" value={overtimeForm.record_date} onChange={e => setOvertimeForm({ ...overtimeForm, record_date: e.target.value })} />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label className="text-xs">Gün (8s)</Label>
                  <Input type="number" min="0" placeholder="0" value={overtimeForm.days} onChange={e => setOvertimeForm({ ...overtimeForm, days: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">Saat</Label>
                  <Input type="number" min="0" max="23" placeholder="0" value={overtimeForm.hours} onChange={e => setOvertimeForm({ ...overtimeForm, hours: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">Dakika</Label>
                  <Input type="number" min="0" max="59" placeholder="0" value={overtimeForm.minutes} onChange={e => setOvertimeForm({ ...overtimeForm, minutes: e.target.value })} />
                </div>
              </div>
              <div>
                <Label>Açıklama</Label>
                <Textarea value={overtimeForm.description} onChange={e => setOvertimeForm({ ...overtimeForm, description: e.target.value })} />
              </div>
              <Button className="w-full" onClick={() => addOvertime.mutate()} disabled={addOvertime.isPending}>
                {addOvertime.isPending ? 'İşleniyor...' : 'Ekle'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Personel Hareketleri */}
        <Dialog open={openMovement} onOpenChange={setOpenMovement}>
          <DialogTrigger asChild>
            <Button variant="outline" className="flex flex-col h-auto py-4 gap-2 items-center justify-center border-indigo-200 hover:bg-indigo-50 dark:border-indigo-900/30 dark:hover:bg-indigo-900/20">
              <Activity className="w-6 h-6 text-indigo-500" />
              <span className="text-xs font-semibold whitespace-normal text-center">Personel Hareketleri</span>
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Yeni Hareket Ekle</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-4">
              <div>
                <Label>Personel</Label>
                <Select value={movementForm.personnel_id} onValueChange={(v) => setMovementForm({ ...movementForm, personnel_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Personel seçin" /></SelectTrigger>
                  <SelectContent>
                    {Object.keys(groupedPersonnel).map(dept => (
                      <SelectGroup key={dept}>
                        <SelectLabel>{dept}</SelectLabel>
                        {groupedPersonnel[dept].map((c: any) => (
                          <SelectItem key={c.id} value={c.id}>{c.first_name} {c.last_name}</SelectItem>
                        ))}
                      </SelectGroup>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Hareket Türü</Label>
                <Select value={movementForm.movement_type} onValueChange={(v) => setMovementForm({ ...movementForm, movement_type: v })}>
                  <SelectTrigger><SelectValue placeholder="Tür seçin" /></SelectTrigger>
                  <SelectContent>
                    {movementTypes.map((t: any) => (
                      <SelectItem key={t.code} value={t.code}>[{t.code}] {t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Başlangıç</Label>
                  <Input type="date" value={movementForm.start_date} onChange={e => handleDateChange('start_date', e.target.value)} />
                </div>
                <div>
                  <Label>Bitiş</Label>
                  <Input type="date" value={movementForm.end_date} onChange={e => handleDateChange('end_date', e.target.value)} />
                </div>
              </div>
              <div>
                <Label>Gün Sayısı</Label>
                <Input type="number" min="1" max="365" value={movementForm.total_days} onChange={e => setMovementForm({ ...movementForm, total_days: parseInt(e.target.value) || 1 })} />
              </div>
              <div>
                <Label>Açıklama</Label>
                <Textarea value={movementForm.description} onChange={e => setMovementForm({ ...movementForm, description: e.target.value })} placeholder="İsteğe bağlı" />
              </div>
              <Button className="w-full" onClick={() => addMovement.mutate()} disabled={addMovement.isPending}>
                {addMovement.isPending ? 'Kaydediliyor...' : 'Kaydet'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* İzin / Vardiya (Haftalık İzin Yönetimi) */}
        <Dialog open={openLeave} onOpenChange={setOpenLeave}>
          <DialogTrigger asChild>
            <Button variant="outline" className="flex flex-col h-auto py-4 gap-2 items-center justify-center border-green-200 hover:bg-green-50 dark:border-green-900/30 dark:hover:bg-green-900/20">
              <Calendar className="w-6 h-6 text-green-500" />
              <span className="text-xs font-semibold whitespace-normal text-center">İzin / Vardiya</span>
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>İzin ve Vardiya Tercihleri Yönetimi</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-4">
              <div>
                <Label>Personel</Label>
                <Select value={dayOffForm.personnel_id} onValueChange={(v) => setDayOffForm({ ...dayOffForm, personnel_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Personel Seçin" /></SelectTrigger>
                  <SelectContent>
                    {Object.keys(groupedPersonnel).map(dept => (
                      <SelectGroup key={dept}>
                        <SelectLabel>{dept}</SelectLabel>
                        {groupedPersonnel[dept].map((c: any) => (
                          <SelectItem key={c.id} value={c.id}>{c.first_name} {c.last_name}</SelectItem>
                        ))}
                      </SelectGroup>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>İzin Günü (Haftalık)</Label>
                <Select value={dayOffForm.day_of_week} onValueChange={(v) => setDayOffForm({ ...dayOffForm, day_of_week: v })}>
                  <SelectTrigger><SelectValue placeholder="Gün Seçin (Pzt-Cuma)" /></SelectTrigger>
                  <SelectContent>
                    {DAYS.slice(1, 6).map((d, i) => (
                      <SelectItem key={i+1} value={(i+1).toString()}>{d}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Açıklama (İsteğe bağlı)</Label>
                <Input 
                  value={dayOffForm.description} 
                  onChange={(e) => setDayOffForm({...dayOffForm, description: e.target.value})} 
                  placeholder="İzin hakkında not..."
                />
              </div>
              <Button className="w-full" onClick={() => addWeeklyDayOff.mutate()} disabled={addWeeklyDayOff.isPending}>
                {addWeeklyDayOff.isPending ? 'Kaydediliyor...' : 'Yeni İzin Ata / Değiştir'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Satış Hedefleri */}
        <Dialog open={openSales} onOpenChange={setOpenSales}>
          <DialogTrigger asChild>
            <Button variant="outline" className="flex flex-col h-auto py-4 gap-2 items-center justify-center border-blue-200 hover:bg-blue-50 dark:border-blue-900/30 dark:hover:bg-blue-900/20">
              <Target className="w-6 h-6 text-blue-500" />
              <span className="text-xs font-semibold whitespace-normal text-center">Aylık Kota / Performans</span>
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Aylık Kota ve Satış Girişi</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-4">
              <div>
                <Label>Ay</Label>
                <Input type="month" value={salesForm.target_month} onChange={e => setSalesForm({...salesForm, target_month: e.target.value})} />
              </div>
              <div>
                <Label>Personel</Label>
                <Select value={salesForm.personnel_id} onValueChange={handleSalesPersonnelChange}>
                  <SelectTrigger><SelectValue placeholder="Personel seçin" /></SelectTrigger>
                  <SelectContent>
                    {Object.keys(groupedPersonnel).map(dept => (
                      <SelectGroup key={dept}>
                        <SelectLabel>{dept}</SelectLabel>
                        {groupedPersonnel[dept].map((c: any) => (
                          <SelectItem key={c.id} value={c.id}>{c.first_name} {c.last_name}</SelectItem>
                        ))}
                      </SelectGroup>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Aylık Kota (Hedef)</Label>
                  <Input type="number" min="0" value={salesForm.target_quota} onChange={e => setSalesForm({...salesForm, target_quota: e.target.value})} />
                </div>
                <div>
                  <Label>Yapılan Satış</Label>
                  <Input type="number" min="0" value={salesForm.realized_sales} onChange={e => setSalesForm({...salesForm, realized_sales: e.target.value})} />
                </div>
              </div>
              <Button className="w-full" onClick={() => addSalesTarget.mutate()} disabled={addSalesTarget.isPending}>
                {addSalesTarget.isPending ? 'Kaydediliyor...' : 'Kaydet ve Sonrakine Geç'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

      </div>
    </div>
  );
};

export default ManagerQuickActions;
