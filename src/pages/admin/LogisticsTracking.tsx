import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Truck, Plus, Trash2, Pencil, Calendar, Download, Settings, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';

const LogisticsTracking = () => {
  const queryClient = useQueryClient();
  const [isRecordOpen, setIsRecordOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isCompaniesOpen, setIsCompaniesOpen] = useState(false);
  const [newCompany, setNewCompany] = useState('');

  const [form, setForm] = useState({
    company_name: '',
    shipment_date: new Date().toISOString().split('T')[0],
    content_description: '',
    tracking_number: ''
  });

  // Fetch Companies
  const { data: companies, isLoading: loadingCompanies } = useQuery({
    queryKey: ['cargo_companies'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cargo_companies' as any)
        .select('*')
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data;
    }
  });

  // Fetch Records
  const { data: records, isLoading: loadingRecords } = useQuery({
    queryKey: ['logistics_records'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('logistics_records' as any)
        .select('*')
        .order('shipment_date', { ascending: false })
        .limit(200);
      if (error) throw error;
      return data;
    }
  });

  // Export Excel
  const handleExportExcel = async () => {
    if (!records || records.length === 0) {
      toast.error('Dıya aktarılacak veri bulunamadı');
      return;
    }
    try {
      const XLSX = await import('xlsx');
      const exportData = records.map(item => ({
        'Tarih': format(new Date(item.shipment_date), 'dd.MM.yyyy', { locale: tr }),
        'Kargo Firması': item.company_name,
        'İçerik Açıklaması': item.content_description,
        'Takip Numarası': item.tracking_number,
        'Oluşturulma': format(new Date(item.created_at), 'dd.MM.yyyy HH:mm', { locale: tr })
      }));
      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Kargo_Takip");
      XLSX.writeFile(wb, `Kargo_Takip_${format(new Date(), 'dd_MM_yyyy')}.xlsx`);
      toast.success("Excel başarıyla indirildi");
    } catch (e: any) {
      toast.error("Excel oluşturulurken hata: " + e.message);
    }
  };

  // Company Mutations
  const addCompanyMutation = useMutation({
    mutationFn: async (name: string) => {
      const { error } = await supabase.from('cargo_companies' as any).insert([{ name }]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cargo_companies'] });
      toast.success('Firma eklendi');
      setNewCompany('');
    },
    onError: (err: any) => toast.error('Hata: ' + err.message)
  });

  const deleteCompanyMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('cargo_companies' as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cargo_companies'] });
      toast.success('Firma silindi');
    },
    onError: (err: any) => toast.error('Hata: ' + err.message)
  });

  // Record Mutations
  const upsertRecordMutation = useMutation({
    mutationFn: async (data: typeof form) => {
      if (editingId) {
        const { error } = await supabase.from('logistics_records' as any).update(data).eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('logistics_records' as any).insert([data]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['logistics_records'] });
      toast.success(editingId ? 'Kayıt güncellendi' : 'Kayıt eklendi');
      setIsRecordOpen(false);
      resetForm();
    },
    onError: (err: any) => toast.error('Kayıt hatası: ' + err.message)
  });

  const deleteRecordMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('logistics_records' as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['logistics_records'] });
      toast.success('Kayıt silindi');
    },
    onError: (err: any) => toast.error('Silme hatası: ' + err.message)
  });

  const rejectDeletionMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('logistics_records' as any).update({ deletion_status: 'none' }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['logistics_records'] });
      toast.success('Silme talebi reddedildi');
    },
    onError: (err: any) => toast.error('Hata: ' + err.message)
  });

  const resetForm = () => {
    setEditingId(null);
    setForm({
      company_name: '',
      shipment_date: new Date().toISOString().split('T')[0],
      content_description: '',
      tracking_number: ''
    });
  };

  const handleEdit = (record: any) => {
    setEditingId(record.id);
    setForm({
      company_name: record.company_name,
      shipment_date: record.shipment_date,
      content_description: record.content_description,
      tracking_number: record.tracking_number
    });
    setIsRecordOpen(true);
  };

  const handleSaveRecord = () => {
    if (!form.company_name) { toast.error("Kargo firması adı zorunludur."); return; }
    if (!form.content_description) { toast.error("İçerik açıklaması zorunludur."); return; }
    if (!form.tracking_number) { toast.error("Takip numarası zorunludur."); return; }
    upsertRecordMutation.mutate(form);
  };

  if (loadingRecords || loadingCompanies) return <div className="p-8 text-center animate-pulse"><Loader2 className="w-6 h-6 animate-spin mx-auto"/>Yükleniyor...</div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center bg-card p-4 rounded-xl border gap-4">
        <h2 className="text-2xl font-bold flex items-center gap-2 text-primary whitespace-nowrap">
          <Truck className="w-6 h-6" /> Kargo Takip
        </h2>

        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto justify-end">
          <Dialog open={isCompaniesOpen} onOpenChange={setIsCompaniesOpen}>
            <DialogTrigger asChild>
              <Button variant="secondary" className="flex-1 md:flex-none"><Settings className="w-4 h-4 mr-2" /> Kargo Firmaları</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Kargo Firmalarını Yönet</DialogTitle></DialogHeader>
              <div className="space-y-4 py-4">
                <div className="flex gap-2">
                  <Input 
                    value={newCompany} 
                    onChange={e => setNewCompany(e.target.value)} 
                    placeholder="Yeni kargo firması adı..." 
                    onKeyDown={e => { if (e.key === 'Enter' && newCompany.trim()) addCompanyMutation.mutate(newCompany.trim()) }}
                  />
                  <Button onClick={() => newCompany.trim() && addCompanyMutation.mutate(newCompany.trim())} disabled={addCompanyMutation.isPending}>
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                <div className="border rounded-md max-h-[300px] overflow-y-auto">
                  <Table>
                    <TableBody>
                      {companies?.map((c: any) => (
                        <TableRow key={c.id}>
                          <TableCell className="font-medium">{c.name}</TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="sm" onClick={() => deleteCompanyMutation.mutate(c.id)} disabled={deleteCompanyMutation.isPending}>
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                      {(!companies || companies.length === 0) && (
                        <TableRow><TableCell colSpan={2} className="text-center text-muted-foreground">Kayıtlı firma bulunamadı.</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <Button variant="outline" onClick={handleExportExcel} className="flex-1 md:flex-none">
            <Download className="w-4 h-4 mr-2" /> Excel
          </Button>

          <Dialog open={isRecordOpen} onOpenChange={(open) => { setIsRecordOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button className="flex-1 md:flex-none bg-primary/90 hover:bg-primary"><Plus className="w-4 h-4 mr-2" /> Yeni Kargo</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader><DialogTitle>{editingId ? "Kargoyu Düzenle" : "Yeni Kargo Ekle"}</DialogTitle></DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Gönderi Tarihi</Label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input type="date" className="pl-9" value={form.shipment_date} onChange={e => setForm({...form, shipment_date: e.target.value})} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Kargo Firması</Label>
                  <select 
                    className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background disabled:cursor-not-allowed disabled:opacity-50"
                    value={form.company_name}
                    onChange={(e) => setForm({ ...form, company_name: e.target.value })}
                  >
                    <option value="">Seçiniz...</option>
                    {companies?.map((c: any) => <option key={c.id} value={c.name}>{c.name}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Kargo İçeriği / Açıklama</Label>
                  <Input value={form.content_description} onChange={e => setForm({...form, content_description: e.target.value})} placeholder="Örn: Evrak, İade Kolisi..." />
                </div>
                <div className="space-y-2">
                  <Label>Kargo Takip Numarası</Label>
                  <Input value={form.tracking_number} onChange={e => setForm({...form, tracking_number: e.target.value})} placeholder="Takip No..." />
                </div>
                <Button className="w-full mt-4" onClick={handleSaveRecord} disabled={upsertRecordMutation.isPending}>
                  {upsertRecordMutation.isPending ? 'Kaydediliyor...' : 'Kaydet'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card className="glass-card">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tarih</TableHead>
                  <TableHead>Firma</TableHead>
                  <TableHead>Açıklama</TableHead>
                  <TableHead>Takip Numarası</TableHead>
                  <TableHead className="text-right">İşlemler</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(!records || records.length === 0) ? (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Kayıtlı kargo bulunamadı.</TableCell></TableRow>
                ) : (
                  records.map((item: any) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{format(new Date(item.shipment_date), 'dd MMM yyyy', { locale: tr })}</TableCell>
                      <TableCell><span className="px-2 py-1 bg-muted rounded-md text-xs font-semibold">{item.company_name}</span></TableCell>
                      <TableCell>{item.content_description}</TableCell>
                      <TableCell>
                        <button 
                          onClick={(e) => {
                             e.preventDefault();
                             e.stopPropagation();
                             const tNumber = item.tracking_number ? String(item.tracking_number).trim() : '';
                             if (tNumber) {
                                 window.open(`https://www.dhlecommerce.com.tr/gonderi-takip?id=${tNumber}`, '_blank');
                                 
                                 try {
                                     if (navigator.clipboard && navigator.clipboard.writeText) {
                                         navigator.clipboard.writeText(tNumber);
                                         toast.success('Takip numarası kopyalandı!');
                                     } else {
                                         const textArea = document.createElement("textarea");
                                         textArea.value = tNumber;
                                         document.body.appendChild(textArea);
                                         textArea.select();
                                         try {
                                             document.execCommand('copy');
                                             toast.success('Takip numarası kopyalandı!');
                                         } catch (err) {
                                             console.error('Kopyalama hatası', err);
                                         }
                                         document.body.removeChild(textArea);
                                     }
                                 } catch(err) {
                                     console.error('Pano hatası:', err);
                                 }
                             }
                          }}
                          className="font-mono text-sm text-blue-600 dark:text-blue-400 hover:underline hover:text-blue-800 transition-colors text-left"
                          title="Kopyalamak için tıklayın"
                        >
                          {item.tracking_number || '-'}
                        </button>
                      </TableCell>
                      <TableCell className="text-right">
                        {item.deletion_status === 'pending' ? (
                          <div className="flex items-center justify-end gap-2">
                             <span className="text-xs font-semibold text-orange-600 bg-orange-100 px-2 py-1 rounded">Silme Onayı Bekliyor</span>
                             <Button variant="outline" size="sm" className="bg-green-50 text-green-600 hover:bg-green-100 border-green-200" onClick={() => {
                                if(window.confirm('Bu kaydın silinmesini onaylıyor musunuz?')) deleteRecordMutation.mutate(item.id);
                             }} disabled={deleteRecordMutation.isPending}>Onayla</Button>
                             <Button variant="outline" size="sm" className="bg-red-50 text-red-600 hover:bg-red-100 border-red-200" onClick={() => {
                                rejectDeletionMutation.mutate(item.id);
                             }} disabled={rejectDeletionMutation.isPending}>Reddet</Button>
                          </div>
                        ) : (
                          <>
                            <Button variant="ghost" size="icon" onClick={() => handleEdit(item)}>
                              <Pencil className="w-4 h-4 text-blue-500" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => {
                              if(window.confirm('Emin misiniz?')) deleteRecordMutation.mutate(item.id);
                            }} disabled={deleteRecordMutation.isPending}>
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </>
                        )}
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

export default LogisticsTracking;
