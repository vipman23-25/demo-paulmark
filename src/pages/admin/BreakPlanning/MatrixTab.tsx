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
import { calculateBreakMatrix } from '@/lib/breakMatrixUtils';

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
    return calculateBreakMatrix(personnelData || [], shiftsData || [], settings, selectedDate);
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
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Bilgi</AlertTitle>
          <AlertDescription>
            Seçilen tarih için planlama oluşturulamadı. Lütfen ayarlar kısmından mola slotlarını ve reyonları tanımladığınızdan emin olun. 
            (Hata Detayı: Personel={personnelData?.length || 0}, Vardiya={shiftsData?.length || 0}, Slot={settings?.slots?.length || 0}, Grup={settings?.departmentGroups?.length || 0})
          </AlertDescription>
        </Alert>
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
                  <TableHead>Kalan Hesaplaması</TableHead>
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
                          <div className="flex flex-col gap-1 min-w-[120px]">
                            <div className="text-xs text-muted-foreground flex justify-between"><span>Mevcut:</span> <span>{g.total.length} Kişi</span></div>
                            <div className="text-xs text-red-500 flex justify-between"><span>Molada:</span> <span>- {onBreak.length} Kişi</span></div>
                            <div className={`font-bold border-t pt-1 mt-1 flex justify-between ${isCritical ? 'text-red-600' : 'text-green-600'}`}>
                              <span>Kalan:</span> <span>{remainingCount} Kişi</span>
                            </div>
                          </div>
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
