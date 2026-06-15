import { useEffect, useState, useMemo, lazy, Suspense } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabaseAnon as supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { MapPin, CalendarDays, Umbrella, Coffee, ImagePlus, UserCheck, Timer, Calendar, Info, Clock, Activity, Target, LogOut, Bell, Package, Plus, Minus, Truck, Trash2, Settings, RefreshCw, Smartphone, AlertTriangle } from "lucide-react";
import { format, startOfWeek } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { requestNotificationPermission, subscribeUserToPush } from '@/utils/pushSubscription';
import { calculateDistance } from '@/lib/geoUtils';
import { ShiftSwapSection } from '@/components/employee/ShiftSwapSection';

const retryLazy = (componentImport: () => Promise<any>) => {
  return lazy(async () => {
    try {
      return await componentImport();
    } catch (error) {
      console.error("Chunk load error in EmployeePanel, forcing reload...", error);
      window.location.href = window.location.href.split('?')[0] + '?t=' + new Date().getTime();
      return { default: () => <div className="min-h-screen flex items-center justify-center">Sürüm güncelleniyor, lütfen bekleyin...</div> };
    }
  });
};

const AdminDashboard = retryLazy(() => import('@/pages/admin/Dashboard'));
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { calculateEntitlement, calculateUsedLeave } from '@/lib/leaveUtils';
import DailyBreakTracker from '@/components/employee/DailyBreakTracker';

import { differenceInYears, differenceInMonths, differenceInDays, addYears, addMonths } from 'date-fns';
import { calculateBreakMatrix, getPersonnelAssignedSlot, checkBreakViolation } from '@/lib/breakMatrixUtils';

const DAYS = ['', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];

const calculateWorkDuration = (startDate: string | null | undefined) => {
  if (!startDate) return { years: 0, months: 0, days: 0, totalDays: 0 };
  const start = new Date(startDate);
  if (isNaN(start.getTime())) return { years: 0, months: 0, days: 0, totalDays: 0 };
  start.setHours(0, 0, 0, 0);
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const diffMs = now.getTime() - start.getTime();
  const totalDays = Math.max(0, Math.round(diffMs / (1000 * 60 * 60 * 24)) + 1);

  if (totalDays === 0) return { years: 0, months: 0, days: 0, totalDays: 0 };

  const years = differenceInYears(now, start);
  const dateAfterYears = addYears(start, years);
  const months = differenceInMonths(now, dateAfterYears);
  const dateAfterMonths = addMonths(dateAfterYears, months);
  const days = differenceInDays(now, dateAfterMonths) + 1;

  return { years, months, days, totalDays };
};

function getEmployeeStatus(personnel: any, shiftRaw: string, myTodayShift: any) {
  const isOff = !shiftRaw || shiftRaw === '-' || shiftRaw.toUpperCase() === 'OFF' || shiftRaw.toUpperCase() === 'IZIN';
  return { statusLabel: isOff ? 'İzinli' : 'Mağazada' };
}

const EmployeePanel = () => {
  const { user, signOut, isAdmin } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [, setTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 60000);
    return () => clearInterval(interval);
  }, []);

  const [dayOffDescription, setDayOffDescription] = useState('');
  const [shiftPrefDay, setShiftPrefDay] = useState('');
  const [shiftPrefTime, setShiftPrefTime] = useState('sabah');
  const [shiftPrefDescription, setShiftPrefDescription] = useState('');
  const [isLogisticsOpen, setIsLogisticsOpen] = useState(false);
  const [logisticsForm, setLogisticsForm] = useState({
    shipment_date: new Date().toISOString().split('T')[0],
    company_name: '',
    content_description: '',
    tracking_number: ''
  });
  const [surveyNotes, setSurveyNotes] = useState<{[key: string]: string}>({});
  const [selectedSalesMonth, setSelectedSalesMonth] = useState(new Date().toISOString().substring(0, 7));
  
  const [closedReminders, setClosedReminders] = useState<string[]>(() => {
    try {
      const stored = sessionStorage.getItem('viewed_reminders');
      return stored ? JSON.parse(stored) : [];
    } catch { return []; }
  });

  useEffect(() => {
    if (!user) navigate('/login');
  }, [user, navigate]);

  const { data: personnel, isLoading: loadingPersonnel, isError: isPersonnelError, error: personnelError } = useQuery({
    queryKey: ['personnel', user?.id],
    initialData: () => {
      if (!user?.id) return undefined;
      try {
        const stored = localStorage.getItem(`personnel_${user.id}`);
        return stored ? JSON.parse(stored) : undefined;
      } catch { return undefined; }
    },
    queryFn: async () => {
      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Supabase request timeout')), 5000));
      const queryPromise = supabase.from('personnel').select('*').eq('id', user?.id).maybeSingle();
      
      const res = await Promise.race([queryPromise, timeoutPromise]) as any;
      const { data, error } = res;
      
      if (error) {
        console.error("EmployeePanel personnel fetch error:", error);
        throw error;
      }
      
      if (!data && isAdmin) {
        const adminData = {
          id: user?.id || 'admin',
          first_name: user?.user_metadata?.display_name || 'Admin',
          last_name: 'Yönetici',
          department: 'Yönetim',
          role: 'admin',
          is_active: true,
          gender: 'erkek',
          start_date: new Date().toISOString()
        };
        localStorage.setItem(`personnel_${user?.id}`, JSON.stringify(adminData));
        return adminData;
      }
      
      if (data) {
        localStorage.setItem(`personnel_${user?.id}`, JSON.stringify(data));
      }
      return data;
    },
    enabled: !!user?.id
  });

  useEffect(() => {
    if (personnel?.id) {
      setTimeout(async () => {
        try {
          const permitted = await requestNotificationPermission();
          if (permitted) {
            await subscribeUserToPush(personnel.id);
          }
        } catch (err) {
          console.error('Push error:', err);
        }
      }, 3000);
    }
  }, [personnel?.id]);

  useEffect(() => {
    if (!personnel?.id) return;
    const channel = supabase
      .channel(`employee_realtime_${personnel.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'break_records' }, () => {
        queryClient.invalidateQueries({ queryKey: ['employee_dashboard'] });
        queryClient.invalidateQueries({ queryKey: ['employee_break_matrix'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'personnel_movements' }, () => {
        queryClient.invalidateQueries({ queryKey: ['employee_dashboard'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'personnel', filter: `id=eq.${personnel.id}` }, () => {
        queryClient.invalidateQueries({ queryKey: ['employee_personnel'] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [personnel?.id, queryClient]);

  if (isPersonnelError) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="glass-card max-w-md w-full text-center">
          <CardContent className="p-8">
            <p className="text-destructive mb-4 font-semibold">Sistem bağlantı hatası oluştu.</p>
            <p className="text-muted-foreground text-sm mb-6">Sunucuya ulaşılamıyor veya işlem zaman aşımına uğradı. {(personnelError as Error)?.message}</p>
            <Button variant="outline" onClick={() => window.location.reload()}><RefreshCw className="w-4 h-4 mr-2" /> Tekrar Dene</Button>
            <Button variant="ghost" className="mt-4 w-full" onClick={handleSignOut}><LogOut className="w-4 h-4 mr-2" /> Çıkış Yap</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { data: generalSettings } = useQuery({
    queryKey: ['general_settings'],
    queryFn: async () => {
      const { data } = await supabase.from('system_settings' as any).select('setting_value').eq('setting_key', 'general').single();
      return data?.setting_value || {};
    }
  });

  const breakLimit = Number(generalSettings?.breakLimitMinutes || 60);
  const announcementImages = generalSettings?.announcementImages || [];
  const geofenceConfig = generalSettings?.geofence || { isActive: false, lat: 0, lng: 0, radius: 100 };
  const baseFeatures = generalSettings?.employeeDashboardFeatures || {
    showOvertime: true,
    showBreakViolations: true,
    showLeaveStatus: true,
    showWeeklyDayOff: true,
    showSalesTargets: true,
    showMovements: true,
    showReminders: true,
    showCargoStatus: true,
    showShiftTracking: true,
    showShiftVisuals: true,
    showActiveBreaks: true,
    showShiftSwaps: true,
  };

  const pVis = (personnel as any)?.module_visibility || {};
  
  const features = {
    showBreak: pVis.showBreak ?? true,
    showOvertime: pVis.showOvertime ?? baseFeatures.showOvertime ?? true,
    showBreakViolations: pVis.showBreak ?? baseFeatures.showBreakViolations ?? true,
    showLeaveStatus: pVis.showLeave ?? baseFeatures.showLeaveStatus ?? true,
    showWeeklyDayOff: pVis.showLeave ?? baseFeatures.showWeeklyDayOff ?? baseFeatures.showLeaveStatus ?? true,
    showSalesTargets: pVis.showSales ?? baseFeatures.showSalesTargets ?? true,
    showMovements: pVis.showMovements ?? baseFeatures.showMovements ?? true,
    showReminders: pVis.showAnnouncements ?? baseFeatures.showReminders ?? true,
    showCargoStatus: pVis.showCargo ?? baseFeatures.showCargoStatus ?? true,
    showLogistics: pVis.showLogistics ?? true,
    showShiftTracking: pVis.showShiftTracking ?? baseFeatures.showShiftTracking ?? true,
    showShiftVisuals: pVis.showShiftVisuals ?? baseFeatures.showShiftVisuals ?? true,
    showActiveBreaks: pVis.showActiveBreaks ?? baseFeatures.showActiveBreaks ?? true,
    showShiftSwaps: pVis.showShiftSwaps ?? baseFeatures.showShiftSwaps ?? true,
  };

  const isManager = personnel?.department?.toLowerCase().includes('müdür');

  const getCachedDashboardData = (id: string | undefined) => {
    if (!id) return undefined;
    try {
      const cached = localStorage.getItem(`dashboard_${id}`);
      if (cached) return JSON.parse(cached);
    } catch (e) {}
    return undefined;
  };

  const { data: shiftImages } = useQuery({
    queryKey: ['shift_images'],
    queryFn: async () => {
      const todayDate = new Date();
      let currentDay = todayDate.getDay();
      if (currentDay === 0) currentDay = 7;
      
      const weekStart = new Date(todayDate);
      weekStart.setDate(todayDate.getDate() - currentDay + 1);
      const weekStartStr = format(weekStart, 'yyyy-MM-dd');
      
      const nextWeekStart = new Date(weekStart);
      nextWeekStart.setDate(nextWeekStart.getDate() + 7);
      const nextWeekStartStr = format(nextWeekStart, 'yyyy-MM-dd');

      const keys = [`shift_image_${weekStartStr}`, `shift_image_${nextWeekStartStr}`];
      
      const { data } = await supabase.from('system_settings' as any)
          .select('setting_value')
          .in('setting_key', keys);
          
      return (data || [])
          .map((item: any) => item.setting_value?.image)
          .filter(Boolean);
    }
  });

  const { data: dashboardData, isLoading: loadingData } = useQuery({
    queryKey: ['employee_dashboard', personnel?.id],
    initialData: () => getCachedDashboardData(personnel?.id),
    queryFn: async (): Promise<any> => {
      if (!personnel?.id) return null;
      const currentMonth = new Date().toISOString().substring(0, 7);
      const lastMonthDate = new Date();
      lastMonthDate.setMonth(lastMonthDate.getMonth() - 1);
      const lastMonthStr = lastMonthDate.toISOString().substring(0, 7);
      const thirtyDaysAgoStr = format(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd');
      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Supabase request timeout')), 10000));
      const queriesPromise = Promise.all([
        supabase.from('weekly_day_off').select('id, personnel_id, day_of_week, status, admin_response, created_at, description').eq('personnel_id', personnel.id).order('created_at', { ascending: false }).limit(20),
        supabase.from('break_records').select('id, personnel_id, break_start, break_end').eq('personnel_id', personnel.id).order('break_start', { ascending: false }).limit(20),
        supabase.from('overtime_records').select('*').eq('personnel_id', personnel.id).order('record_date', { ascending: false }),
        supabase.from('personnel_movements').select('*').eq('personnel_id', personnel.id).order('start_date', { ascending: false }),
        supabase.from('reminders').select('*').eq('is_active', true).order('id', { ascending: false }) as any,
        supabase.from('sales_targets' as any).select('*, personnel!inner(department)').eq('personnel.department', personnel.department || 'Bilinmiyor').in('target_month', [currentMonth, lastMonthStr]) as any,
        supabase.from('cargo_shipments' as any).select('*').gte('arrival_date', thirtyDaysAgoStr).order('arrival_date', { ascending: true }),
        supabase.from('logistics_records' as any).select('*').gte('shipment_date', thirtyDaysAgoStr).order('shipment_date', { ascending: false }),
        supabase.from('cargo_companies' as any).select('*').order('created_at', { ascending: true }),
        supabase.from('shift_preferences' as any).select('*').eq('personnel_id', personnel.id).maybeSingle()
      ]);

      const [
        { data: weeklyDayOffs },
        { data: breaks },
        { data: overtimes },
        { data: movements },
        { data: reminders },
        { data: allDepartmentSalesTargets },
        { data: shipments },
        { data: logistics },
        { data: cargoCompanies },
        { data: shiftPreference }
      ] = await Promise.race([queriesPromise, timeoutPromise]) as any;

      const todayDate = new Date();
      const currentDay = todayDate.getDay() || 7;
      const weekStart = new Date(todayDate);
      weekStart.setDate(todayDate.getDate() - currentDay + 1);
      const weekStartStr = format(weekStart, 'yyyy-MM-dd');
      
      const [
        { data: responses },
        { data: settingsData },
        { data: allPersonnel },
        { data: shiftSchedules }
      ] = await Promise.all([
        supabase.from('reminder_responses' as any).select('*')
          .eq('personnel_id', personnel.id)
          .order('response_date', { ascending: false }),
        supabase.from('system_settings' as any).select('setting_value').eq('setting_key', 'general').single(),
        supabase.from('personnel' as any).select('id, first_name, last_name, department, is_active, role, module_visibility'),
        supabase.from('shift_schedules' as any).select('*').eq('week_start_date', weekStartStr)
      ]);
      
      const taskStatuses = settingsData?.setting_value?.taskStatuses || ['Yapıldı', 'Yapılmadı', 'Beklemede', 'Okudum & Anladım'];
      
      const constructedWeeklySchedule: any[] = [];
      if (allPersonnel && shiftSchedules) {
         const daysTr = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
         allPersonnel.forEach((p: any) => {
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
      const weeklySchedule = constructedWeeklySchedule;
      
      const { data: deptCoworkers } = await supabase.from('personnel' as any).select('*').eq('department', personnel.department || 'Bilinmiyor');
      const coworkerIds = (deptCoworkers || []).map((c: any) => c.id);
      
      const todayIsoDate = new Date().toISOString().split('T')[0];
      const [
         { data: colleagueBreaks },
         { data: colleagueMovements },
         { data: colleagueDayOffs },
         { data: genderRules }
      ] = await Promise.all([
         supabase.from('break_records' as any).select('*, personnel(first_name, last_name, department)').gte('break_start', todayIsoDate),
         coworkerIds.length > 0 ? supabase.from('personnel_movements' as any).select('*').in('personnel_id', coworkerIds).or(`end_date.is.null,end_date.gte.${todayIsoDate}`).order('start_date', { ascending: false }) : { data: [] },
         coworkerIds.length > 0 ? supabase.from('weekly_day_off' as any).select('*').in('personnel_id', coworkerIds) : { data: [] },
         supabase.from('shift_gender_rules' as any).select('*')
      ]);
      const today = new Date();
      const todayDayOfWeek = today.getDay();
      const todayDateOfMonth = today.getDate();

      const activeBreak = (breaks || []).find((b: any) => !b.break_end);
      const myTodayShift = (shiftSchedules || []).find((s: any) => s.personnel_id === personnel.id && s.shift_date === todayIsoDate);
      const currentTimeStr = format(new Date(), 'HH:mm');

      const visibleReminders = (reminders || []).filter((rem: any) => {
        let isTarget = false;
        if (rem.personnel_id) {
           isTarget = rem.personnel_id === personnel.id;
        } else if (rem.department_name) {
           if (rem.department_name === 'Tümü' || rem.department_name === 'all') isTarget = true;
           else if (rem.department_name === 'Müdür Hariç Tümü' || rem.department_name === 'all_except_managers') {
              const isManager = (personnel.department || '').toLowerCase().includes('müdür');
              isTarget = !isManager;
           } else {
              isTarget = personnel.department === rem.department_name;
           }
        } else {
           isTarget = true;
        }
        
        if (!isTarget) return false;

        if (rem.display_type === 'hidden' && !rem.is_survey) return false;
  
        if (rem.target_date && todayIsoDate !== rem.target_date && rem.recurrence === 'none' && !rem.is_survey) {
           return false;
        }

        if (rem.target_gender && rem.target_gender !== 'none' && personnel.gender !== rem.target_gender) return false;
        if (rem.target_employment_type && rem.target_employment_type !== 'none' && personnel.employment_type !== rem.target_employment_type) return false;
        
        if (rem.target_break_status && rem.target_break_status !== 'none') {
           if (rem.target_break_status === 'on_break' && !activeBreak) return false;
           if (rem.target_break_status === 'not_on_break' && activeBreak) return false;
        }

        if (rem.target_shift && rem.target_shift !== 'none') {
           if (!myTodayShift || myTodayShift.shift_type !== rem.target_shift) return false;
        }

        if (rem.target_task && rem.target_task !== 'none') {
           if (!myTodayShift || myTodayShift.task_assignment !== rem.target_task) return false;
        }
        
        if (rem.target_time && currentTimeStr < rem.target_time) {
           return false;
        }

        if (rem.is_survey || !rem.recurrence || rem.recurrence === 'none' || rem.recurrence === 'daily') return true;
        
        const parts = rem.recurrence.split(',');
        const type = parts[0];
        const vals = parts.slice(1).map(Number);
        
        if (type === 'weekly') {
          return vals.includes(todayDayOfWeek);
        }
        if (type === 'monthly') {
          return vals.includes(todayDateOfMonth);
        }
        return true;
      });

      const resData = { 
        weeklyDayOffs: weeklyDayOffs || [], 
        breaks: breaks || [], 
        overtimes: overtimes || [], 
        movements: movements || [],
        reminders: visibleReminders,
        allDepartmentSalesTargets: allDepartmentSalesTargets || [],
        shipments: shipments || [],
        logistics: logistics || [],
        cargoCompanies: cargoCompanies || [],
        responses: responses || [],
        taskStatuses,
        weeklySchedule: constructedWeeklySchedule,
        deptCoworkers: deptCoworkers || [],
        colleagueBreaks: colleagueBreaks || [],
        colleagueMovements: colleagueMovements || [],
        colleagueDayOffs: colleagueDayOffs || [],
        genderRules: genderRules || [],
        shiftPreference,
        isLeaveSelectionActive: settingsData?.setting_value?.isLeaveSelectionActive ?? true,
        isShiftSelectionActive: settingsData?.setting_value?.isShiftSelectionActive ?? true,
        isShiftSwapActive: settingsData?.setting_value?.isShiftSwapActive ?? true,
        myTodayShift: myTodayShift || null
      };
      
      try {
        localStorage.setItem(`dashboard_${personnel.id}`, JSON.stringify(resData));
      } catch (e) {}

      return resData;
    },
    enabled: !!personnel?.id
  });

  const targetDateStr = format(new Date(), 'yyyy-MM-dd');
  const weekStartStr = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');

  const { data: assignedBreakSlot } = useQuery({
    queryKey: ['employee_break_matrix', personnel?.id, targetDateStr],
    enabled: !!personnel?.id,
    queryFn: async () => {
      const { data: sData } = await supabase.from('system_settings' as any).select('setting_value').eq('setting_key', 'break_matrix').maybeSingle();
      const settings = sData?.setting_value || { slots: [], departmentGroups: [], rules: [] };
      
      const { data: shiftsData } = await supabase.from('shift_schedules').select('*').eq('week_start_date', weekStartStr);
      const { data: pData } = await supabase.from('personnel').select('*').eq('is_active', true);
      
      const matrix = calculateBreakMatrix(pData || [], shiftsData || [], settings, targetDateStr);
      if (!matrix) return null;
      return getPersonnelAssignedSlot(matrix, personnel.id);
    }
  });

  const submitSurveyResponseMutation = useMutation({
    mutationFn: async ({ reminder_id, status, notes }: { reminder_id: string, status: string, notes: string }) => {
      const today = new Date().toISOString().split('T')[0];
      const { error } = await supabase.from('reminder_responses' as any).upsert([{
        reminder_id,
        personnel_id: personnel?.id,
        response_date: today,
        status,
        notes: notes || ''
      }], { onConflict: 'reminder_id, personnel_id, response_date' });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee_dashboard'] });
      toast.success('Yanıtınız kaydedildi');
    },
    onError: (err: any) => toast.error('Yanıt kaydedilemedi: ' + err.message)
  });

  const addLogisticsMutation = useMutation({
    mutationFn: async (data: typeof logisticsForm) => {
      const { error } = await supabase.from('logistics_records' as any).insert([data]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee_dashboard'] });
      toast.success('Yeni kargo kaydı eklendi');
      setIsLogisticsOpen(false);
      setLogisticsForm({
        company_name: '',
        shipment_date: new Date().toISOString().split('T')[0],
        content_description: '',
        tracking_number: ''
      });
    },
    onError: (err: any) => toast.error('Kargo ekleme hatası: ' + err.message)
  });

  const handleAddLogistics = () => {
    if (!logisticsForm.company_name) { toast.error("Firma adı zorunludur."); return; }
    if (!logisticsForm.content_description) { toast.error("Açıklama zorunludur."); return; }
    if (!logisticsForm.tracking_number) { toast.error("Takip no zorunludur."); return; }
    addLogisticsMutation.mutate(logisticsForm);
  };

  const deleteLogisticsMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('logistics_records' as any).update({ deletion_status: 'pending' }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee_dashboard'] });
      toast.success('Kargo silme talebi yöneticiye gönderildi');
    },
    onError: (err: any) => toast.error('Silme talebi hatası: ' + err.message)
  });

  const updateCargoMutation = useMutation({
    mutationFn: async ({ id, totalBoxes, notes, addedCount }: { id: string, totalBoxes: number, notes?: string, addedCount?: number }) => {
      if (notes !== undefined && !addedCount) {
        const { error } = await supabase
          .from('cargo_shipments' as any)
          .update({ personnel_notes: notes })
          .eq('id', id);
        if (error) throw error;
        return;
      }

      if (addedCount && addedCount !== 0 && personnel) {
        const { data: currentShipment, error: fetchErr } = await supabase
          .from('cargo_shipments' as any)
          .select('counted_boxes, total_boxes')
          .eq('id', id)
          .single();
          
        if (fetchErr) throw fetchErr;

        const currentCount = currentShipment?.counted_boxes || 0;
        let newCount = currentCount + addedCount;
        
        if (newCount < 0) newCount = 0;
        if (newCount > currentShipment.total_boxes) newCount = currentShipment.total_boxes;

        const actualAddedCount = newCount - currentCount;
        if (actualAddedCount === 0) return;

        const isComplete = newCount >= currentShipment.total_boxes;

        const payload: any = { 
          counted_boxes: newCount, 
          status: isComplete ? 'Tamamlandı' : 'Sayılıyor',
          completion_date: isComplete ? new Date().toISOString() : null
        };
        if (notes !== undefined) payload.personnel_notes = notes;

        const { error: updateErr } = await supabase
          .from('cargo_shipments' as any)
          .update(payload)
          .eq('id', id);
        if (updateErr) throw updateErr;

        await supabase.from('cargo_shipment_logs' as any).insert([{
          shipment_id: id,
          personnel_name: `${personnel.first_name} ${personnel.last_name}`,
          added_count: actualAddedCount
        }]);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee_dashboard'] });
      toast.success('Koli sayımı güncellendi');
    },
    onError: (error: any) => {
      toast.error('Koli güncellenemedi: ' + error.message);
    }
  });

  const toggleDayMutation = useMutation({
    mutationFn: async ({ day, isSelected, description }: { day: number, isSelected: boolean, description?: string }) => {
      const { error: delErr } = await supabase.from('weekly_day_off').delete().eq('personnel_id', personnel.id);
      if (delErr) throw delErr;
      
      if (!isSelected) {
        const payload: any = { personnel_id: personnel.id, day_of_week: day, description, status: 'approved' };
        const { error: insErr } = await supabase.from('weekly_day_off').insert(payload);
        if (insErr) throw insErr;
        return { deleted: false };
      }
      return { deleted: true };
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['employee_dashboard', personnel?.id] });
      toast.success(res.deleted ? 'İzin günü talebi kaldırıldı' : 'Haftalık izin günü olarak ayarlandı');
    },
    onError: (error: any) => {
      console.error("Day Off Error:", error);
      toast.error('İzin günü ayarlanamadı: ' + (error.message || 'Bilinmeyen hata'));
    }
  });

  const saveNoteOnlyMutation = useMutation({
    mutationFn: async ({ description, allIds }: { description: string, allIds: string[] }) => {
      if (allIds.length > 0) {
        const { error } = await supabase.from('weekly_day_off').update({ description }).eq('id', allIds[0]);
        if (error) throw error;
      } else {
        const payload: any = { personnel_id: personnel.id, day_of_week: 0, description, status: 'approved' };
        const { error } = await supabase.from('weekly_day_off').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee_dashboard', personnel?.id] });
      toast.success('Notunuz yöneticiye iletildi');
    },
    onError: (error: any) => {
      toast.error('Not kaydedilemedi: ' + error.message);
    }
  });

  const shiftPreferenceMutation = useMutation({
    mutationFn: async ({ day_of_week, requested_shift, description }: { day_of_week: number, requested_shift: string, description?: string }) => {
      await supabase.from('shift_preferences' as any).delete().eq('personnel_id', personnel.id);
      
      if (day_of_week) {
         const { error } = await supabase.from('shift_preferences' as any).insert({
            personnel_id: personnel.id,
            day_of_week,
            requested_shift,
            description,
            status: 'pending'
         });
         if (error) throw error;
         return 'added';
      }
      return 'deleted';
    },
    onSuccess: (status) => {
       queryClient.invalidateQueries({ queryKey: ['employee_dashboard', personnel?.id] });
       if (status === 'added') toast.success('Vardiya tercihiniz onaya gönderildi!');
       else toast.success('Vardiya tercihiniz iptal edildi.');
    },
    onError: (err: any) => toast.error('Vardiya tercihi kaydedilemedi: ' + err.message)
  });

  const myTodayShift = dashboardData?.myTodayShift;
  const shiftRaw = myTodayShift ? (myTodayShift.shift_type || '').toString().trim() : '';
  const employeeStatusObj = personnel ? getEmployeeStatus(personnel, shiftRaw, myTodayShift) : { statusLabel: '' };
  const { statusLabel } = employeeStatusObj;

  const [currentDistance, setCurrentDistance] = useState<number | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);

  useEffect(() => {
    if (!geofenceConfig.isActive) {
      setCurrentDistance(null);
      setGeoError(null);
      return;
    }
    if (statusLabel !== 'Mağazada' && statusLabel !== 'Molada') {
      setCurrentDistance(null);
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setGeoError(null);
        const dist = calculateDistance(pos.coords.latitude, pos.coords.longitude, geofenceConfig.lat, geofenceConfig.lng);
        setCurrentDistance(dist);
      },
      (err) => {
        setGeoError("Konum bilgisi alınamıyor. Lütfen cihazınızın konum (GPS) özelliğini açın ve tarayıcıya izin verin.");
      },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 5000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [geofenceConfig.isActive, geofenceConfig.lat, geofenceConfig.lng, statusLabel]);

  const breakStartRadius = geofenceConfig.radiusStart || geofenceConfig.radius || 100;
  const breakEndRadius = geofenceConfig.radiusEnd || geofenceConfig.radius || 100;
  const activeRadius = statusLabel === 'Mağazada' ? breakStartRadius : breakEndRadius;

  const isGeofenceBlockedForStart = geofenceConfig.isActive && statusLabel === 'Mağazada' && (geoError !== null || (currentDistance !== null && currentDistance > breakStartRadius));
  const isGeofenceBlockedForEnd = geofenceConfig.isActive && statusLabel === 'Molada' && (geoError !== null || (currentDistance !== null && currentDistance > breakEndRadius));
  const isGeofenceBlocked = isGeofenceBlockedForStart || isGeofenceBlockedForEnd;

  const startBreakMutation = useMutation({
    mutationFn: async () => {
      if (isGeofenceBlockedForStart) {
        throw new Error(`Mağaza sınırları (${breakStartRadius}m) dışındayken molaya çıkamazsınız!`);
      }
      const { data, error } = await supabase.from('break_records').insert({ personnel_id: personnel!.id, break_start: new Date().toISOString() }).select('id, personnel_id, break_start, break_end').single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      if (data) {
        queryClient.setQueryData(['employee_dashboard', personnel?.id], (old: any) => {
          if (!old) return old;
          return { ...old, breaks: [data, ...(old.breaks || [])] };
        });
        
        if (assignedBreakSlot) {
          const violation = checkBreakViolation(data.break_start, assignedBreakSlot.timeRange);
          if (violation === 'early') {
            toast.warning(`Dikkat: Atanan mola saatinizden (${assignedBreakSlot.timeRange}) ERKEN çıktınız!`, { duration: 8000 });
          } else if (violation === 'late') {
            toast.warning(`Dikkat: Atanan mola saatinizden (${assignedBreakSlot.timeRange}) GEÇ çıktınız!`, { duration: 8000 });
          } else {
            toast.success('Mola başladı!');
          }
        } else {
          toast.success('Mola başladı!');
        }
      }
      queryClient.invalidateQueries({ queryKey: ['employee_dashboard', personnel?.id] });
    },
    onError: (err: any) => toast.error('Mola başlatılırken hata: ' + (err.message || 'Lütfen tekrar deneyin'))
  });

  const endBreakMutation = useMutation({
    mutationFn: async (breakId: string) => {
      if (geofenceConfig.isActive && statusLabel === 'Molada') {
        if (geoError) throw new Error("Konum bilgisi alınamadı. Lütfen konum servislerini açın.");
        if (currentDistance !== null && currentDistance > breakEndRadius) {
          throw new Error(`Mağaza sınırları (${breakEndRadius}m) dışındasınız! (Mesafe: ${Math.round(currentDistance)}m)`);
        }
      }
      const { data, error } = await supabase.from('break_records').update({ break_end: new Date().toISOString() }).eq('id', breakId).select('id, personnel_id, break_start, break_end').single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      if (data) {
        queryClient.setQueryData(['employee_dashboard', personnel?.id], (old: any) => {
          if (!old) return old;
          return { ...old, breaks: (old.breaks || []).map((b: any) => b.id === data.id ? data : b) };
        });
      }
      queryClient.invalidateQueries({ queryKey: ['employee_dashboard', personnel?.id] });
      toast.success('Mola bitti!');
    },
    onError: (err: any) => toast.error('Mola bitirilirken hata: ' + (err.message || 'Lütfen tekrar deneyin'))
  });

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/login');
    } catch (error) {
      toast.error('Çıkış yapılamadı');
    }
  };

  useEffect(() => {
    if (dashboardData?.weeklyDayOffs && dashboardData.weeklyDayOffs.length > 0) {
      setDayOffDescription(dashboardData.weeklyDayOffs[0].description || '');
    }
    if (dashboardData?.shiftPreference) {
       setShiftPrefDay(dashboardData.shiftPreference.day_of_week.toString());
       setShiftPrefTime(dashboardData.shiftPreference.requested_shift);
       setShiftPrefDescription(dashboardData.shiftPreference.description || '');
    }
  }, [dashboardData?.weeklyDayOffs, dashboardData?.shiftPreference]);

  const { weeklyDayOffs, breaks, overtimes, movements, reminders } = dashboardData || { weeklyDayOffs: [], breaks: [], overtimes: [], movements: [], reminders: [] };
  const safeBreaks = breaks || [];
  const todayStr = new Date().toISOString().split('T')[0];

  const { todayBreaks, activeBreak, recentBreaks } = useMemo(() => {
    const tb = safeBreaks.filter((b: any) => (b.break_start || '').startsWith(todayStr));
    return {
      todayBreaks: tb,
      activeBreak: tb.find((b: any) => !b.break_end),
      recentBreaks: safeBreaks.filter((b: any) => b.break_end).sort((a: any, b: any) => new Date(b.break_end).getTime() - new Date(a.break_end).getTime()).slice(0, 5)
    };
  }, [safeBreaks, todayStr]);

  if (loadingPersonnel || loadingData) {
    return <div className="min-h-screen flex items-center justify-center">Yükleniyor...</div>;
  }

  if (!personnel) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="glass-card max-w-md w-full text-center">
          <CardContent className="p-8">
            <p className="text-muted-foreground mb-4">Hesabınıza bağlı personel kaydı bulunamadı. Lütfen admin ile iletişime geçin.</p>
            <Button variant="outline" onClick={handleSignOut}><LogOut className="w-4 h-4 mr-2" /> Çıkış Yap</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentMonthName = new Date().toLocaleString('tr-TR', { month: 'long' });

  const breakViolationsCount = safeBreaks.filter((b: any) => {
    if (!b.break_end) return false;
    const start = new Date(b.break_start);
    const end = new Date(b.break_end);
    const dur = Math.round((end.getTime() - start.getTime()) / (1000 * 60));
    return dur > breakLimit;
  }).length;

  const safeOvertimes = overtimes || [];
  const earnedOvertime = safeOvertimes.filter((r: any) => !(r.record_type || '').toLowerCase().includes('alacak') && !(r.record_type || '').toLowerCase().includes('kullanım')).reduce((s: number, r: any) => s + Number(r.hours), 0);
  const usedCredit = safeOvertimes.filter((r: any) => (r.record_type || '').toLowerCase().includes('alacak') || (r.record_type || '').toLowerCase().includes('kullanım')).reduce((s: number, r: any) => s + Number(r.hours), 0);

  const totalOverdueMinutes = safeBreaks.reduce((sum: number, b: any) => {
    if (!b.break_end) return sum;
    const start = new Date(b.break_start);
    const end = new Date(b.break_end);
    const dur = Math.round((end.getTime() - start.getTime()) / (1000 * 60));
    if (dur > breakLimit) {
      return sum + (dur - breakLimit);
    }
    return sum;
  }, 0);

  const formatDuration = (totalH: number) => {
    const abs = Math.abs(totalH);
    const d = Math.floor(abs / 8);
    const remH = abs - (d * 8);
    const h = Math.floor(remH);
    const m = Math.round((remH - h) * 60);
    
    const parts = [];
    if (d > 0) parts.push(`${d} Gün`);
    if (h > 0) parts.push(`${h} Saat`);
    if (m > 0) parts.push(`${m} Dk`);
    const formatted = parts.length > 0 ? parts.join(' ') : '0 Saat';
    return totalH < 0 ? `- ${formatted}` : formatted;
  };

  const safeMovements = movements || [];
  const usedLeaves = calculateUsedLeave(safeMovements);
  const entitlement = typeof (personnel as any).annual_leave_entitlement === 'number' 
    ? (personnel as any).annual_leave_entitlement 
    : calculateEntitlement(personnel.start_date, generalSettings?.leaveEntitlements);
  const remainingLeave = entitlement - usedLeaves;

  const safeWeeklyDayOffs = weeklyDayOffs || [];
  const selectedDays = safeWeeklyDayOffs.map((d: any) => Number(d.day_of_week));

  const toggleDay = (day: number) => {
    const isSelected = safeWeeklyDayOffs.some((d: any) => Number(d.day_of_week) === day);
    
    if (!isSelected) {
      const colleagueSameDay = dashboardData?.colleagueDayOffs?.filter((d: any) => d.day_of_week === day) || [];
      if (colleagueSameDay.length > 0) {
        if (!window.confirm("Uyarı: Reyonunuzdaki " + colleagueSameDay.length + " arkadaşınız bu günü izin günü olarak seçmiş. Yine de seçmek ister misiniz?")) {
          return;
        }
      }

      const genderBlock = dashboardData?.genderRules?.find((r: any) => r.day_of_week === day && r.gender === (personnel as any).gender);
      if (genderBlock) {
         toast.error(genderBlock.warning_message || "Bu gün için sistem tarafından cinsiyetinize özel bir izin kısıtlaması getirilmiştir.");
         return;
      }
    }

    toggleDayMutation.mutate({ day, isSelected, description: dayOffDescription });
  };

  const { years, months, days, totalDays } = calculateWorkDuration(personnel.start_date);

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">

      <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{personnel.first_name} {personnel.last_name}</h1>
            <p className="text-muted-foreground">{personnel.department}</p>
            <p className="text-sm text-green-600 dark:text-green-400 font-medium mt-1">
              ⏱️ {years > 0 ? `${years} yıl ` : ''}{months > 0 ? `${months} ay ` : ''}{days} gün ({totalDays} gün) çalışıyor
            </p>
          </div>
          <div className="flex flex-wrap gap-2 justify-end">
            <Button variant="ghost" size="sm" onClick={async () => {
              try {
                if ('serviceWorker' in navigator) {
                  const registrations = await navigator.serviceWorker.getRegistrations();
                  for (const reg of registrations) await reg.unregister();
                }
                const cacheKeys = await caches.keys();
                for (const key of cacheKeys) await caches.delete(key);
                const keysToRemove = [];
                for (let i = 0; i < localStorage.length; i++) {
                  const k = localStorage.key(i);
                  if (k && !k.includes('sb-') && !k.includes('supabase.auth.token') && k !== 'mock_user_session') keysToRemove.push(k);
                }
                keysToRemove.forEach(k => localStorage.removeItem(k));
                window.location.href = window.location.href.split('?')[0] + '?t=' + new Date().getTime();
              } catch(e) {
                window.location.reload();
              }
            }} className="text-muted-foreground hover:text-foreground" title="Sayfa Yüklenmiyorsa Tıklayın">
              <RefreshCw className="w-4 h-4 mr-1" /> Sorun Gider
            </Button>
            {isManager && (
              <Button variant="default" size="sm" onClick={() => navigate('/admin')} className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm font-semibold">
                <Settings className="w-4 h-4 mr-2" /> Admin Panel
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={handleSignOut}><LogOut className="w-4 h-4 mr-2" /> Çıkış</Button>
          </div>
        </div>

        {isGeofenceBlocked && (
          <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg flex items-start gap-3 border border-red-100 dark:border-red-800/30">
            <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="text-red-800 dark:text-red-300 font-semibold text-sm">Mağaza Sınırları Dışındasınız</h3>
              <p className="text-red-600 dark:text-red-400 text-xs mt-1">
                {geoError ? geoError : `Mevcut konumunuz mağazadan uzak. İşlem yapabilmek için lütfen ${activeRadius} metre alan içerisine giriniz. (Mesafe: ${currentDistance ? Math.round(currentDistance) : '?'}m)`}
              </p>
            </div>
          </div>
        )}

        {/* Break Section */}
        {features.showBreak && (
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Coffee className="h-5 w-5" /> Mola</CardTitle>
              <CardDescription>Mola durumunuzu takip edin</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {assignedBreakSlot && !activeBreak && todayBreaks.length === 0 && (
                <div className="bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300 p-3 rounded-md text-sm border border-blue-200 dark:border-blue-800 flex items-center justify-between">
                  <span><strong>Atanmış Mola Saatiniz:</strong></span>
                  <span className="font-bold">{assignedBreakSlot.timeRange}</span>
                </div>
              )}
              {activeBreak ? (
                <>
                  <div className="p-4 bg-warning/10 rounded-lg text-center"><p className="text-lg font-semibold text-foreground">Moladasınız</p></div>
                  <Button onClick={() => endBreakMutation.mutate(activeBreak.id)} disabled={isGeofenceBlockedForEnd || endBreakMutation.isPending || loadingData} className={`w-full ${isGeofenceBlockedForEnd ? 'opacity-50 cursor-not-allowed' : ''}`} variant="outline"><Coffee className="w-4 h-4 mr-2" /> Moladan Geldim</Button>
                </>
              ) : (
                <Button onClick={() => startBreakMutation.mutate()} disabled={isGeofenceBlockedForStart || startBreakMutation.isPending || loadingData} className={`w-full ${isGeofenceBlockedForStart ? 'opacity-50 cursor-not-allowed' : ''}`} variant="outline"><Coffee className="w-4 h-4 mr-2" /> Molaya Çıktım</Button>
              )}

              <DailyBreakTracker todayBreaks={todayBreaks} activeBreak={activeBreak} limitMinutes={breakLimit} assignedSlot={assignedBreakSlot} />

              {recentBreaks.length > 0 && (
                <div className="mt-4 space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Son Molalar</p>
                  {recentBreaks.map((b: any) => {
                    const start = b.break_start ? new Date(b.break_start) : new Date();
                    const end = b.break_end ? new Date(b.break_end) : new Date();
                    const dur = Math.round((end.getTime() - start.getTime()) / (1000 * 60)) || 0;
                    return (
                      <div key={b.id} className="flex justify-between text-sm p-2 bg-muted/50 rounded items-center">
                        <span className="text-muted-foreground">{format(start, 'HH:mm')} - {b.break_end ? format(end, 'HH:mm') : 'Devam ediyor'}</span>
                        <span className="font-semibold text-foreground">{b.break_end ? `${dur} dk` : '-'}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Colleague Shift Panel */}
        {features.showShiftTracking && (
          <ColleagueShiftPanel dashboardData={dashboardData} personnel={personnel} />
        )}
        
        {/* Shift Swap Selection */}
        {dashboardData?.isShiftSwapActive && features.showShiftSwaps && (
          <ShiftSwapSection personnelId={personnel.id} deptCoworkers={dashboardData.deptCoworkers} />
        )}

        {/* Dashboards */}
        {(features.showOvertime || features.showBreakViolations || features.showLeaveStatus || features.showSalesTargets || features.showMovements || features.showReminders || features.showActiveBreaks) && (
        <Card className="glass-card md:col-span-2">
          <CardHeader><CardTitle className="flex items-center gap-2"><Activity className="h-5 w-5" /> Kontrol Paneli Özetleri</CardTitle></CardHeader>
          <CardContent>
            {(features.showOvertime || features.showBreakViolations || features.showLeaveStatus) && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {features.showOvertime && (
              <div className="p-4 rounded-lg bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30">
                <div className="flex items-center gap-2 mb-2 text-blue-600 dark:text-blue-400"><Clock className="h-4 w-4" /><h3 className="font-semibold text-sm">Toplam Fazla Mesai</h3></div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Kazanılan: <span className="font-bold text-foreground">{formatDuration(earnedOvertime)}</span></p>
                  <p className="text-xs text-muted-foreground">Kullanılan Alacak: <span className="font-bold text-foreground">{formatDuration(usedCredit)}</span></p>
                  <div className="h-px bg-border my-2"></div>
                  <p className="text-sm font-semibold">Bakiye: <span className={earnedOvertime - usedCredit < 0 ? 'text-destructive' : 'text-green-600'}>{formatDuration(earnedOvertime - usedCredit)}</span></p>
                </div>
              </div>
              )}

              {features.showBreakViolations && (
              <div className="p-4 rounded-lg bg-red-50/50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30">
                <div className="flex items-center gap-2 mb-2 text-red-600 dark:text-red-400"><Coffee className="h-4 w-4" /><h3 className="font-semibold text-sm">Mola İhlal Özeti</h3></div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">İhlale Düşen Mola Sayısı: <span className="font-bold text-foreground">{breakViolationsCount} Kez</span></p>
                  <p className="text-xs text-muted-foreground">Toplam Gecikme: <span className="font-bold text-foreground">{totalOverdueMinutes} Dk</span></p>
                </div>
              </div>
              )}

              {features.showLeaveStatus && (
              <div className="p-4 rounded-lg bg-orange-50/50 dark:bg-orange-900/10 border border-orange-100 dark:border-orange-900/30">
                <div className="flex items-center gap-2 mb-2 text-orange-600 dark:text-orange-400"><Umbrella className="h-4 w-4" /><h3 className="font-semibold text-sm">Yıllık İzin Durumu</h3></div>
                <div className="space-y-3">
                  <div className="flex justify-between text-xs"><span>Kullanılan: {usedLeaves}</span><span>Hak: {entitlement}</span></div>
                  <Progress value={entitlement > 0 ? (usedLeaves / entitlement) * 100 : 0} className="h-2" />
                  <p className="text-sm font-semibold mt-1">Kalan İzin: <span className={remainingLeave < 0 ? 'text-destructive' : 'text-green-600'}>{remainingLeave} Gün</span></p>
                </div>
              </div>
              )}
            </div>
            )}

            {features.showSalesTargets && (() => {
              const currentMonthStr = new Date().toISOString().substring(0, 7);
              const lastMDate = new Date();
              lastMDate.setMonth(lastMDate.getMonth() - 1);
              const lastMonthStr = lastMDate.toISOString().substring(0, 7);
              
              const currentSalesTargets = (dashboardData?.allDepartmentSalesTargets || []).filter((s: any) => s.target_month === selectedSalesMonth);
              const salesTarget = currentSalesTargets.find((s: any) => s.personnel_id === personnel?.id) || null;
              const deptTargetQuota = currentSalesTargets.reduce((acc: number, curr: any) => acc + (Number(curr.target_quota) || 0), 0);
              const deptRealizedSales = currentSalesTargets.reduce((acc: number, curr: any) => acc + (Number(curr.realized_sales) || 0), 0);
              
              return (
              <div className="p-4 rounded-lg bg-emerald-50/30 dark:bg-emerald-950/20 border border-emerald-100/50 dark:border-emerald-900/30 shadow-sm relative overflow-hidden mt-4">
                <div className="absolute top-0 right-0 p-4 opacity-10"><Target className="w-24 h-24" /></div>
                <div className="flex items-center justify-between gap-2 mb-4 relative z-10">
                  <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
                    <Target className="h-5 w-5" />
                    <h3 className="font-bold text-sm tracking-tight uppercase">Satış Hedefleri</h3>
                  </div>
                  <Select value={selectedSalesMonth} onValueChange={setSelectedSalesMonth}>
                    <SelectTrigger className="w-[130px] h-8 text-xs bg-white dark:bg-gray-800">
                      <SelectValue placeholder="Ay Seçin" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={currentMonthStr}>Bu Ay</SelectItem>
                      <SelectItem value={lastMonthStr}>Geçen Ay</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 relative z-10">
                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-muted-foreground">Şahsi Kotanız</p>
                    {salesTarget ? (
                      <>
                        <div className="flex justify-between text-sm">
                          <span>Satış: {Number(salesTarget.realized_sales || 0).toLocaleString('tr-TR')} ₺</span>
                          <span>Hedef: {Number(salesTarget.target_quota || 0).toLocaleString('tr-TR')} ₺</span>
                        </div>
                        {(() => {
                          const quota = salesTarget.target_quota;
                          const realized = salesTarget.realized_sales;
                          const ratio = quota > 0 ? (realized / quota) * 100 : 0;
                          const isComplete = ratio >= 100;
                          const remaining100 = Math.max(0, quota - realized);
                          return (
                            <>
                              <Progress value={Math.min(100, ratio)} className={`h-2 ${isComplete ? '[&>div]:bg-red-500 bg-red-100 dark:bg-red-950' : 'bg-emerald-100 dark:bg-emerald-950'}`} />
                              <div className="flex justify-between items-center mt-2 text-xs font-semibold">
                                <span className={isComplete ? 'text-red-500 dark:text-red-400' : 'text-emerald-600'}>%{ratio.toFixed(1)}</span>
                                <span className={isComplete ? 'text-red-500 dark:text-red-400 animate-pulse' : 'text-emerald-600'}>
                                  {isComplete ? 'Hedef %100 Geçildi!' : `Kalan: ${remaining100.toLocaleString('tr-TR')} ₺`}
                                </span>
                              </div>
                            </>
                          )
                        })()}
                      </>
                    ) : (
                      <div className="flex items-center justify-center p-4 text-muted-foreground text-sm text-center border-dashed border-2 rounded min-h-[100px]">
                        Kişisel kota tanımlanmadı
                      </div>
                    )}
                  </div>
                  
                  {deptTargetQuota > 0 ? (
                    <div className="space-y-2">
                      <p className="text-sm font-semibold text-muted-foreground">[{personnel.department || 'Bilinmeyen'}] Reyonu Toplamı</p>
                      <div className="flex justify-between text-sm">
                        <span>Satış: {Number(deptRealizedSales || 0).toLocaleString('tr-TR')} ₺</span>
                        <span>Hedef: {Number(deptTargetQuota || 0).toLocaleString('tr-TR')} ₺</span>
                      </div>
                      {(() => {
                        const quota = deptTargetQuota;
                        const realized = deptRealizedSales;
                        const ratio = quota > 0 ? (realized / quota) * 100 : 0;
                        const isComplete = ratio >= 100;
                        const target80 = quota * 0.8;
                        const is80Complete = realized >= target80;
                        const remaining80 = Math.max(0, target80 - realized);
                        const remaining100 = Math.max(0, quota - realized);
                        
                        return (
                          <>
                            <Progress value={Math.min(100, ratio)} className={`h-2 ${isComplete ? '[&>div]:bg-red-500 bg-red-100 dark:bg-red-950' : 'bg-emerald-100 dark:bg-emerald-950'}`} />
                            <div className="flex flex-col mt-2 gap-1 text-xs font-semibold">
                              {!is80Complete ? (
                                 <p className="text-amber-600 dark:text-amber-400">%80 için Kalan: {remaining80.toLocaleString('tr-TR')} ₺</p>
                              ) : (
                                 <p className="text-green-600 dark:text-green-400">%80 Hedefi Tamamlandı! 🎉</p>
                              )}
                              <p className={isComplete ? 'text-red-500 dark:text-red-400 animate-pulse' : 'text-emerald-600'}>
                                {isComplete ? `Reyon Hedefi %${Math.round(ratio)} Geçildi!` : `%100 için Kalan: ${remaining100.toLocaleString('tr-TR')} ₺`}
                              </p>
                            </div>
                          </>
                        )
                      })()}
                    </div>
                  ) : (
                    <div className="flex items-center justify-center p-4 text-muted-foreground text-sm text-center border-dashed border-2 rounded min-h-[100px]">
                      Reyon kotası tanımlanmadı
                    </div>
                  )}
                </div>
              </div>
              )
            })()}

            {(features.showMovements || features.showReminders || features.showActiveBreaks) && (
            <div className={`grid grid-cols-1 gap-4 mt-6 pt-4 ${(features.showOvertime || features.showBreakViolations || features.showLeaveStatus || features.showSalesTargets) ? 'border-t' : 'mt-0 pt-0'}`}>
              {features.showReminders && (
              <div className="p-4 rounded-lg bg-muted/30 border border-border/50">
                <div className="flex items-center gap-2 mb-3 text-indigo-500"><Bell className="h-4 w-4" /><h3 className="font-semibold text-sm">Duyurular ve Görevler</h3></div>
                <div className="space-y-4 max-h-[400px] overflow-y-auto pr-1">
                  {dashboardData?.reminders && dashboardData.reminders.length > 0 ? dashboardData.reminders.map((rem: any) => {
                    let validResponse = null;
                    const userResponses = dashboardData.responses?.filter((r:any) => r.reminder_id === rem.id) || [];
                    const todayIsoDate = new Date().toISOString().split('T')[0];
                      
                    if (userResponses.length > 0) {
                        if (!rem.recurrence || rem.recurrence === 'none') {
                           validResponse = userResponses[0];
                        } else if (rem.recurrence === 'daily') {
                           validResponse = userResponses.find((r:any) => r.response_date === todayIsoDate);
                        } else if (rem.recurrence.startsWith('weekly')) {
                           const td = new Date();
                           const cd = td.getDay() || 7;
                           const ws = new Date(td);
                           ws.setDate(td.getDate() - cd + 1);
                           const weekStartStr = ws.toISOString().split('T')[0];
                           validResponse = userResponses.find((r:any) => r.response_date >= weekStartStr);
                        } else if (rem.recurrence.startsWith('monthly')) {
                           const monthStartStr = new Date().toISOString().slice(0,7) + '-01';
                           validResponse = userResponses.find((r:any) => r.response_date >= monthStartStr);
                        }
                    }

                    const response = validResponse;
                    return (
                    <div key={rem.id} className={`flex flex-col border p-4 rounded-xl shadow-sm ${rem.is_survey ? 'bg-purple-50/50 dark:bg-purple-950/20 border-purple-100 dark:border-purple-900/30' : 'bg-indigo-50/50 dark:bg-indigo-950/20 border-indigo-100 dark:border-indigo-900/30'}`}>
                       <div className="flex justify-between items-start gap-2 mb-2">
                         <span className="font-bold text-lg text-foreground leading-tight">{rem.title}</span>
                         {rem.is_survey && <Badge variant="outline" className="bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-100 border-none shrink-0">Anket / Görev</Badge>}
                       </div>
                       
                       {rem.description && <span className="text-base font-medium text-foreground/90 whitespace-pre-wrap mb-3">{rem.description}</span>}
                       
                       {rem.is_survey && (
                         <div className="mt-2 pt-3 border-t border-black/5 dark:border-white/5">
                           {response ? (
                             <div className="flex flex-col gap-2 bg-black/5 dark:bg-white/5 p-2 rounded-lg">
                               <div className="flex items-center justify-between">
                                 <span className="text-sm font-medium text-muted-foreground">Bugünkü Durumunuz:</span>
                                 <Badge className="bg-success text-white border-0">{response.status}</Badge>
                               </div>
                               {response.notes && (
                                 <div className="text-xs text-muted-foreground bg-background p-2 rounded border border-border/50">
                                   <span className="font-semibold block mb-1">Açıklamanız:</span>
                                   {response.notes}
                                 </div>
                               )}
                             </div>
                           ) : (
                             <div className="space-y-3">
                               <span className="text-xs font-semibold text-muted-foreground block mb-1">Durum Bildirin:</span>
                               <div className="space-y-2 mb-2">
                                 <Input 
                                   placeholder="Açıklama / Notunuz (Opsiyonel)" 
                                   value={surveyNotes[rem.id] || ''} 
                                   onChange={e => setSurveyNotes({...surveyNotes, [rem.id]: e.target.value})}
                                   className="h-8 text-xs bg-background/50"
                                 />
                               </div>
                               <div className="flex flex-wrap gap-2">
                                 {dashboardData.taskStatuses.map((status: string) => (
                                   <Button 
                                     key={status} 
                                     size="sm" 
                                     variant="secondary" 
                                     className="hover:bg-primary hover:text-primary-foreground min-w-[80px]"
                                     onClick={() => submitSurveyResponseMutation.mutate({ reminder_id: rem.id, status, notes: surveyNotes[rem.id] || '' })}
                                     disabled={submitSurveyResponseMutation.isPending}
                                   >
                                     {status}
                                   </Button>
                                 ))}
                               </div>
                             </div>
                           )}
                         </div>
                       )}
                       
                       {!rem.is_survey && rem.reminder_datetime && (
                         <div className="flex items-center gap-1 text-xs text-indigo-400 mt-2 font-medium">
                            <CalendarDays className="h-3 w-3" />
                            Son Geçerlilik: {rem.reminder_datetime && !isNaN(new Date(rem.reminder_datetime).getTime()) ? format(new Date(rem.reminder_datetime), 'dd.MM.yyyy') : '-'}
                         </div>
                       )}
                    </div>
                  )}) : (
                    <div className="p-4 bg-muted/20 text-center rounded-lg text-sm text-muted-foreground border border-dashed">Şu an için aktif bir duyuru/görev bulunmuyor.</div>
                  )}
                </div>
              </div>
              )}

              {features.showMovements && (
              <div className="p-4 rounded-lg bg-muted/30 border border-border/50">
                <div className="flex items-center gap-2 mb-3 text-primary"><MapPin className="h-4 w-4" /><h3 className="font-semibold text-sm">Son Kişisel Hareketleriniz</h3></div>
                <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                  {movements.length > 0 ? movements.slice(0, 5).map((m: any) => {
                    const isValidStart = m.start_date && !isNaN(new Date(m.start_date).getTime());
                    const isValidEnd = m.end_date && !isNaN(new Date(m.end_date).getTime());
                    return (
                    <div key={m.id} className="flex justify-between items-center bg-background border p-2 rounded-md text-xs">
                       <div>
                         <span className="font-medium text-foreground block">{m.type || m.movement_type || 'Belirtilmemiş'}</span>
                         <span className="text-muted-foreground">
                           {isValidStart ? format(new Date(m.start_date), 'dd.MM.yyyy') : '-'} 
                           {' - '}
                           {isValidEnd ? format(new Date(m.end_date), 'dd.MM.yyyy') : '-'}
                         </span>
                       </div>
                       <Badge variant="outline">{m.total_days} Gün</Badge>
                    </div>
                  )}) : (
                    <div className="p-3 bg-muted/20 text-center rounded text-xs text-muted-foreground">Kayıtlı kişisel hareket bulunamadı.</div>
                  )}
                </div>
              </div>
              )}
            </div>
            )}

            {features.showActiveBreaks && (
              <div className="p-4 rounded-lg bg-muted/30 border border-border/50">
                <div className="flex items-center gap-2 mb-3 text-primary"><Clock className="h-4 w-4" /><h3 className="font-semibold text-sm">Molada Olanlar</h3></div>
                <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                  {(() => {
                    const activeBreaks = (dashboardData?.colleagueBreaks || []).filter((b: any) => !b.break_end);
                    if (activeBreaks.length === 0) {
                      return <div className="p-3 bg-muted/20 text-center rounded text-xs text-muted-foreground">Şu anda molada olan yok.</div>;
                    }
                    return activeBreaks.map((b: any) => {
                      const p = b.personnel;
                      const name = p ? `${p.first_name} ${p.last_name}` : 'Bilinmiyor';
                      const startTime = b.break_start ? new Date(b.break_start) : new Date();
                      const isValidDate = !isNaN(startTime.getTime());
                      const duration = isValidDate ? Math.round((new Date().getTime() - startTime.getTime()) / (1000 * 60)) : 0;
                      
                      const shift = (() => {
                        if (!dashboardData?.weeklySchedule) return null;
                        const row = dashboardData.weeklySchedule.find((r: any) => r['Ad Soyad'] === name);
                        if (!row) return null;
                        const daysTr = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
                        const todayName = daysTr[new Date().getDay()];
                        return row[todayName];
                      })();

                      return (
                        <div key={b.id} className="flex justify-between items-center bg-background border p-2 rounded-md text-xs">
                          <div>
                            <span className="font-medium text-foreground block">
                              {name}
                              {shift ? <span className="text-xs text-muted-foreground ml-1">({shift})</span> : null}
                            </span>
                            <span className="text-muted-foreground">{isValidDate ? format(startTime, 'HH:mm') : '-'}</span>
                          </div>
                          <Badge variant="outline" className={duration > 60 ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 border-orange-200' : 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200'}>{duration} dk</Badge>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
        )}

        {/* Day Off Selection */}
        {features.showWeeklyDayOff && (
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Calendar className="h-5 w-5" /> Haftalık İzin Günü</CardTitle>
            <CardDescription>
              {selectedDays.length > 0 
                ? <span className="font-semibold text-primary">Seçili İzin Gününüz: {DAYS[selectedDays[0]]}</span>
                : 'İzin kullanmak istediğiniz günü seçin'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase text-muted-foreground ml-1">Notunuz (İsteğe bağlı)</Label>
                  <Input 
                    placeholder="Örn: Cuma günü hastane işim var..." 
                    value={dayOffDescription} 
                    onChange={(e) => setDayOffDescription(e.target.value)}
                    className="bg-muted/50 focus:bg-background transition-colors"
                  />
                  {!dashboardData?.isLeaveSelectionActive && (
                     <Button 
                       size="sm" 
                       onClick={() => saveNoteOnlyMutation.mutate({ description: dayOffDescription, allIds: safeWeeklyDayOffs.map((r: any) => r.id) })} 
                       disabled={saveNoteOnlyMutation.isPending}
                       className="mt-2 w-full"
                     >
                       Sadece Notu Kaydet
                     </Button>
                  )}
                </div>
              </div>

              {!dashboardData?.isLeaveSelectionActive ? (
                <div className="p-3 bg-orange-50 text-orange-700 rounded-md text-sm text-center font-medium">
                  Bu hafta için sistem üzerinden izin günü seçimi duraklatılmıştır. Sadece yönetime iletmek istediğiniz notları yukarıdan girip kaydedebilirsiniz.
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-2">
                  <div className="sm:col-span-12 pb-2">
                    <p className="text-sm font-medium text-muted-foreground ml-1">Yukarıdaki ayarlarınızla birlikte İzin Gününüzü onaylayın:</p>
                  </div>
                  {DAYS.slice(1, 6).map((day, idx) => {
                    const i = idx + 1;
                    const isSelected = selectedDays.includes(i);
                    const isPending = isSelected && (weeklyDayOffs[0] as any)?.status === 'pending';
                    const isRejected = isSelected && (weeklyDayOffs[0] as any)?.status === 'rejected';
                    const isApproved = isSelected && (weeklyDayOffs[0] as any)?.status === 'approved';
                    
                    return (
                      <Button 
                        key={day} 
                        variant={isSelected ? "default" : "outline"}
                        className={`h-12 relative overflow-hidden ${isSelected ? (isPending ? 'bg-orange-500 hover:bg-orange-600 text-white border-none' : isRejected ? 'bg-red-500 hover:bg-red-600 text-white border-none' : 'bg-primary') : 'hover:border-primary/50'}`}
                        onClick={() => toggleDay(i)}
                        disabled={toggleDayMutation.isPending}
                      >
                        {day}
                        {isSelected && (
                          <div className="absolute top-0 right-0 p-1">
                            {isPending && <Clock className="w-3 h-3 opacity-70 animate-pulse" />}
                            {isRejected && <Info className="w-3 h-3 opacity-70" title="Reddedildi" />}
                            {isApproved && <UserCheck className="w-3 h-3 opacity-70" />}
                          </div>
                        )}
                      </Button>
                    );
                  })}
                </div>
              )}
              {selectedDays.length > 0 && weeklyDayOffs[0]?.admin_response && (
                <div className="mt-4 p-3 bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 rounded-lg border border-red-100 dark:border-red-900/30 text-sm">
                  <span className="font-semibold block mb-1">Müdür Notu:</span>
                  {weeklyDayOffs[0].admin_response}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
        )}

        {/* Shift Preference Selection */}
        {features.showShiftTracking && (
        <Card className="glass-card border-indigo-100 dark:border-indigo-900/30 mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
              <CalendarDays className="h-5 w-5" /> Haftalık Vardiya Tercihi
            </CardTitle>
            <CardDescription>
              Haftanın <span className="font-semibold text-indigo-500">sadece 1 günü için</span> vardiya tercihi yapabilirsiniz.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!dashboardData?.isShiftSelectionActive ? (
                <div className="p-3 bg-orange-50 text-orange-700 rounded-md text-sm text-center font-medium">
                  Bu hafta için sistem üzerinden vardiya tercihi seçimi duraklatılmıştır.
                </div>
            ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold uppercase text-muted-foreground ml-1">Tercih Edilen Gün</Label>
                      <select 
                        value={shiftPrefDay}
                        onChange={(e) => setShiftPrefDay(e.target.value)}
                        className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background/50 px-3 py-2 text-sm transition-colors focus:bg-background"
                      >
                        <option value="">-- Gün Seçiniz --</option>
                        {DAYS.slice(1, 8).map((d, i) => (
                          <option key={i+1} value={(i+1).toString()}>{d}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold uppercase text-muted-foreground ml-1">Vardiya Tercihiniz</Label>
                      <select 
                        value={shiftPrefTime}
                        onChange={(e) => setShiftPrefTime(e.target.value)}
                        className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background/50 px-3 py-2 text-sm transition-colors focus:bg-background"
                        disabled={!shiftPrefDay}
                      >
                        <option value="sabah">Sabah Vardiyasında Olmak İstiyorum</option>
                        <option value="aksam">Akşam Vardiyasında Olmak İstiyorum</option>
                      </select>
                    </div>
                  </div>
                  
                  <div className="space-y-2 pt-2">
                    <Label className="text-xs font-semibold uppercase text-muted-foreground ml-1">Açıklama / Mazeret (İsteğe bağlı)</Label>
                    <Input 
                      placeholder="Örn: Salı sabahı hastane randevum var..." 
                      value={shiftPrefDescription}
                      onChange={(e) => setShiftPrefDescription(e.target.value)}
                      className="bg-muted/50 focus:bg-background transition-colors"
                      disabled={!shiftPrefDay}
                    />
                  </div>
                  
                  <div className="flex gap-2 pt-2">
                    <Button 
                      onClick={() => shiftPreferenceMutation.mutate({ day_of_week: parseInt(shiftPrefDay), requested_shift: shiftPrefTime, description: shiftPrefDescription })}
                      disabled={!shiftPrefDay || shiftPreferenceMutation.isPending}
                      className="w-full bg-indigo-600 hover:bg-indigo-700 text-white"
                    >
                      Tercihi Kaydet
                    </Button>
                    
                    {dashboardData?.shiftPreference && (
                      <Button 
                        variant="outline" 
                        onClick={() => shiftPreferenceMutation.mutate({ day_of_week: 0, requested_shift: '' })}
                        disabled={shiftPreferenceMutation.isPending}
                        className="text-red-500 hover:text-red-700 hover:bg-red-50"
                        title="Tercihi İptal Et"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>

                  {dashboardData?.shiftPreference && (
                    <div className="mt-4 p-3 bg-indigo-50 dark:bg-indigo-950/20 rounded-lg border border-indigo-100 dark:border-indigo-900/30 text-sm">
                      <div className="flex justify-between items-center">
                        <span className="font-semibold text-indigo-700 dark:text-indigo-300">
                          Aktif Tercihiniz: {DAYS[dashboardData.shiftPreference.day_of_week]} - {dashboardData.shiftPreference.requested_shift === 'sabah' ? 'Sabah' : 'Akşam'}
                        </span>
                        {dashboardData.shiftPreference.status === 'pending' && <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-200 border-none animate-pulse">Onay Bekliyor</Badge>}
                        {dashboardData.shiftPreference.status === 'approved' && <Badge className="bg-green-100 text-green-800 hover:bg-green-200 border-none">Onaylandı</Badge>}
                        {dashboardData.shiftPreference.status === 'rejected' && <Badge className="bg-red-100 text-red-800 hover:bg-red-200 border-none">Reddedildi</Badge>}
                      </div>
                      {dashboardData.shiftPreference.admin_response && (
                        <div className="mt-2 pt-2 border-t border-indigo-200/50 text-indigo-600 dark:text-indigo-400">
                          <span className="font-semibold mr-1">Müdür Notu:</span>
                          {dashboardData.shiftPreference.admin_response}
                        </div>
                      )}
                    </div>
                  )}
                </div>
            )}
          </CardContent>
        </Card>
        )}

        {/* Cargo Shipments Tracking Section */}
        {features.showCargoStatus && dashboardData?.shipments && dashboardData.shipments.length > 0 && (() => {
          const activeShipments = dashboardData.shipments.filter((s:any) => s.total_boxes > s.counted_boxes || s.status === 'Sayılıyor');
          const shipmentsToShow = [...activeShipments];
          
          if (shipmentsToShow.length === 0) return null;
          
          return (
          <Card className="glass-card mt-6">
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-xl font-bold flex items-center gap-2"><Package className="h-5 w-5 text-primary" /> Koli / Sevkiyat Takibi</CardTitle>
            </CardHeader>
            <CardContent className="pt-4 px-3 sm:px-6">
              <div className="flex flex-col gap-4">
                {shipmentsToShow
                  .sort((a: any, b: any) => {
                    const aComp = a.counted_boxes >= a.total_boxes;
                    const bComp = b.counted_boxes >= b.total_boxes;
                    if (aComp === bComp) return new Date(b.arrival_date).getTime() - new Date(a.arrival_date).getTime();
                    return aComp ? 1 : -1;
                  })
                  .map((shipment: any) => {
                    const remaining = Math.max(0, shipment.total_boxes - shipment.counted_boxes);
                    const progress = shipment.total_boxes > 0 ? (shipment.counted_boxes / shipment.total_boxes) * 100 : 0;
                    const isComplete = shipment.counted_boxes >= shipment.total_boxes;

                    return (
                      <div key={shipment.id} className={`p-5 rounded-xl border-2 transition-all ${isComplete ? 'bg-success/5 border-success/30' : 'bg-card border-border hover:border-primary/30'} flex flex-col md:flex-row gap-6 shadow-sm items-center`}>
                        
                        <div className="flex-1 w-full">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="font-semibold text-lg">{shipment.arrival_date && !isNaN(new Date(shipment.arrival_date).getTime()) ? format(new Date(shipment.arrival_date), 'dd.MM.yyyy') : '-'} Sevkiyatı</h3>
                            <Badge variant={isComplete ? "default" : "outline"} className={isComplete ? "bg-success" : ""}>
                              {isComplete ? 'Tamamlandı' : 'Bekliyor'}
                            </Badge>
                          </div>
                          <div className="mt-2 space-y-1">
                            {shipment.notes && (
                              <div className="text-xs bg-primary/10 text-primary p-2 rounded mb-2">
                                <span className="font-semibold">Yönetici Notu:</span> {shipment.notes}
                              </div>
                            )}
                            <Label className="text-[11px] font-semibold uppercase text-muted-foreground ml-1">Personel Açıklaması / Not Ekleyin</Label>
                            <Input 
                              defaultValue={shipment.personnel_notes || ''}
                              placeholder="Eksik, hasarlı koli tespiti veya ek notlar..."
                              className="h-10 text-sm bg-muted/30"
                              onBlur={(e) => {
                                if (e.target.value !== (shipment.personnel_notes || '')) {
                                  updateCargoMutation.mutate({ 
                                    id: shipment.id, 
                                    totalBoxes: shipment.total_boxes, 
                                    notes: e.target.value 
                                  });
                                }
                              }}
                            />
                          </div>
                        </div>
                        
                        <div className="flex-1 w-full flex flex-col justify-center">
                          <div className="grid grid-cols-3 gap-1 sm:gap-2 mb-3 text-center">
                            <div className="bg-muted rounded-lg p-1.5 sm:p-2 flex flex-col justify-center overflow-hidden">
                              <p className="text-[10px] w-full text-muted-foreground mb-1 uppercase font-bold truncate tracking-tighter">Top.</p>
                              <p className="text-lg sm:text-xl font-bold">{shipment.total_boxes}</p>
                            </div>
                            <div className="bg-primary/10 rounded-lg p-1.5 sm:p-2 border border-primary/20 flex flex-col justify-center overflow-hidden">
                              <p className="text-[10px] w-full text-primary mb-1 uppercase font-bold truncate tracking-tighter">Say.</p>
                              <p className="text-lg sm:text-xl font-bold text-primary">{shipment.counted_boxes}</p>
                            </div>
                            <div className="bg-destructive/10 rounded-lg p-1.5 sm:p-2 border border-destructive/20 shadow-sm flex flex-col justify-center overflow-hidden">
                              <p className="text-[10px] w-full text-destructive mb-1 uppercase font-bold truncate tracking-tighter">Kalan</p>
                              <p className="text-xl sm:text-2xl font-bold text-destructive animate-pulse">{remaining}</p>
                            </div>
                          </div>

                          <div className="space-y-1">
                            <div className="flex justify-between text-xs font-medium">
                              <span>İlerleme Oranı</span>
                              <span>{Math.round(progress)}%</span>
                            </div>
                            <Progress value={progress} className="h-2 w-full bg-secondary" />
                          </div>
                        </div>

                        <div className="w-full md:max-w-[220px] flex items-center justify-between gap-3">
                          <Button 
                            variant="destructive" 
                            size="icon"
                            className="h-14 w-14 shrink-0 rounded-xl"
                            onClick={() => {
                              if (shipment.counted_boxes > 0) {
                                updateCargoMutation.mutate({ id: shipment.id, totalBoxes: shipment.total_boxes, addedCount: -1 });
                              }
                            }}
                            disabled={shipment.counted_boxes === 0 || updateCargoMutation.isPending}
                          >
                            <Minus className="h-6 w-6" />
                          </Button>
                          <div className="flex-1 text-center text-[10px] uppercase font-bold text-muted-foreground">
                            Sayımı<br/>Güncelle
                          </div>
                          <Button 
                            variant="default" 
                            size="icon"
                            className="h-14 w-14 shrink-0 rounded-xl"
                            onClick={() => {
                              if (shipment.counted_boxes < shipment.total_boxes) {
                                updateCargoMutation.mutate({ id: shipment.id, totalBoxes: shipment.total_boxes, addedCount: 1 });
                              }
                            }}
                            disabled={shipment.counted_boxes >= shipment.total_boxes || updateCargoMutation.isPending}
                          >
                            <Plus className="h-6 w-6" />
                          </Button>
                        </div>

                      </div>
                    );
                  })}
              </div>
              </CardContent>
            </Card>
          )})()}

        {/* Logistics Tracking Section */}
        {features.showLogistics && (
          <Card className="glass-card mt-6">
            <CardHeader className="pb-3 border-b flex flex-row items-center justify-between">
              <CardTitle className="text-xl font-bold flex items-center gap-2"><Truck className="h-5 w-5 text-primary" /> Kargo Takip (Kayıtlar)</CardTitle>
              <Dialog open={isLogisticsOpen} onOpenChange={setIsLogisticsOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="bg-primary/90 hover:bg-primary"><Plus className="w-4 h-4 mr-1"/> Yeni Kargo</Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px]">
                  <DialogHeader><DialogTitle>Yeni Kargo Ekle</DialogTitle></DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>Gönderi Tarihi</Label>
                      <div className="relative">
                        <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input type="date" className="pl-9" value={logisticsForm.shipment_date} onChange={e => setLogisticsForm({...logisticsForm, shipment_date: e.target.value})} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Kargo Firması</Label>
                      <select 
                        className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background disabled:cursor-not-allowed disabled:opacity-50"
                        value={logisticsForm.company_name}
                        onChange={(e) => setLogisticsForm({ ...logisticsForm, company_name: e.target.value })}
                      >
                        <option value="">Seçiniz...</option>
                        {dashboardData?.cargoCompanies?.map((c: any) => <option key={c.id} value={c.name}>{c.name}</option>)}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label>İçerik / Açıklama</Label>
                      <Input value={logisticsForm.content_description} onChange={e => setLogisticsForm({...logisticsForm, content_description: e.target.value})} placeholder="Örn: İade kolisi..." />
                    </div>
                    <div className="space-y-2">
                      <Label>Takip Numarası</Label>
                      <Input value={logisticsForm.tracking_number} onChange={e => setLogisticsForm({...logisticsForm, tracking_number: e.target.value})} placeholder="Takip No..." />
                    </div>
                    <Button className="w-full mt-4" onClick={handleAddLogistics} disabled={addLogisticsMutation.isPending}>
                      {addLogisticsMutation.isPending ? 'Ekleniyor...' : 'Kargo Ekle'}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent className="pt-4 px-3 sm:px-6">
              {(!dashboardData?.logistics || dashboardData.logistics.length === 0) ? (
                 <p className="text-muted-foreground text-center py-4 text-sm">Henüz kargo kaydı bulunmuyor.</p>
              ) : (
                <div className="flex flex-col gap-3 max-h-96 overflow-y-auto pr-2">
                  {dashboardData.logistics.map((log: any) => (
                    <div key={log.id} className="p-4 rounded-xl border bg-card/50 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className="bg-primary/5">{log.company_name}</Badge>
                          <span className="text-sm font-medium">{log.shipment_date && !isNaN(new Date(log.shipment_date).getTime()) ? format(new Date(log.shipment_date), 'dd.MM.yyyy') : '-'}</span>
                        </div>
                        <p className="font-semibold">{log.content_description}</p>
                      </div>
                      <div className="flex items-center gap-4 mt-2 sm:mt-0">
                        <div className="text-left sm:text-right">
                          <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mb-1">Takip Numarası</p>
                          <p className="font-mono bg-muted px-3 py-1.5 rounded-lg text-sm select-all">{log.tracking_number}</p>
                        </div>
                        {log.deletion_status === 'pending' ? (
                          <Badge variant="outline" className="bg-orange-50 text-orange-600 border-orange-200">Silinme Onayı Bekliyor</Badge>
                        ) : (
                          <Button variant="ghost" size="icon" onClick={() => {
                            if (window.confirm("Bu kargo kaydını silmek istediğinize emin misiniz? (Yönetici onayı gerektirir)")) {
                              deleteLogisticsMutation.mutate(log.id);
                            }
                          }} disabled={deleteLogisticsMutation.isPending}>
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

      {/* Shift Visuals Section */}
      {features.showShiftVisuals && ((shiftImages && shiftImages.length > 0) || (Array.isArray(announcementImages) && announcementImages.length > 0)) && (
        <div className="mt-8 mb-6 flex flex-col items-center w-[calc(100%+2rem)] -mx-4 sm:w-full sm:mx-0 px-0">
           <div className="w-full flex flex-col shadow-2xl bg-white sm:max-w-[923px]">
               {shiftImages?.map((imgUrl: string, idx: number) => (
                   <img key={idx} src={imgUrl} alt={`Vardiya Görseli ${idx + 1}`} className="w-full h-auto object-contain block border-b-4 border-gray-400 last:border-b-0" />
               ))}

               {Array.isArray(announcementImages) && announcementImages.map((url: string, i: number) => (
                  <img key={`ann-${i}`} src={url} alt={`Duyuru ${i+1}`} className="w-full h-auto object-contain block border-b-2 border-gray-300 last:border-b-0" />
               ))}
           </div>
        </div>
      )}
      </div>

      {isManager && (
        <div className="mt-8 pt-8 border-t border-muted-foreground/20">

           
           <h2 className="text-2xl font-black text-center mt-10 mb-6 text-foreground tracking-tight px-4">
             <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/60">
                Mağaza Yöneticisi Özeti
             </span>
           </h2>
             <div className="mx-auto w-full max-w-7xl">
                <Suspense fallback={<div className="p-8 text-center animate-pulse text-muted-foreground">Mağaza Yöneticisi Özeti Yükleniyor...</div>}>
                  <AdminDashboard isManagerPanel={true} />
                </Suspense>
             </div>
        </div>
      )}

      <footer className="mt-8 text-center pb-6 text-sm font-medium text-muted-foreground">Tasarlayan Turgay DOLU</footer>
    </div>
  );
};

const DailyBreakTracker = ({ todayBreaks, activeBreak, limitMinutes, assignedSlot }: { todayBreaks: any[], activeBreak: any, limitMinutes: number, assignedSlot?: any }) => {
  const [totalConsumedSeconds, setTotalConsumedSeconds] = useState(0);

  useEffect(() => {
    const update = () => {
      let consumed = 0;
      todayBreaks.forEach(b => {
        const start = new Date(b.break_start).getTime();
        const end = b.break_end ? new Date(b.break_end).getTime() : Date.now();
        consumed += Math.floor((end - start) / 1000);
      });
      setTotalConsumedSeconds(consumed);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [todayBreaks, activeBreak]);

  const limitSeconds = limitMinutes * 60;
  const remainingSeconds = limitSeconds - totalConsumedSeconds;
  
  useEffect(() => {
      if (activeBreak && remainingSeconds === 300) { 
          toast.warning('Molanızın bitmesine son 5 dakika kalmıştır!', { duration: 10000 });
      }
  }, [remainingSeconds, activeBreak]);

  const isExceeded = remainingSeconds < 0;
  const formatTime = (totalSeconds: number) => {
    const abs = Math.abs(totalSeconds);
    const h = Math.floor(abs / 3600);
    const m = Math.floor((abs % 3600) / 60);
    const s = abs % 60;
    return `${totalSeconds < 0 ? '-' : ''}${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  let violationBadge = null;
  if (activeBreak && assignedSlot) {
    const violation = checkBreakViolation(activeBreak.break_start, assignedSlot.timeRange);
    if (violation === 'early') {
      violationBadge = <div className="mt-2 text-xs font-bold text-orange-600 bg-orange-100 border border-orange-200 py-1.5 px-2 rounded">⚠️ Atanan saatinizden ({assignedSlot.timeRange}) erken çıktınız!</div>;
    } else if (violation === 'late') {
      violationBadge = <div className="mt-2 text-xs font-bold text-red-600 bg-red-100 border border-red-200 py-1.5 px-2 rounded">🚨 Atanan saatinizden ({assignedSlot.timeRange}) geç çıktınız!</div>;
    }
  }

  return (
    <div className={`mt-4 p-4 rounded-lg text-center border transition-colors ${isExceeded ? 'bg-destructive/10 border-destructive shadow-sm' : 'bg-secondary/20 border-transparent'}`}>
      <div className="grid grid-cols-2 gap-4">
        <div><p className="text-sm text-muted-foreground font-medium">Günlük Kullanım</p><p className="text-xl font-mono font-semibold">{formatTime(totalConsumedSeconds)}</p></div>
        <div><p className="text-sm text-muted-foreground font-medium">Kalan Süre</p><p className={`text-xl font-mono font-bold ${isExceeded ? 'text-destructive animate-pulse' : 'text-green-600 dark:text-green-500'}`}>{formatTime(remainingSeconds)}</p></div>
      </div>
      {violationBadge}
      <p className="text-xs text-muted-foreground mt-3 pt-2 border-t">Günlük Kullanılabilir Mola Hakkı: <b>{limitMinutes} dakika</b></p>
    </div>
  );
};

const ColleagueShiftPanel = ({ dashboardData, personnel }: { dashboardData: any, personnel: any }) => {
  if (!dashboardData?.weeklySchedule || dashboardData.weeklySchedule.length === 0) return null;

  const daysTr = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];

  const getShiftStatus = (person: any, dateOffset: 0 | 1 = 0) => {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + dateOffset);
    const targetStr = targetDate.toISOString().split('T')[0];
    const dayName = daysTr[targetDate.getDay()];
    const fullName = `${person.first_name} ${person.last_name}`.trim();

    const activeMovement = dashboardData.colleagueMovements?.find((m: any) => {
      if (m.personnel_id !== person.id) return false;
      return m.start_date <= targetStr && m.end_date >= targetStr;
    });

    if (activeMovement) {
      return {
        title: activeMovement.movement_type || 'Raporlu/İzinli',
        statusLabel: 'İzinli',
        statusColor: 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400'
      };
    }

    const row = dashboardData.weeklySchedule.find((r: any) => r['Ad Soyad']?.toString().trim() === fullName);
    const shiftRaw = row ? (row[dayName] || '').toString().trim() : '';

    if (!shiftRaw || shiftRaw === '-') {
      return {
        title: 'İzinli (Off) / Belirsiz',
        statusLabel: 'İzinli',
        statusColor: 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800'
      };
    }

    let shiftType = '';
    const upVal = shiftRaw.toUpperCase();
    if (upVal.startsWith('S') && !upVal.match(/^(\d{1,2})[.:]/)) shiftType = 'Sabah';
    else if (upVal.startsWith('A') && !upVal.match(/^(\d{1,2})[.:]/)) shiftType = 'Akşam';
    else if (upVal.startsWith('İ') || upVal.startsWith('I') || upVal.includes('İZİN') || upVal.includes('IZIN') || upVal === 'X' || upVal === 'R' || upVal === 'Yİ' || upVal === 'Üİ' || upVal === 'ÜS') shiftType = 'İzinli';
    else {
      const match = upVal.match(/^(\d{1,2})[.:]/);
      if (match) {
        const hour = parseInt(match[1], 10);
        if (hour < 13) shiftType = 'Sabah';
        else shiftType = 'Akşam';
      }
    }

    if (shiftType === 'İzinli') {
      return {
        title: 'Haftalık İzin',
        statusLabel: 'İzinli',
        statusColor: 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400'
      };
    }

    let title = shiftRaw;
    if (upVal === 'S' || upVal === 'SABAH' || (upVal.startsWith('S+') && !upVal.match(/^(\d{1,2})[.:]/))) title = 'Sabah Vardiyası';
    else if (upVal === 'A' || upVal === 'AKŞAM' || (upVal.startsWith('A+') && !upVal.match(/^(\d{1,2})[.:]/))) title = 'Akşam Vardiyası';

    const hasMutfak = shiftRaw.toLowerCase().includes('mutfak') || shiftRaw.toUpperCase().includes('+M');
    const hasDepo = shiftRaw.toLowerCase().includes('depo') || shiftRaw.toUpperCase().includes('+D');

    if (hasMutfak && !title.toLowerCase().includes('mutfak')) title += ' + Mutfak';
    if (hasDepo && !title.toLowerCase().includes('depo')) title += ' + Depo';

    if (shiftRaw.includes('+')) {
      const custom = shiftRaw.substring(shiftRaw.indexOf('+'));
      if (!custom.toLowerCase().includes('mutfak') && !custom.toLowerCase().includes('depo')) {
         if (!title.includes(custom)) title += ' ' + custom;
      }
    }

    let statusLabel = 'Mağazada';
    let statusColor = 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400';

    if (dateOffset === 0) {
      const activeBreak = dashboardData.colleagueBreaks?.find((b: any) => b.personnel_id === person.id && !b.break_end);
      if (activeBreak) {
        statusLabel = 'Molada';
        statusColor = 'bg-blue-100 text-blue-700 border-blue-200 animate-pulse dark:bg-blue-900/30 dark:text-blue-400';
      } else {
        if (shiftType === '') {
          statusLabel = 'Mağaza Dışı';
          statusColor = 'bg-gray-100 text-gray-500 border-gray-200 dark:bg-gray-800 dark:text-gray-400';
        } else {
          const now = new Date();
          const hhmm = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
          if (shiftType === 'Sabah') {
            if (hhmm >= '18:00') {
              statusLabel = 'Mesaisi Bitti';
              statusColor = 'bg-gray-100 text-gray-500 border-gray-200 dark:bg-gray-800 dark:text-gray-400';
            }
          } else if (shiftType === 'Akşam') {
            if (hhmm < '13:20') {
              statusLabel = 'Gelecek';
              statusColor = 'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400';
            } else if (hhmm >= '22:00') {
              statusLabel = 'Mesaisi Bitti';
              statusColor = 'bg-gray-100 text-gray-500 border-gray-200 dark:bg-gray-800 dark:text-gray-400';
            }
          }
        }
      }
    } else {
      statusLabel = 'Yarınki Plan';
      statusColor = 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400';
    }

    return { title, statusLabel, statusColor, hasMutfak, hasDepo };
  };

  const myStatusToday = getShiftStatus(personnel, 0);
  const myStatusTomorrow = getShiftStatus(personnel, 1);
  const colleagues = (dashboardData.deptCoworkers || []).filter((c: any) => c.id !== personnel.id && c.is_active);

  return (
    <Card className="glass-card mb-6 border-primary/20 bg-card">
      <CardHeader className="bg-primary/5 pb-3">
        <CardTitle className="flex items-center gap-2"><CalendarDays className="h-5 w-5 text-primary" /> Reyonum ve Vardiya Durumum ({personnel.department})</CardTitle>
      </CardHeader>
      <CardContent className="pt-4 grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Kendi 2 Günlük Planım */}
        <div className="space-y-4">
          <h3 className="font-bold text-foreground border-b pb-2 flex items-center justify-between">
            <span>👤 Benim Planım</span>
          </h3>
          <div className="flex flex-col gap-3">
            <div className={`p-3 rounded-lg border ${myStatusToday.statusColor}`}>
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs font-bold uppercase opacity-70 flex items-center gap-1"><Clock className="w-3 h-3" /> BUGÜN</span>
                <span className="text-xs font-bold px-2 py-0.5 rounded bg-background/50 shadow-sm">{myStatusToday.statusLabel}</span>
              </div>
              <p className="font-medium text-sm">{myStatusToday.title}</p>
            </div>
            
            <div className={`p-3 rounded-lg border ${myStatusTomorrow.statusColor} opacity-90`}>
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs font-bold uppercase opacity-70 flex items-center gap-1"><CalendarDays className="w-3 h-3" /> YARIN</span>
                <span className="text-xs font-bold px-2 py-0.5 rounded bg-background/50 shadow-sm">{myStatusTomorrow.statusLabel}</span>
              </div>
              <p className="font-medium text-sm">{myStatusTomorrow.title}</p>
            </div>
          </div>
        </div>

        {/* Çalışma Arkadaşlarım (Bugün) */}
        <div className="space-y-4">
          <h3 className="font-bold text-foreground border-b pb-2 flex items-center justify-between">
            <span>👥 Çalışma Arkadaşlarım (Bugün)</span>
          </h3>
          <div className="flex flex-col gap-2 max-h-[190px] overflow-y-auto pr-2 custom-scrollbar">
            {colleagues.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">Bu reyonda kayıtlı başka aktif personel yok.</p>
            ) : (
              colleagues.map((c: any) => {
                const status = getShiftStatus(c, 0);
                return (
                  <div key={c.id} className={`flex flex-col sm:flex-row justify-between items-start sm:items-center p-2.5 rounded-lg border bg-background/50 transition-colors border-l-4 ${status.statusColor.split(' ')[0].replace('bg-', 'border-')}`}>
                    <div>
                      <p className="font-bold text-sm tracking-tight">
                        {c.first_name} {c.last_name}
                        {status.hasMutfak && <span className="text-orange-600 dark:text-orange-400 font-extrabold ml-1">+M</span>}
                        {status.hasDepo && <span className="text-blue-600 dark:text-blue-400 font-extrabold ml-1">+D</span>}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">{status.title}</p>
                    </div>
                    <div className={`mt-2 sm:mt-0 text-[10px] uppercase font-bold px-2.5 py-1 rounded-full border shadow-sm ${status.statusColor}`}>
                      {status.statusLabel}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default EmployeePanel;
