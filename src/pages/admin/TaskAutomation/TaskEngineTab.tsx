import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { PlayCircle, Save, Calendar as CalendarIcon, RefreshCw } from 'lucide-react';
import { format, addDays, startOfWeek } from 'date-fns';
import { tr } from 'date-fns/locale';

const generateWeekOptions = () => {
    const options = [];
    let current = startOfWeek(new Date(), { weekStartsOn: 1 });
    current = addDays(current, -14); // Past 2 weeks
    for (let i = 0; i < 6; i++) {
        const start = current;
        const end = addDays(current, 6);
        options.push({
            label: `${format(start, 'dd MMM')} - ${format(end, 'dd MMM yyyy', { locale: tr })}`,
            start: format(start, 'yyyy-MM-dd'),
            end: format(end, 'yyyy-MM-dd'),
            dates: Array.from({length: 7}).map((_, i) => format(addDays(start, i), 'yyyy-MM-dd'))
        });
        current = addDays(current, 7);
    }
    return options;
};

const WEEK_OPTIONS = generateWeekOptions();

const TaskEngineTab = () => {
  const queryClient = useQueryClient();
  const [selectedWeek, setSelectedWeek] = useState(WEEK_OPTIONS[2]); // Default to current week
  const [generatedAssignments, setGeneratedAssignments] = useState<any[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  const { data: personnel } = useQuery({
    queryKey: ['personnel'],
    queryFn: async () => {
      const { data, error } = await supabase.from('personnel').select('*').eq('is_active', true);
      if (error) throw error;
      return data;
    }
  });

  const { data: shiftSchedules } = useQuery({
    queryKey: ['shift_schedules', selectedWeek.start, selectedWeek.end],
    queryFn: async () => {
      const { data, error } = await supabase.from('shift_schedules').select('*')
         .gte('shift_date', selectedWeek.start).lte('shift_date', selectedWeek.end);
      if (error) throw error;
      return data;
    }
  });

  const { data: balances } = useQuery({
    queryKey: ['task_personnel_balances'],
    queryFn: async () => {
      const { data, error } = await supabase.from('task_personnel_balances' as any).select('*');
      if (error) throw error;
      return data;
    }
  });

  const { data: settings } = useQuery({
    queryKey: ['task_automation_settings'],
    queryFn: async () => {
      const { data, error } = await supabase.from('task_automation_settings' as any).select('*');
      if (error) throw error;
      return data;
    }
  });

  const handleGenerate = () => {
      if (!personnel || !shiftSchedules || !settings || !balances) {
          return toast.error("Veriler tam yüklenmedi.");
      }
      setIsGenerating(true);

      const newAssignments: any[] = [];
      const whSettings = settings.find((s: any) => s.module_name === 'warehouse') || { active_days: [1,2,3,4,5,6,7], max_capacity: 3 };
      const kiSettings = settings.find((s: any) => s.module_name === 'kitchen') || { active_days: [1,2,3,4,5,6,7], max_capacity: 1 };

      // Helper to calculate fairness score (lower is better priority)
      const getScore = (pId: string, module: string) => {
          const bal = balances.find((b: any) => b.personnel_id === pId && b.module_name === module)?.balance_days || 0;
          const assignedThisRun = newAssignments.filter(a => a.personnel_id === pId && a.module_name === module).length;
          return assignedThisRun - bal; // High balance means they are "owed" less, so subtract it to boost priority? Wait. If balance is positive, they over-worked. So they should NOT be picked. So assigned - balance? No, assigned + balance. If balance is +5, their score is high, they won't be picked.
      };

      // Ensure we boost priority for low score (meaning they should be assigned)
      const calculatePriorityScore = (pId: string, module: string) => {
          const bal = balances.find((b: any) => b.personnel_id === pId && b.module_name === module)?.balance_days || 0;
          const assignedThisRun = newAssignments.filter(a => a.personnel_id === pId && a.module_name === module).length;
          return assignedThisRun + bal; // Lower score = picked first
      };

      selectedWeek.dates.forEach(dateStr => {
          const dayOfWeek = new Date(dateStr).getDay() || 7; // 1: Mon, 7: Sun

          const dayShifts = shiftSchedules.filter((s: any) => s.shift_date === dateStr);
          // Only active workers for today (not off, not sick)
          const activeWorkers = dayShifts.filter((s: any) => s.shift_code !== 'İ' && s.shift_code !== 'R' && s.shift_code !== 'O' && s.shift_code !== '-');

          // --- WAREHOUSE LOGIC ---
          if (whSettings.active_days.includes(dayOfWeek)) {
             const depts = Array.from(new Set(activeWorkers.map((s: any) => {
                 const p = personnel.find((p: any) => p.id === s.personnel_id);
                 return p?.department;
             }).filter(Boolean)));

             depts.forEach(dept => {
                 const deptWorkers = activeWorkers.map((s: any) => {
                     return { shift: s, personnel: personnel.find((p: any) => p.id === s.personnel_id) };
                 }).filter(w => w.personnel?.department === dept);

                 const total = deptWorkers.length;
                 const evening = deptWorkers.filter(w => w.shift.shift_code?.includes('A')).length;
                 const morning = deptWorkers.filter(w => w.shift.shift_code?.includes('S')).length;

                 let toAssign = 0;
                 const preferredShift = 'A'; // prefer evening

                 const isCocuk = dept?.toLowerCase().includes('çocuk');
                 const isBayan = dept?.toLowerCase().includes('bayan') || dept?.toLowerCase().includes('kadın');
                 const isErkek = dept?.toLowerCase().includes('erkek');

                 if (isCocuk) {
                     if (total === 1 && morning === 1) toAssign = 0;
                     else if (total >= 2 && total <= 3 && evening >= 1) toAssign = 1;
                 } else if (isBayan) {
                     if (total === 4 && evening >= 1 && evening <= 2) toAssign = 1;
                 } else if (isErkek) {
                     if (evening === 3) toAssign = 1;
                     else if (evening === 4) toAssign = 2;
                     else if (evening >= 5) toAssign = 3;
                 }

                 if (toAssign > 0) {
                     // Get candidates (prefer evening, then morning)
                     let candidates = deptWorkers.filter(w => w.shift.shift_code?.includes('A'));
                     if (candidates.length < toAssign) {
                         candidates = deptWorkers;
                     }
                     // Sort by score
                     candidates.sort((a, b) => calculatePriorityScore(a.personnel.id, 'warehouse') - calculatePriorityScore(b.personnel.id, 'warehouse'));

                     for (let i = 0; i < Math.min(toAssign, candidates.length); i++) {
                         newAssignments.push({
                             personnel_id: candidates[i].personnel.id,
                             module_name: 'warehouse',
                             assignment_date: dateStr,
                             shift: candidates[i].shift.shift_code,
                             is_manual: false
                         });
                     }
                 }
             });
          }

          // --- KITCHEN LOGIC ---
          if (kiSettings.active_days.includes(dayOfWeek)) {
              const toAssign = kiSettings.max_capacity || 1;
              let candidates = activeWorkers.map((s: any) => {
                  return { shift: s, personnel: personnel.find((p: any) => p.id === s.personnel_id) };
              }).filter(w => w.personnel); // add gender filter if needed by reading kiSettings.rules

              // Ensure they are not already in warehouse today
              candidates = candidates.filter(c => !newAssignments.some(a => a.personnel_id === c.personnel.id && a.assignment_date === dateStr));

              candidates.sort((a, b) => calculatePriorityScore(a.personnel.id, 'kitchen') - calculatePriorityScore(b.personnel.id, 'kitchen'));

              for (let i = 0; i < Math.min(toAssign, candidates.length); i++) {
                  newAssignments.push({
                      personnel_id: candidates[i].personnel.id,
                      module_name: 'kitchen',
                      assignment_date: dateStr,
                      shift: candidates[i].shift.shift_code,
                      is_manual: false
                  });
              }
          }
      });

      setGeneratedAssignments(newAssignments);
      setIsGenerating(false);
      toast.success("Görev dağılımı başarıyla oluşturuldu. İnceleyip kaydedebilirsiniz.");
  };

  const saveAssignmentsMutation = useMutation({
      mutationFn: async () => {
          // Delete old assignments for this week
          const { error: delErr } = await supabase.from('task_assignments' as any)
             .delete()
             .gte('assignment_date', selectedWeek.start)
             .lte('assignment_date', selectedWeek.end);
          if (delErr) throw delErr;

          if (generatedAssignments.length > 0) {
              const { error: insErr } = await supabase.from('task_assignments' as any).insert(generatedAssignments);
              if (insErr) throw insErr;
          }
      },
      onSuccess: () => {
          toast.success("Görevler veritabanına kaydedildi!");
          setGeneratedAssignments([]);
          queryClient.invalidateQueries({ queryKey: ['task_assignments'] });
      },
      onError: (e: any) => {
          toast.error("Kaydetme hatası: " + e.message);
      }
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between gap-4">
          <div className="flex items-center gap-2">
            <select 
                className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={selectedWeek.start}
                onChange={e => {
                    const found = WEEK_OPTIONS.find(w => w.start === e.target.value);
                    if (found) setSelectedWeek(found);
                }}
            >
                {WEEK_OPTIONS.map(w => <option key={w.start} value={w.start}>{w.label}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
              <Button onClick={handleGenerate} disabled={isGenerating} variant="secondary">
                  <RefreshCw className={`w-4 h-4 mr-2 ${isGenerating ? 'animate-spin' : ''}`} />
                  Otomatik Hesapla
              </Button>
              <Button onClick={() => saveAssignmentsMutation.mutate()} disabled={generatedAssignments.length === 0 || saveAssignmentsMutation.isPending}>
                  <Save className="w-4 h-4 mr-2" />
                  Listeyi Kaydet
              </Button>
          </div>
      </div>

      <Card>
          <CardHeader>
              <CardTitle>Oluşturulan Taslak</CardTitle>
              <CardDescription>Otomatik hesaplanan görev listesi. Kaydetmeden önce kontrol edebilirsiniz.</CardDescription>
          </CardHeader>
          <CardContent>
              {generatedAssignments.length === 0 ? (
                  <div className="text-center py-10 text-muted-foreground bg-muted/20 rounded-xl border border-dashed">
                      <PlayCircle className="w-10 h-10 mx-auto mb-3 opacity-20" />
                      Görev oluşturmak için "Otomatik Hesapla" butonuna basın.
                  </div>
              ) : (
                  <Table>
                      <TableHeader>
                          <TableRow>
                              <TableHead>Tarih</TableHead>
                              <TableHead>Görev (Modül)</TableHead>
                              <TableHead>Personel</TableHead>
                              <TableHead>Reyon</TableHead>
                              <TableHead>Vardiya</TableHead>
                          </TableRow>
                      </TableHeader>
                      <TableBody>
                          {generatedAssignments.sort((a,b) => a.assignment_date.localeCompare(b.assignment_date)).map((a, i) => {
                              const p = personnel?.find((p: any) => p.id === a.personnel_id);
                              return (
                                  <TableRow key={i}>
                                      <TableCell className="font-semibold">{format(new Date(a.assignment_date), 'dd MMM EEEE', { locale: tr })}</TableCell>
                                      <TableCell>
                                          <span className={`px-2 py-1 rounded text-xs font-semibold ${a.module_name === 'warehouse' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>
                                              {a.module_name === 'warehouse' ? 'Depo' : 'Mutfak'}
                                          </span>
                                      </TableCell>
                                      <TableCell>{p?.name}</TableCell>
                                      <TableCell>{p?.department}</TableCell>
                                      <TableCell>{a.shift}</TableCell>
                                  </TableRow>
                              )
                          })}
                      </TableBody>
                  </Table>
              )}
          </CardContent>
      </Card>
    </div>
  );
};

export default TaskEngineTab;
