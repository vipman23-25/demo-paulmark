import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Target, Pencil, RefreshCw, Download } from 'lucide-react';
import { toast } from 'sonner';

const getInitialMonth = () => {
  const d = new Date();
  const m = (d.getMonth() + 1).toString().padStart(2, '0');
  return `${d.getFullYear()}-${m}`;
};

const SalesTargets = () => {
  const queryClient = useQueryClient();
  const [selectedMonth, setSelectedMonth] = useState(getInitialMonth());
  const [isOpen, setIsOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<any>(null);
  const [form, setForm] = useState<{ target_quota: number | string; realized_sales: number | string }>({ target_quota: '', realized_sales: '' });

  const { data: personnel = [], isLoading: pLoading } = useQuery({
    queryKey: ['active_personnel_sales'],
    queryFn: async (): Promise<any[]> => {
      const { data, error } = await supabase.from('personnel').select('*').eq('is_active', true);
      if (error) throw error;
      return data || [];
    }
  });

  const { data: salesTargets = [], isLoading: sLoading, refetch } = useQuery({
    queryKey: ['sales_targets', selectedMonth],
    queryFn: async (): Promise<any[]> => {
      const { data, error } = await supabase.from('sales_targets' as any).select('*').eq('target_month', selectedMonth);
      if (error) throw error;
      return data || [];
    }
  });

  const upsertMutation = useMutation({
    mutationFn: async (payload: any) => {
      // Check if it already exists
      const existing = salesTargets.find((s: any) => s.personnel_id === payload.personnel_id && s.target_month === payload.target_month);
      if (existing) {
         const { error } = await supabase.from('sales_targets' as any).update({
           target_quota: payload.target_quota,
           realized_sales: payload.realized_sales
         }).eq('id', existing.id);
         if (error) throw error;
      } else {
         const { error } = await supabase.from('sales_targets' as any).insert(payload);
         if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales_targets', selectedMonth] });
      toast.success('Satış hedefi başarıyla kaydedildi');
      setIsOpen(false);
    },
    onError: (e: any) => toast.error('Hata: ' + e.message)
  });

  const handleEdit = (p: any) => {
    const existing = salesTargets.find((s: any) => s.personnel_id === p.id);
    setEditingRow(p);
    setForm({
      target_quota: existing ? existing.target_quota : '',
      realized_sales: existing ? existing.realized_sales : '',
    });
    setIsOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRow) return;
    upsertMutation.mutate({
      personnel_id: editingRow.id,
      target_month: selectedMonth,
      target_quota: Number(form.target_quota) || 0,
      realized_sales: Number(form.realized_sales) || 0
    });
  };

  const isLoading = pLoading || sLoading;

  const data = personnel.map(p => {
    const st = salesTargets.find((s: any) => s.personnel_id === p.id);
    return {
      ...p,
      salesTarget: st || null
    };
  });

  const deptTotals = data.reduce((acc: any, p: any) => {
    const dep = p.department || 'Diğer';
    if (!acc[dep]) acc[dep] = { quota: 0, realized: 0 };
    if (p.salesTarget) {
       acc[dep].quota += Number(p.salesTarget.target_quota) || 0;
       acc[dep].realized += Number(p.salesTarget.realized_sales) || 0;
    }
    return acc;
  }, {});

  const handleExportToExcel = async () => {
    const XLSX = await import('xlsx');
    const exportData = data.map(p => ({
      'Ad Soyad': `${p.first_name} ${p.last_name}`,
      'Reyon / Departman': p.department,
      'Aylık Hedef (Kota)': p.salesTarget?.target_quota || 0,
      'Yapılan Satış': p.salesTarget?.realized_sales || 0,
      'Kalan Hedef': Math.max(0, (p.salesTarget?.target_quota || 0) - (p.salesTarget?.realized_sales || 0))
    }));
    
    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, `Satis_Hedefleri`);
    XLSX.writeFile(workbook, `Satis_Hedefleri_${selectedMonth}.xlsx`);
    toast.success('Excel dosyası indirildi');
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Target className="h-6 w-6" /> Personel Satış Hedefleri
        </h2>
        <div className="flex gap-2 items-center">
          <Input 
            type="month" 
            value={selectedMonth} 
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="w-48 bg-background uppercase"
          />
          <Button variant="outline" size="icon" onClick={() => refetch()} title="Yenile">
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button variant="outline" onClick={handleExportToExcel} title="Excel İndir" className="gap-2">
            <Download className="h-4 w-4" /> Excel İndir
          </Button>
        </div>
      </div>

      {!isLoading && Object.keys(deptTotals).length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Object.entries(deptTotals).map(([dep, vals]: any) => {
            if (vals.quota === 0) return null;
            const ratio = (vals.realized / vals.quota) * 100;
            const isComplete = ratio >= 100;
            return (
              <Card key={dep} className={`glass-card ${isComplete ? 'border-red-500/50 bg-red-500/5' : ''}`}>
                 <CardContent className="p-4 flex flex-col justify-center">
                    <h3 className="font-bold text-sm text-muted-foreground mb-1">[{dep}] Reyonu Toplamı</h3>
                    <div className="flex justify-between items-center text-sm">
                      <span className="font-semibold">{vals.quota.toLocaleString('tr-TR')} ₺</span>
                      <span className={`font-bold ${isComplete ? 'text-red-600' : 'text-blue-600'}`}>{vals.realized.toLocaleString('tr-TR')} ₺</span>
                    </div>
                    {isComplete ? (
                      <p className="text-xs text-red-600 mt-2 font-bold animate-pulse">Hedef %{(ratio).toFixed(0)} Geçildi!</p>
                    ) : (
                      <p className="text-xs text-muted-foreground mt-2">%{(ratio).toFixed(0)} Tamamlandı</p>
                    )}
                 </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <Card className="glass-card">
        <CardHeader>
          <CardTitle>Aylık Kota ve Performans</CardTitle>
          <CardDescription>{selectedMonth} yılı/ayı için personellerin kotalarını belirleyin.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ad Soyad</TableHead>
                  <TableHead>Reyon / Departman</TableHead>
                  <TableHead className="text-right">Aylık Hedef (Kota)</TableHead>
                  <TableHead className="text-right">Yapılan Satış</TableHead>
                  <TableHead className="text-right">Kalan Hedef</TableHead>
                  <TableHead className="text-center">İşlemler</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground animate-pulse">Yükleniyor...</TableCell></TableRow>
                ) : data.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Personel bulunamadı</TableCell></TableRow>
                ) : data.map(p => {
                  const quota = p.salesTarget?.target_quota || 0;
                  const realized = p.salesTarget?.realized_sales || 0;
                  const remaining = quota - realized;
                  
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.first_name} {p.last_name}</TableCell>
                      <TableCell>{p.department}</TableCell>
                      <TableCell className="text-right font-semibold">{quota.toLocaleString('tr-TR')} ₺</TableCell>
                      <TableCell className="text-right text-blue-600 dark:text-blue-400 font-semibold">{realized.toLocaleString('tr-TR')} ₺</TableCell>
                      <TableCell className="text-right">
                        {quota > 0 ? (
                          remaining > 0 ? (
                            <span className="text-orange-500 font-medium">{remaining.toLocaleString('tr-TR')} ₺ Kaldı</span>
                          ) : (
                            <span className="text-red-500 dark:text-red-400 font-bold">%{(realized / quota * 100).toFixed(0)} Aşıldı</span>
                          )
                        ) : (
                          <span className="text-muted-foreground text-xs">Kota Yok</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <Button variant="ghost" size="sm" onClick={() => handleEdit(p)}>
                          <Pencil className="h-4 w-4 mr-2" /> Düzenle
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isOpen} onOpenChange={(o) => { setIsOpen(o); if(!o) setEditingRow(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Satış Hedefi Güncelle</DialogTitle>
            {editingRow && <DialogDescription>{editingRow.first_name} {editingRow.last_name} için {selectedMonth} değerleri.</DialogDescription>}
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Aylık Hedef Kota (₺)</Label>
              <Input type="number" min="0" step="0.01" value={form.target_quota} onChange={e => setForm({...form, target_quota: e.target.value === '' ? '' : Number(e.target.value)})} />
            </div>
            <div className="space-y-2">
              <Label>Yapılan Satış (₺)</Label>
              <Input type="number" min="0" step="0.01" value={form.realized_sales} onChange={e => setForm({...form, realized_sales: e.target.value === '' ? '' : Number(e.target.value)})} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>İptal</Button>
              <Button type="submit" disabled={upsertMutation.isPending}>{upsertMutation.isPending ? 'Kaydediliyor' : 'Kaydet'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SalesTargets;
