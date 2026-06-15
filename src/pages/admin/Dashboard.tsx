import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Clock, MapPin, Zap, Package, CalendarDays, Settings, Bell, Trash2, ToggleRight, ToggleLeft, Edit2, Send, Target, CheckCircle2, Download } from 'lucide-react';
import { getSystemLogs } from '@/lib/systemLogs';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import SalesTargets from './SalesTargets';
import { MatrixTab } from '@/pages/admin/BreakPlanning/MatrixTab';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { format, startOfWeek } from 'date-fns';
import { tr } from 'date-fns/locale';
import { useAuth } from '@/contexts/AuthContext';
import { Progress } from '@/components/ui/progress';
import { calculateBreakMatrix, getPersonnelAssignedSlot } from '@/lib/breakMatrixUtils';
import ManagerQuickActions from '@/components/ManagerQuickActions';

const SalesPerformanceCard = ({ salesTargets, personnel }: any) => {
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    return format(new Date(), 'yyyy-MM');
  });

  const getPersonnelName = (id: string) => {
    const p = personnel.find((p: any) => p.id === id);
    return p ? `${p.first_name} ${p.last_name} (${p.department})` : 'Bilinmiyor';
  };

  const availableMonths = useMemo(() => {
    const keys = new Set<string>();
    keys.add(format(new Date(), 'yyyy-MM'));
    
    salesTargets.forEach((t: any) => {
      if (t.target_month) {
        keys.add(t.target_month);
      }
    });
    
    return Array.from(keys).sort().reverse();
  }, [salesTargets]);

  const activeTargets = salesTargets.filter((t: any) => t.target_quota > 0 && t.target_month === selectedMonth);

  const formatMonthLabel = (key: string) => {
    const [y, m] = key.split('-');
    const date = new Date(parseInt(y, 10), parseInt(m, 10) - 1, 1);
    return format(date, 'MMMM yyyy', { locale: tr });
  };

  return (
    <Card className="glass-card">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="flex items-center gap-2">
          <Target className="h-5 w-5" />
          Aylık Kota ve Performans
        </CardTitle>
        <Select value={selectedMonth} onValueChange={setSelectedMonth}>
          <SelectTrigger className="w-[150px] h-8 text-xs bg-background/50">
            <SelectValue placeholder="Ay Seçin" />
          </SelectTrigger>
          <SelectContent>
            {availableMonths.map(mKey => (
              <SelectItem key={mKey} value={mKey}>{formatMonthLabel(mKey)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-96 overflow-y-auto pr-1">
          {activeTargets.length === 0 ? (
            <p className="text-muted-foreground text-sm col-span-full">Seçilen ay için tanımlı kota bulunmuyor.</p>
          ) : (
            activeTargets.map((t: any) => {
              const quota = Number(t.target_quota) || 0;
              const realized = Number(t.realized_sales) || 0;
              const ratio = quota > 0 ? (realized / quota) * 100 : 0;
              const isComplete = ratio >= 100;
              
              const target80 = quota * 0.8;
              const is80Complete = realized >= target80;
              const remaining80 = Math.max(0, target80 - realized);
              const remaining100 = Math.max(0, quota - realized);

              return (
                <div key={t.id} className="p-4 rounded-lg bg-emerald-50/50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/30">
                  <p className="font-semibold text-sm mb-2 text-foreground">{getPersonnelName(t.personnel_id)}</p>
                  
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-muted-foreground">Satış: {realized.toLocaleString('tr-TR')} ₺</span>
                    <span className="font-medium">Hedef: {quota.toLocaleString('tr-TR')} ₺</span>
                  </div>
                  
                  <Progress value={Math.min(100, ratio)} className={`h-2 mb-2 ${isComplete ? '[&>div]:bg-red-500 bg-red-100 dark:bg-red-950' : 'bg-emerald-100 dark:bg-emerald-950'}`} />
                  
                  <div className="flex justify-between items-center text-xs font-semibold">
                    <span className={isComplete ? 'text-red-500 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}>
                      %{ratio.toFixed(1)}
                    </span>
                    <div className="text-right flex flex-col gap-0.5">
                      {!is80Complete ? (
                        <span className="text-amber-600 dark:text-amber-400">%80 için Kalan: {remaining80.toLocaleString('tr-TR')} ₺</span>
                      ) : (
                        <span className="text-green-600 dark:text-green-400">%80 Tamamlandı!</span>
                      )}
                      {!isComplete ? (
                        <span className="text-emerald-600 dark:text-emerald-500">%100 için Kalan: {remaining100.toLocaleString('tr-TR')} ₺</span>
                      ) : (
                        <span className="text-red-500 dark:text-red-400">%100 Tamamlandı!</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
};

const Dashboard = ({ isManagerPanel = false }: { isManagerPanel?: boolean }) => {
  const { personnel: authPersonnel } = useAuth();
  const storageKey = isManagerPanel ? 'manager_dashboard_visibility' : 'admin_dashboard_visibility';
  const queryClient = useQueryClient();
  
  const [visibility, setVisibility] = useState(() => {
    const defaultVis = {
      showTodayShift: true,
      showTomorrowShift: false,
      showActiveBreaks: true,
      showDailyBreaks: true,
      showMovements: true,
      showCargoStatus: true,
      showOvertimes: true,
      showReminders: true,
      showNotifications: true,
      showVardiyaGorseli: true,
      showSalesPerformance: true,
      showQuickActions: true
    };
    
    // First try database
    if (authPersonnel && (authPersonnel as any).module_visibility && (authPersonnel as any).module_visibility[storageKey]) {
       return { ...defaultVis, ...(authPersonnel as any).module_visibility[storageKey] };
    }
    
    // Fallback to local storage
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        return { ...defaultVis, ...JSON.parse(saved) };
      }
    } catch (e) {
      console.error(e);
    }
    return defaultVis;
  });

  const updateVisibilityMutation = useMutation({
    mutationFn: async (newVal: any) => {
      if (!authPersonnel?.id) return;
      const currentVis = (authPersonnel as any).module_visibility || {};
      const updatedVis = {
        ...currentVis,
        [storageKey]: newVal
      };
      
      const { error } = await supabase
        .from('personnel')
        .update({ module_visibility: updatedVis })
        .eq('id', authPersonnel.id);
        
      if (error) throw error;
    }
  });

  const toggleVis = (key: keyof typeof visibility, checked: boolean) => {
    setVisibility(prev => {
      const newVal = { ...prev, [key]: checked };
      localStorage.setItem(storageKey, JSON.stringify(newVal));
      
      // Also save to database
      if (authPersonnel?.id) {
        updateVisibilityMutation.mutate(newVal);
      }
      
      return newVal;
    });
  };

  useEffect(() => {
    const channel = supabase
      .channel('dashboard_realtime_breaks')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'break_records' }, () => {
        queryClient.invalidateQueries({ queryKey: ['admin_dashboard_data'] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  useEffect(() => {
    if (authPersonnel && (authPersonnel as any).module_visibility) {
      const dbVis = (authPersonnel as any).module_visibility[storageKey];
      if (dbVis) {
        setVisibility(prev => {
          const newVal = { ...prev, ...dbVis };
          localStorage.setItem(storageKey, JSON.stringify(newVal));
          return newVal;
        });
      }
    }
  }, [authPersonnel, storageKey]);

  useEffect(() => {
    const cleanupOldBreaks = async () => {
      try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const { data } = await supabase
          .from('break_records')
          .select('id, break_start, break_end')
          .lt('break_start', today.toISOString())
          .not('break_end', 'is', null);

        if (data && data.length > 0) {
          const toDelete = data.filter((b: any) => {
             const start = new Date(b.break_start).getTime();
             const end = new Date(b.break_end).getTime();
             const mins = (end - start) / 60000;
             return mins <= 60; // İhlal değil
          }).map((b: any) => b.id);
          
          if (toDelete.length > 0) {
             await supabase.from('break_records').delete().in('id', toDelete);
             console.log(`${toDelete.length} adet eski temiz mola kaydı silindi.`);
          }
        }
      } catch (err) {
        console.error("Mola temizleme hatası:", err);
      }
    };
    cleanupOldBreaks();
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard_data'],
    initialData: () => {
      try {
        const cached = localStorage.getItem('admin_dashboard_data');
        if (cached) return JSON.parse(cached);
      } catch (e) {}
      return undefined;
    },
    queryFn: async () => {
      const todayDate = new Date();
      const currentDay = todayDate.getDay() || 7;
      const weekStart = new Date(todayDate);
      weekStart.setDate(todayDate.getDate() - currentDay + 1);
      const weekStartStr = format(weekStart, 'yyyy-MM-dd');
      
      const nextWeekStart = new Date(weekStart);
      nextWeekStart.setDate(nextWeekStart.getDate() + 7);
      const week3Start = new Date(nextWeekStart);
      week3Start.setDate(week3Start.getDate() + 7);
      const week4Start = new Date(week3Start);
      week4Start.setDate(week4Start.getDate() + 7);

      const shiftImageKeys = [
        `shift_image_${weekStartStr}`,
        `shift_image_${format(nextWeekStart, 'yyyy-MM-dd')}`,
        `shift_image_${format(week3Start, 'yyyy-MM-dd')}`,
        `shift_image_${format(week4Start, 'yyyy-MM-dd')}`
      ];

      const todayIso = new Date();
      todayIso.setHours(0,0,0,0);
      const todayIsoStr = todayIso.toISOString();
      const ninetyDaysAgoStr = format(new Date(Date.now() - 90*24*60*60*1000), 'yyyy-MM-dd');
      const thirtyDaysAgoStr = format(new Date(Date.now() - 30*24*60*60*1000), 'yyyy-MM-dd');

      const [
        { data: personnel },
        { data: breaks },
        { data: movements },
        { data: dayOffs },
        { data: shipments },
        { data: shiftSchedules },
        { data: reminders },
        { data: salesTargets },
        { data: systemSettingsRaw }
      ] = await Promise.all([
        supabase.from('personnel').select('*').eq('is_active', true),
        supabase.from('break_records').select('*').gte('break_start', todayIsoStr),
        supabase.from('personnel_movements').select('*').gte('end_date', ninetyDaysAgoStr),
        supabase.from('weekly_day_off').select('*').gte('created_at', ninetyDaysAgoStr),
        supabase.from('cargo_shipments').select('*').gte('arrival_date', thirtyDaysAgoStr),
        supabase.from('shift_schedules').select('*').eq('week_start_date', weekStartStr),
        supabase.from('reminders').select('*, responses:reminder_responses(*)').eq('is_active', true),
        supabase.from('sales_targets' as any).select('*').gte('target_month', format(new Date(Date.now() - 90*24*60*60*1000), 'yyyy-MM')),
        supabase.from('system_settings' as any).select('setting_key, setting_value').eq('setting_key', 'last_backup_date')
      ]);
      
      const lastBackup = systemSettingsRaw?.find((s: any) => s.setting_key === 'last_backup_date');
      
      const constructedWeeklySchedule: any[] = [];
      if (personnel && shiftSchedules) {
         const daysTr = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
         personnel.forEach(p => {
             const row: any = {
                 'Ad Soyad': `${p.first_name || ''} ${p.last_name || ''}`.trim(),
                 'Reyon': p.department || 'Diğer',
             };
             const pSchedules = shiftSchedules.filter((s: any) => s.personnel_id === p.id);
             pSchedules.forEach((s: any) => {
                 const dt = new Date(s.shift_date);
                 const dayName = daysTr[dt.getDay()];
                 let val = s.shift_type || '';
                 if (s.task_assignment) {
                     if (s.task_assignment === 'Mutfak' && !val.includes('+M')) val += '+M';
                     if (s.task_assignment === 'Depo' && !val.includes('+D')) val += '+D';
                 }
                 row[dayName] = val;
             });
             constructedWeeklySchedule.push(row);
         });
      }
      
      const resData = { 
        personnel: personnel || [], 
        breaks: breaks || [], 
        movements: movements || [], 
        dayOffs: dayOffs || [], 
        shipments: shipments || [], 
        weeklySchedule: constructedWeeklySchedule,
        reminders: reminders || [],
        salesTargets: salesTargets || [],
        lastBackupDate: lastBackup?.setting_value || null
      };

      try {
        localStorage.setItem('admin_dashboard_data', JSON.stringify(resData));
      } catch (e) {}

      return resData;
    }
  });

  const { data: shiftImages } = useQuery({
    queryKey: ['dashboard_shift_images'],
    queryFn: async () => {
      const todayDate = new Date();
      const currentDay = todayDate.getDay() || 7;
      const weekStart = new Date(todayDate);
      weekStart.setDate(todayDate.getDate() - currentDay + 1);
      const weekStartStr = format(weekStart, 'yyyy-MM-dd');
      
      const nextWeekStart = new Date(weekStart);
      nextWeekStart.setDate(nextWeekStart.getDate() + 7);
      const week3Start = new Date(nextWeekStart);
      week3Start.setDate(week3Start.getDate() + 7);
      const week4Start = new Date(week3Start);
      week4Start.setDate(week4Start.getDate() + 7);

      const shiftImageKeys = [
        `shift_image_${weekStartStr}`,
        `shift_image_${format(nextWeekStart, 'yyyy-MM-dd')}`,
        `shift_image_${format(week3Start, 'yyyy-MM-dd')}`,
        `shift_image_${format(week4Start, 'yyyy-MM-dd')}`
      ];

      const { data: shiftImagesRaw } = await supabase.from('system_settings' as any).select('setting_key, setting_value').in('setting_key', shiftImageKeys);

      return (shiftImagesRaw || []).filter((s:any) => {
        if (!s.setting_value?.image || !s.setting_key) return false;
        const ws = s.setting_key.replace('shift_image_', '');
        const endDate = new Date(ws);
        endDate.setDate(endDate.getDate() + 6);
        const endIsoDate = endDate.toISOString().split('T')[0];
        const todayIsoDate = new Date().toISOString().split('T')[0];
        return todayIsoDate <= endIsoDate;
      }).map((s:any) => s.setting_value.image);
    }
  });

  if (isLoading || !data) {
    return <div className="p-8 text-center text-muted-foreground animate-pulse">Dashboard yükleniyor...</div>;
  }

  const { personnel, breaks, movements, dayOffs, shipments, weeklySchedule, reminders, salesTargets } = data;
  const activePersonnel = personnel.filter(p => p.is_active);
  const onBreakRecords = breaks
    .filter((b: any) => b.break_end === null)
    .sort((a: any, b: any) => new Date(b.break_start).getTime() - new Date(a.break_start).getTime());

  const expiringContracts = activePersonnel.filter(p => {
    if (p.employment_type === 'bayram_part_time' && p.contract_end_date) {
      const end = new Date(p.contract_end_date);
      const today = new Date();
      const diffTime = end.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays === 1 || diffDays === 0;
    }
    return false;
  });

  let showBackupWarning = false;
  if (!isLoading) {
    const today = new Date();
    // Uyarı SADECE her ayın 1'inde gelsin.
    if (today.getDate() === 1) {
      if (!data?.lastBackupDate) {
        showBackupWarning = true;
      } else {
        const lastBackupDate = new Date(data.lastBackupDate);
        if (lastBackupDate.getMonth() !== today.getMonth() || lastBackupDate.getFullYear() !== today.getFullYear()) {
          showBackupWarning = true;
        }
      }
    }
  }

  return (
    <div className="space-y-4 animate-fade-in">
      {showBackupWarning && (
        <div className="bg-red-50 dark:bg-red-950/50 border-l-4 border-red-500 p-4 rounded-r-lg shadow-sm mb-6 flex items-start gap-3">
          <Trash2 className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <h3 className="text-red-800 dark:text-red-300 font-semibold text-sm">Aylık Veri Yedekleme Uyarısı!</h3>
            <p className="text-red-700 dark:text-red-400 text-xs mt-1">
              Bu ay için henüz sistem yedeği alınmamış. Olası bir veri kaybını önlemek ve sistemi hızlandırmak için 
              lütfen <strong className="font-bold cursor-pointer underline" onClick={() => navigate('/admin/settings')}>Sistem Ayarları</strong> menüsünden güncel yedeğinizi alarak eski kayıtları temizleyin.
            </p>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-foreground">Kontrol Paneli</h2>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="ml-auto"><Settings className="w-4 h-4 mr-2" /> Görünüm Seçenekleri</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Hangi kartlar gösterilsin?</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuCheckboxItem checked={visibility.showTodayShift} onCheckedChange={(c) => toggleVis('showTodayShift', c)}>Bugünün Vardiya Özeti</DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem checked={visibility.showTomorrowShift} onCheckedChange={(c) => toggleVis('showTomorrowShift', c)}>Yarının Vardiya Özeti</DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem checked={visibility.showDailyBreaks} onCheckedChange={(c) => toggleVis('showDailyBreaks', c)}>Mola Raporu</DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem checked={visibility.showMovements} onCheckedChange={(c) => toggleVis('showMovements', c)}>Personel Hareketleri</DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem checked={visibility.showCargoStatus} onCheckedChange={(c) => toggleVis('showCargoStatus', c)}>Kargo / Lojistik Durumu</DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem checked={visibility.showSalesPerformance} onCheckedChange={(c) => toggleVis('showSalesPerformance', c)}>Aylık Kota ve Performans</DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem checked={visibility.showOvertimes} onCheckedChange={(c) => toggleVis('showOvertimes', c)}>Fazla Mesailer</DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem checked={visibility.showReminders} onCheckedChange={(c) => toggleVis('showReminders', c)}>Duyurular ve Anketler</DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem checked={visibility.showNotifications} onCheckedChange={(c) => toggleVis('showNotifications', c)}>Bildirimler</DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem checked={visibility.showVardiyaGorseli} onCheckedChange={(c) => toggleVis('showVardiyaGorseli', c)}>Haftalık Vardiya Görseli</DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem checked={visibility.showQuickActions} onCheckedChange={(c) => toggleVis('showQuickActions', c)}>Yönetici Hızlı İşlemler</DropdownMenuCheckboxItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {expiringContracts.length > 0 && (
        <div className="bg-amber-100 border-l-4 border-amber-500 text-amber-900 p-4 mb-4 rounded-r-lg shadow-sm">
          <div className="flex">
            <div className="py-1"><Bell className="h-6 w-6 text-amber-500 mr-4" /></div>
            <div>
              <p className="font-bold">Sözleşmesi Yakında Bitecek Personeller!</p>
              <p className="text-sm">Aşağıdaki Bayram Part Time personellerinin sözleşme bitiş tarihine 1 gün veya daha az kaldı:</p>
              <ul className="list-disc ml-5 mt-1 text-sm font-semibold">
                {expiringContracts.map(p => (
                  <li key={p.id}>{p.first_name} {p.last_name} (Bitiş: {format(new Date(p.contract_end_date), 'dd.MM.yyyy')})</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {visibility.showQuickActions && (
        <div className="col-span-1 md:col-span-2 lg:col-span-3">
          <ManagerQuickActions personnel={{ department: 'Tümü' }} />
        </div>
      )}

      {visibility.showTodayShift && <ShiftCard weeklySchedule={weeklySchedule} breaks={breaks} movements={movements} personnel={activePersonnel} daysOffset={0} />}
      {visibility.showTomorrowShift && <ShiftCard weeklySchedule={weeklySchedule} breaks={breaks} movements={movements} personnel={activePersonnel} daysOffset={1} />}
      {visibility.showDailyBreaks && <DashboardMatrixWrapper />}
      {visibility.showMovements && <MovementsCard movements={movements} personnel={activePersonnel} />}
      {visibility.showCargoStatus && <CargoStatusCard shipments={shipments} />}
      {visibility.showSalesPerformance && <SalesPerformanceCard salesTargets={salesTargets} personnel={personnel} />}
      {visibility.showOvertimes && <OvertimeReceivablesCard personnel={activePersonnel} />}
      {visibility.showReminders && <AnnouncementsCard reminders={reminders} personnel={activePersonnel} />}
      {visibility.showNotifications && <NotificationsCard reminders={reminders} personnel={activePersonnel} />}

      {visibility.showVardiyaGorseli && shiftImages && shiftImages.length > 0 && (
        <div className="mb-8 flex flex-col items-center">
           <div className="w-full flex flex-col shadow-2xl bg-white sm:max-w-[923px]">
               {shiftImages.map((imgUrl: string, idx: number) => (
                   <img key={idx} src={imgUrl} alt={`Vardiya Görseli ${idx + 1}`} className="w-full h-auto object-contain block border-b-4 border-gray-400 last:border-b-0" />
               ))}
           </div>
        </div>
      )}
    </div>
  );
};

const LiveBreakBadge = ({ activeBreak }: { activeBreak: any }) => {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const update = () => {
      const ms = Date.now() - new Date(activeBreak.break_start).getTime();
      setElapsed(Math.floor(ms / 60000));
    };
    update();
    const int = setInterval(update, 60000);
    return () => clearInterval(int);
  }, [activeBreak]);

  const limit = 60;
  const remaining = limit - elapsed;

  if (remaining < 0) {
    return <span className="shrink-0 ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-700 animate-pulse border border-red-200" title="Süre aşıldı!">İhlal Süresi ({Math.abs(remaining)}dk)</span>;
  }

  return <span className="shrink-0 ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 animate-pulse border border-blue-200">Molada ({elapsed}dk, Kalan: {remaining}dk)</span>;
};

const ShiftCard = ({ weeklySchedule, breaks, movements, personnel, daysOffset = 0 }: { weeklySchedule: any, breaks: any, movements: any, personnel: any, daysOffset?: number }) => {
  if (!weeklySchedule || weeklySchedule.length === 0) return null;

  const daysTr = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + daysOffset);
  const targetName = daysTr[targetDate.getDay()];
  const targetDateStr = format(targetDate, 'yyyy-MM-dd');
  const weekStartStr = format(startOfWeek(targetDate, { weekStartsOn: 1 }), 'yyyy-MM-dd');

  const { data: matrixSettings } = useQuery({
    queryKey: ['system_settings_break_planning'],
    queryFn: async () => {
      const { data } = await supabase.from('system_settings' as any).select('setting_value').eq('setting_key', 'break_matrix').maybeSingle();
      return data?.setting_value || { slots: [], departmentGroups: [], rules: [] };
    },
    enabled: daysOffset === 0
  });

  const { data: shiftsData } = useQuery({
    queryKey: ['shift_schedules', weekStartStr],
    queryFn: async () => {
      const { data } = await supabase.from('shift_schedules').select('*').eq('week_start_date', weekStartStr);
      return data || [];
    },
    enabled: daysOffset === 0
  });

  const matrix = useMemo(() => {
    if (daysOffset !== 0 || !matrixSettings || !shiftsData || !personnel) return null;
    return calculateBreakMatrix(personnel, shiftsData, matrixSettings, targetDateStr);
  }, [daysOffset, matrixSettings, shiftsData, personnel, targetDateStr]);

  const formatDisplayName = (fullString: string) => {
    const match = fullString.match(/^(.*?)\s*(\(.*?\))?$/);
    if (!match) return fullString;
    
    let namePart = match[1].trim();
    const suffix = match[2] ? ` ${match[2]}` : '';
    
    const parts = namePart.split(/\s+/);
    if (parts.length >= 3) {
      const firstInitial = parts[0].charAt(0).toLocaleUpperCase('tr-TR') + '.';
      const rest = parts.slice(1).join(' ').toLocaleUpperCase('tr-TR');
      const format1 = `${firstInitial} ${rest}`;
      
      const allInitials = parts.slice(0, parts.length - 1).map(p => p.charAt(0).toLocaleUpperCase('tr-TR') + '.');
      const format2 = `${allInitials.join('')} ${parts[parts.length - 1].toLocaleUpperCase('tr-TR')}`;
      
      if (format1.length <= 20) {
        namePart = format1;
      } else {
        namePart = format2;
      }
    } else {
      namePart = namePart.toLocaleUpperCase('tr-TR');
    }
    return namePart + suffix;
  };

  // structure: { "Erkek Reyonu": { "Sabah": [], "Akşam": [], "İzinli": [] } }
    const shifts: Record<string, any> = {}; 

    weeklySchedule.forEach((row: any) => {
        const adSoyad = row['Ad Soyad']?.toString().trim();
        if (!adSoyad || adSoyad === '----------------' || adSoyad === 'Personel Bulunamadı') return;
        const reyon = row['Reyon']?.toString().trim() || 'Diğer';
        const rawVal = (row[targetName] || '').toString().trim();

        const isDepoRow = reyon.startsWith('Depo (') || reyon === '--- DEPO ÇALIŞMASI ---';
        const isMutfakRow = reyon.startsWith('Mutfak (') || reyon === '--- MUTFAK ÇALIŞMASI ---';

        if (!shifts[adSoyad]) {
            shifts[adSoyad] = { 
                reyon: reyon, 
                shiftVal: '', 
                hasDepo: false, 
                hasMutfak: false,
                category: 'Belirsiz'
            };
        }

        if (!isDepoRow && !isMutfakRow) {
            shifts[adSoyad].reyon = reyon;
            if (rawVal) {
                shifts[adSoyad].shiftVal = rawVal;
                const upVal = rawVal.toUpperCase();
                const cleanVal = upVal.split('+')[0].trim();
                const absences = ['İ', 'I', 'R', 'Yİ', 'Üİ', 'ÜS', 'T', 'Ü', 'M', 'Y', 'Z', 'X', 'D', 'B'];

                if (absences.includes(cleanVal)) shifts[adSoyad].category = 'İzinli';
                else if (cleanVal === 'S' || cleanVal === 'SABAH') shifts[adSoyad].category = 'Sabah';
                else if (cleanVal === 'A' || cleanVal === 'AKŞAM') shifts[adSoyad].category = 'Akşam';
                else {
                    const match = cleanVal.match(/^(\d{1,2})[.:]/);
                    if (match) {
                        const hour = parseInt(match[1], 10);
                        if (hour < 13) shifts[adSoyad].category = 'Sabah';
                        else shifts[adSoyad].category = 'Akşam';
                    } else {
                        shifts[adSoyad].category = 'Diğer';
                    }
                }
                
                if (rawVal.includes('+')) {
                    const rawLower = rawVal.toLowerCase();
                    if (rawLower.includes('depo') || rawLower.includes('+d')) shifts[adSoyad].hasDepo = true;
                    if (rawLower.includes('mutfak') || rawLower.includes('+m')) shifts[adSoyad].hasMutfak = true;
                }
            }
        } else if (isDepoRow) {
            if (rawVal && rawVal !== '-') shifts[adSoyad].hasDepo = true;
        } else if (isMutfakRow) {
            if (rawVal && rawVal !== '-') shifts[adSoyad].hasMutfak = true;
        }
    });

    const grouped: Record<string, Record<string, {name: string, val: string}[]>> = {};

    Object.entries(shifts).forEach(([adSoyad, data]) => {
        if (!data.shiftVal && !data.hasDepo && !data.hasMutfak) return;
        let cat = data.category;
        if (!data.shiftVal && (data.hasDepo || data.hasMutfak)) cat = 'Ek Görev (Sınıflandırılmamış Shift)';
        if (cat === 'Belirsiz') return;

        const finalReyon = data.reyon.replace('Depo (', '').replace('Mutfak (', '').replace(')', '');
        if (!grouped[finalReyon]) grouped[finalReyon] = { 'Sabah': [], 'Akşam': [], 'İzinli': [], 'Diğer': [], 'Ek Görev (Sınıflandırılmamış Shift)': [] };
        if (!grouped[finalReyon][cat]) grouped[finalReyon][cat] = [];
        
        grouped[finalReyon][cat].push({ name: adSoyad, val: data.shiftVal });
    });

  const renderBreakStatus = (pString: string) => {
    if (daysOffset !== 0) return null;
    if (!personnel || !breaks) return null;
    
    const nameOnly = pString.split(' (')[0].split('+')[0].trim().toLocaleLowerCase('tr-TR').replace(/\s+/g, ' ');
    const person = personnel.find((per: any) => 
      `${per.first_name} ${per.last_name}`.trim().toLocaleLowerCase('tr-TR').replace(/\s+/g, ' ') === nameOnly
    );
    
    if (!person) return null;

    // Aktif Mola Kontrolü
    const activeBreak = breaks.find((b: any) => !b.break_end && b.personnel_id === person.id);
    if (activeBreak) {
      return <LiveBreakBadge activeBreak={activeBreak} />;
    }

    // Bugün tamamlanmış molalar
    const today = new Date();
    const todayFinishedBreaks = breaks.filter((b: any) => {
      if (!b.break_start || !b.break_end) return false;
      if (b.personnel_id !== person.id) return false;
      const d = new Date(b.break_start);
      return d.getDate() === today.getDate() && 
             d.getMonth() === today.getMonth() && 
             d.getFullYear() === today.getFullYear();
    });

    if (todayFinishedBreaks.length === 0) return null;

    const violation = todayFinishedBreaks.find((b: any) => {
      const s = new Date(b.break_start);
      const e = new Date(b.break_end);
      const startMins = s.getHours() * 60 + s.getMinutes();
      const endMins = e.getHours() * 60 + e.getMinutes();
      let diff = endMins - startMins;
      if (diff < 0) diff += 24 * 60;
      return diff > 60;
    });

    let totalMins = 0;
    todayFinishedBreaks.forEach((b: any) => {
      const s = new Date(b.break_start);
      const e = new Date(b.break_end);
      const startMins = s.getHours() * 60 + s.getMinutes();
      const endMins = e.getHours() * 60 + e.getMinutes();
      let diff = endMins - startMins;
      if (diff < 0) diff += 24 * 60;
      totalMins += diff;
    });

    if (violation) {
      return <span className="shrink-0 ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-700 border border-red-200">İhlal (Toplam {totalMins} dk)</span>;
    }

    return <span className="shrink-0 ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded bg-green-100 text-green-700 border border-green-200">Mola Bitti ({totalMins} dk)</span>;
  };

  const getMovementBadge = (pString: string) => {
    if (!personnel || !movements) return null;
    
    const nameOnly = pString.split(' (')[0].split('+')[0].trim().toLocaleLowerCase('tr-TR').replace(/\s+/g, ' ');
    const person = personnel.find((per: any) => 
      `${per.first_name} ${per.last_name}`.trim().toLocaleLowerCase('tr-TR').replace(/\s+/g, ' ') === nameOnly
    );
    
    if (!person) return null;

    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + daysOffset);
    const targetStr = targetDate.toISOString().split('T')[0];

    const activeMovement = movements.find((m: any) => {
      if (m.personnel_id !== person.id) return false;
      return m.start_date <= targetStr && m.end_date >= targetStr;
    });

    if (activeMovement) {
      return <span className="shrink-0 ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded bg-warning/20 text-warning border border-warning/30" title="Aktif Hareket">{activeMovement.movement_type}</span>;
    }
    return null;
  };

  return (
    <Card className="glass-card border-primary/20 bg-card">
      <CardHeader className="bg-primary/5 pb-2 pt-3">
        <CardTitle className="flex flex-col gap-1">
          <div className="flex items-center gap-2 text-base">
            <CalendarDays className="h-4 w-4 text-primary" />
            {daysOffset === 0 ? 'Bugünün' : 'Yarının'} Vardiya ve Görev Özeti
          </div>
          <span className="text-sm font-normal text-muted-foreground ml-6">
            {format(targetDate, 'dd MMMM eeee', { locale: tr })}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-3 space-y-3">
        {Object.entries(grouped).map(([reyon, cats]) => (
          <div key={reyon} className="border border-border/50 rounded-md p-2.5 bg-background/30">
            <h3 className="text-sm font-bold text-foreground mb-2 border-b border-border/50 pb-1">🛍️ {reyon}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              
              {['Sabah', 'Akşam', 'İzinli', 'Diğer', 'Ek Görev (Sınıflandırılmamış Shift)'].map((cat) => {
                const list = cats[cat] || [];
                if (list.length === 0) return null;
                const emoji = cat === 'Sabah' ? '☀️' : cat === 'Akşam' ? '🌙' : cat === 'İzinli' ? '⛔' : cat === 'Diğer' ? '📋' : '✨';
                
                return (
                  <div key={cat} className="bg-muted/30 p-2 rounded border border-border/50">
                    <h4 className="font-semibold text-xs mb-1.5 flex items-center gap-1">{emoji} {cat}</h4>
                    <div className="space-y-1">
                      {list.map((person: any, idx: number) => {
                        const isOff = person.val === '-' || person.val.toUpperCase() === 'OFF' || person.val.toUpperCase() === 'IZIN';
                        
                        let assignedSlot = null;
                        if (daysOffset === 0 && matrix) {
                          const pObj = personnel.find((p: any) => `${p.first_name} ${p.last_name}`.trim() === person.name);
                          if (pObj) {
                            assignedSlot = getPersonnelAssignedSlot(matrix, pObj.id);
                          }
                        }

                        let hasStartedBreak = false;
                        if (daysOffset === 0) {
                          const pObj = personnel.find((p: any) => `${p.first_name} ${p.last_name}`.trim() === person.name);
                          if (pObj) {
                            const pBreaks = breaks.filter((b: any) => b.personnel_id === pObj.id && (b.break_start || '').startsWith(targetDateStr));
                            if (pBreaks.length > 0) hasStartedBreak = true;
                          }
                        }

                        return (
                          <div key={idx} className={`p-2 rounded flex justify-between items-center text-xs border ${isOff ? 'bg-red-50/50 border-red-100 dark:bg-red-950/20 dark:border-red-900/30' : 'bg-background border-border/50'}`}>
                            <div className="flex flex-col gap-0.5 max-w-[80%]">
                              <span className={`font-semibold truncate flex items-center gap-1 ${isOff ? 'text-red-700 dark:text-red-400 line-through opacity-70' : 'text-foreground'}`} title={person.name}>
                                {formatDisplayName(person.name)} {getMovementBadge(person.name)}
                              </span>
                              {!isOff && (
                                <span className="text-[10px] text-muted-foreground truncate" title={person.val}>
                                  {person.val}
                                </span>
                              )}
                              {assignedSlot && !hasStartedBreak && !isOff && (
                                <span className="text-[10px] text-blue-600 dark:text-blue-400 font-medium">
                                  ({assignedSlot.timeRange} / Molaya çıkacak)
                                </span>
                              )}
                            </div>
                            {!isOff && daysOffset === 0 && (
                              <div className="shrink-0 flex items-center justify-end">
                                {renderBreakStatus(person.name)}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

            </div>
          </div>
        ))}
        {Object.keys(grouped).length === 0 && (
          <p className="text-muted-foreground text-center py-4">Bugüne ait kayıtlı vardiya/görev planı bulunmuyor.</p>
        )}
      </CardContent>
    </Card>
  );
};

const CargoStatusCard = ({ shipments }: any) => {
  const displayShipments = [...shipments]
    .sort((a: any, b: any) => new Date(b.arrival_date).getTime() - new Date(a.arrival_date).getTime())
    .slice(0, 1);

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5" />
          Aktif Tır / Koli Sevkiyat Durumu
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
          {displayShipments.length === 0 ? (
            <p className="text-muted-foreground text-sm">Bekleyen kargo/koli sevkiyatı yok</p>
          ) : (
            displayShipments.map((s: any) => {
              const remaining = Math.max(0, s.total_boxes - s.counted_boxes);
              const progress = s.total_boxes > 0 ? (s.counted_boxes / s.total_boxes) * 100 : 0;
              const isCompleted = remaining === 0 && s.total_boxes > 0;
              
              return (
                <div key={s.id} className={`p-3 rounded-lg border ${isCompleted ? 'bg-success/10 border-success/20' : 'bg-muted/20'}`}>
                  <div className="flex justify-between items-center mb-2">
                    <p className="font-medium text-sm">
                      {format(new Date(s.arrival_date), 'dd.MM.yyyy')} Sevkiyatı
                    </p>
                    {isCompleted ? (
                      <span className="text-[10px] font-bold px-2 py-1 bg-success/20 text-success rounded uppercase">Tamamlandı</span>
                    ) : (
                      <span className="text-xs font-semibold px-2 py-1 bg-primary/10 text-primary rounded">Kalan: {remaining}</span>
                    )}
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground mb-1">
                    <span>Toplam: {s.total_boxes}</span>
                    <span>Sayılan: {s.counted_boxes}</span>
                  </div>
                  <div className="w-full bg-secondary/20 h-2 rounded-full overflow-hidden">
                    <div className={`h-full transition-all duration-500 ${isCompleted ? 'bg-success' : 'bg-primary'}`} style={{ width: `${progress}%` }}></div>
                  </div>
                  {s.notes && <p className="text-xs text-muted-foreground mt-2 italic">{s.notes}</p>}
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
};

const OvertimeReceivablesCard = ({ personnel }: any) => {
  const { data: overtimes, isLoading } = useQuery({
    queryKey: ['dashboard_overtimes'],
    queryFn: async () => {
      const { data } = await supabase.from('overtime_records').select('personnel_id, hours, record_type');
      return data || [];
    }
  });

  const getPersonnelName = (id: string, withDept=false) => {
    const p = personnel.find((p: any) => p.id === id);
    if (!p) return 'Bilinmiyor';
    return withDept ? `${p.first_name} ${p.last_name} (${p.department})` : `${p.first_name} ${p.last_name}`;
  };

  const balances: Record<string, number> = {};
  if (overtimes) {
    overtimes.forEach((o: any) => {
      const isUsed = (o.record_type || '').toLowerCase().includes('kullanım') || (o.record_type || '').toLowerCase().includes('alacak');
      const h = Number(o.hours || 0);
      if (!balances[o.personnel_id]) balances[o.personnel_id] = 0;
      balances[o.personnel_id] += isUsed ? -h : h;
    });
  }

  const receivables = Object.entries(balances)
    .filter(([_, bal]) => bal > 0)
    .sort((a, b) => b[1] - a[1]); // highest first

  const formatDuration = (totalH: number) => {
    const d = Math.floor(totalH / 8);
    const remH = totalH - (d * 8);
    const h = Math.floor(remH);
    const m = Math.round((remH - h) * 60);
    const parts = [];
    if (d > 0) parts.push(`${d} G`);
    if (h > 0) parts.push(`${h} S`);
    if (m > 0) parts.push(`${m} Dk`);
    return parts.length > 0 ? parts.join(' ') : '0';
  };

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-5 w-5" />
          Fazla Mesai Alacak Listesi
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center p-4"><span className="animate-pulse text-muted-foreground font-semibold">Hesaplanıyor...</span></div>
        ) : (
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {receivables.length === 0 ? (
              <p className="text-muted-foreground text-sm">Alacaklı personel bulunmuyor</p>
            ) : (
              receivables.map(([pId, bal]) => (
                <div key={pId} className="flex items-center justify-between p-2 rounded-lg bg-muted/50 border">
                  <div>
                    <p className="font-medium text-sm">{getPersonnelName(pId, true)}</p>
                  </div>
                  <div className="text-xs font-semibold px-2 py-1 rounded bg-success/20 text-success">
                    {formatDuration(bal)}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

const BreaksCard = ({ breaks, personnel, weeklySchedule }: any) => {
  const getPersonnelName = (id: string) => {
    const p = personnel.find((p: any) => p.id === id);
    return p ? `${p.first_name} ${p.last_name}` : 'Bilinmiyor';
  };

  const getShift = (id: string) => {
    const p = personnel.find((p: any) => p.id === id);
    if (!p || !weeklySchedule) return null;
    const name = `${p.first_name} ${p.last_name}`.trim();
    const row = weeklySchedule.find((r: any) => r['Ad Soyad'] === name);
    if (!row) return null;
    const daysTr = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
    const todayName = daysTr[new Date().getDay()];
    return row[todayName];
  };

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Molada Olanlar
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {breaks.length === 0 ? (
            <p className="text-muted-foreground text-sm">Şu anda molada olan yok</p>
          ) : (
            breaks.map((b: any) => {
              const startTime = new Date(b.break_start);
              const duration = Math.round((new Date().getTime() - startTime.getTime()) / (1000 * 60));
              return (
                <div key={b.id} className="flex items-center justify-between p-2 rounded-lg bg-info/10 border border-info/20">
                  <div>
                    <p className="font-medium text-sm">
                      {getPersonnelName(b.personnel_id)}
                      {(() => {
                        const shift = getShift(b.personnel_id);
                        return shift ? <span className="text-xs text-muted-foreground ml-1">({shift})</span> : null;
                      })()}
                    </p>
                    <p className="text-xs text-muted-foreground">{format(startTime, 'HH:mm', { locale: tr })}</p>
                  </div>
                  <div className={`text-xs font-semibold px-2 py-1 rounded ${duration > 60 ? 'bg-warning/20 text-warning' : 'bg-info/20 text-info'}`}>
                    {duration} dk
                  </div>
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
};

const MovementsCard = ({ movements, personnel }: any) => {
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  const getPersonnelName = (id: string) => {
    const p = personnel.find((p: any) => p.id === id);
    return p ? `${p.first_name} ${p.last_name}` : 'Bilinmiyor';
  };

  const availableMonths = useMemo(() => {
    const keys = new Set<string>();
    const d = new Date();
    keys.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    
    movements.forEach((m: any) => {
      if (m.start_date) {
        const ms = new Date(m.start_date);
        keys.add(`${ms.getFullYear()}-${String(ms.getMonth() + 1).padStart(2, '0')}`);
      }
    });
    
    return Array.from(keys).sort().reverse();
  }, [movements]);

  const filteredMovements = movements.filter((m: any) => {
    const mStart = new Date(m.start_date);
    const mEnd = new Date(m.end_date);
    
    const [yearStr, monthStr] = selectedMonth.split('-');
    const targetYear = parseInt(yearStr, 10);
    const targetMonthIndex = parseInt(monthStr, 10) - 1;
    
    const targetMonthStart = new Date(targetYear, targetMonthIndex, 1);
    const targetMonthEnd = new Date(targetYear, targetMonthIndex + 1, 0, 23, 59, 59, 999);
    
    return mStart <= targetMonthEnd && mEnd >= targetMonthStart;
  });

  const formatMonthLabel = (key: string) => {
    const [y, m] = key.split('-');
    const date = new Date(parseInt(y, 10), parseInt(m, 10) - 1, 1);
    return format(date, 'MMMM yyyy', { locale: tr });
  };

  return (
    <Card className="glass-card">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="flex items-center gap-2">
          <MapPin className="h-5 w-5" />
          Personel Hareketleri
        </CardTitle>
        <Select value={selectedMonth} onValueChange={setSelectedMonth}>
          <SelectTrigger className="w-[150px] h-8 text-xs bg-background/50">
            <SelectValue placeholder="Ay Seçin" />
          </SelectTrigger>
          <SelectContent>
            {availableMonths.map(mKey => (
              <SelectItem key={mKey} value={mKey}>{formatMonthLabel(mKey)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-80 overflow-y-auto pr-1">
          {filteredMovements.length === 0 ? (
            <p className="text-muted-foreground col-span-full">Bu ay için hareket bulunamadı</p>
          ) : (
            filteredMovements.map((m: any) => {
              const startDate = new Date(m.start_date);
              const endDate = new Date(m.end_date);
              const now = new Date().getTime();
              const isActive = startDate.getTime() <= now && endDate.getTime() >= now - 86400000;
              
              return (
                <div key={m.id} className={`p-3 rounded-lg border ${isActive ? 'bg-warning/10 border-warning/20' : 'bg-background/40 border-border/40'}`}>
                  <div className="flex justify-between items-start">
                    <p className="font-medium text-sm">{getPersonnelName(m.personnel_id)}</p>
                    {isActive && <span className="text-[10px] bg-warning/20 text-warning px-1.5 py-0.5 rounded font-bold uppercase">Aktif</span>}
                  </div>
                  <p className={`text-xs font-semibold mt-1 ${isActive ? 'text-warning' : 'text-foreground'}`}>{m.movement_type}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {format(startDate, 'dd.MM', { locale: tr })} - {format(endDate, 'dd.MM.yyyy', { locale: tr })}
                  </p>
                  <p className="text-xs text-muted-foreground">{m.total_days} gün</p>
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
};

const DashboardMatrixWrapper = () => {
  const { data: dbSettings } = useQuery({
    queryKey: ['system_settings_break_planning'],
    queryFn: async () => {
      const { data } = await supabase.from('system_settings' as any).select('setting_value').eq('setting_key', 'break_matrix').maybeSingle();
      return data?.setting_value || {
        slots: [],
        departmentGroups: [],
        rules: []
      };
    }
  });

  if (!dbSettings) return <div className="p-4 text-center animate-pulse">Mola matrisi yükleniyor...</div>;

  return (
    <div className="mt-6 mb-6">
      <MatrixTab settings={dbSettings} />
    </div>
  );
};

const AnnouncementsCard = ({ reminders, personnel }: any) => {
  const announcements = reminders.filter((r: any) => r.display_type !== 'hidden');

  const getTargetPersonnel = (r: any, allPersonnel: any[]) => {
    let targets = allPersonnel.filter(p => p.is_active);
    if (r.personnel_id) {
      targets = targets.filter(p => p.id === r.personnel_id);
    } else if (r.department_name && r.department_name !== 'all') {
      if (r.department_name === 'all_except_managers') {
        targets = targets.filter(p => !p.department?.toLowerCase().includes('müdür') && !p.department?.toLowerCase().includes('yönetim'));
      } else {
        targets = targets.filter(p => p.department === r.department_name);
      }
    }
    if (r.target_gender && r.target_gender !== 'none') {
      targets = targets.filter(p => p.gender === r.target_gender);
    }
    if (r.target_employment_type && r.target_employment_type !== 'none') {
      targets = targets.filter(p => p.employment_type === r.target_employment_type);
    }
    return targets;
  };

  const exportSurveyToExcel = async (survey: any) => {
    try {
      const responses = survey.responses || [];
      const targets = getTargetPersonnel(survey, personnel);

      // 1. All Responses Sheet
      const responsesData = responses.map((resp: any) => {
        const p = personnel.find((per: any) => per.id === resp.personnel_id);
        return {
          'Ad Soyad': p ? `${p.first_name} ${p.last_name}` : 'Bilinmiyor',
          'Departman': p ? p.department : '-',
          'Tarih': resp.response_date,
          'Seçilen Durum': resp.status,
          'Açıklama / Not': resp.notes || '-'
        };
      });

      // 2. Summary Sheet (Pivot)
      const summaryMap: any = {};
      targets.forEach((p: any) => {
        summaryMap[p.id] = {
          'Ad Soyad': `${p.first_name} ${p.last_name}`,
          'Departman': p.department
        };
      });

      responses.forEach((resp: any) => {
        if (!summaryMap[resp.personnel_id]) return;
        const statusName = resp.status;
        if (!summaryMap[resp.personnel_id][statusName]) {
          summaryMap[resp.personnel_id][statusName] = 0;
        }
        summaryMap[resp.personnel_id][statusName]++;
      });

      const summaryData = Object.values(summaryMap);
      
      const XLSX = await import('xlsx');
      const wb = XLSX.utils.book_new();
      
      const wsResponses = XLSX.utils.json_to_sheet(responsesData.length > 0 ? responsesData : [{ 'Bilgi': 'Henüz yanıt yok' }]);
      XLSX.utils.book_append_sheet(wb, wsResponses, "Tüm Yanıtlar");

      const wsSummary = XLSX.utils.json_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(wb, wsSummary, "Kişi Bazlı Özet");

      XLSX.writeFile(wb, `Anket_Raporu_${survey.title}_${format(new Date(), 'dd_MM_yyyy')}.xlsx`);
      toast.success("Excel raporu başarıyla indirildi");
    } catch (e: any) {
      toast.error("Excel oluşturulurken hata: " + e.message);
    }
  };

  return (
    <Card className="glass-card mb-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Aktif Duyurular ve Anketler
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1">
          {announcements.length === 0 ? (
             <p className="text-muted-foreground text-sm">Şu anda aktif duyuru veya anket bulunmuyor</p>
          ) : (
            announcements.map((r: any) => {
              const targets = getTargetPersonnel(r, personnel);
              const responses = r.responses || [];
              const respondedPersonnelIds = responses.map((resp: any) => resp.personnel_id);
              const notResponded = targets.filter((p: any) => !respondedPersonnelIds.includes(p.id));
              
              // Count statuses
              const statusCounts = responses.reduce((acc: any, curr: any) => {
                acc[curr.status] = (acc[curr.status] || 0) + 1;
                return acc;
              }, {});

              return (
                <div key={r.id} className="p-4 rounded-lg border bg-muted/20 flex flex-col gap-3">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <p className="font-bold text-base text-foreground leading-tight">{r.title}</p>
                      {r.description && <p className="text-sm font-medium text-foreground/80 mt-1.5">{r.description}</p>}
                      
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {r.is_survey && <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-100">Anket / Görev</span>}
                        {r.personnel_id ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-100">
                            Kişi: {personnel.find((p:any) => p.id === r.personnel_id)?.first_name} {personnel.find((p:any) => p.id === r.personnel_id)?.last_name}
                          </span>
                        ) : r.department_name ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-100">
                            Hedef: {r.department_name === 'all' ? 'Tüm Personel' : r.department_name === 'all_except_managers' ? 'Müdür Hariç Tümü' : r.department_name}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    {r.is_survey && (
                      <Button variant="outline" size="sm" onClick={() => exportSurveyToExcel(r)} className="ml-4 shrink-0 text-green-600 border-green-200 hover:bg-green-50" title="Aylık Rapor İndir (Excel)">
                        <Download className="h-4 w-4 mr-1" />
                        Excel
                      </Button>
                    )}
                  </div>

                  {/* Survey Details Section */}
                  {r.is_survey && (
                    <div className="mt-2 pt-3 border-t grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Results Summary */}
                      <div className="bg-background rounded p-3 border">
                        <p className="text-xs font-bold mb-2 uppercase text-muted-foreground">Anket Sonuçları</p>
                        {responses.length === 0 ? (
                          <p className="text-xs text-muted-foreground">Henüz yanıt yok.</p>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {Object.entries(statusCounts).map(([status, count]: [string, any]) => (
                              <Badge key={status} variant="secondary" className="text-xs">
                                {status}: {count}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="bg-background rounded p-3 border">
                        <p className="text-xs font-bold mb-2 uppercase text-muted-foreground">Dönüş Yapanlar ({responses.length})</p>
                        <div className="max-h-24 overflow-y-auto space-y-1">
                          {responses.length === 0 ? (
                            <p className="text-xs text-muted-foreground">Henüz dönüş yapan olmadı.</p>
                          ) : (
                            responses.map((resp: any) => {
                              const p = personnel.find((per: any) => per.id === resp.personnel_id);
                              return (
                                <div key={resp.id} className="text-xs flex justify-between border-b pb-1 last:border-0">
                                  <span>{p ? `${p.first_name} ${p.last_name}` : 'Bilinmiyor'}</span>
                                  <span className="font-semibold text-primary">{resp.status}</span>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>

                      <div className="bg-background rounded p-3 border md:col-span-2">
                        <p className="text-xs font-bold mb-2 uppercase text-muted-foreground">Dönüş Yapmayanlar ({notResponded.length})</p>
                        <div className="max-h-24 overflow-y-auto">
                          {notResponded.length === 0 ? (
                            <p className="text-xs text-green-600 dark:text-green-400 font-semibold">Tüm hedef kitle anketi yanıtladı!</p>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {notResponded.map((p: any) => (
                                <Badge key={p.id} variant="outline" className="text-[10px] text-muted-foreground">
                                  {p.first_name} {p.last_name}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
};

const NotificationsCard = ({ reminders, personnel }: any) => {
  const queryClient = useQueryClient();
  const notifications = reminders.filter((r: any) => r.display_type === 'hidden');

  const handlePushNow = async (reminder: any) => {
    toast.info('Sadece Web Push bildirimi tetikleniyor...');
    try {
      const { data, error } = await supabase.functions.invoke('send-push', {
        body: {
          personnel_id: reminder.personnel_id,
          department_name: reminder.department_name,
          title: reminder.title,
          body: reminder.description,
          custom_filters: {
            target_gender: reminder.target_gender,
            target_employment_type: reminder.target_employment_type
          },
          send_to_telegram: false,
          force_push_only: true,
          force_telegram_only: false
        }
      });
      if (error) throw error;
      
      toast.success(`Bildirim gönderildi! (${data?.sent || 0} web push ulaştı)`);
      
      // Update the DB to tag it as sent
      if (!reminder.title.includes('(Gönderildi)')) {
        await supabase.from('reminders').update({ title: reminder.title + ' (Gönderildi)' }).eq('id', reminder.id);
        queryClient.invalidateQueries({ queryKey: ['dashboardData'] });
      }
    } catch (e: any) {
      toast.error('Bildirim gönderilemedi: ' + e.message);
    }
  };

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Send className="h-5 w-5" />
          Bildirimler
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
          {notifications.length === 0 ? (
             <p className="text-muted-foreground text-sm">Şu anda aktif bildirim bulunmuyor</p>
          ) : (
            notifications.map((r: any) => {
              const isSent = r.title.includes('(Gönderildi)');
              return (
                <div key={r.id} className={`p-3 rounded-lg border flex justify-between items-start transition-colors ${isSent ? 'bg-emerald-50/50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800' : 'bg-muted/20'}`}>
                  <div className="flex-1">
                    <p className={`font-bold text-base leading-tight ${isSent ? 'text-emerald-800 dark:text-emerald-300' : 'text-foreground'}`}>{r.title}</p>
                    {r.description && <p className="text-sm font-medium mt-1.5 opacity-80">{r.description}</p>}
                    
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {r.personnel_id ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-100">
                          Kişi: {personnel.find((p:any) => p.id === r.personnel_id)?.first_name} {personnel.find((p:any) => p.id === r.personnel_id)?.last_name}
                        </span>
                      ) : r.department_name ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-100">
                          Hedef: {r.department_name === 'all' ? 'Tüm Personel' : r.department_name === 'all_except_managers' ? 'Müdür Hariç Tümü' : r.department_name}
                        </span>
                      ) : null}

                      {r.target_time && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-100 flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {r.target_time}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0 ml-4 flex-wrap justify-end">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => handlePushNow(r)} 
                      className={`gap-1 ${isSent ? 'text-emerald-600 border-emerald-200 hover:bg-emerald-100' : 'text-orange-500 border-orange-200 hover:bg-orange-100'}`}
                    >
                      {isSent ? <CheckCircle2 className="h-4 w-4" /> : <Send className="h-4 w-4" />}
                      {isSent ? 'Tekrar Gönder' : 'Gönder'}
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default Dashboard;

