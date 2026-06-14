import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { Download, Search, ActivitySquare } from 'lucide-react';
import * as XLSX from 'xlsx';

interface SystemLog {
  id: string;
  created_at: string;
  user_id: string;
  user_name: string;
  action_type: string;
  details: string;
}

export const SystemLogs = () => {
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('system_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1000); // Son 1000 log

      if (error) {
        console.error('Log getirme hatası:', error);
      } else {
        setLogs(data || []);
      }
    } catch (err) {
      console.error('Beklenmeyen hata:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleExportExcel = () => {
    const exportData = filteredLogs.map(log => ({
      'Tarih': new Date(log.created_at).toLocaleString('tr-TR'),
      'Kullanıcı': log.user_name || 'Bilinmiyor',
      'İşlem Türü': log.action_type,
      'Detay': log.details
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sistem Logları");
    
    // Sütun genişliklerini ayarla
    ws['!cols'] = [
      { wch: 20 }, // Tarih
      { wch: 25 }, // Kullanıcı
      { wch: 20 }, // İşlem
      { wch: 60 }  // Detay
    ];

    XLSX.writeFile(wb, `sistem_loglari_${new Date().toLocaleDateString('tr-TR')}.xlsx`);
  };

  const filteredLogs = logs.filter(log => 
    log.user_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.action_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.details?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Sistem Logları</h1>
          <p className="text-muted-foreground">Sistemde yapılan tüm işlemlerin geçmişi (Son 1000 kayıt).</p>
        </div>
        <Button onClick={handleExportExcel} className="flex items-center gap-2">
          <Download className="w-4 h-4" />
          Excel'e Aktar
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center space-x-2">
            <Search className="w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="İşlem türü, kullanıcı veya detay ara..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-md"
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[180px]">Tarih</TableHead>
                  <TableHead className="w-[200px]">Kullanıcı</TableHead>
                  <TableHead className="w-[150px]">İşlem Türü</TableHead>
                  <TableHead>Detay</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                      Loglar yükleniyor...
                    </TableCell>
                  </TableRow>
                ) : filteredLogs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                      Gösterilecek log kaydı bulunamadı.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="font-medium">
                        {new Date(log.created_at).toLocaleString('tr-TR')}
                      </TableCell>
                      <TableCell>{log.user_name || 'Bilinmiyor'}</TableCell>
                      <TableCell>
                        <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10">
                          {log.action_type}
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {log.details}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
