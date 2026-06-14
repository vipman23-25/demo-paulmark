import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Download, Calendar as CalendarIcon } from 'lucide-react';
import { format, subDays, startOfWeek, endOfWeek, subMonths, endOfMonth, startOfMonth } from 'date-fns';
import { tr } from 'date-fns/locale';
import { toast } from 'sonner';

const TaskReportsTab = () => {
  const [reportPeriod, setReportPeriod] = useState('weekly'); // weekly, 15days, monthly

  const getDateRange = () => {
    const today = new Date();
    if (reportPeriod === 'weekly') {
      return { start: format(startOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd'), end: format(endOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd') };
    }
    if (reportPeriod === '15days') {
      return { start: format(subDays(today, 15), 'yyyy-MM-dd'), end: format(today, 'yyyy-MM-dd') };
    }
    // monthly
    return { start: format(startOfMonth(today), 'yyyy-MM-dd'), end: format(endOfMonth(today), 'yyyy-MM-dd') };
  };

  const { start, end } = getDateRange();

  const { data: assignments, isLoading } = useQuery({
    queryKey: ['task_assignments_report', start, end],
    queryFn: async () => {
      const { data, error } = await supabase.from('task_assignments' as any)
         .select('*, personnel(*)')
         .gte('assignment_date', start)
         .lte('assignment_date', end);
      if (error) throw error;
      return data;
    }
  });

  const getStats = () => {
    if (!assignments) return [];
    const statsMap: any = {};
    assignments.forEach((a: any) => {
        const pId = a.personnel_id;
        if (!statsMap[pId]) {
            statsMap[pId] = {
                name: a.personnel?.name || 'Bilinmiyor',
                department: a.personnel?.department || '-',
                warehouseCount: 0,
                kitchenCount: 0,
                total: 0
            };
        }
        if (a.module_name === 'warehouse') statsMap[pId].warehouseCount++;
        else if (a.module_name === 'kitchen') statsMap[pId].kitchenCount++;
        statsMap[pId].total++;
    });
    return Object.values(statsMap).sort((a: any, b: any) => b.total - a.total);
  };

  const stats = getStats();

  const handleExportExcel = async () => {
      if (!stats.length) return toast.error("Dışa aktarılacak veri yok.");
      
      const XLSX = await import('xlsx');
      const exportData = stats.map((s: any) => ({
          'Personel Adı': s.name,
          'Reyon': s.department,
          'Depo Görevi Sayısı': s.warehouseCount,
          'Mutfak Görevi Sayısı': s.kitchenCount,
          'Toplam Görev': s.total
      }));

      // Raw data log
      const rawData = assignments?.map((a: any) => ({
          'Tarih': format(new Date(a.assignment_date), 'dd.MM.yyyy', { locale: tr }),
          'Görev': a.module_name === 'warehouse' ? 'Depo' : 'Mutfak',
          'Personel': a.personnel?.name,
          'Reyon': a.personnel?.department,
          'Vardiya': a.shift
      })) || [];

      const wb = XLSX.utils.book_new();
      const ws1 = XLSX.utils.json_to_sheet(exportData);
      XLSX.utils.book_append_sheet(wb, ws1, "Görev_Özeti");

      const ws2 = XLSX.utils.json_to_sheet(rawData);
      XLSX.utils.book_append_sheet(wb, ws2, "Tüm_Atamalar");

      XLSX.writeFile(wb, `Otomasyon_Raporu_${reportPeriod}_${format(new Date(), 'dd_MM')}.xlsx`);
      toast.success("Excel başarıyla indirildi.");
  };

  return (
    <div className="space-y-6">
      <Card>
          <CardHeader className="flex flex-row justify-between items-center">
              <div>
                  <CardTitle>Görev Dağılım Raporları</CardTitle>
                  <CardDescription>Personellerin hangi periyotta kaç kez görev aldığını inceleyin.</CardDescription>
              </div>
              <Button onClick={handleExportExcel} variant="outline">
                  <Download className="w-4 h-4 mr-2" />
                  Excel İndir
              </Button>
          </CardHeader>
          <CardContent className="space-y-6">
              <div className="flex gap-2 mb-4">
                  <Button variant={reportPeriod === 'weekly' ? 'default' : 'secondary'} onClick={() => setReportPeriod('weekly')}>Bu Hafta</Button>
                  <Button variant={reportPeriod === '15days' ? 'default' : 'secondary'} onClick={() => setReportPeriod('15days')}>Son 15 Gün</Button>
                  <Button variant={reportPeriod === 'monthly' ? 'default' : 'secondary'} onClick={() => setReportPeriod('monthly')}>Bu Ay</Button>
              </div>

              {isLoading ? (
                  <div className="text-center py-4">Yükleniyor...</div>
              ) : stats.length === 0 ? (
                  <div className="text-center py-10 text-muted-foreground border rounded-lg bg-muted/20">Bu periyotta hiç görev kaydı bulunamadı.</div>
              ) : (
                  <Table>
                      <TableHeader>
                          <TableRow>
                              <TableHead>Personel</TableHead>
                              <TableHead>Reyon</TableHead>
                              <TableHead className="text-center text-blue-600">Depo (Kez)</TableHead>
                              <TableHead className="text-center text-orange-600">Mutfak (Kez)</TableHead>
                              <TableHead className="text-center">Toplam</TableHead>
                          </TableRow>
                      </TableHeader>
                      <TableBody>
                          {stats.map((s: any, i) => (
                              <TableRow key={i}>
                                  <TableCell className="font-semibold">{s.name}</TableCell>
                                  <TableCell>{s.department}</TableCell>
                                  <TableCell className="text-center font-mono">{s.warehouseCount}</TableCell>
                                  <TableCell className="text-center font-mono">{s.kitchenCount}</TableCell>
                                  <TableCell className="text-center font-bold text-primary">{s.total}</TableCell>
                              </TableRow>
                          ))}
                      </TableBody>
                  </Table>
              )}
          </CardContent>
      </Card>
    </div>
  );
};

export default TaskReportsTab;
