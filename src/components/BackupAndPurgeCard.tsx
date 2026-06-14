import React, { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { AlertTriangle, Database, Download, Trash2, Upload } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';

const TABLES_TO_BACKUP = [
  'cargo_companies',
  'cargo_shipments',
  'logistics_records',
  'shift_schedules',
  'overtime_records',
  'personnel_movements',
  'break_records',
  'weekly_day_off',
  'sales_targets',
  'reminders',
  'personnel'
];

const TABLE_NAMES: Record<string, string> = {
  'cargo_companies': 'Kargo Firmaları',
  'cargo_shipments': 'Kargo Takip',
  'logistics_records': 'Koli Sevkiyat',
  'shift_schedules': 'Vardiyalar',
  'overtime_records': 'Fazla Mesailer',
  'personnel_movements': 'Personel Hareketleri',
  'break_records': 'Molalar',
  'weekly_day_off': 'İzinler',
  'sales_targets': 'Satış Hedefleri',
  'reminders': 'Duyurular',
  'personnel': 'Personeller'
};

const BackupAndPurgeCard = () => {
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [selectedTables, setSelectedTables] = useState<string[]>([]);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const toggleTable = (table: string) => {
    setSelectedTables(prev => 
      prev.includes(table) ? prev.filter(t => t !== table) : [...prev, table]
    );
  };

  const handleExport = async () => {
    try {
      setIsExporting(true);
      const XLSX = await import('xlsx');
      const workbook = XLSX.utils.book_new();

      for (const table of TABLES_TO_BACKUP) {
        const { data, error } = await supabase.from(table).select('*');
        if (error) throw error;
        
        const worksheet = XLSX.utils.json_to_sheet(data || []);
        XLSX.utils.book_append_sheet(workbook, worksheet, table);
      }

      const dateStr = new Date().toISOString().split('T')[0];
      XLSX.writeFile(workbook, `Sistem_Yedek_${dateStr}.xlsx`);
      
      // Update last backup date in system_settings
      await supabase.from('system_settings' as any).upsert(
        { setting_key: 'last_backup_date', setting_value: new Date().toISOString() },
        { onConflict: 'setting_key' }
      );
      
      toast.success('Yedekleme başarıyla tamamlandı!');
    } catch (error: any) {
      console.error('Yedekleme hatası:', error);
      toast.error('Yedek alınırken bir hata oluştu: ' + error.message);
    } finally {
      setIsExporting(false);
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsImporting(true);
      const reader = new FileReader();
      
      reader.onload = async (evt) => {
        try {
          const XLSX = await import('xlsx');
          const bstr = evt.target?.result;
          const workbook = XLSX.read(bstr, { type: 'binary' });

          let successCount = 0;
          for (const sheetName of workbook.SheetNames) {
            if (TABLES_TO_BACKUP.includes(sheetName)) {
              const worksheet = workbook.Sheets[sheetName];
              const data = XLSX.utils.sheet_to_json(worksheet);
              
              if (data && data.length > 0) {
                // Remove id constraint if any problems, but typically upsert handles it.
                // We will perform upsert matching by ID.
                const { error } = await supabase.from(sheetName).upsert(data);
                if (error) {
                  console.error(`Tablo geri yükleme hatası (${sheetName}):`, error);
                  toast.error(`${sheetName} yüklenirken hata oluştu.`);
                } else {
                  successCount++;
                }
              }
            }
          }
          
          if (successCount > 0) {
            toast.success(`${successCount} tablo başarıyla geri yüklendi! Lütfen sayfayı yenileyin.`);
          } else {
            toast.info('Geri yüklenecek geçerli bir veri bulunamadı.');
          }
        } catch (err: any) {
          toast.error('Dosya okuma hatası: ' + err.message);
        } finally {
          setIsImporting(false);
          if (fileInputRef.current) fileInputRef.current.value = '';
        }
      };
      
      reader.readAsBinaryString(file);
    } catch (error: any) {
      toast.error('Beklenmeyen hata: ' + error.message);
      setIsImporting(false);
    }
  };

  const confirmDelete = async () => {
    if (deleteConfirmation !== 'SİL') {
      toast.error('Lütfen silme işlemini onaylamak için tam olarak SİL yazın.');
      return;
    }

    if (selectedTables.length === 0) {
      toast.error('Lütfen silinecek tabloları seçin.');
      return;
    }

    try {
      setIsDeleting(true);
      for (const table of selectedTables) {
        // Delete all rows in the table. Supabase doesn't support TRUNCATE via standard client without a filter.
        // We can do a dummy filter: id is not null
        const { error } = await supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000');
        if (error) throw error;
      }
      
      toast.success('Seçilen veriler kalıcı olarak SİLİNDİ!');
      setIsDeleteDialogOpen(false);
      setDeleteConfirmation('');
      setSelectedTables([]);
    } catch (error: any) {
      console.error('Silme hatası:', error);
      toast.error('Silme işlemi sırasında hata oluştu: ' + error.message);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Card className="glass-card border-red-200 shadow-sm relative overflow-hidden">
      <div className="absolute top-0 right-0 w-32 h-32 bg-red-100 rounded-bl-full opacity-50 z-0 pointer-events-none"></div>
      <CardHeader className="relative z-10">
        <CardTitle className="flex items-center gap-2 text-red-700">
          <Database className="w-5 h-5" /> Yedekleme ve Veri Temizliği
        </CardTitle>
        <CardDescription>
          Sistemdeki tüm tabloları Excel olarak indirebilir, tekrar yükleyebilir ve eski verileri temizleyebilirsiniz.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 relative z-10">
        <div className="flex gap-4">
          <Button onClick={handleExport} disabled={isExporting} className="w-1/2 bg-blue-600 hover:bg-blue-700">
            <Download className="w-4 h-4 mr-2" />
            {isExporting ? 'Yedekleniyor...' : 'Tüm Sistemi Yedekle'}
          </Button>
          
          <Button onClick={() => fileInputRef.current?.click()} disabled={isImporting} variant="outline" className="w-1/2 border-blue-200 text-blue-700 hover:bg-blue-50">
            <Upload className="w-4 h-4 mr-2" />
            {isImporting ? 'Yükleniyor...' : 'Yedekten Geri Yükle'}
          </Button>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleImport} 
            accept=".xlsx" 
            className="hidden" 
          />
        </div>

        <div className="pt-4 border-t border-red-100">
          <h4 className="font-semibold text-red-700 flex items-center gap-2 mb-3">
            <Trash2 className="w-4 h-4" /> Manuel Veri Temizliği (DİKKAT!)
          </h4>
          <p className="text-xs text-muted-foreground mb-4">
            Aşağıdan temizlemek istediğiniz verileri seçerek silebilirsiniz. Silmeden önce **mutlaka yedek alınız**.
          </p>

          <div className="grid grid-cols-2 gap-2 mb-4">
            {TABLES_TO_BACKUP.map(table => (
              <div key={table} className="flex items-center space-x-2">
                <Checkbox 
                  id={`purge-${table}`} 
                  checked={selectedTables.includes(table)}
                  onCheckedChange={() => toggleTable(table)}
                />
                <label htmlFor={`purge-${table}`} className="text-sm font-medium leading-none cursor-pointer">
                  {TABLE_NAMES[table]}
                </label>
              </div>
            ))}
          </div>

          <Button 
            onClick={() => setIsDeleteDialogOpen(true)} 
            disabled={selectedTables.length === 0}
            variant="destructive" 
            className="w-full"
          >
            Seçili Verileri Kalıcı Olarak Sil
          </Button>
        </div>

        <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-red-600">
                <AlertTriangle className="w-5 h-5" /> Çok Kritik İşlem Uyarısı
              </DialogTitle>
              <DialogDescription className="pt-2">
                Şu tabloları <strong>KALICI</strong> olarak silmek üzeresiniz:
                <ul className="list-disc pl-5 mt-2 mb-4 font-semibold text-foreground">
                  {selectedTables.map(t => <li key={t}>{TABLE_NAMES[t]}</li>)}
                </ul>
                <span className="text-red-500 font-bold block mb-2">Bu işlemin geri dönüşü YOKTUR. Tüm ilgili veriler kaybolacaktır!</span>
                Onaylamak için aşağıdaki kutuya büyük harflerle <strong>SİL</strong> yazın.
              </DialogDescription>
            </DialogHeader>
            <div className="my-2">
              <Input 
                placeholder="SİL yazın" 
                value={deleteConfirmation} 
                onChange={e => setDeleteConfirmation(e.target.value)} 
                className="font-bold tracking-widest text-center uppercase"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)} disabled={isDeleting}>İptal</Button>
              <Button variant="destructive" onClick={confirmDelete} disabled={isDeleting || deleteConfirmation !== 'SİL'}>
                {isDeleting ? 'Siliniyor...' : 'Evet, SİL'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};

export default BackupAndPurgeCard;
