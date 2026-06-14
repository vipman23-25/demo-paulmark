import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';

const ShiftReportsTab = () => {
  const [reportSpan, setReportSpan] = useState<'7' | '15' | '30' | '60' | '90' | '120'>('30');

  const { data: reportData, isLoading } = useQuery({
    queryKey: ['shift_reports', reportSpan],
    queryFn: async () => {
      const { data: personnel } = await supabase.from('personnel').select('id, first_name, last_name, department');
      
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - parseInt(reportSpan));
      const startStr = startDate.toISOString().split('T')[0];

      const { data: schedules } = await supabase.from('shift_schedules').select('*').gte('shift_date', startStr);

      const stats = (personnel || []).map(p => {
        const pScheds = (schedules || []).filter(s => s.personnel_id === p.id);
        const morning = pScheds.filter(s => s.shift_type === 'S' || s.shift_type === 'Sabah').length;
        const evening = pScheds.filter(s => s.shift_type === 'A' || s.shift_type === 'Akşam').length;
        const off = pScheds.filter(s => s.shift_type === 'İ' || s.shift_type === 'İzinli' || s.shift_type === 'T').length;
        
        const kitchen = pScheds.filter(s => s.task_assignment === 'Mutfak').length;
        const warehouse = pScheds.filter(s => s.task_assignment === 'Depo').length;
        
        return {
          ...p,
          morning,
          evening,
          off,
          kitchen,
          warehouse,
          total: morning + evening
        };
      }).sort((a, b) => a.department.localeCompare(b.department));

      return stats;
    }
  });

  const exportExcel = async () => {
    if (!reportData) return;
    const XLSX = await import('xlsx');
    const ws = XLSX.utils.json_to_sheet(reportData.map(r => ({
      'Ad Soyad': `${r.first_name} ${r.last_name}`,
      'Departman': r.department,
      'Sabah Vardiyası': r.morning,
      'Akşam Vardiyası': r.evening,
      'İzin (Off)': r.off,
      'Mutfak Görevi': r.kitchen,
      'Depo Görevi': r.warehouse,
      'Toplam Çalışma': r.total
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Vardiya İstatistikleri");
    XLSX.writeFile(wb, `Vardiya_Raporu_Son_${reportSpan}_Gun.xlsx`);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Vardiya Dengeleme Raporu</CardTitle>
          <CardDescription>Personellerin geçmiş dönemde kaç kez sabah ve akşam vardiyasına geldiklerini inceleyip adaleti sağlayabilirsiniz.</CardDescription>
        </div>
        <div className="flex gap-2 items-center">
          <select 
            value={reportSpan} 
            onChange={e => setReportSpan(e.target.value as any)}
            className="h-10 rounded-md border border-input bg-background px-3"
          >
            <option value="7">Son 7 Gün</option>
            <option value="15">Son 15 Gün</option>
            <option value="30">Son 1 Ay (30 Gün)</option>
            <option value="60">Son 2 Ay (60 Gün)</option>
            <option value="90">Son 3 Ay (90 Gün)</option>
            <option value="120">Son 4 Ay (120 Gün)</option>
          </select>
          <Button onClick={exportExcel}><Download className="w-4 h-4 mr-2" /> Excel İndir</Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-4 text-muted-foreground animate-pulse">Veriler yükleniyor...</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ad Soyad</TableHead>
                <TableHead>Reyon</TableHead>
                <TableHead className="text-center">Sabah</TableHead>
                <TableHead className="text-center">Akşam</TableHead>
                <TableHead className="text-center">İzin</TableHead>
                <TableHead className="text-center">Mutfak</TableHead>
                <TableHead className="text-center">Depo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reportData?.map(r => (
                <TableRow key={r.id}>
                  <TableCell className="font-semibold">{r.first_name} {r.last_name}</TableCell>
                  <TableCell>{r.department}</TableCell>
                  <TableCell className="text-center"><span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full text-xs font-bold">{r.morning}</span></TableCell>
                  <TableCell className="text-center"><span className="bg-indigo-100 text-indigo-800 px-2 py-1 rounded-full text-xs font-bold">{r.evening}</span></TableCell>
                  <TableCell className="text-center"><span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-bold">{r.off}</span></TableCell>
                  <TableCell className="text-center"><span className="bg-orange-100 text-orange-800 px-2 py-1 rounded-full text-xs font-bold">{r.kitchen}</span></TableCell>
                  <TableCell className="text-center"><span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs font-bold">{r.warehouse}</span></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};

export default ShiftReportsTab;
