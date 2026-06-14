import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfWeek } from 'date-fns';
import { tr } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertCircle, Calendar as CalendarIcon } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';

export const MatrixTab = ({ settings }: { settings: any }) => {
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  const { data: personnelData, isLoading: isLoadingPersonnel } = useQuery({
    queryKey: ['personnel'],
    queryFn: async () => {
      const { data } = await supabase.from('personnel').select('*').eq('is_active', true);
      return data || [];
    }
  });

  const weekStartStr = useMemo(() => format(startOfWeek(new Date(selectedDate), { weekStartsOn: 1 }), 'yyyy-MM-dd'), [selectedDate]);

  const { data: shiftsData, isLoading: isLoadingShifts } = useQuery({
    queryKey: ['shift_schedules', weekStartStr],
    queryFn: async () => {
      const { data } = await supabase.from('shift_schedules').select('*').eq('week_start_date', weekStartStr);
      return data || [];
    }
  });

  const matrix = useMemo(() => {
    if (!personnelData || !shiftsData || !settings.slots || !settings.departmentGroups) return null;

    const dayOfWeek = new Date(selectedDate).getDay();
    const dayType = (dayOfWeek === 0 || dayOfWeek === 6) ? 'weekend' : 'weekday';

    // 1. Get today's shifts
    const todayShifts = shiftsData.filter((s: any) => s.shift_date === selectedDate);
    
    // 2. Map personnel to groups and shifts
    const groups: Record<string, { total: any[], name: string, criticalLimit: number }> = {};
    settings.departmentGroups.forEach((g: any) => {
      const limit = dayType === 'weekend' 
        ? (g.criticalLimitWeekend ?? g.criticalLimit ?? 1) 
        : (g.criticalLimitWeekday ?? g.criticalLimit ?? 1);
      groups[g.id] = { total: [], name: g.name, criticalLimit: limit };
    });

    const activePersonnel = personnelData.map(p => {
      const shift = todayShifts.find((s: any) => s.personnel_id === p.id);
      if (!shift || !shift.shift_type || shift.shift_type === '-') return null; // Not working today

      // Determine group
      let groupId = 'other';
      for (const g of settings.departmentGroups) {
        if (g.includedDepartments.some((d: string) => p.department?.toUpperCase().includes(d.toUpperCase()))) {
          groupId = g.id;
          break;
        }
      }

      const upVal = shift.shift_type.toUpperCase();
      const cleanVal = upVal.split('+')[0].trim();
      let category = 'DİĞER';
      if (cleanVal === 'S' || cleanVal === 'SABAH') category = 'SABAH';
      else if (cleanVal === 'A' || cleanVal === 'AKŞAM') category = 'AKŞAM';
      else {
        const match = cleanVal.match(/^(\d{1,2})[.:]/);
        if (match) {
          const hour = parseInt(match[1], 10);
          if (hour < 13) category = 'SABAH';
          else category = 'AKŞAM';
        }
      }

      const pData = { ...p, shiftVal: shift.shift_type, category };
      if (groups[groupId]) groups[groupId].total.push(pData);
      
      return pData;
    }).filter(Boolean);

    // 3. Initialize matrix slots
    const slots = settings.slots.map((s: any) => ({ ...s, assignments: {} }));
    
    // 4. Distribute per group
    Object.keys(groups).forEach(groupId => {
      const g = groups[groupId];
      
      // Initialize slot assignments for this group
      slots.forEach((s: any) => { s.assignments[groupId] = []; });

      g.total.forEach(p => {
        // Find matching slots based on rules
        const rulesForDay = (settings.rules || []).filter((r: any) => r.dayType === dayType);
        const validSlots = slots.filter((s: any) => {
          const rule = rulesForDay.find((r: any) => r.slotId === s.id);
          if (!rule) return false;
          return rule.targetShifts.includes('ALL') || rule.targetShifts.some((ts: string) => p.category.includes(ts) || p.shiftVal.toUpperCase().includes(ts));
        });

        if (validSlots.length > 0) {
          // Balance: find the valid slot with the minimum people from this group
          validSlots.sort((a: any, b: any) => a.assignments[groupId].length - b.assignments[groupId].length);
          validSlots[0].assignments[groupId].push(p);
        } else if (slots.length > 0) {
          // Fallback: put in the slot with minimum overall people
          const sortedSlots = [...slots].sort((a: any, b: any) => a.assignments[groupId].length - b.assignments[groupId].length);
          sortedSlots[0].assignments[groupId].push(p);
        }
      });
    });

    return { groups, slots };
  }, [personnelData, shiftsData, settings, selectedDate]);

  if (isLoadingPersonnel || isLoadingShifts) return <div className="p-8 text-center animate-pulse">Veriler yükleniyor...</div>;

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4 items-center">
            <Label>Tarih Seçin:</Label>
            <Input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="w-[200px]" />
          </div>
        </CardContent>
      </Card>

      {!matrix || !matrix.slots.length ? (
        <Alert><AlertCircle className="h-4 w-4" /><AlertTitle>Bilgi</AlertTitle><AlertDescription>Seçilen tarih için planlama oluşturulamadı. Lütfen ayarlar kısmından mola slotlarını ve reyonları tanımladığınızdan emin olun.</AlertDescription></Alert>
      ) : (
        <Card>
          <CardHeader><CardTitle>{format(new Date(selectedDate), 'd MMMM yyyy', { locale: tr })} - Mola Matrisi</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reyon Adı</TableHead>
                  <TableHead>Mola Saati</TableHead>
                  <TableHead>Moladaki Kişiler</TableHead>
                  <TableHead>Kalan Kişiler (Sayı)</TableHead>
                  <TableHead>Durum</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.keys(matrix.groups).map(groupId => {
                  const g = matrix.groups[groupId];
                  if (g.total.length === 0) return null;

                  return matrix.slots.map((slot: any, index: number) => {
                    const onBreak = slot.assignments[groupId] || [];
                    const remainingCount = g.total.length - onBreak.length;
                    const isCritical = remainingCount < g.criticalLimit;

                    return (
                      <TableRow key={`${groupId}-${slot.id}`} className={index === matrix.slots.length - 1 ? 'border-b-4 border-b-muted' : ''}>
                        {index === 0 && (
                          <TableCell rowSpan={matrix.slots.length} className="font-semibold align-top bg-muted/20 border-r">
                            {g.name}
                            <div className="text-xs text-muted-foreground font-normal mt-1">Toplam: {g.total.length} Kişi</div>
                            <div className="text-xs text-muted-foreground font-normal">Kritik: {g.criticalLimit} Kişi</div>
                          </TableCell>
                        )}
                        <TableCell className="font-medium whitespace-nowrap">{slot.timeRange}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {onBreak.length > 0 ? onBreak.map((p: any) => (
                              <Badge key={p.id} variant="secondary" className="text-xs">{p.first_name} {p.last_name}</Badge>
                            )) : <span className="text-xs text-muted-foreground">-</span>}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="font-semibold">{remainingCount} Kişi</div>
                        </TableCell>
                        <TableCell>
                          {isCritical ? (
                            <Badge variant="destructive" className="flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Kritik Sınır Aşımı</Badge>
                          ) : (
                            <Badge variant="outline" className="bg-green-500/10 text-green-600">Uygun</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  });
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
