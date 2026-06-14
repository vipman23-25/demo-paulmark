import { useState, Fragment } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { FileDown, Calendar as CalIcon, Settings2, RefreshCw, Printer, Image } from 'lucide-react';

const DAYS_TR = ['P.TESİ', 'SALI', 'ÇARŞ', 'PERŞ', 'CUMA', 'C.TESİ', 'PAZAR'];
const DAYS = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];

const formatDateTR = (dateStr: string) => {
    const months = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
    const d = new Date(dateStr);
    return `${d.getDate()} ${months[d.getMonth()]}`;
};

const getDynamicTitle = (startDateStr: string, branchName: string = 'ERZURUM FORUM') => {
    if (!startDateStr) return `${branchName} SHİFT TABLOSU`;
    const start = new Date(startDateStr);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    
    const months = ['OCAK', 'ŞUBAT', 'MART', 'NİSAN', 'MAYIS', 'HAZİRAN', 'TEMMUZ', 'AĞUSTOS', 'EYLÜL', 'EKİM', 'KASIM', 'ARALIK'];
    
    const startDay = start.getDate();
    const endDay = end.getDate();
    const startMonth = months[start.getMonth()];
    const endMonth = months[end.getMonth()];
    
    if (startMonth === endMonth) {
        return `${branchName} ${startDay}-${endDay} ${startMonth} SHİFT TABLOSU`;
    } else {
        return `${branchName} ${startDay} ${startMonth} - ${endDay} ${endMonth} SHİFT TABLOSU`;
    }
};

const getVirtualDept = (dept: string, groups: any[] = [], personnelId: string = '') => {
    if (!dept) return 'Tanımsız';
    
    if (groups && groups.length > 0) {
        if (groups.some(g => g.groupName === dept)) {
            return dept;
        }
        for (const g of groups) {
            if (personnelId && g.personnels && g.personnels.includes(personnelId)) {
                return g.groupName;
            }
            if (g.departments && g.departments.includes(dept)) {
                return g.groupName;
            }
        }
    }
    
    // Fallback/Legacy logic if no groups are defined
    const lowerDept = String(dept).toLocaleLowerCase('tr-TR');
    if (lowerDept.includes('kadın') || lowerDept.includes('çocuk') || lowerDept.includes('bayan')) {
        return 'Kadın & Çocuk Reyon';
    }
    return String(dept);
};

const getShiftCategory = (val: string): string => {
    if (!val) return '';
    const cleanVal = (val || '').toUpperCase().split('+')[0].trim();
    const absences = ['İ', 'I', 'R', 'Yİ', 'Üİ', 'ÜS', 'T', 'Ü', 'M', 'Y', 'Z', 'X', 'D', 'B'];

    if (absences.includes(cleanVal)) return 'İzinli';
    if (cleanVal === 'S' || cleanVal === 'SABAH') return 'Sabah';
    if (cleanVal === 'A' || cleanVal === 'AKŞAM') return 'Akşam';
    
    const match = cleanVal.match(/^(\d{1,2})[.:]/);
    if (match) {
        const hour = parseInt(match[1], 10);
        if (hour < 13) return 'Sabah';
        else return 'Akşam';
    }
    return 'Diğer';
};

const ShiftEngineTab = () => {
  const queryClient = useQueryClient();
  const [selectedWeekStart, setSelectedWeekStart] = useState<string>('');
  const [generatedGrid, setGeneratedGrid] = useState<any[]>([]);
  const [isGenerated, setIsGenerated] = useState(false);
  const [showOnlyAssignedTasks, setShowOnlyAssignedTasks] = useState(true);
  const [showCodeMigration, setShowCodeMigration] = useState(false);
  const [codeMappings, setCodeMappings] = useState<Record<string, string>>({});

  const { data: engineContext, isLoading, refetch } = useQuery({
    queryKey: ['shift_engine_context'],
    queryFn: async () => {
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        
        const results = await Promise.all([
          supabase.from('personnel').select('*').eq('is_active', true),
          supabase.from('personnel_movements').select('*').order('id', { ascending: false }).limit(5000),
          supabase.from('weekly_day_off').select('*').eq('status', 'approved'),
          supabase.from('department_shift_rules').select('*'),
          supabase.from('shift_schedules').select('*').gte('shift_date', thirtyDaysAgo),
          supabase.from('shift_preferences').select('*').eq('status', 'approved'),
          supabase.from('system_settings' as any).select('*').in('setting_key', ['general', 'shift_engine_config']),
          supabase.from('shift_dependency_rules').select('*')
        ]);

        const errors = results.map(r => r.error).filter(Boolean);
        if (errors.length > 0) {
            console.error("Shift engine data fetch errors:", errors);
            throw new Error("Veri tabanından bilgiler alınırken hata oluştu. Lütfen sayfayı yenileyin.");
        }

        const [
          { data: personnel },
          { data: movements },
          { data: dayOffs },
          { data: deptRules },
          { data: pastSchedules },
          { data: shiftPrefs },
          { data: settingsData },
          { data: dependencyRules }
        ] = results;

        const holidaysReq = await supabase.from('public_holidays' as any).select('*');
        const publicHolidays = holidaysReq.error ? [] : (holidaysReq.data || []);

        const generalSettingsRaw = settingsData?.find((s: any) => s.setting_key === 'general');
        const engineConfigRaw = settingsData?.find((s: any) => s.setting_key === 'shift_engine_config');

        const movementTypes = generalSettingsRaw?.setting_value?.movementTypes || [];
        
        // Fallback for UI if totally empty, but primary source is movementTypes
        const activeCodes = movementTypes.length > 0 ? movementTypes : [
          { code: 'S', label: 'Sabah' },
          { code: 'A', label: 'Akşam' },
          { code: 'İ', label: 'İzin' }
        ];

        if (!activeCodes.some((c: any) => c.code === '' || c.code === '-')) {
            activeCodes.unshift({ code: '', label: 'Temizle (-)' });
        }
        if (!activeCodes.some((c: any) => c.code === 'Y')) {
            activeCodes.push({ code: 'Y', label: 'Yıllık İzin (Y)' });
        }

        return {
          personnel: personnel || [],
          movements: movements || [],
          dayOffs: dayOffs || [],
          deptRules: deptRules || [],
          pastSchedules: pastSchedules || [],
          shiftPrefs: shiftPrefs || [],
          shiftCodes: activeCodes,
          engineConfig: engineConfigRaw?.setting_value || { blockMultipleAbsence: true },
          dependencyRules: dependencyRules || [],
          publicHolidays,
          generalSettings: generalSettingsRaw?.setting_value || {}
        };
    }
  });

  const getWeekDates = (startStr: string) => {
    if (!startStr) return [];
    const dates = [];
    const startObj = new Date(startStr);
    
    // Yıllık timezone/gün kaymasını önlemek için yerel saati kullan ve o haftanın Pazartesisine git
    let day = startObj.getDay();
    if (day === 0) day = 7; // Pazar
    
    // Seçilen tarihten kaç gün geriye gideceğimizi bul (Pazartesiye ulaşmak için)
    const diff = day - 1;
    startObj.setDate(startObj.getDate() - diff);
    
    for (let i = 0; i < 7; i++) {
        const d = new Date(startObj);
        d.setDate(d.getDate() + i);
        
        // Yerel saate göre YYYY-MM-DD formatını güvenli bir şekilde al
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const dayOfMonth = String(d.getDate()).padStart(2, '0');
        dates.push(`${year}-${month}-${dayOfMonth}`);
    }
    return dates;
  };

  const handleGenerate = async () => {
    try {
      if (!selectedWeekStart) return toast.error('Lütfen haftanın başlama tarihi (Pazartesi) seçiniz.');
      
      toast.info('Tüm güncel veriler yükleniyor (Hareketler, İzinler vb.). Lütfen bekleyin...', { duration: 3000 });
      const { data: engineContext } = await refetch();
      if (!engineContext) return toast.error('Motor verileri henüz yüklenmedi, lütfen bekleyin.');

      const weekDates = getWeekDates(selectedWeekStart);
      const newGrid: any[] = [];

    const isAbsence = (code: string) => {
        if (!code) return false;
        const upper = String(code).toUpperCase().trim();
        return ['İ', 'R', 'Yİ', 'Üİ', 'ÜS', 'T', 'Ü', 'M', 'Y', 'Z', 'X', 'D', 'B'].includes(upper) || upper.includes('YILLIK') || upper.includes('RAPOR');
    };

    const groups = engineContext?.engineConfig?.department_groups || [];
    const targetOrder = ['Müdür', 'Kadın & Çocuk Reyon', 'Erkek Reyon', 'Kasiyer'];
    const depts = Array.from(new Set(engineContext.personnel.map((p: any) => getVirtualDept(p.department, groups, p.id))));
    depts.sort((a, b) => {
      let ia = targetOrder.indexOf(a);
      let ib = targetOrder.indexOf(b);
      if (ia === -1) ia = 999;
      if (ib === -1) ib = 999;
      if (ia !== ib) return ia - ib;
      return a.localeCompare(b);
    });

    let collisionError = "";

    const allRows: any[] = engineContext.personnel.map((p: any) => ({
        personnel_id: p.id, 
        adSoyad: `${p.first_name || ''} ${p.last_name || ''}`.trim(), 
        department: getVirtualDept(p.department, groups, p.id), 
        originalDept: p.department || 'Tanımsız', 
        gender: p.gender, 
        employment_type: p.employment_type || 'full_time', 
        contract_start_date: p.contract_start_date, 
        contract_end_date: p.contract_end_date, 
        shifts: {}, tasks: {}, preferredShift: {}
    }));

    // OPTIMIZATION: O(1) Lookups
    const rowsById = new Map(allRows.map(r => [r.personnel_id, r]));

    // OPTIMIZATION: Pre-calculate past schedules to avoid O(N^3) in sorting
    const pastCountsMap = new Map();
    engineContext.personnel.forEach((p: any) => {
        const pSchedules = engineContext.pastSchedules.filter((s: any) => s.personnel_id === p.id);
        const sabahCount = pSchedules.filter((s: any) => ['S', 'Sabah'].includes(s.shift_type)).length;
        const aksamCount = pSchedules.filter((s: any) => ['A', 'Akşam'].includes(s.shift_type)).length;
        pastCountsMap.set(p.id, { sabah: sabahCount, aksam: aksamCount });
    });

    depts.forEach(dept => {
      const rows = allRows.filter(r => r.department === dept);
      const deptStaff = engineContext.personnel.filter(p => getVirtualDept(p.department, groups, p.id) === dept);
      
      // Step 1: Initialize rows and map absences
      deptStaff.forEach(p => {
        const row = rows.find(r => r.personnel_id === p.id);
        if (!row) return;

        const pMovements = engineContext.movements.filter(m => m.personnel_id === p.id);
        
        weekDates.forEach((dateStr) => {
            // Bayram Part Time Contract Check
            if (row.employment_type === 'bayram_part_time') {
               if (row.contract_start_date && row.contract_end_date) {
                  if (dateStr < row.contract_start_date || dateStr > row.contract_end_date) {
                      row.shifts[dateStr] = 'X'; // Contract out of bounds
                  }
               } else {
                  row.shifts[dateStr] = 'X'; // No contract defined
               }
            }
            
            // Part Time Public Holiday Check
            if (row.employment_type === 'part_time') {
                const isHoliday = engineContext.publicHolidays?.some((h: any) => h.date === dateStr);
                if (isHoliday) {
                    row.shifts[dateStr] = 'X'; // Public Holiday restriction
                }
            }

            const hasMovement = pMovements.find(m => {
                if (!m.start_date) return false;
                
                const parseSafeLocal = (isoStr: string) => {
                    if (isoStr.includes('.')) {
                        const p = isoStr.split('.');
                        if (p.length === 3) return `${p[2]}-${p[1]}-${p[0]}`;
                    }
                    const d = new Date(isoStr);
                    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                };
                
                const mStart = parseSafeLocal(m.start_date);
                const mEnd = m.end_date ? parseSafeLocal(m.end_date) : mStart;

                return mStart <= dateStr && mEnd >= dateStr;
            });

            if (hasMovement && hasMovement.movement_type && !row.shifts[dateStr]) {
                let mType = String(hasMovement.movement_type).trim();
                if ((mType || '').toUpperCase().includes('YILLIK')) mType = 'Y';
                row.shifts[dateStr] = mType; // e.g. R, Yİ, Y
            }
        });
      });

      // (Müdürler için eskiden burada erken çıkış yapılıyordu, artık diğer personeller gibi izinlerini (T, R vb) alabilmeleri için bu kural kaldırıldı)


      // Step 2 & 3: Leave Assignments
      const isLeaveSelectionActive = engineContext.generalSettings?.isLeaveSelectionActive ?? true;
      if (isLeaveSelectionActive) {
        // Step 2: Map explicit Day Offs (Haftalık İzin)
        deptStaff.forEach((p, idx) => {
          const row = rows[idx];
          const pDayOffs = engineContext.dayOffs.filter(d => d.personnel_id === p.id);
          row.debug_dayoffs = pDayOffs;
          
          weekDates.forEach((dateStr) => {
             const [yyyy, mm, dd] = dateStr.split('-');
             const localDate = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
             let dayOfWeek = localDate.getDay();
             if (dayOfWeek === 0) dayOfWeek = 7;

             // DEBUG
             if (!row.debug_days) row.debug_days = {};
             row.debug_days[dateStr] = dayOfWeek;

             if (pDayOffs.some(d => Number(d.day_of_week) === dayOfWeek) && !row.shifts[dateStr]) {
                 row.shifts[dateStr] = 'T'; // Haftalık izin (Hafta Tatili)
             }
          });
        });

        // Step 3: Auto-assign missing Day Offs (Balanced Distribution)
        depts.forEach(dpt => {
            const currentDeptStaff = rows.filter(r => r.department === dpt);
            currentDeptStaff.forEach((row) => {
                const hasDayOff = weekDates.some(d => isAbsence(row.shifts[d]));
                if (!hasDayOff) {
                    let minCount = 999;
                    let minDay = -1;
                    // İlk tercih: 2 kişiden az izinli olan günleri bul (Max 2 kuralı)
                    for (let d = 0; d < 5; d++) {
                        const dateStr = weekDates[d];
                        const countOff = currentDeptStaff.filter(r => isAbsence(r.shifts[dateStr]) || r.shifts[dateStr] === 'T').length;
                        if (countOff < 2 && countOff < minCount) {
                            minCount = countOff;
                            minDay = d;
                        }
                    }
                    
                    // Eğer tüm haftaiçi günlerinde en az 2 kişi izinliyse, mecburen en boş olan güne atama yap (Haftasonuna sarkmaması için)
                    if (minDay === -1) {
                        minCount = 999;
                        for (let d = 0; d < 5; d++) {
                            const dateStr = weekDates[d];
                            const countOff = currentDeptStaff.filter(r => isAbsence(r.shifts[dateStr]) || r.shifts[dateStr] === 'T').length;
                            if (countOff < minCount) {
                                minCount = countOff;
                                minDay = d;
                            }
                        }
                    }
                    
                    if (minDay !== -1) {
                        row.shifts[weekDates[minDay]] = 'T';
                    }
                }
            });
        });
      }

      // Step 4: Collision Check
      if (engineContext.engineConfig?.blockMultipleAbsence !== false) {
          weekDates.forEach(dateStr => {
              const offStaff = rows.filter(r => isAbsence(r.shifts[dateStr]));
              if (offStaff.length >= 2 && deptStaff.length >= 2) {
                  const names = offStaff.map(r => r.adSoyad).join(", ");
                  collisionError = `Hata: ${dept} reyonunda ${names} aynı gün (${dateStr}) izin/rapor durumundadır. Lütfen hareketleri kontrol edin.`;
              }
          });
      }

      // Step 5: Special Requests (Preferences)
      const isShiftSelectionActive = engineContext.generalSettings?.isShiftSelectionActive ?? true;
      if (isShiftSelectionActive) {
        deptStaff.forEach((p, idx) => {
           const row = rows[idx];
           const pPrefs = engineContext.shiftPrefs.filter(sp => sp.personnel_id === p.id);
           weekDates.forEach((dateStr) => {
               const [yyyy, mm, dd] = dateStr.split('-');
               const localDate = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
               let dayOfWeek = localDate.getDay();
               if (dayOfWeek === 0) dayOfWeek = 7;

               const pref = pPrefs.find(sp => Number(sp.day_of_week) === dayOfWeek);
               if (pref && !row.shifts[dateStr]) {
                   row.shifts[dateStr] = pref.requested_shift?.toLowerCase() === 'sabah' ? 'S' : 'A';
               }
           });
        });
      }

      // Step 5.5: Part Time 16 Days Max Limit
      deptStaff.forEach((p, idx) => {
        const row = rows[idx];
        if (row.employment_type === 'part_time') {
           const weekMonth = selectedWeekStart.substring(0, 7);
           let monthWorkCount = engineContext.pastSchedules.filter((s: any) => s.personnel_id === p.id && s.shift_date.startsWith(weekMonth) && ['S', 'A', 'S+M', 'S+D', 'A+M', 'A+D'].includes(s.shift_type)).length;
           
           weekDates.forEach((dateStr) => {
               if (!row.shifts[dateStr]) { // unassigned
                  if (monthWorkCount >= 16) {
                      row.shifts[dateStr] = 'X'; // Reached monthly limit
                  } else {
                      monthWorkCount++; // Assuming they will get assigned today
                  }
               }
           });
         }
      });

      // Step 5.6: Bayram Part Time Auto Assignment
      const isHolidayMode = engineContext.engineConfig?.isHolidayModeActive;
      const holidayStart = engineContext.engineConfig?.holidayStartDate ? new Date(engineContext.engineConfig.holidayStartDate) : null;
      const holidayEnd = engineContext.engineConfig?.holidayEndDate ? new Date(engineContext.engineConfig.holidayEndDate) : null;

      deptStaff.forEach((p, idx) => {
        const row = rows[idx];
        if (row.employment_type === 'bayram_part_time') {
           weekDates.forEach((dateStr) => {
               if (!row.shifts[dateStr]) { // unassigned
                  const currentDate = new Date(dateStr);
                  let isHolidayDate = false;
                  if (isHolidayMode && holidayStart && holidayEnd) {
                      if (currentDate >= holidayStart && currentDate <= holidayEnd) {
                          isHolidayDate = true;
                      }
                  }
                  const holidayNormalHours = engineContext.engineConfig?.holidayNormalHours || '13:30/22:00';
                  const holidaySpecialHours = engineContext.engineConfig?.holidaySpecialHours || '14:30/23:00';
                  
                  row.shifts[dateStr] = isHolidayDate ? holidaySpecialHours : holidayNormalHours;
               }
           });
        }
      });
    }); // End of Steps 1-5 pass

    // DYNAMIC DEPARTMENT HELPER
    const getDailyVirtualDept = (pId: string, dateStr: string) => {
        const row = rowsById.get(pId);
        if (!row) return 'Tanımsız';
        const staticDept = row.department;
        
        for (const g of groups) {
            if (g.isDynamic && g.backupPersonnels?.includes(pId)) {
                const primaryAbsent = g.personnels?.some((pid: string) => {
                    const pRow = rowsById.get(pid);
                    if (pRow) {
                        const code = pRow.shifts[dateStr];
                        if (code && g.triggerCodes?.includes(code)) return true;
                    }
                    return false;
                });
                if (primaryAbsent) return g.groupName;
            }
        }
        return staticDept;
    };

    // Step 6: Distribution Algorithm based on ACTIVE staff
    depts.forEach(dept => {
      if (String(dept).toLowerCase().includes('müdür')) return;

      weekDates.forEach((dateStr, dIdx) => {
          const dailyRows = allRows.filter(r => getDailyVirtualDept(r.personnel_id, dateStr) === dept);

          const unassignedRows = dailyRows.filter(r => !r.shifts[dateStr] && r.employment_type !== 'bayram_part_time');
          if (unassignedRows.length === 0) return;

          const activeRows = dailyRows.filter(r => !isAbsence(r.shifts[dateStr]));
          const totalActive = activeRows.length; // Remaining active people today
          
          let targetS = 0;
          let targetA = 0;

          // Distribution Rules based on Active Worker Count
          const isWeekend = dIdx >= 5;
          const deptDemandRules = engineContext.engineConfig?.department_demand_rules || {};
          let demandRules = deptDemandRules[dept];
          
          if (!demandRules) {
              const matchedKey = Object.keys(deptDemandRules).find(k => k.toLowerCase() === dept.toLowerCase());
              if (matchedKey) demandRules = deptDemandRules[matchedKey];
          }
          if (!demandRules && (dept.toLowerCase().includes('kadın') || dept.toLowerCase().includes('çocuk') || dept.toLowerCase().includes('bayan'))) {
              demandRules = deptDemandRules['Kadın & Çocuk Reyon'];
          }
          
          demandRules = demandRules || deptDemandRules["Genel"] || engineContext.engineConfig?.demand_rules;

          if (demandRules) {
             const rulesArray = isWeekend ? demandRules.weekend : demandRules.weekday;
             const specificRule = rulesArray?.find((r: any) => parseInt(r.total) === totalActive);
             
             if (specificRule && (parseInt(specificRule.s) > 0 || parseInt(specificRule.a) > 0)) {
                 targetS = parseInt(specificRule.s) || 0;
                 targetA = parseInt(specificRule.a) || 0;
             } else {
                 // Fallback proportional if totalActive exceeds config rows OR rule is 0/0
                 targetS = Math.floor(totalActive / 2);
                 targetA = Math.ceil(totalActive / 2);
             }
          } else {
              if (totalActive === 2) { targetS = 1; targetA = 1; }
              else if (totalActive === 3) { targetS = 1; targetA = 2; }
              else if (totalActive === 4) { targetS = 2; targetA = 2; }
              else if (totalActive === 5) { targetS = 2; targetA = 3; }
              else if (totalActive === 6) { targetS = 2; targetA = 4; }
              else if (totalActive >= 7) { targetS = 3; targetA = totalActive - 3; }
              else if (totalActive === 1) { targetS = 0; targetA = 1; }
          }

          let currentS = activeRows.filter(r => r.shifts[dateStr] && getShiftCategory(r.shifts[dateStr]) === 'Sabah').length;
          let currentA = activeRows.filter(r => r.shifts[dateStr] && getShiftCategory(r.shifts[dateStr]) === 'Akşam').length;

          // Adjust targets based on already assigned preferences/movements
          targetS = Math.max(0, targetS - currentS);
          targetA = Math.max(0, targetA - currentA);

          // Rotation & Balancing Logic
          unassignedRows.sort((rA, rB) => {
              const prevDateStr = dIdx > 0 ? weekDates[dIdx - 1] : null;
              const rAPrev = prevDateStr ? rA.shifts[prevDateStr] : null;
              const rBPrev = prevDateStr ? rB.shifts[prevDateStr] : null;

              let scoreA = 0; // High score = give S, Low score = give A
              let scoreB = 0;

              // 1. Rotation (Avoid same shift consecutively)
              if (rAPrev === 'S') scoreA -= 40; // Needs A
              if (rAPrev === 'A') scoreA += 40; // Needs S

              if (rBPrev === 'S') scoreB -= 40;
              if (rBPrev === 'A') scoreB += 40;

              // 2. Weekly Fairness Balance
              const rASabahCount = weekDates.filter(d => getShiftCategory(rA.shifts[d]) === 'Sabah').length;
              const rBSabahCount = weekDates.filter(d => getShiftCategory(rB.shifts[d]) === 'Sabah').length;
              const rAAksamCount = weekDates.filter(d => getShiftCategory(rA.shifts[d]) === 'Akşam').length;
              const rBAksamCount = weekDates.filter(d => getShiftCategory(rB.shifts[d]) === 'Akşam').length;

              // Penalize having too many Sabah shifts, reward having many Akşam shifts
              scoreA -= (rASabahCount * 60);
              scoreB -= (rBSabahCount * 60);
              scoreA += (rAAksamCount * 60);
              scoreB += (rBAksamCount * 60);

              // 3. Prevent extreme imbalances if possible (Hard limits)
              if (rAAksamCount >= 4) scoreA += 150; // Force S if they worked 4 evenings
              if (rBAksamCount >= 4) scoreB += 150;
              if (rASabahCount >= 4) scoreA -= 150; // Force A if they worked 4 mornings
              if (rBSabahCount >= 4) scoreB -= 150;

              // 4. Preferences (Onaylı Tercihler)
              if (rA.preferredShift[dateStr] === 'S') scoreA += 100;
              if (rA.preferredShift[dateStr] === 'A') scoreA -= 100;

              if (rB.preferredShift[dateStr] === 'S') scoreB += 100;
              if (rB.preferredShift[dateStr] === 'A') scoreB -= 100;

              // 5. Monthly Balance (Past schedules fallback)
              const pastA = pastCountsMap.get(rA.personnel_id) || { sabah: 0, aksam: 0 };
              if (pastA.aksam > pastA.sabah) scoreA += 10;

              const pastB = pastCountsMap.get(rB.personnel_id) || { sabah: 0, aksam: 0 };
              if (pastB.aksam > pastB.sabah) scoreB += 10;
              
              return scoreB - scoreA; // Descending order (highest score gets S first)
          });

          // Assignment loop
          unassignedRows.forEach(row => {
             let assignS = false;
             
             if (currentS < targetS && currentA < targetA) {
                 assignS = true; // Top scorer gets S
             } else if (currentS < targetS) {
                 assignS = true; // Forced S because A is full
             } else {
                 assignS = false; // Forced A because S is full
             }

             if (assignS) {
                 row.shifts[dateStr] = 'S';
                 currentS++;
             } else {
                 row.shifts[dateStr] = 'A';
                 currentA++;
             }
          });
      });
    }); // End of Step 6

    // Step 6.5: Müdür Özel Dağılımı (Kural Bazlı Atama)
    const mudurRows = allRows.filter(r => String(r.department).toLowerCase().includes('müdür'));
    
    mudurRows.forEach(row => {
        const activeDays = weekDates.filter(d => !isAbsence(row.shifts[d]));
        
        activeDays.forEach((dateStr, dIdx) => {
            const currentDate = new Date(dateStr);
            const dayOfWeek = currentDate.getDay(); // 0 = Pazar, 6 = Cumartesi
            let assigned = false;

            // Kural 1: İzin gününden 1 gün öncesi kesinlikle S (En Yüksek Öncelik)
            const nextDateStr = weekDates[dIdx + 1]; 
            if (nextDateStr && isAbsence(row.shifts[nextDateStr])) {
                row.shifts[dateStr] = 'S';
                assigned = true;
            } else if (!nextDateStr && dIdx === 6) {
                // Eğer pazar günüysek ve bir sonraki gün (Pazartesi) kişinin sabit izin günüyse
                const pDayOffs = engineContext.dayOffs.filter(d => d.personnel_id === row.personnel_id);
                if (pDayOffs.some(d => Number(d.day_of_week) === 1)) {
                    row.shifts[dateStr] = 'S';
                    assigned = true;
                }
            }
            
            // Kural 2: 3 günlük çalışma bloğunun ortası (2. günü) A
            if (!assigned) {
                const prevDateStr = dIdx > 0 ? weekDates[dIdx - 1] : null;
                if (prevDateStr && nextDateStr) {
                    if (!isAbsence(row.shifts[prevDateStr]) && !isAbsence(row.shifts[nextDateStr])) {
                        row.shifts[dateStr] = 'A';
                        assigned = true;
                    }
                }
            }

            // Kural 3: Hafta Sonu A
            if (!assigned) {
                if (dayOfWeek === 0 || dayOfWeek === 6) { // Pazar veya Cumartesi
                    row.shifts[dateStr] = 'A';
                    assigned = true;
                }
            }
        });

        // Kural 4: Kalan günlerin S/A olarak dengeli dağıtılması
        const remainingUnassigned = activeDays.filter(d => !row.shifts[d]);
        let currentSCount = activeDays.filter(d => row.shifts[d] === 'S').length;
        let currentACount = activeDays.filter(d => row.shifts[d] === 'A').length;

        remainingUnassigned.forEach(dateStr => {
            if (currentSCount <= currentACount) {
                row.shifts[dateStr] = 'S';
                currentSCount++;
            } else {
                row.shifts[dateStr] = 'A';
                currentACount++;
            }
        });
    });

    newGrid.push(...allRows);

    // Step 7: Cross-Department Dependency Rules (Second Pass Override)
    if (engineContext.dependencyRules && engineContext.dependencyRules.length > 0) {
        const groups = engineContext?.engineConfig?.department_groups || [];
        engineContext.dependencyRules.forEach((rule: any) => {
            const targetDeptRows = newGrid.filter(r => getVirtualDept(r.originalDept, groups, r.personnel_id) === getVirtualDept(rule.target_department, groups));
            const supportPersonRow = rowsById.get(rule.personnel_id);

            if (!supportPersonRow || targetDeptRows.length === 0) return;

            weekDates.forEach(dateStr => {
                // If support person is already absent (Off, Report, etc), do not override
                if (isAbsence(supportPersonRow.shifts[dateStr])) return;

                // Count absences in target dept
                const absentCount = targetDeptRows.filter(r => isAbsence(r.shifts[dateStr])).length;
                
                // If absences reach the trigger count
                if (absentCount >= (rule.trigger_absence_count || 1)) {
                    // Check if the remaining active staff match the trigger shift type
                    // If trigger_shift_type is 'S', we check if AT LEAST ONE of the remaining staff has 'S'
                    let shiftConditionMet = false;
                    
                    if (rule.trigger_shift_type && rule.trigger_shift_type !== '-') {
                        const activeStaff = targetDeptRows.filter(r => !isAbsence(r.shifts[dateStr]));
                        shiftConditionMet = activeStaff.some(r => r.shifts[dateStr] && getShiftCategory(r.shifts[dateStr]) === (rule.trigger_shift_type === 'A' ? 'Akşam' : 'Sabah'));
                    } else {
                        // If no specific shift type is required, just checking absence is enough
                        shiftConditionMet = true;
                    }

                    if (shiftConditionMet) {
                        supportPersonRow.shifts[dateStr] = rule.action_shift_type || 'A';
                    }
                }
            });
        });
    }

    const finalOrder = ['müdür', 'kasiyer', 'çocuk', 'kadın', 'bayan', 'erkek'];
    newGrid.sort((a, b) => {
        const aDept = String(a.originalDept || '').toLocaleLowerCase('tr-TR');
        const bDept = String(b.originalDept || '').toLocaleLowerCase('tr-TR');

        let ia = finalOrder.findIndex(dept => aDept.includes(dept));
        let ib = finalOrder.findIndex(dept => bDept.includes(dept));

        if (ia === -1) ia = 999;
        if (ib === -1) ib = 999;

        if (ia !== ib) return ia - ib;
        return String(a.adSoyad || '').localeCompare(String(b.adSoyad || ''), 'tr-TR');
    });

    if (collisionError) {
        if (!window.confirm(`${collisionError}\n\nYine de bu kural ihlaline rağmen vardiyayı oluşturmak istiyor musunuz?`)) {
            return; 
        }
    }

    if (newGrid.length === 0) {
        toast.error('Aktif personel bulunamadığı için liste oluşturulamadı.');
        return;
    }

    let finalGrid = newGrid;
    finalGrid = assignTasksToGrid(finalGrid, 'Depo', 'A');
    finalGrid = assignTasksToGrid(finalGrid, 'Mutfak', 'S');

    setGeneratedGrid(finalGrid);
    setIsGenerated(true);
    toast.success('Haftalık Vardiya Listesi Taslağı Oluşturuldu! Düzenleyip kaydedebilirsiniz.');
    } catch (err: any) {
      console.error("Vardiya oluşturma hatası:", err);
      toast.error("Motor çalışırken bir hata oluştu: " + err.message);
    }
  };

  const handleCellChange = (pId: string, dateStr: string, val: string) => {
      setGeneratedGrid(prev => prev.map(row => {
          if (row.personnel_id === pId) {
              const newShifts = { ...row.shifts };
              const newTasks = { ...row.tasks };
              if (val === '') {
                  delete newShifts[dateStr];
              } else {
                  newShifts[dateStr] = val;
              }
              return { ...row, shifts: newShifts, tasks: newTasks };
          }
          return row;
      }));
  };

  const handleTaskChange = (pId: string, dateStr: string, taskVal: string) => {
      setGeneratedGrid(prev => prev.map(row => {
          if (row.personnel_id === pId) {
              const newTasks = { ...row.tasks };
              const newShifts = { ...row.shifts };
              let currentShift = newShifts[dateStr] || '';
              
              currentShift = currentShift.replace('+M', '').replace('+D', '');
              
              if (taskVal === '') {
                  delete newTasks[dateStr];
              } else {
                  newTasks[dateStr] = taskVal;
              }
              newShifts[dateStr] = currentShift;
              
              return { ...row, tasks: newTasks, shifts: newShifts };
          }
          return row;
      }));
  };

  const assignTasksToGrid = (currentGrid: any[], taskName: 'Depo' | 'Mutfak', targetShift: 'A' | 'S') => {
      const config = taskName === 'Depo' ? engineContext?.engineConfig?.depo_config : engineContext?.engineConfig?.mutfak_config;
      const c = config || { count: 0, gender: 'Tümü', departments: [], included_personnel: [], excluded_personnel: [] };
      const targetCount = c.count || 0;
      
      if (targetCount === 0 && (!c.included_personnel || c.included_personnel.length === 0)) {
          return currentGrid;
      }
      
      const weekDates = getWeekDates(selectedWeekStart);
      const newGrid = currentGrid.map(row => ({ ...row, tasks: { ...row.tasks }, shifts: { ...row.shifts } }));
      
      weekDates.forEach((dateStr) => {
          const dt = new Date(dateStr);
          const dayOfWeek = dt.getDay() === 0 ? 7 : dt.getDay(); // 1=Mon, 7=Sun
          
          if (c.active_days && c.active_days.length > 0 && !c.active_days.includes(dayOfWeek)) {
              return; 
          }

          newGrid.forEach(r => { 
              if (r.tasks && r.tasks[dateStr] === taskName) {
                  delete r.tasks[dateStr]; 
                  if (r.shifts && r.shifts[dateStr]) {
                      r.shifts[dateStr] = r.shifts[dateStr].replace(taskName === 'Mutfak' ? '+M' : '+D', '');
                  }
              }
          });
          
          let candidates = newGrid.filter(r => {
             const s = r.shifts[dateStr];
             if (!s) return false;
             if (r.tasks && r.tasks[dateStr] && r.tasks[dateStr] !== taskName) return false; 
             
             if (c.valid_shifts && c.valid_shifts.length > 0) {
                 return c.valid_shifts.some((vs: string) => {
                     const cleanVs = vs.replace('+M', '').replace('+D', '');
                     const cleanS = s.replace('+M', '').replace('+D', '');
                     if (cleanVs === cleanS || cleanS.startsWith(cleanVs)) return true;
                     
                     if (cleanVs === 'A' && getShiftCategory(cleanS) === 'Akşam') return true;
                     if (cleanVs === 'S' && getShiftCategory(cleanS) === 'Sabah') return true;
                     
                     return false;
                 });
             } else {
                 const mappedShift = targetShift === 'A' ? 'Akşam' : 'Sabah';
                 return getShiftCategory(s) === mappedShift;
             }
          });
          
          if (c.excluded_personnel && c.excluded_personnel.length > 0) {
              candidates = candidates.filter(r => !c.excluded_personnel.includes(r.personnel_id));
          }
          
          const forcedCandidates = candidates.filter(r => c.included_personnel && c.included_personnel.includes(r.personnel_id));
          let regularCandidates = candidates.filter(r => !c.included_personnel || !c.included_personnel.includes(r.personnel_id));
          
          if (c.gender && c.gender !== 'Tümü') {
              regularCandidates = regularCandidates.filter(r => r.gender === c.gender);
          }
          
          if (c.departments && c.departments.length > 0) {
              regularCandidates = regularCandidates.filter(r => c.departments.includes(r.originalDept));
          }
          
          // Adil dağıtım (Fair Distribution) algoritması:
          // Her personelin bu hafta şu ana kadar kaç kez bu görevi aldığını say
          const sortByTaskCount = (a: any, b: any) => {
              const countA = Object.values(a.tasks || {}).filter(t => t === taskName).length;
              const countB = Object.values(b.tasks || {}).filter(t => t === taskName).length;
              if (countA !== countB) return countA - countB; // Az görev alan öncelikli
              return 0.5 - Math.random(); // Eşitse rastgele
          };

          forcedCandidates.sort(sortByTaskCount);
          regularCandidates.sort(sortByTaskCount);
          
          // Günlük hedefi kesinlikle aşmamak için slice() kullan
          const selectedForced = forcedCandidates.slice(0, targetCount);
          const remainingCount = Math.max(0, targetCount - selectedForced.length);
          const selected = [...selectedForced, ...regularCandidates.slice(0, remainingCount)];
          
          selected.forEach(r => { 
              if (!r.tasks) r.tasks = {};
              r.tasks[dateStr] = taskName; 
          });
      });
      return newGrid;
  };

  const handleAssignTasks = (taskName: 'Depo' | 'Mutfak', targetShift: 'A' | 'S') => {
      if (!generatedGrid.length) return;
      
      const config = taskName === 'Depo' ? engineContext?.engineConfig?.depo_config : engineContext?.engineConfig?.mutfak_config;
      const c = config || { count: 0, gender: 'Tümü', departments: [], included_personnel: [], excluded_personnel: [] };
      const targetCount = c.count || 0;
      
      if (targetCount === 0 && (!c.included_personnel || c.included_personnel.length === 0)) {
          return toast.info(`Ayarlarda ${taskName} çalışan hedefi 0 olarak belirlenmiş.`);
      }
      
      const newGrid = assignTasksToGrid(generatedGrid, taskName, targetShift);
      setGeneratedGrid(newGrid);
      toast.success(`${taskName} görevleri detaylı kurallara göre dağıtıldı.`);
  };

  const applyQuotasToGrid = (grid: any[]) => {
      const shiftCodes = engineContext?.shiftCodes || [];
      const aMappings = shiftCodes.find((c: any) => c.code === 'A') || {};
      const sMappings = shiftCodes.find((c: any) => c.code === 'S') || {};

      const A2 = aMappings.mappedCode2 || '13:30/22:00';
      const A3 = aMappings.mappedCode3 || '12:30/21:00';

      const S1 = sMappings.mappedCode || '09:30/18:00';
      const S2 = sMappings.mappedCode2 || '11:30/20:00';

      const config = engineContext?.engineConfig || {};
      const groups = config.department_groups || [];
      const depts = Array.from(new Set(grid.map((r: any) => getVirtualDept(r.originalDept, groups, r.personnel_id))));
      const weekDates = getWeekDates(selectedWeekStart);

      let changedCount = 0;

      depts.forEach(dept => {
          const deptRows = grid.filter((r: any) => getVirtualDept(r.originalDept, groups, r.personnel_id) === dept);
          
          weekDates.forEach(dateStr => {
              const activeRows = deptRows.filter((r: any) => {
                  const val = r.shifts[dateStr] || '';
                  const cleanVal = val.replace('+M', '').replace('+D', '');
                  return cleanVal && !['İ', 'R', 'Yİ', 'Y', 'Üİ', 'ÜS', 'T', 'X'].includes((cleanVal || '').toUpperCase()) && !(cleanVal || '').toUpperCase().includes('YILLIK');
              });

              // Bayram Part Time Update
              const isHolidayMode = config.isHolidayModeActive;
              const holidayStart = config.holidayStartDate ? new Date(config.holidayStartDate) : null;
              const holidayEnd = config.holidayEndDate ? new Date(config.holidayEndDate) : null;
              const currentDate = new Date(dateStr);
              let isHolidayDate = false;
              if (isHolidayMode && holidayStart && holidayEnd) {
                  if (currentDate >= holidayStart && currentDate <= holidayEnd) {
                      isHolidayDate = true;
                  }
              }
              const holidayNormalHours = config.holidayNormalHours || '13:30/22:00';
              const holidaySpecialHours = config.holidaySpecialHours || '14:30/23:00';

              activeRows.forEach((r: any) => {
                  if (r.employment_type === 'bayram_part_time') {
                      const newVal = isHolidayDate ? holidaySpecialHours : holidayNormalHours;
                      if (r.shifts[dateStr] !== newVal) {
                          r.shifts[dateStr] = newVal;
                          changedCount++;
                      }
                  }
              });

              const targetRows = activeRows.filter((r: any) => r.employment_type !== 'bayram_part_time' && r.shifts[dateStr]);
              if (targetRows.length === 0) return;

              const A1 = isHolidayDate ? holidaySpecialHours : holidayNormalHours;

              const quotas = { [A1]: 0, [A2]: 0, [A3]: 0, [S1]: 0, [S2]: 0 };
              let remaining = targetRows.length;
              
              if (remaining >= 1) { quotas[S1] = (quotas[S1] || 0) + 1; remaining--; }
              if (remaining >= 1) { quotas[A1] = (quotas[A1] || 0) + 1; remaining--; }
              if (remaining >= 1) { quotas[A2] = (quotas[A2] || 0) + 1; remaining--; }
              if (remaining >= 1) { quotas[S2] = (quotas[S2] || 0) + 1; remaining--; }
              if (remaining >= 1) { quotas[A3] = (quotas[A3] || 0) + 1; remaining--; }
              if (remaining >= 1) { quotas[A1] = (quotas[A1] || 0) + 1; remaining--; }
              if (remaining >= 1) { quotas[A2] = (quotas[A2] || 0) + 1; remaining--; }
              if (remaining >= 1) { quotas[A1] = (quotas[A1] || 0) + 1; remaining--; }
              if (remaining >= 1) { quotas[S2] = (quotas[S2] || 0) + 1; remaining--; }
              if (remaining >= 1) { quotas[A1] = (quotas[A1] || 0) + 1; remaining--; }
              while (remaining > 0) { quotas[A1] = (quotas[A1] || 0) + 1; remaining--; }

              targetRows.sort((a: any, b: any) => {
                  const isA_S = getShiftCategory(a.shifts[dateStr] || '') === 'Sabah' ? 0 : 1;
                  const isB_S = getShiftCategory(b.shifts[dateStr] || '') === 'Sabah' ? 0 : 1;
                  return isA_S - isB_S;
              });

              const availableS: string[] = [];
              for (let i = 0; i < (quotas[S1] || 0); i++) availableS.push(S1);
              for (let i = 0; i < (quotas[S2] || 0); i++) availableS.push(S2);

              const availableA: string[] = [];
              for (let i = 0; i < (quotas[A1] || 0); i++) availableA.push(A1);
              for (let i = 0; i < (quotas[A2] || 0); i++) availableA.push(A2);
              for (let i = 0; i < (quotas[A3] || 0); i++) availableA.push(A3);

              const combinedAvailable = [...availableS, ...availableA];
              targetRows.forEach((row: any, idx: number) => {
                  if (combinedAvailable[idx]) {
                      const original = row.shifts[dateStr] || '';
                      const suffix = original.includes('+M') ? '+M' : original.includes('+D') ? '+D' : '';
                      const newVal = combinedAvailable[idx] + suffix;
                      if (original !== newVal) {
                          row.shifts[dateStr] = newVal;
                          changedCount++;
                      }
                  }
              });
          });
      });

      return { newGrid: grid, changedCount };
  };

  const handleApplyHolidayShift = () => {
      if (!isGenerated || generatedGrid.length === 0) return;
      
      const newGridCopy = generatedGrid.map(r => ({...r, shifts: {...r.shifts}, tasks: {...r.tasks}}));
      const { newGrid, changedCount } = applyQuotasToGrid(newGridCopy);

      setGeneratedGrid(newGrid);
      if (changedCount > 0) toast.success(`Saatler tüm eşleşmeler kullanılarak başarıyla yeniden dağıtıldı! ${changedCount} vardiya değiştirildi.`);
      else toast.info("Dağıtıma uygun değiştirilecek vardiya bulunamadı.");
  };

  const calculateUnknownCodes = () => {
      if (!isGenerated || !engineContext) return [];
      const unknowns = new Set<string>();
      const systemCodes = ['İ', 'R', 'Yİ', 'Y', 'Üİ', 'ÜS', 'T', 'X'];
      generatedGrid.forEach(row => {
          Object.values(row.shifts).forEach((val: any) => {
              const cleanVal = String(val || '').replace('+M', '').replace('+D', '').trim();
              if (cleanVal && !engineContext.shiftCodes.some((c: any) => c.code === cleanVal)) {
                  if (!systemCodes.includes((cleanVal || '').toUpperCase()) && !(cleanVal || '').toUpperCase().includes('YILLIK') && !(cleanVal || '').toUpperCase().includes('RAPOR')) {
                      unknowns.add(cleanVal);
                  }
              }
          });
      });
      return Array.from(unknowns);
  };

  const applyCodeMappings = () => {
      setGeneratedGrid(prev => prev.map(row => {
          const newShifts = { ...row.shifts };
          let rowChanged = false;
          Object.keys(newShifts).forEach(dateStr => {
              const val = newShifts[dateStr] || '';
              const cleanVal = String(val).replace('+M', '').replace('+D', '').trim();
              if (codeMappings[cleanVal] && codeMappings[cleanVal] !== 'none') {
                  const suffix = val.includes('+M') ? '+M' : (val.includes('+D') ? '+D' : '');
                  newShifts[dateStr] = codeMappings[cleanVal] + suffix;
                  rowChanged = true;
              }
          });
          return rowChanged ? { ...row, shifts: newShifts } : row;
      }));
      setShowCodeMigration(false);
      toast.success("Eski kodlar başarıyla güncellendi. Lütfen tabloyu kontrol edip 'Onayla, Kaydet ve Yayınla' butonuna basın!");
  };

  const unknownCodesList = calculateUnknownCodes();

  const handleLoadSavedWeek = (weekStart: string) => {
      setSelectedWeekStart(weekStart);
      const weekDates = getWeekDates(weekStart);
      const newGrid: any[] = [];
      const groups = engineContext?.engineConfig?.department_groups || [];
      engineContext?.personnel.forEach((p: any) => {
          newGrid.push({ personnel_id: p.id, adSoyad: `${p.first_name || ''} ${p.last_name || ''}`.trim(), department: getVirtualDept(p.department, groups, p.id), originalDept: p.department || 'Tanımsız', gender: p.gender, shifts: {}, tasks: {}, preferredShift: {} });
      });

      const weekSchedules = engineContext?.pastSchedules.filter((s: any) => s.week_start_date === weekStart) || [];
      weekSchedules.forEach((s: any) => {
          const row = newGrid.find(r => r.personnel_id === s.personnel_id);
          if (row) {
              row.shifts[s.shift_date] = s.shift_type;
              if (s.task_assignment) {
                  row.tasks[s.shift_date] = s.task_assignment;
              } else {
                  if (s.shift_type?.includes('+M')) row.tasks[s.shift_date] = 'Mutfak';
                  if (s.shift_type?.includes('+D')) row.tasks[s.shift_date] = 'Depo';
              }
          }
      });

      const finalOrder = ['müdür', 'kasiyer', 'çocuk', 'kadın', 'bayan', 'erkek'];
      newGrid.sort((a, b) => {
          const aDept = String(a.originalDept || '').toLocaleLowerCase('tr-TR');
          const bDept = String(b.originalDept || '').toLocaleLowerCase('tr-TR');
          let ia = finalOrder.findIndex(dept => aDept.includes(dept));
          let ib = finalOrder.findIndex(dept => bDept.includes(dept));
          if (ia === -1) ia = 999;
          if (ib === -1) ib = 999;
          if (ia !== ib) return ia - ib;
          return String(a.adSoyad || '').localeCompare(String(b.adSoyad || ''), 'tr-TR');
      });

      setGeneratedGrid(newGrid);
      setIsGenerated(true);
      toast.success(`${formatDateTR(weekStart)} haftası ekrana yüklendi. Düzenleme yapabilirsiniz.`);
  };

  const deleteSavedWeekMutation = useMutation({
      mutationFn: async (weekStart: string) => {
          const { error } = await supabase.from('shift_schedules').delete().eq('week_start_date', weekStart);
          if (error) throw error;
      },
      onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ['shift_engine_context'] });
          toast.success('Haftalık liste kalıcı olarak silindi.');
      }
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
        // html2canvas capture logic
        let base64Image = null;
        try {
            const captureElement = document.getElementById('shift-table-capture');
            if (captureElement) {
                const tempStyle = document.createElement('style');
                tempStyle.id = 'temp-print-hide-save';
                tempStyle.innerHTML = `.print\\:hidden { display: none !important; } .print\\:hide-row { display: none !important; }`;
                document.head.appendChild(tempStyle);
                const originalWidth = captureElement.style.width;
                captureElement.style.width = 'max-content';
                await new Promise(r => setTimeout(r, 100)); // reflow
                
                // Ignore elements with data-html2canvas-ignore automatically
                const html2canvas = (await import('html2canvas')).default;
                const canvas = await html2canvas(captureElement, { 
                    scale: 3.0, 
                    logging: false,
                    useCORS: true,
                    backgroundColor: '#ffffff',
                    onclone: (clonedDoc) => {
                        let cssText = '';
                        try {
                            for (let i = 0; i < document.styleSheets.length; i++) {
                                const sheet = document.styleSheets[i];
                                try {
                                    if (sheet.cssRules) {
                                        for (let j = 0; j < sheet.cssRules.length; j++) {
                                            cssText += sheet.cssRules[j].cssText + ' ';
                                        }
                                    }
                                } catch (e) {
                                    console.warn("Could not read cssRules", e);
                                }
                            }
                        } catch (e) {}
                        const style = clonedDoc.createElement('style');
                        style.innerHTML = cssText + `
                            .print\\:hidden { display: none !important; }
                            .print\\:table-row { display: table-row !important; }
                            .print\\:h-4 { height: 1rem !important; }
                            .print\\:m-0 { margin: 0 !important; }
                            .print\\:p-0 { padding: 0 !important; }
                            .print\\:hide-row { display: none !important; }
                            table { border-collapse: separate !important; border-spacing: 0 !important; }
                            * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
                        `;
                        clonedDoc.head.appendChild(style);
                    }
                });
                // Dosya boyutunu düşürmek için kaliteyi %60 (0.6) yapıyoruz
                base64Image = canvas.toDataURL('image/jpeg', 0.6);
                const ts = document.getElementById('temp-print-hide-save');
                if (ts) ts.remove();
                captureElement.style.width = originalWidth;
            }
        } catch (e) {
            console.error("Html2Canvas capture failed:", e);
            const ts = document.getElementById('temp-print-hide-save');
            if (ts) ts.remove();
            const ce = document.getElementById('shift-table-capture');
            if (ce) ce.style.width = '';
        }

        const weekDates = getWeekDates(selectedWeekStart);
        // Wipe existing for this week to allow recreation
        const { error: delErr } = await supabase.from('shift_schedules').delete().in('shift_date', weekDates);
        
        const inserts: any[] = [];
        generatedGrid.forEach(row => {
            weekDates.forEach(dateStr => {
                const shift_type = row.shifts[dateStr] || 'A';
                inserts.push({
                    personnel_id: row.personnel_id,
                    shift_date: dateStr,
                    shift_type: shift_type,
                    task_assignment: row.tasks[dateStr] || null,
                    week_start_date: selectedWeekStart,
                    is_manual_override: true
                });
            });
        });

        // Add chunking if needed for large teams, using single insert for now
        const { error: insErr } = await supabase.from('shift_schedules').insert(inserts);
        if (insErr) throw insErr;
        
        // Save base64 image to system_settings with a date key
        if (base64Image) {
           const key = `shift_image_${selectedWeekStart}`;
           
           // Upsert logic for system_settings (since it might already exist)
           const { data: existing } = await supabase.from('system_settings').select('id').eq('setting_key', key).maybeSingle();
           
           if (existing?.id) {
               const { error: updErr } = await supabase.from('system_settings').update({ setting_value: { image: base64Image } }).eq('id', existing.id);
               if (updErr) console.error("Görsel güncellenemedi:", updErr);
           } else {
               const { error: insErr } = await supabase.from('system_settings').insert({ setting_key: key, setting_value: { image: base64Image } });
               if (insErr) console.error("Görsel kaydedilemedi:", insErr);
           }
        }
    },
    onSuccess: () => {
        toast.success("Vardiya Listesi Başarıyla Veritabanına Kaydedildi!");
        queryClient.invalidateQueries({ queryKey: ['shift_schedules'] });
    },
    onError: (e: any) => {
        toast.error("Vardiya kaydedilirken hata oluştu: " + e.message);
    }
  });

  const downloadImage = async () => {
      const captureElement = document.getElementById('shift-table-capture');
      if (!captureElement) return;
      
      const toastId = toast.loading("Görsel hazırlanıyor, lütfen bekleyin...");
      try {
          const tempStyle = document.createElement('style');
          tempStyle.id = 'temp-print-hide-dl';
          tempStyle.innerHTML = `.print\\:hidden { display: none !important; } .print\\:hide-row { display: none !important; }`;
          document.head.appendChild(tempStyle);
          const originalWidth = captureElement.style.width;
          captureElement.style.width = 'max-content';
          await new Promise(r => setTimeout(r, 100)); // reflow

          const html2canvas = (await import('html2canvas')).default;
          const canvas = await html2canvas(captureElement, { 
              scale: 4.0, 
              logging: false,
              useCORS: true,
              backgroundColor: '#ffffff',
              onclone: (clonedDoc) => {
                  const style = clonedDoc.createElement('style');
                  style.innerHTML = `
                      .print\\:hidden { display: none !important; }
                      .print\\:table-row { display: table-row !important; }
                      .print\\:h-4 { height: 1rem !important; }
                      .print\\:m-0 { margin: 0 !important; }
                      .print\\:p-0 { padding: 0 !important; }
                      .print\\:hide-row { display: none !important; }
                  `;
                  clonedDoc.head.appendChild(style);
              }
          });
          
          const base64Image = canvas.toDataURL('image/jpeg', 0.75);
          
          const ts = document.getElementById('temp-print-hide-dl');
          if (ts) ts.remove();
          captureElement.style.width = originalWidth;

          const link = document.createElement('a');
          link.href = base64Image;
          link.download = `Vardiya_Tablosu_${selectedWeekStart}.jpg`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          
          toast.success("Görsel başarıyla indirildi!", { id: toastId });
      } catch (e: any) {
          console.error("Görsel indirme hatası:", e);
          toast.error("Görsel indirilirken hata oluştu: " + e.message, { id: toastId });
      }
  };

  const downloadAllWeeksExcel = async () => {
    if (!engineContext || !engineContext.pastSchedules) return;
    const toastId = toast.loading("Toplu Excel hazırlanıyor...");
    try {
        const savedWeeks = Array.from(new Set(engineContext.pastSchedules.map((s: any) => s.week_start_date))).sort().reverse() as string[];
        if (savedWeeks.length === 0) {
            toast.error("İndirilecek geçmiş hafta bulunamadı.", { id: toastId });
            return;
        }

        const XLSX = await import('xlsx');
        const wb = XLSX.utils.book_new();

        savedWeeks.forEach(weekStart => {
            const weekSchedules = engineContext.pastSchedules.filter((s: any) => s.week_start_date === weekStart);
            const weekDates = getWeekDates(weekStart);
            const exportData: any[] = [];
            
            const personnelMap = new Map();
            weekSchedules.forEach((s: any) => {
                if (!personnelMap.has(s.personnel_id)) {
                    const p = engineContext.personnel.find((p:any) => p.id === s.personnel_id);
                    const groups = engineContext.engineConfig?.department_groups || [];
                    personnelMap.set(s.personnel_id, {
                        department: p ? getVirtualDept(p.department, groups, p.id) : 'Bilinmeyen',
                        originalDept: p ? p.department : 'Bilinmeyen',
                        adSoyad: p ? `${p.first_name} ${p.last_name}` : 'Bilinmeyen Personel',
                        shifts: {},
                        tasks: {}
                    });
                }
                const row = personnelMap.get(s.personnel_id);
                row.shifts[s.shift_date] = s.shift_type;
                if (s.task_assignment) row.tasks[s.shift_date] = s.task_assignment;
            });

            const rows = Array.from(personnelMap.values());
            const currentDepts = Array.from(new Set(rows.map(r => r.department)));
            currentDepts.forEach(dept => {
                const deptRows = rows.filter(r => r.department === dept);
                deptRows.forEach(row => {
                    const obj: any = { 'Grup': row.department, 'Orijinal Departman': row.originalDept, 'Ad Soyad': row.adSoyad };
                    weekDates.forEach((dateStr, i) => { 
                        obj[`${DAYS[i]} (${dateStr})`] = row.shifts[dateStr] || '-';
                    });
                    exportData.push(obj);
                });
                exportData.push({});
            });

            if (exportData.length > 0) {
                const ws = XLSX.utils.json_to_sheet(exportData);
                XLSX.utils.book_append_sheet(wb, ws, weekStart.substring(0, 31));
            }
        });

        if (wb.SheetNames.length > 0) {
            XLSX.writeFile(wb, `Tum_Gecmis_Vardiyalar.xlsx`);
            toast.success("Tüm haftalar Excel olarak indirildi!", { id: toastId });
        } else {
            toast.error("Dosyaya yazılacak veri bulunamadı.", { id: toastId });
        }
    } catch (e: any) {
        console.error("Toplu Excel hatası:", e);
        toast.error("Excel hazırlanırken hata oluştu: " + e.message, { id: toastId });
    }
  };

  const downloadAllWeeksImages = async () => {
    if (!engineContext || !engineContext.pastSchedules) return;
    const toastId = toast.loading("Resimler indiriliyor, lütfen tarayıcınızın çoklu indirme izni isteyip istemediğini kontrol edin...");
    try {
        const savedWeeks = Array.from(new Set(engineContext.pastSchedules.map((s: any) => s.week_start_date))).sort().reverse() as string[];
        if (savedWeeks.length === 0) {
            toast.error("İndirilecek geçmiş hafta bulunamadı.", { id: toastId });
            return;
        }

        const keys = savedWeeks.map(w => `shift_image_${w}`);
        const { data: settings } = await supabase.from('system_settings').select('*').in('setting_key', keys);
        
        if (!settings || settings.length === 0) {
            toast.error("Geçmiş haftalara ait kaydedilmiş resim bulunamadı. Lütfen eski haftaları açıp 'Onayla, Kaydet ve Yayınla' butonuna tekrar basın.", { id: toastId });
            return;
        }

        let downloadedCount = 0;
        
        for (const week of savedWeeks) {
            const key = `shift_image_${week}`;
            const setting = settings.find(s => s.setting_key === key);
            if (setting && setting.setting_value?.image) {
                const link = document.createElement('a');
                link.href = setting.setting_value.image;
                link.download = `Vardiya_Tablosu_${week}.jpg`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                downloadedCount++;
                
                await new Promise(resolve => setTimeout(resolve, 300));
            }
        }

        if (downloadedCount > 0) {
            toast.success(`Başarıyla indirildi! Toplam ${downloadedCount} haftalık görsel ayrı ayrı tam ekran olarak kaydedildi.`, { id: toastId });
        } else {
            toast.error("Resim verisine ulaşılamadı. Haftaları ekrana yükleyip tekrar kaydetmeniz gerekebilir.", { id: toastId });
        }
    } catch (e: any) {
        console.error("Toplu resim hatası:", e);
        toast.error("Resim hazırlanırken hata oluştu: " + e.message, { id: toastId });
    }
  };

  const generateExcel = async (type: 'vardiya' | 'depo' | 'mutfak') => {
    if (!isGenerated) return;
    const weekDates = getWeekDates(selectedWeekStart);
    const targetOrder = ['Müdür', 'Kadın & Çocuk Reyon', 'Erkek Reyon', 'Kasiyer'];
    
    // Filtreleme (Depo/Mutfak seçildiyse sadece o görevi alanları göster)
    let gridToExport = generatedGrid;
    if (type === 'depo') {
        gridToExport = generatedGrid.filter(r => Object.values(r.tasks || {}).includes('Depo'));
    } else if (type === 'mutfak') {
        gridToExport = generatedGrid.filter(r => Object.values(r.tasks || {}).includes('Mutfak'));
    }

    const currentDepts = Array.from(new Set(gridToExport.map(r => r.department)));
    currentDepts.sort((a, b) => {
      let ia = targetOrder.indexOf(a);
      let ib = targetOrder.indexOf(b);
      if (ia === -1) ia = 999;
      if (ib === -1) ib = 999;
      if (ia !== ib) return ia - ib;
      return String(a).localeCompare(String(b));
    });
    
    const exportData: any[] = [];
    currentDepts.forEach(dept => {
        const deptRows = gridToExport.filter(r => r.department === dept);
        deptRows.forEach(row => {
          const obj: any = { 'Grup': row.department, 'Orijinal Departman': row.originalDept, 'Ad Soyad': row.adSoyad };
          weekDates.forEach((dateStr, i) => { 
              if (type === 'vardiya') {
                  obj[`${DAYS[i]} (${dateStr})`] = row.shifts[dateStr] || '-';
              } else if (type === 'depo') {
                  obj[`${DAYS[i]} (${dateStr})`] = row.tasks[dateStr] === 'Depo' ? 'D' : '-';
              } else if (type === 'mutfak') {
                  obj[`${DAYS[i]} (${dateStr})`] = row.tasks[dateStr] === 'Mutfak' ? 'M' : '-';
              }
          });
          exportData.push(obj);
        });
        
        exportData.push({});
    });

    const XLSX = await import('xlsx');
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    const sheetName = type === 'vardiya' ? 'Vardiya' : type === 'depo' ? 'Depo' : 'Mutfak';
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(wb, `${sheetName}_Listesi_${selectedWeekStart}.xlsx`);
  };

  return (
    <>
    <Card className="border shadow-sm print:border-none print:shadow-none print:m-0">
      <CardHeader className="border-b bg-muted/30 pb-6 print:hidden">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <CardTitle className="text-xl">Vardiya Motoru</CardTitle>
            <CardDescription>Otomatik dengeleme motorunu başlatarak taslak listeyi görün. Müdahale edip kaydedin.</CardDescription>
          </div>
          <div className="flex flex-col gap-2 md:items-end">
            <div className="flex items-center gap-3">
              <div className="border rounded-lg bg-background flex items-center px-2 shadow-sm">
                 <CalIcon className="w-4 h-4 text-muted-foreground mr-2"/>
                 <input 
                   type="date" 
                   className="outline-none py-2 text-sm bg-transparent" 
                   value={selectedWeekStart} 
                   onChange={e => setSelectedWeekStart(e.target.value)}
                   title="Haftanın Pazartesi Günü"
                 />
              </div>
              <Button onClick={handleApplyHolidayShift} variant="outline" className="border-pink-200 text-pink-600 hover:bg-pink-50" disabled={!isGenerated || generatedGrid.length === 0} title="S ve A harflerini (veya mevcut saatleri) ayarlardaki tüm eşleşmeleri kullanarak kotalı olarak yeniden dağıtır">
                Saatleri Dağıt (Özel Kotalı)
              </Button>
              <Button onClick={handleGenerate} className="bg-indigo-600 hover:bg-indigo-700 text-white"><Settings2 className="w-4 h-4 mr-2"/> Otomatik Hazırla</Button>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-6 print:p-0 print:m-0">
        {isLoading && <div className="text-center p-8 animate-pulse text-muted-foreground">Motor verileri yükleniyor...</div>}
        
        {!isLoading && engineContext !== undefined && (() => {
           const savedWeeks = Array.from(new Set(engineContext.pastSchedules.map((s: any) => s.week_start_date))).sort().reverse().slice(0, 8) as string[];
           if (savedWeeks.length === 0) return null;
           return (
             <div className="mb-8 p-4 border rounded-xl bg-muted/10 print:hidden">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-3 gap-3">
                   <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Kayıtlı Geçmiş Haftalar (Son 8 Hafta)</h3>
                   <div className="flex gap-2">
                       <Button size="sm" variant="outline" className="h-8 text-indigo-600 border-indigo-200 hover:bg-indigo-50" onClick={downloadAllWeeksExcel}><FileDown className="w-3.5 h-3.5 mr-1" /> Tümünü Excel İndir</Button>
                       <Button size="sm" variant="outline" className="h-8 text-emerald-600 border-emerald-200 hover:bg-emerald-50" onClick={downloadAllWeeksImages}><Image className="w-3.5 h-3.5 mr-1" /> Tümünü Resim İndir</Button>
                   </div>
                </div>
                <div className="flex flex-wrap gap-3">
                  {savedWeeks.map((weekStart, i) => (
                      <div key={weekStart} className="flex items-center bg-white dark:bg-black border shadow-sm rounded-lg overflow-hidden">
                          <div className="px-3 py-2 bg-indigo-50 dark:bg-indigo-900/20 border-r border-indigo-100 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 font-medium text-sm flex items-center gap-2">
                             <CalIcon className="w-4 h-4" />
                             {i + 1}. Hafta: {formatDateTR(weekStart)}
                          </div>
                          <div className="flex">
                             <button onClick={() => handleLoadSavedWeek(weekStart)} className="px-3 py-2 text-xs hover:bg-muted font-medium transition-colors border-r" title="Düzenle">Düzenle</button>
                             <button onClick={() => deleteSavedWeekMutation.mutate(weekStart)} disabled={deleteSavedWeekMutation.isPending} className="px-3 py-2 text-xs text-red-600 hover:bg-red-50 font-medium transition-colors" title="Sil">Sil</button>
                          </div>
                      </div>
                  ))}
                </div>
             </div>
           );
        })()}

        {engineContext === undefined && !isLoading && (
            <div className="flex flex-col items-center justify-center p-12 lg:p-24 border-2 border-dashed border-red-200 rounded-xl bg-red-50 dark:bg-red-900/10">
                <h3 className="text-lg font-semibold text-red-600">Veri Yükleme Hatası</h3>
                <p className="text-sm text-center text-red-500/80 max-w-sm mt-2">Vardiya kuralları ve personel bilgileri sunucudan alınamadı. Lütfen sayfayı yenileyin veya internet bağlantınızı kontrol edin.</p>
                <Button variant="outline" className="mt-4 border-red-200 text-red-600 hover:bg-red-100" onClick={() => window.location.reload()}><RefreshCw className="w-4 h-4 mr-2" /> Sayfayı Yenile</Button>
            </div>
        )}

        {!isLoading && !isGenerated && engineContext !== undefined && (
            <div className="flex flex-col items-center justify-center p-12 lg:p-24 border-2 border-dashed rounded-xl bg-muted/10">
                <RefreshCw className="w-12 h-12 text-muted-foreground/30 mb-4" />
                <h3 className="text-lg font-semibold text-foreground">Vardiya Listesi Bekliyor</h3>
                <p className="text-sm text-center text-muted-foreground max-w-sm mt-1">Yukarıdan başlama tarihi (Pazartesi) seçip "Otomatik Hazırla" butonuna tıklayarak taslak oluşturabilirsiniz.</p>
            </div>
        )}

        {isGenerated && generatedGrid.length > 0 && engineContext !== undefined && (
          <div className="space-y-4 animate-fade-in">
             <div className="flex justify-between items-center bg-primary/5 p-3 rounded-lg border border-primary/20 print:hidden">
                <p className="text-sm font-medium">✨ Taslak tablo oluşturuldu. Hücrelere tıklayarak "S", "A", "İ", "R" değerlerini manuel değiştirebilirsiniz.</p>
                <div className="flex gap-2">
                    <div className="flex gap-2" data-html2canvas-ignore="true">
                        <Button variant="outline" size="sm" onClick={() => generateExcel('vardiya')} className="text-indigo-600 border-indigo-200 hover:bg-indigo-50"><FileDown className="w-4 h-4 mr-1"/> Vardiya Excel</Button>
                        <Button variant="outline" size="sm" onClick={() => generateExcel('depo')} className="text-blue-600 border-blue-200 hover:bg-blue-50"><FileDown className="w-4 h-4 mr-1"/> Depo Excel</Button>
                        <Button variant="outline" size="sm" onClick={() => generateExcel('mutfak')} className="text-amber-600 border-amber-200 hover:bg-amber-50"><FileDown className="w-4 h-4 mr-1"/> Mutfak Excel</Button>
                        <Button variant="outline" size="sm" onClick={downloadImage} className="text-emerald-600 border-emerald-200 hover:bg-emerald-50"><Image className="w-4 h-4 mr-1"/> Resim İndir</Button>
                        <Button variant="outline" size="sm" onClick={() => window.print()} className="text-gray-600 border-gray-200 hover:bg-gray-50"><Printer className="w-4 h-4 mr-1"/> Yazdır</Button>
                    </div>
                    <Button size="sm" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} data-html2canvas-ignore="true">{saveMutation.isPending ? 'Kaydediliyor...' : 'Onayla, Kaydet ve Yayınla'}</Button>
                </div>
             </div>

             {unknownCodesList.length > 0 && (
                 <div className="flex items-center justify-between bg-orange-50 p-3 rounded-lg border border-orange-200 print:hidden text-orange-800">
                     <p className="text-sm font-medium">⚠️ Bu tabloda ayarlarınızda bulunmayan eski vardiya kodları var. Lütfen bunları yeni kodlarınızla güncelleyin.</p>
                     <Button size="sm" variant="outline" className="border-orange-300 hover:bg-orange-100" onClick={() => {
                         const initialMappings: Record<string, string> = {};
                         unknownCodesList.forEach(c => initialMappings[c] = 'none');
                         setCodeMappings(initialMappings);
                         setShowCodeMigration(true);
                     }}>
                         Eski Kodları Güncelle
                     </Button>
                 </div>
             )}

             <div id="shift-table-capture" className="bg-white pb-4 -mx-1 px-1">
                 <div className="text-center font-black text-[30px] py-3 uppercase text-black tracking-wider bg-white border-2 border-black border-b-0 italic print:border-none print:bg-white print:text-black print:pb-2 relative flex items-center justify-center">
                     {getDynamicTitle(selectedWeekStart, engineContext.engineConfig.branchName)}
                     <div className="absolute right-4" data-html2canvas-ignore="true">
                         <Button onClick={handleGenerate} size="sm" variant="outline" className="border-indigo-200 hover:bg-indigo-50 text-indigo-700 print:hidden font-sans not-italic text-sm capitalize">
                             <Settings2 className="w-4 h-4 mr-2"/> Otomatik Vardiya Dağıt
                         </Button>
                     </div>
                 </div>
                 <div className="border-2 border-black overflow-hidden print:overflow-visible shadow-sm bg-white print:border-none print:rounded-none">
                 <div className="overflow-x-auto print:overflow-visible">
                    <table className="w-full text-[15px] border-collapse text-black font-extrabold leading-tight">
                       <thead>
                          <tr className="bg-[#e2e2e2] text-center border-b-2 border-black">
                             <th className="border-b border-r border-black p-1.5 w-10 font-extrabold italic text-[15px] leading-none">SIRA<br/>NO</th>
                             <th className="border-b border-r border-black p-1 w-[180px] font-extrabold text-center text-[16px]">ADI SOYADI</th>
                             <th className="border-b border-r border-black p-1 w-[110px] font-extrabold text-center text-[15px]">GÖREVİ</th>
                             {getWeekDates(selectedWeekStart).map((dateStr, i) => (
                                 <th key={dateStr} className="border-b border-r border-black p-1 w-[85px] italic">
                                     <div className="font-extrabold text-[17px] leading-none mb-1">{DAYS_TR[i]}</div>
                                     <div className="font-bold text-[14px] leading-tight">{formatDateTR(dateStr)}</div>
                                 </th>
                             ))}
                             <th className="p-1.5 w-16 bg-yellow-200 border-l-2 border-black font-extrabold text-red-600 print:hidden text-[16px] leading-none">AKŞAM</th>
                          </tr>
                       </thead>
                       <tbody>
                           {(() => {
                             const groups = engineContext?.engineConfig?.department_groups || [];
                             const mergeInTable = engineContext?.engineConfig?.mergeDepartmentsInTable || false;
                             const finalOrder = ['müdür', 'kasiyer', 'çocuk', 'kadın', 'bayan', 'erkek'];
                             
                             const currentDepts = Array.from(new Set(generatedGrid.map(r => 
                                 mergeInTable 
                                     ? getVirtualDept(r.originalDept, groups, r.personnel_id) 
                                     : (r.originalDept || 'Tanımsız')
                             )));
                             
                             currentDepts.sort((a, b) => {
                               let ia = finalOrder.findIndex(dept => String(a || '').toLocaleLowerCase('tr-TR').includes(dept));
                               let ib = finalOrder.findIndex(dept => String(b || '').toLocaleLowerCase('tr-TR').includes(dept));
                               if (ia === -1) ia = 999;
                               if (ib === -1) ib = 999;
                               if (ia !== ib) return ia - ib;
                               return String(a || '').localeCompare(String(b || ''), 'tr-TR');
                             });

                             let globalRowCounter = 1;
                             const deptTotals: any[] = []; // for daily summary table

                             const customColorPalette = [
                                 'bg-[#d0e0e3]', // light cyan
                                 'bg-[#ead1dc]', // light pink-purple
                                 'bg-[#d9ead3]', // light green
                                 'bg-[#c9daf8]', // light blue
                                 'bg-[#d9d2e9]', // lavender
                                 'bg-[#e6b8af]', // salmon
                                 'bg-[#b6d7a8]', // pale green
                                 'bg-[#a2c4c9]', // darker cyan
                                 'bg-[#f6b26b]', // orange
                                 'bg-[#9fc5e8]'  // darker blue
                             ];
                             const getCustomColorForValue = (v: string) => {
                                 if (!v) return 'bg-white';
                                 let hash = 0;
                                 for (let i = 0; i < v.length; i++) {
                                     hash = v.charCodeAt(i) + ((hash << 5) - hash);
                                 }
                                 hash = Math.abs(hash);
                                 return customColorPalette[hash % customColorPalette.length];
                             };

                             return (
                                 <>
                                 {currentDepts.map((dept, deptIdx) => {
                                     const deptRows = generatedGrid.filter(r => 
                                         mergeInTable
                                             ? getVirtualDept(r.originalDept, groups, r.personnel_id) === dept
                                             : r.originalDept === dept
                                     );
                                     if (deptRows.length === 0) return null;

                                     if (mergeInTable) {
                                         deptRows.sort((a, b) => {
                                             const dComp = String(a.originalDept || '').localeCompare(String(b.originalDept || ''), 'tr-TR');
                                             if (dComp !== 0) return dComp;
                                             return String(a.adSoyad || '').localeCompare(String(b.adSoyad || ''), 'tr-TR');
                                         });
                                     }

                                     const dailyTotals = getWeekDates(selectedWeekStart).map(dateStr => {
                                         let sabahCount = 0;
                                         let aksamCount = 0;
                                         deptRows.forEach(r => {
                                             const val = r.shifts[dateStr] || '';
                                             if (getShiftCategory(val) === 'Sabah') sabahCount++;
                                             else if (getShiftCategory(val) === 'Akşam') aksamCount++;
                                         });
                                         return { sabah: sabahCount, aksam: aksamCount };
                                     });
                                     deptTotals.push({ dept, dailyTotals, rowCount: deptRows.length });

                                     return (
                                       <Fragment key={dept}>
                                           {deptRows.map((row, rIdx) => {
                                               const aksamTotal = getWeekDates(selectedWeekStart).filter(d => getShiftCategory(row.shifts[d] || '') === 'Akşam').length;
                                               return (
                                                   <tr key={row.personnel_id}>
                                                       <td className="text-center font-extrabold text-[14px] md:text-[16px] border-b border-r border-black italic bg-[#e2e2e2] py-2 px-1">{globalRowCounter++}</td>
                                                       <td className="font-bold border-b border-r border-black pl-2 uppercase italic bg-[#e2e2e2] text-[15px] md:text-[17px] py-2 tracking-tighter leading-tight">
                                                           {row.adSoyad}
                                                       </td>
                                                       <td className="font-bold italic text-[13px] md:text-[15px] border-b border-r border-black text-center uppercase bg-[#e2e2e2] py-2 tracking-tighter px-1">{row.originalDept}</td>
                                                       {getWeekDates(selectedWeekStart).map(dateStr => {
                                                           const val = row.shifts[dateStr] || '';
                                                           const displayVal = val;
                                                           let cellBg = 'bg-white';
                                                           let textColor = 'text-black';
                                                           const upVal = (val || '').toUpperCase();

                                                           if (upVal === 'S' || upVal === 'A' || !val) {
                                                               cellBg = 'bg-white';
                                                           } else if (upVal === 'Yİ' || upVal === 'Y' || upVal.includes('YILLIK')) {
                                                               cellBg = 'bg-[#f8cbad]';
                                                               textColor = 'text-black';
                                                           } else if (upVal === 'T' || upVal.includes('H.İZİN') || upVal.includes('HT')) {
                                                               cellBg = 'bg-[#f4cccc]';
                                                               textColor = 'text-[#cc0000] italic';
                                                           } else if (upVal === 'Üİ' || upVal.includes('ÜCRETLİ')) {
                                                               cellBg = 'bg-purple-200';
                                                               textColor = 'text-[#cc0000]';
                                                           } else if (upVal === 'ÜS' || upVal.includes('ÜCRETSİZ')) {
                                                               cellBg = 'bg-pink-200';
                                                               textColor = 'text-[#cc0000]';
                                                           } else if (upVal === 'R' || upVal.includes('RAPOR')) {
                                                               cellBg = 'bg-[#fff2cc]';
                                                               textColor = 'text-[#cc0000]';
                                                           } else {
                                                               cellBg = 'bg-white';
                                                               textColor = 'text-black';
                                                           }

                                                           return (
                                                               <td key={dateStr} className={`p-0 border-b border-r border-black text-center font-bold text-[15px] xl:text-[17px] tracking-tighter ${cellBg}`}>
                                                                   <div className="relative w-full h-full min-h-[46px] flex items-center justify-center">
                                                                       <div className={`absolute inset-0 flex flex-col items-center justify-center pointer-events-none ${textColor} leading-[1.1]`}>
                                                                           {val && val.includes('/') ? (
                                                                               <>
                                                                                   <span>{val.split('/')[0]}</span>
                                                                                   <span className="border-t border-black/30 w-[80%] my-[2px]"></span>
                                                                                   <span>{val.split('/')[1]}</span>
                                                                               </>
                                                                           ) : (
                                                                               <span className="font-black text-[16px] md:text-[18px]">{displayVal || '-'}</span>
                                                                           )}
                                                                       </div>
                                                                       <select 
                                                                         className="w-full h-full absolute inset-0 z-10 opacity-0 cursor-pointer appearance-none print:hidden"
                                                                         value={val}
                                                                         onChange={e => handleCellChange(row.personnel_id, dateStr, e.target.value)}
                                                                       >
                                                                         <option value="">-</option>
                                                                         {engineContext.shiftCodes.map((c: any) => {
                                                                             const cUp = (c.code || '').toUpperCase();
                                                                             const label = cUp === 'T' ? 'H.İZİN' : (cUp === 'Yİ' || cUp === 'Y') ? 'YILLIK İZİN' : cUp === 'Üİ' ? 'ÜCRETLİ İZİN' : cUp === 'ÜS' ? 'ÜCRETSİZ İZİN' : cUp === 'R' ? 'RAPOR' : c.code;
                                                                             return <option key={c.code} value={c.code} title={c.label}>{label}</option>
                                                                         })}
                                                                         {val && !engineContext.shiftCodes.some((c: any) => c.code === val) && (
                                                                             <option value={val}>{displayVal}</option>
                                                                         )}
                                                                       </select>
                                                                   </div>
                                                               </td>
                                                           );
                                                       })}
                                                       <td className="text-center font-bold text-[14px] md:text-[16px] border-b border-l-2 border-black bg-white print:hidden py-2">{aksamTotal > 0 ? aksamTotal : ''}</td>
                                                   </tr>
                                               );
                                           })}
                                           {/* Alt toplam satırı */}
                                           {(() => {
                                               const currentVirtual = getVirtualDept(dept, groups);
                                               const nextDept = deptIdx < currentDepts.length - 1 ? currentDepts[deptIdx + 1] : null;
                                               const nextVirtual = nextDept ? getVirtualDept(nextDept, groups) : null;
                                               
                                               if (currentVirtual === nextVirtual) {
                                                   return null;
                                               }
                                               const isMudur = String(currentVirtual).toLocaleLowerCase('tr-TR').includes('müdür');
                                               
                                                let blockCount = 0;
                                                const blockDailyTotals = getWeekDates(selectedWeekStart).map(() => ({ sabah: 0, aksam: 0 }));
                                                
                                                for (let i = deptTotals.length - 1; i >= 0; i--) {
                                                    const d = deptTotals[i];
                                                    if (getVirtualDept(d.dept, groups) === currentVirtual) {
                                                        blockCount += d.rowCount || 0;
                                                        d.dailyTotals.forEach((dt: any, idx: number) => {
                                                            blockDailyTotals[idx].sabah += dt.sabah;
                                                            blockDailyTotals[idx].aksam += dt.aksam;
                                                        });
                                                    } else {
                                                        break;
                                                    }
                                                }

                                                return (
                                                    <Fragment key={`sum-${dept}`}>
                                                        {!isMudur && (
                                                            <tr className="bg-indigo-50 border-b-2 border-indigo-200 print:hidden">
                                                                <td colSpan={3} className="text-right font-bold text-[12px] pr-2 py-1.5 text-indigo-800 uppercase border-b border-indigo-200">
                                                                    {currentVirtual} Toplam ({blockCount} Kişi):
                                                                </td>
                                                                {getWeekDates(selectedWeekStart).map((dateStr, idx) => {
                                                                    const dt = blockDailyTotals[idx];
                                                                    return (
                                                                        <td key={`sum-${dateStr}`} className="text-center font-bold text-[12px] text-indigo-800 border-b border-r border-indigo-200 py-1.5 whitespace-nowrap">
                                                                            S-{dt.sabah} A-{dt.aksam}
                                                                        </td>
                                                                    );
                                                                })}
                                                                <td className="border-b border-l-2 border-black/40 bg-gray-50 print:hidden"></td>
                                                            </tr>
                                                        )}
                                                        <tr style={{ backgroundColor: '#ffffff' }}>
                                                            <td colSpan={100} className="p-0 border-b-2 border-x-0 border-black">
                                                                <div className="w-full" style={{ height: '16px', backgroundColor: '#ffffff' }}>&nbsp;</div>
                                                            </td>
                                                        </tr>
                                                    </Fragment>
                                               );
                                           })()}
                                       </Fragment>
                                     );
                                 })}

                                {/* En alt Genel Özet Tablosu */}
                                <tr className="h-8 border-t-2 border-black bg-white">
                                    <td colSpan={100}></td>
                                </tr>
                                <tr className="bg-yellow-200 border-b border-black font-bold text-red-600 text-center print:hidden">
                                    <td colSpan={3} className="text-right pr-4 border-r border-black">AKŞAM TOPLAM</td>
                                    {getWeekDates(selectedWeekStart).map((dateStr, i) => {
                                        const sumA = deptTotals.reduce((acc, curr) => acc + curr.dailyTotals[i].aksam, 0);
                                        return <td key={dateStr} className="border-r border-black text-black">{sumA}</td>;
                                    })}
                                    <td className="bg-white border-b border-l-2 border-black print:hidden"></td>
                                </tr>
                                <tr className="bg-yellow-100 border-b-2 border-black font-bold text-red-600 text-center print:hidden">
                                    <td colSpan={3} className="text-right pr-4 border-r border-black">SABAH TOPLAM</td>
                                    {getWeekDates(selectedWeekStart).map((dateStr, i) => {
                                        const sumS = deptTotals.reduce((acc, curr) => acc + curr.dailyTotals[i].sabah, 0);
                                        return <td key={dateStr} className="border-r border-black text-black">{sumS}</td>;
                                    })}
                                    <td className="bg-white border-b border-l-2 border-black print:hidden"></td>
                                </tr>
                                <tr className="bg-yellow-300 border-b-2 border-black font-black text-red-700 text-center text-[16px] print:hidden">
                                    <td colSpan={3} className="text-right pr-4 border-r border-black">GÜNLÜK TOPLAM ÇALIŞAN</td>
                                    {getWeekDates(selectedWeekStart).map((dateStr, i) => {
                                        const sumS = deptTotals.reduce((acc, curr) => acc + curr.dailyTotals[i].sabah, 0);
                                        const sumA = deptTotals.reduce((acc, curr) => acc + curr.dailyTotals[i].aksam, 0);
                                        return <td key={dateStr} className="border-r border-black text-black">{sumS + sumA}</td>;
                                    })}
                                    <td className="bg-white border-b border-l-2 border-black print:hidden"></td>
                                </tr>
                                </>
                            );
                          })()}

                        </tbody>
                     </table>
                  </div>

              {/* Mutfak Çalışması Tablosu */}
              <div>
                      <div className="flex justify-between items-center mb-4 print:hidden" data-html2canvas-ignore="true">
                          <div className="flex items-center gap-4">
                              <h3 className="text-lg font-bold text-amber-600 flex items-center">Mutfak Çalışması</h3>
                              <div className="flex items-center gap-2 border rounded-full px-3 py-1 bg-muted/20 print:hidden">
                                  <Switch id="toggleMutfak" checked={showOnlyAssignedTasks} onCheckedChange={setShowOnlyAssignedTasks} className="scale-75" />
                                  <Label htmlFor="toggleMutfak" className="text-xs cursor-pointer text-muted-foreground select-none">Sadece Görevliler</Label>
                              </div>
                          </div>
                          <Button onClick={() => handleAssignTasks('Mutfak', 'S')} size="sm" variant="outline" className="border-amber-200 hover:bg-amber-50 text-amber-700 print:hidden">Otomatik Mutfak Dağıt</Button>
                      </div>
                  <div className="bg-white border-x-2 border-b-2 border-t-0 border-black">
                     <table className="w-full text-left border-collapse text-[15px] font-extrabold leading-tight">
                        <thead className="bg-amber-200 text-black border-b-2 border-black">
                           <tr className="bg-amber-200">
                               <th colSpan={100} className="p-2 text-center text-[18px] font-black border-b-2 border-black uppercase tracking-widest text-black">MUTFAK ÇALIŞMASI LİSTESİ</th>
                           </tr>
                           <tr>
                              <th className="p-1.5 border-b border-r border-black w-10 text-center font-extrabold text-[14px]">#</th>
                              <th className="p-1 border-b border-r border-black w-[180px] font-extrabold text-center text-[15px]">ADI SOYADI</th>
                              <th className="p-1 border-b border-r border-black w-[110px] font-extrabold text-[14px] hidden sm:table-cell text-center">GRUP</th>
                              {getWeekDates(selectedWeekStart).map((dateStr, idx) => (
                                  <th key={dateStr} className="p-1 border-b border-r border-black text-center font-bold w-[85px] italic">
                                      <div className="font-extrabold text-[16px] leading-none mb-1">{DAYS_TR[idx]}</div>
                                      <div className="font-bold text-[13px] leading-tight">{formatDateTR(dateStr)}</div>
                                  </th>
                              ))}
                              <th className="p-1.5 w-16 print:hidden border-b border-black"></th>
                           </tr>
                        </thead>
                        <tbody>
                           {generatedGrid
                               .filter(row => showOnlyAssignedTasks ? Object.values(row.tasks || {}).includes('Mutfak') : true)
                               .map((row, idx) => (
                               <tr key={`m-${row.personnel_id}`} className="hover:bg-amber-50/50">
                                   <td className="p-2 border-b border-r border-black text-center text-black font-extrabold text-[15px]">{idx + 1}</td>
                                   <td className="py-2 px-3 border-b border-r border-black font-bold text-black text-[14px] md:text-[16px] uppercase italic tracking-tighter leading-tight">{row.adSoyad}</td>
                                   <td className="py-2 px-1 border-b border-r border-black text-black font-bold text-[12px] md:text-[14px] hidden sm:table-cell text-center uppercase tracking-tighter">{row.department}</td>
                                   {getWeekDates(selectedWeekStart).map(dateStr => (
                                       <td key={`m-${row.personnel_id}-${dateStr}`} className="p-0 border-b border-r border-black text-center">
                                           {row.shifts[dateStr] ? (
                                               <button 
                                                 onClick={() => handleTaskChange(row.personnel_id, dateStr, row.tasks[dateStr] === 'Mutfak' ? '' : 'Mutfak')}
                                                 className={`w-full h-full min-h-[38px] transition-colors ${row.tasks[dateStr] === 'Mutfak' ? 'bg-amber-400 text-black font-black text-[18px]' : 'bg-white text-gray-300 hover:bg-amber-100 font-black text-[18px]'}`}
                                               >
                                                 {row.tasks[dateStr] === 'Mutfak' ? 'M' : '-'}
                                               </button>
                                           ) : (
                                               <div className="w-full h-full min-h-[38px] bg-white text-gray-300 flex items-center justify-center font-black text-[18px]">-</div>
                                           )}
                                       </td>
                                   ))}
                                   <td className="print:hidden border-b border-black"></td>
                               </tr>
                           ))}
                        </tbody>
                     </table>
                  </div>
              </div>

              {/* Depo Çalışması Tablosu */}
              <div>
                  <div className="flex justify-between items-center mb-4 print:hidden" data-html2canvas-ignore="true">
                      <div className="flex items-center gap-4">
                          <h3 className="text-lg font-bold text-blue-600 flex items-center">Depo Çalışması</h3>
                          <div className="flex items-center gap-2 border rounded-full px-3 py-1 bg-muted/20 print:hidden">
                              <Switch id="toggleDepo" checked={showOnlyAssignedTasks} onCheckedChange={setShowOnlyAssignedTasks} className="scale-75" />
                              <Label htmlFor="toggleDepo" className="text-xs cursor-pointer text-muted-foreground select-none">Sadece Görevliler</Label>
                          </div>
                      </div>
                      <Button onClick={() => handleAssignTasks('Depo', 'A')} size="sm" variant="outline" className="border-blue-200 hover:bg-blue-50 text-blue-700 print:hidden">Otomatik Depo Dağıt</Button>
                  </div>
                  <div className="bg-white border-x-2 border-b-2 border-t-0 border-black">
                     <table className="w-full text-left border-collapse text-[15px] font-extrabold leading-tight">
                        <thead className="bg-blue-200 text-black border-b-2 border-black">
                           <tr className="bg-blue-200">
                               <th colSpan={100} className="p-2 text-center text-[18px] font-black border-b-2 border-black uppercase tracking-widest text-black">DEPO ÇALIŞMASI LİSTESİ</th>
                           </tr>
                           <tr>
                              <th className="p-1.5 border-b border-r border-black w-10 text-center font-extrabold text-[14px]">#</th>
                              <th className="p-1 border-b border-r border-black w-[180px] font-extrabold text-center text-[15px]">ADI SOYADI</th>
                              <th className="p-1 border-b border-r border-black w-[110px] font-extrabold text-[14px] hidden sm:table-cell text-center">GRUP</th>
                              {getWeekDates(selectedWeekStart).map((dateStr, idx) => (
                                  <th key={dateStr} className="p-1 border-b border-r border-black text-center font-bold w-[85px] italic">
                                      <div className="font-extrabold text-[16px] leading-none mb-1">{DAYS_TR[idx]}</div>
                                      <div className="font-bold text-[13px] leading-tight">{formatDateTR(dateStr)}</div>
                                  </th>
                              ))}
                              <th className="p-1.5 w-16 print:hidden border-b border-black"></th>
                           </tr>
                        </thead>
                        <tbody>
                           {generatedGrid
                               .filter(row => showOnlyAssignedTasks ? Object.values(row.tasks || {}).includes('Depo') : true)
                               .map((row, idx) => (
                               <tr key={`d-${row.personnel_id}`} className="hover:bg-blue-50/50">
                                   <td className="p-2 border-b border-r border-black text-center text-black font-extrabold text-[15px]">{idx + 1}</td>
                                   <td className="py-2 px-3 border-b border-r border-black font-bold text-black text-[14px] md:text-[16px] uppercase italic tracking-tighter leading-tight">{row.adSoyad}</td>
                                   <td className="py-2 px-1 border-b border-r border-black text-black font-bold text-[12px] md:text-[14px] hidden sm:table-cell text-center uppercase tracking-tighter">{row.department}</td>
                                   {getWeekDates(selectedWeekStart).map(dateStr => (
                                       <td key={`d-${row.personnel_id}-${dateStr}`} className="p-0 border-b border-r border-black text-center">
                                           {row.shifts[dateStr] ? (
                                               <button 
                                                 onClick={() => handleTaskChange(row.personnel_id, dateStr, row.tasks[dateStr] === 'Depo' ? '' : 'Depo')}
                                                 className={`w-full h-full min-h-[38px] transition-colors ${row.tasks[dateStr] === 'Depo' ? 'bg-blue-400 text-black font-black text-[18px]' : 'bg-white text-gray-300 hover:bg-blue-100 font-black text-[18px]'}`}
                                               >
                                                 {row.tasks[dateStr] === 'Depo' ? 'D' : '-'}
                                               </button>
                                           ) : (
                                               <div className="w-full h-full min-h-[38px] bg-white text-gray-300 flex items-center justify-center font-black text-[18px]">-</div>
                                           )}
                                       </td>
                                   ))}
                                   <td className="print:hidden border-b border-black"></td>
                               </tr>
                           ))}
                        </tbody>
                     </table>
                   </div>
               </div>
                </div>
              </div>
            </div>
         )}
      </CardContent>
    </Card>

    <Dialog open={showCodeMigration} onOpenChange={setShowCodeMigration}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Eski Vardiya Kodlarını Güncelle</DialogTitle>
            <DialogDescription>
              Aşağıdaki kodlar eski kayıtlı tablolardan gelmektedir ve güncel "Personel Hareket Türleri" ayarlarınızda bulunmamaktadır. Lütfen bunları yeni güncel kodlarınızla eşleştirin.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
              {unknownCodesList.map(oldCode => (
                  <div key={oldCode} className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-2 w-1/2">
                          <span className="font-bold text-red-500 bg-red-50 px-2 py-1 rounded w-full text-center border">{oldCode}</span>
                          <span>👉</span>
                      </div>
                      <select 
                          className="w-1/2 px-2 py-2 border rounded text-sm bg-background"
                          value={codeMappings[oldCode] || 'none'}
                          onChange={e => setCodeMappings(prev => ({...prev, [oldCode]: e.target.value}))}
                      >
                          <option value="none">Seçiniz...</option>
                          {engineContext?.shiftCodes.map((c: any) => (
                              <option key={c.code} value={c.code}>{c.code} ({c.label})</option>
                          ))}
                      </select>
                  </div>
              ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCodeMigration(false)}>İptal</Button>
            <Button onClick={applyCodeMappings} disabled={Object.values(codeMappings).some(v => v === 'none')}>Toplu Uygula</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ShiftEngineTab;
