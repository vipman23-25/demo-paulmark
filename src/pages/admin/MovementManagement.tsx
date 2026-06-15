import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Plus, Trash2, Activity, Download, RefreshCw } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { tr } from 'date-fns/locale';
import { calculateEntitlement, calculateUsedLeave } from '@/lib/leaveUtils';

const MovementManagement = () => {
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    personnel_id: '', movement_type: '', start_date: '', end_date: '', description: '', total_days: 1
  });
  const [filter, setFilter] = useState<'all' | 'weekly' | 'monthly'>('all');
  const [isExporting, setIsExporting] = useState(false);
  const [exportMonth, setExportMonth] = useState<string>(format(new Date(), 'yyyy-MM'));

  const HOLIDAYS_2026 = [
    { date: '2026-01-01', label: '1 Ocak Yılbaşı' },
    { date: '2026-03-19', label: 'Ramazan Bayramı Arife' },
    { date: '2026-03-20', label: 'Ramazan Bayramı 1. Gün' },
    { date: '2026-03-21', label: 'Ramazan Bayramı 2. Gün' },
    { date: '2026-03-22', label: 'Ramazan Bayramı 3. Gün' },
    { date: '2026-04-23', label: '23 Nisan Ulusal Egemenlik' },
    { date: '2026-05-01', label: '1 Mayıs Emek ve Dayanışma' },
    { date: '2026-05-19', label: '19 Mayıs Atatürk\'ü Anma' },
    { date: '2026-05-26', label: 'Kurban Bayramı Arife' },
    { date: '2026-05-27', label: 'Kurban Bayramı 1. Gün' },
    { date: '2026-05-28', label: 'Kurban Bayramı 2. Gün' },
    { date: '2026-05-29', label: 'Kurban Bayramı 3. Gün' },
    { date: '2026-05-30', label: 'Kurban Bayramı 4. Gün' },
    { date: '2026-07-15', label: '15 Temmuz Demokrasi' },
    { date: '2026-08-30', label: '30 Ağustos Zafer Bayramı' },
    { date: '2026-10-29', label: '29 Ekim Cumhuriyet Bayramı' }
  ];

  const { data: personnel = [], isLoading: pLoading } = useQuery({
    queryKey: ['active_personnel'],
    queryFn: async () => {
      const { data, error } = await supabase.from('personnel').select('*').eq('is_active', true);
      if (error) throw error;
      return data;
    }
  });

  const { data: settingsData } = useQuery({
    queryKey: ['system_settings_general'],
    queryFn: async () => {
      const { data, error } = await supabase.from('system_settings' as any).select('setting_value').eq('setting_key', 'general').single();
      if (!error && data?.setting_value) {
        return data.setting_value;
      }
      return null;
    }
  });

  const movementTypes = (settingsData?.movementTypes || [{ code: 'İ', label: 'İzin' }, { code: 'R', label: 'Hastalık İzni' }, { code: 'M', label: 'Muafiyet' }, { code: 'B', label: 'Başka Görev' }]).filter((t: any) => t.is_active !== false);

  const { data: movements = [], isLoading: mLoading, refetch } = useQuery({
    queryKey: ['personnel_movements'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('personnel_movements')
        .select(`
          *,
          personnel (
            first_name,
            last_name,
            department
          )
        `)
        .order('start_date', { ascending: false })
        .limit(200);
        
      if (error) {
        toast.error('Hareket verileri yüklenemedi: ' + error.message);
        throw error;
      }
      return data;
    }
  });

  const addMutation = useMutation({
    mutationFn: async (newRecord: any) => {
      const { data, error } = await supabase.from('personnel_movements').insert([newRecord]).select();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['personnel_movements'] });
      toast.success('Hareket eklendi');
      resetForm();
    },
    onError: (error: any) => toast.error('Ekleme başarısız: ' + error.message)
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string, updates: any }) => {
      const { data, error } = await supabase.from('personnel_movements').update(updates).eq('id', id).select();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['personnel_movements'] });
      toast.success('Hareket güncellendi');
      resetForm();
    },
    onError: (error: any) => toast.error('Güncelleme başarısız: ' + error.message)
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('personnel_movements').delete().eq('id', id);
      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['personnel_movements'] });
      toast.success('Hareket silindi');
    },
    onError: (error: any) => toast.error('Silme başarısız: ' + error.message)
  });

  const entitleMutation = useMutation({
    mutationFn: async ({ id, ent }: { id: string, ent: number }) => {
      const { error } = await supabase.from('personnel' as any).update({ annual_leave_entitlement: ent }).eq('id', id);
      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['active_personnel'] });
      toast.success('İzin hakedişi güncellendi');
    },
    onError: (e: any) => toast.error('Hata: ' + e.message)
  });

  const handleDateChange = (field: 'start_date' | 'end_date', value: string) => {
    setForm(prev => {
      const next = { ...prev, [field]: value };
      if (next.start_date && next.end_date) {
        const d = Math.max(1, differenceInDays(new Date(next.end_date), new Date(next.start_date)) + 1);
        next.total_days = d;
      }
      return next;
    });
  };

  const filteredMovements = movements.filter(m => {
    if (filter === 'all') return true;
    const date = new Date(m.start_date);
    const now = new Date();
    if (filter === 'weekly') {
      const weekAgo = new Date();
      weekAgo.setDate(now.getDate() - 7);
      return date >= weekAgo;
    }
    if (filter === 'monthly') {
      const monthAgo = new Date();
      monthAgo.setMonth(now.getMonth() - 1);
      return date >= monthAgo;
    }
    return true;
  });

  const exportToExcel = () => {
    if (filteredMovements.length === 0) {
      toast.error('Dışa aktarılacak veri yok');
      return;
    }
    import('xlsx').then(XLSX => {
      const data = filteredMovements.map(m => ({
        'Personel': m.personnel ? `${m.personnel.first_name} ${m.personnel.last_name}` : 'Bilinmeyen',
        'İşten Çıkış Tarihi': m.personnel?.end_date ? format(new Date(m.personnel.end_date), 'dd.MM.yyyy', { locale: tr }) : '-',
        'Hareket Türü': (() => { const typeObj = movementTypes.find((mt: any) => mt.code === m.movement_type); return typeObj ? `[${typeObj.code}] ${typeObj.label}` : m.movement_type; })(),
        'Başlangıç': m.start_date ? format(new Date(m.start_date), 'dd.MM.yyyy', { locale: tr }) : '-',
        'Bitiş': m.end_date ? format(new Date(m.end_date), 'dd.MM.yyyy', { locale: tr }) : '-',
        'Süre (Gün)': m.total_days,
        'Açıklama': m.description || ''
      }));
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Hareketler");
      XLSX.writeFile(wb, `Hareket_Raporu_${format(new Date(), 'dd_MM_yyyy')}.xlsx`);
      toast.success('Excel dosyası indirildi');
    }).catch(() => toast.error('Excel kütüphanesi yüklenemedi'));
  };

  const exportAdvancedExcel = async () => {
    setIsExporting(true);
    toast.info('Gelişmiş rapor hazırlanıyor, lütfen bekleyin...');
    try {
      const targetYear = parseInt(exportMonth.split('-')[0]);
      const targetMonth = parseInt(exportMonth.split('-')[1]);
      
      const startDateStr = `${targetYear}-${String(targetMonth).padStart(2, '0')}-01`;
      const endOfMonthDate = new Date(targetYear, targetMonth, 0);
      const endDateStr = `${targetYear}-${String(targetMonth).padStart(2, '0')}-${String(endOfMonthDate.getDate()).padStart(2, '0')}`;

      const { data: shifts, error: shiftError } = await supabase
        .from('shift_schedules')
        .select('personnel_id, shift_date, shift_type')
        .gte('shift_date', startDateStr)
        .lte('shift_date', endDateStr);
        
      if (shiftError) throw shiftError;

      const { data: allPersonnel, error: pErr } = await supabase
        .from('personnel')
        .select('*');
      if (pErr) throw pErr;

      const XLSX = await import('xlsx');

      const currentMonthHolidays = HOLIDAYS_2026.filter(h => h.date.startsWith(exportMonth));

      const targetOrder = ['Müdür', 'Kadın & Çocuk Reyon', 'Erkek Reyon', 'Kasiyer'];
      
      const getGroupedDept = (dept: string) => {
          if (!dept) return 'Diğer';
          if (dept === 'Kadın Reyon' || dept === 'Çocuk Reyon') return 'Kadın & Çocuk Reyon';
          return dept;
      };

      const sortedPersonnel = [...(allPersonnel || [])].sort((a: any, b: any) => {
          let ia = targetOrder.indexOf(getGroupedDept(a.department));
          let ib = targetOrder.indexOf(getGroupedDept(b.department));
          if (ia === -1) ia = 999;
          if (ib === -1) ib = 999;
          
          if (ia !== ib) return ia - ib;
          
          const nameA = `${a.first_name || ''} ${a.last_name || ''}`.trim();
          const nameB = `${b.first_name || ''} ${b.last_name || ''}`.trim();
          return nameA.localeCompare(nameB, 'tr-TR');
      });

      const checkShiftWorked = (shiftVal: string) => {
          if (!shiftVal) return false;
          if (shiftVal.startsWith('S') || shiftVal.startsWith('A')) return true;
          const mType = movementTypes.find((mt: any) => (mt.code || '').trim().toUpperCase() === shiftVal);
          if (mType) {
              const maps = [mType.mappedCode, mType.mappedCode2, mType.mappedCode3].map(v => (v || '').trim().toUpperCase());
              return maps.some(v => v.startsWith('S') || v.startsWith('A'));
          }
          return false;
      };

      const data = sortedPersonnel.map((p: any, index: number) => {
        const pMovements = movements.filter((m: any) => {
            if (m.personnel_id !== p.id) return false;
            const mStart = new Date(m.start_date);
            const mEnd = new Date(m.end_date || m.start_date);
            const monthStart = new Date(`${startDateStr}T00:00:00`);
            const monthEnd = new Date(`${endDateStr}T23:59:59`);
            return mStart <= monthEnd && mEnd >= monthStart;
        });

        const pShifts = (shifts || []).filter((s: any) => s.personnel_id === p.id);

        const descriptions: string[] = [];

        pMovements.forEach((m: any) => {
          const typeObj = movementTypes.find((mt: any) => mt.code === m.movement_type);
          const tLabel = (typeObj ? typeObj.label : m.movement_type).toLocaleUpperCase('tr-TR');
          
          const mStartDateStr = format(new Date(m.start_date), 'dd.MM.yyyy');
          const mEndDateStr = m.end_date ? format(new Date(m.end_date), 'dd.MM.yyyy') : mStartDateStr;
          
          const dateRangeStr = mStartDateStr === mEndDateStr ? mStartDateStr : `${mStartDateStr}-${mEndDateStr}`;
          
          const mStart = new Date(m.start_date);
          const mEnd = new Date(m.end_date || m.start_date);
          const monthStart = new Date(`${startDateStr}T00:00:00`);
          const monthEnd = new Date(`${endDateStr}T23:59:59`);
          
          const overlapStart = mStart < monthStart ? monthStart : mStart;
          const overlapEnd = mEnd > monthEnd ? monthEnd : mEnd;
          
          const daysInMonth = Math.max(0, differenceInDays(overlapEnd, overlapStart) + 1);
          
          let holidaysInOverlap = 0;
          currentMonthHolidays.forEach(h => {
             const hDate = new Date(h.date);
             if (hDate >= overlapStart && hDate <= overlapEnd) {
                 holidaysInOverlap += (h.label.includes('Arife') || h.label.includes('ARİFE') ? 0.5 : 1);
             }
          });
          
          let displayDays = daysInMonth;
          if (tLabel.includes('YILLIK İZİN')) {
             displayDays = daysInMonth - holidaysInOverlap;
          }
          
          if (displayDays > 0) {
             descriptions.push(`${dateRangeStr} ${tLabel} (${displayDays} GÜN)`);
          } else {
             descriptions.push(`${dateRangeStr} ${tLabel}`);
          }
        });

        let holidayWorkedCount = 0;
        currentMonthHolidays.forEach(h => {
          const shiftOnHoliday = pShifts.find((s: any) => s.shift_date === h.date);
          
          const movementOnHoliday = pMovements.find((m: any) => {
              const mStart = new Date(m.start_date);
              const mEnd = new Date(m.end_date || m.start_date);
              const hDate = new Date(`${h.date}T12:00:00`);
              mStart.setHours(0,0,0,0);
              mEnd.setHours(23,59,59,999);
              return hDate >= mStart && hDate <= mEnd;
          });

          const shiftVal = shiftOnHoliday ? (shiftOnHoliday.shift_type || '').trim().toUpperCase() : '';
          const hasWorkedShift = checkShiftWorked(shiftVal);

          if (!movementOnHoliday && hasWorkedShift) {
             holidayWorkedCount += (h.label.includes('Arife') || h.label.includes('ARİFE') ? 0.5 : 1);
          }
        });

        const leaveDaysInMonth = pMovements.reduce((sum: number, m: any) => {
            const typeObj = movementTypes.find((mt: any) => mt.code === m.movement_type);
            const tLabel = (typeObj ? typeObj.label : m.movement_type).toLocaleUpperCase('tr-TR');
            
            // Yıllık İzin, Ücretli İzin ve Haftalık İzin (Hafta Tatili) çalışan gün sayısından DÜŞÜLMEZ. (Çalışılmış sayılır)
            if (tLabel.includes('YILLIK İZİN') || tLabel.includes('ÜCRETLİ İZİN') || tLabel.includes('HAFTALIK İZİN') || tLabel.includes('HAFTA TATİLİ') || tLabel === 'T') {
                return sum;
            }

            const mStart = new Date(m.start_date);
            const mEnd = new Date(m.end_date || m.start_date);
            const monthStart = new Date(`${startDateStr}T00:00:00`);
            const monthEnd = new Date(`${endDateStr}T23:59:59`);
            
            const overlapStart = mStart < monthStart ? monthStart : mStart;
            const overlapEnd = mEnd > monthEnd ? monthEnd : mEnd;
            
            const days = Math.max(0, differenceInDays(overlapEnd, overlapStart) + 1);
            return sum + days;
        }, 0);

        let baseDays = 0;
        const reportMonthStart = new Date(`${startDateStr}T00:00:00`);
        const reportMonthEnd = new Date(`${endDateStr}T23:59:59`);
        
        const empStart = p.start_date ? new Date(p.start_date) : reportMonthStart;
        const empEnd = p.end_date ? new Date(p.end_date) : reportMonthEnd;

        if (empStart > reportMonthEnd || empEnd < reportMonthStart) {
            baseDays = 0;
        } else {
            const overlapStart = empStart < reportMonthStart ? reportMonthStart : empStart;
            const overlapEnd = empEnd > reportMonthEnd ? reportMonthEnd : empEnd;
            
            const isFullMonthEmployed = overlapStart.getTime() === reportMonthStart.getTime() && overlapEnd.getTime() === reportMonthEnd.getTime();
            
            if (isFullMonthEmployed) {
                baseDays = 30;
            } else {
                baseDays = Math.max(0, differenceInDays(overlapEnd, overlapStart) + 1);
            }
        } 

        const normalWorkedDays = Math.max(0, baseDays - leaveDaysInMonth);
        const totalWorkedDays = normalWorkedDays + holidayWorkedCount;

        const row: any = {
          'Sıra No': index + 1,
          'ADI-SOYADI': `${p.first_name} ${p.last_name}`,
          'T.C. NO': p.tc_no || '-',
          'İŞE GİRİŞ TARİHİ': p.start_date ? format(new Date(p.start_date), 'dd.MM.yyyy', { locale: tr }) : '-',
          'İŞTEN ÇIKIŞ TARİHİ': p.end_date ? format(new Date(p.end_date), 'dd.MM.yyyy', { locale: tr }) : '-',
          'NORMAL ÇALIŞMA GÜN SAYISI': normalWorkedDays
        };

        currentMonthHolidays.forEach(h => {
          const shiftOnHoliday = pShifts.find((s: any) => s.shift_date === h.date);
          
          const movementOnHoliday = pMovements.find((m: any) => {
              const mStart = new Date(m.start_date);
              const mEnd = new Date(m.end_date || m.start_date);
              const hDate = new Date(`${h.date}T12:00:00`);
              mStart.setHours(0,0,0,0);
              mEnd.setHours(23,59,59,999);
              return hDate >= mStart && hDate <= mEnd;
          });

          const shiftVal = shiftOnHoliday ? (shiftOnHoliday.shift_type || '').trim().toUpperCase() : '';
          const hasWorkedShift = checkShiftWorked(shiftVal);

          const colName = `${format(new Date(h.date), 'dd.MM.yyyy')} ${h.label.split(' ').slice(1).join(' ').toLocaleUpperCase('tr-TR')} ÇALIŞMA DURUMU`;
          if (!movementOnHoliday && hasWorkedShift) {
            row[colName] = 'ÇALIŞTI';
          } else {
            row[colName] = 'ÇALIŞMADI';
          }
        });

        row['TOPLAM ÇALIŞMA GÜN SAYISI'] = totalWorkedDays;
        row['RAPOR VE İZİN DURUMLARI'] = descriptions.join(', ') || '-';
        row._baseDays = baseDays; // keep temporarily for filtering

        return row;
      }).filter((r: any) => r._baseDays > 0);

      // Re-assign Sıra No after filtering
      data.forEach((r: any, i: number) => {
        r['Sıra No'] = i + 1;
        delete r._baseDays;
      });

      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, `${format(new Date(startDateStr), 'MMMM yyyy', {locale: tr})} Raporu`);
      XLSX.writeFile(wb, `Aylik_Puantaj_Raporu_${exportMonth}.xlsx`);
      toast.success('Gelişmiş rapor başarıyla indirildi');
    } catch (e: any) {
      toast.error('Rapor oluşturulurken hata: ' + e.message);
    } finally {
      setIsExporting(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const actualMovementType = form.movement_type || (movementTypes.length > 0 ? movementTypes[0].code : '');
    
    if (!form.personnel_id || !actualMovementType || !form.start_date) {
      toast.error('Lütfen personel, hareket türü ve başlangıç tarihini doldurun');
      return;
    }
    
    const payload = {
      personnel_id: form.personnel_id,
      movement_type: actualMovementType,
      start_date: form.start_date,
      end_date: form.end_date || null,
      total_days: form.total_days,
      description: form.description
    };

    if (editingId) {
      updateMutation.mutate({ id: editingId, updates: payload });
    } else {
      addMutation.mutate(payload);
    }
  };

  const resetForm = () => {
    setIsOpen(false);
    setEditingId(null);
    setForm({ personnel_id: '', movement_type: movementTypes.length > 0 ? movementTypes[0].code : '', start_date: '', end_date: '', description: '', total_days: 1 });
  };

  const handleEdit = (m: any) => {
    setForm({
      personnel_id: m.personnel_id,
      movement_type: m.movement_type,
      start_date: m.start_date ? m.start_date.split('T')[0] : '',
      end_date: m.end_date ? m.end_date.split('T')[0] : '',
      description: m.description || '',
      total_days: m.total_days || 1,
    });
    setEditingId(m.id);
    setIsOpen(true);
  };

  const deleteMovement = (id: string) => {
    if (confirm('Bu hareketi silmek istediğinize emin misiniz?')) {
      deleteMutation.mutate(id);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Activity className="h-6 w-6" /> Personel Hareketleri
        </h2>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => refetch()} title="Yenile">
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Select value={filter} onValueChange={(v: any) => setFilter(v)}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Filtrele" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tümü</SelectItem>
              <SelectItem value="weekly">Bu Hafta</SelectItem>
              <SelectItem value="monthly">Bu Ay</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex gap-2 items-center">
            <Button variant="outline" onClick={exportToExcel}>
              <Download className="w-4 h-4 mr-2" /> Liste (Excel)
            </Button>
            <div className="flex gap-2 items-center border p-1 rounded-md bg-muted/20">
              <Select value={exportMonth} onValueChange={setExportMonth}>
                <SelectTrigger className="w-[120px] h-9 bg-background">
                  <SelectValue placeholder="Rapor Ayı" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={format(new Date(), 'yyyy-MM')}>Bu Ay</SelectItem>
                  <SelectItem value={format(new Date(new Date().setMonth(new Date().getMonth() - 1)), 'yyyy-MM')}>Geçen Ay</SelectItem>
                  <SelectItem value={format(new Date(new Date().setMonth(new Date().getMonth() - 2)), 'yyyy-MM')}>2 Ay Önce</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={exportAdvancedExcel} disabled={isExporting} className="bg-emerald-600 hover:bg-emerald-700 text-white h-9">
                <Download className="w-4 h-4 mr-2" /> {isExporting ? 'Hazırlanıyor...' : 'Gelişmiş Rapor'}
              </Button>
            </div>
          </div>
          <Dialog open={isOpen} onOpenChange={(o) => { setIsOpen(o); if (!o) resetForm(); }}>
            <DialogTrigger asChild>
              <Button><Plus className="w-4 h-4 mr-2" />Yeni Hareket</Button>
            </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editingId ? "Hareketi Düzenle" : "Yeni Hareket Ekle"}</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="personnel_id">Personel</Label>
                <Select value={form.personnel_id} onValueChange={(v) => setForm({ ...form, personnel_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Personel seçin" /></SelectTrigger>
                  <SelectContent>
                    {personnel.map((p: any) => (
                      <SelectItem key={p.id} value={p.id}>{p.first_name} {p.last_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="movement_type">Hareket Türü</Label>
                <Select value={form.movement_type || (movementTypes.length > 0 ? movementTypes[0].code : '')} onValueChange={(v) => setForm({ ...form, movement_type: v })}>
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
                  <Label htmlFor="start_date">Başlangıç</Label>
                  <Input id="start_date" type="date" value={form.start_date} onChange={e => handleDateChange('start_date', e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="end_date">Bitiş</Label>
                  <Input id="end_date" type="date" value={form.end_date} onChange={e => handleDateChange('end_date', e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="total_days">Gün Sayısı</Label>
                <Input id="total_days" type="number" min="1" max="365" value={form.total_days} onChange={e => setForm({ ...form, total_days: parseInt(e.target.value) || 1 })} />
              </div>
              <div>
                <Label htmlFor="description">Açıklama</Label>
                <Textarea id="description" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="İsteğe bağlı" />
              </div>
              <Button type="submit" disabled={addMutation.isPending || updateMutation.isPending} className="w-full">
                {addMutation.isPending || updateMutation.isPending ? 'Kaydediliyor...' : 'Kaydet'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      <Tabs defaultValue="movements" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="movements">Hareket Listesi</TabsTrigger>
          <TabsTrigger value="reports">İzin Raporları</TabsTrigger>
        </TabsList>

        <TabsContent value="movements">
          <Card className="glass-card">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Personel</TableHead>
                    <TableHead>Çıkış Tarihi</TableHead>
                    <TableHead>Tür</TableHead>
                    <TableHead>Başlangıç</TableHead>
                    <TableHead>Bitiş</TableHead>
                    <TableHead>Gün</TableHead>
                    <TableHead>Açıklama</TableHead>
                    <TableHead>İşlem</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mLoading ? (
                    <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground animate-pulse">Hareketler yükleniyor...</TableCell></TableRow>
                  ) : filteredMovements.length === 0 ? (
                    <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Kayıt bulunamadı</TableCell></TableRow>
                  ) : filteredMovements.map((m: any) => (
                    <TableRow key={m.id}>
                      <TableCell className="font-medium">{m.personnel ? `${m.personnel.first_name} ${m.personnel.last_name}` : 'Bilinmeyen'}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{m.personnel?.end_date ? format(new Date(m.personnel.end_date), 'dd.MM.yyyy', { locale: tr }) : '-'}</TableCell>
                      <TableCell>
                        {(() => {
                           const typeObj = movementTypes.find((mt: any) => mt.code === m.movement_type);
                           return typeObj ? `[${typeObj.code}] ${typeObj.label}` : m.movement_type;
                        })()}
                      </TableCell>
                      <TableCell>{m.start_date ? format(new Date(m.start_date), 'dd.MM.yyyy', { locale: tr }) : '-'}</TableCell>
                      <TableCell>{m.end_date ? format(new Date(m.end_date), 'dd.MM.yyyy', { locale: tr }) : '-'}</TableCell>
                      <TableCell>{m.total_days}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{m.description}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button variant="ghost" size="icon" onClick={() => handleEdit(m)} disabled={deleteMutation.isPending}>
                            <Activity className="h-4 w-4 text-blue-500 hover:text-blue-700" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => deleteMovement(m.id)} disabled={deleteMutation.isPending}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reports">
          <Card className="glass-card">
            <CardHeader><CardTitle>Personel Yıllık İzin Raporları</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Personel</TableHead>
                    <TableHead>Departman</TableHead>
                    <TableHead>Hak Edilen (Gün)</TableHead>
                    <TableHead>Kullanılan İzin</TableHead>
                    <TableHead className="text-right">Kalan İzin</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pLoading ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-4 text-muted-foreground">Yükleniyor...</TableCell></TableRow>
                  ) : personnel.map((p: any) => {
                    const pMovements = movements.filter((m: any) => m.personnel_id === p.id);
                    const usedLeave = calculateUsedLeave(pMovements);
                    const baseEnt = typeof p.annual_leave_entitlement === 'number' 
                      ? p.annual_leave_entitlement 
                      : calculateEntitlement(p.start_date, settingsData?.leaveEntitlements);

                    const remainingLeave = baseEnt - usedLeave;
                    return (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">{p.first_name} {p.last_name}</TableCell>
                        <TableCell>{p.department}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                             <Input 
                               type="number" 
                               defaultValue={baseEnt} 
                               onBlur={(e) => {
                                 const val = parseInt(e.target.value);
                                 if (!isNaN(val) && val !== baseEnt) {
                                    entitleMutation.mutate({ id: p.id, ent: val });
                                 }
                               }}
                               className="w-20 h-8"
                             />
                          </div>
                        </TableCell>
                        <TableCell>{usedLeave}</TableCell>
                        <TableCell className={`text-right font-bold ${remainingLeave < 0 ? 'text-red-500' : 'text-emerald-500'}`}>{remainingLeave}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default MovementManagement;
