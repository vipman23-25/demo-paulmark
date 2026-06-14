import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Package, Plus, Trash2, Pencil, Calendar, Download } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const CargoManagement = () => {
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [form, setForm] = useState({
    arrival_date: new Date().toISOString().split('T')[0],
    total_boxes: 0,
    counted_boxes: 0,
    driver_info: '',
    notes: ''
  });

  const [driverForm, setDriverForm] = useState({ name: '', plate: '', phone: '' });
  const [isDriverManagerOpen, setIsDriverManagerOpen] = useState(false);

  const { data: shipments, isLoading } = useQuery({
    queryKey: ['cargo_shipments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cargo_shipments' as any)
        .select('*, cargo_shipment_logs(*)')
        .order('arrival_date', { ascending: false })
        .limit(200);
      
      if (error) throw error;
      return data;
    }
  });

  const { data: drivers = [], isLoading: isLoadingDrivers } = useQuery({
    queryKey: ['cargo_drivers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('system_settings')
        .select('setting_value')
        .eq('setting_key', 'cargo_drivers')
        .maybeSingle();
      
      if (error && error.code !== 'PGRST116') throw error;
      return data?.setting_value || [];
    }
  });

  const updateDriversMutation = useMutation({
    mutationFn: async (newDrivers: any[]) => {
      const { error } = await supabase
        .from('system_settings')
        .upsert({ 
          setting_key: 'cargo_drivers', 
          setting_value: newDrivers 
        }, { onConflict: 'setting_key' });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cargo_drivers'] });
      toast.success('Şoför listesi güncellendi');
    },
    onError: (error: any) => {
      toast.error('Hata: ' + error.message);
    }
  });

  const upsertMutation = useMutation({
    mutationFn: async (formData: any) => {
      const isComplete = Number(formData.counted_boxes) >= Number(formData.total_boxes);
      
      let finalNotes = formData.notes || '';
      if (formData.driver_info && formData.driver_info.trim() !== '') {
        finalNotes = `[Şoför: ${formData.driver_info.trim()}]\n${finalNotes}`;
      }

      const payload = {
        arrival_date: formData.arrival_date,
        total_boxes: Number(formData.total_boxes),
        counted_boxes: Number(formData.counted_boxes),
        notes: finalNotes,
        status: isComplete ? 'Tamamlandı' : 'Sayılıyor',
        completion_date: isComplete ? new Date().toISOString() : null
      };

      if (editingId) {
        const { error } = await supabase
          .from('cargo_shipments' as any)
          .update(payload)
          .eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('cargo_shipments' as any)
          .insert([payload]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cargo_shipments'] });
      toast.success(editingId ? 'Sevkiyat güncellendi' : 'Sevkiyat eklendi');
      setIsOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast.error('İşlem başarısız: ' + error.message);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('cargo_shipments' as any)
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cargo_shipments'] });
      toast.success('Sevkiyat silindi');
    },
    onError: (error: any) => {
      toast.error('Silme işlemi başarısız: ' + error.message);
    }
  });

  const resetForm = () => {
    setEditingId(null);
    setForm({
      arrival_date: new Date().toISOString().split('T')[0],
      total_boxes: 0,
      counted_boxes: 0,
      driver_info: '',
      notes: ''
    });
  };

  const handleEdit = (shipment: any) => {
    setEditingId(shipment.id);
    let driver_info = '';
    let notes = shipment.notes || '';
    
    const match = notes.match(/^\[Şoför:\s*(.*?)\]\s*(.*)$/s);
    if (match) {
      driver_info = match[1];
      notes = match[2];
    }

    setForm({
      arrival_date: shipment.arrival_date,
      total_boxes: shipment.total_boxes,
      counted_boxes: shipment.counted_boxes,
      driver_info,
      notes
    });
    setIsOpen(true);
  };

  const calculateStatusInfo = (total: number, counted: number) => {
    if (counted >= total) return { text: 'Tamamlandı', color: 'bg-success/20 text-success' };
    if (counted > 0) return { text: 'Sayılıyor', color: 'bg-warning/20 text-warning' };
    return { text: 'Bekliyor', color: 'bg-muted text-muted-foreground' };
  };

  const handleExportExcel = async () => {
    if (!shipments || shipments.length === 0) {
      toast.error('Dışa aktarılacak veri bulunamadı');
      return;
    }
    
    try {
      const XLSX = await import('xlsx');
      // 1. Ana tablo (Sevkiyat Özeti)
      const exportData = shipments.map(item => {
        const remaining = Math.max(0, item.total_boxes - item.counted_boxes);
        const status = calculateStatusInfo(item.total_boxes, item.counted_boxes);
        
        let driver_info = '-';
        let display_notes = item.notes || '-';
        const match = (item.notes || '').match(/^\[Şoför:\s*(.*?)\]\s*(.*)$/s);
        if (match) {
          driver_info = match[1];
          display_notes = match[2] || '-';
        }
        
        let diffDays = 0;
        let speed = 0;
        
        if (item.completion_date && item.counted_boxes >= item.total_boxes) {
          const diffTime = Math.abs(new Date(item.completion_date).getTime() - new Date(item.arrival_date).getTime());
          diffDays = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
          speed = Math.round(item.total_boxes / diffDays);
        }

        // Aggregate logs for the summary column
        let logSummary = '-';
        if (item.cargo_shipment_logs && item.cargo_shipment_logs.length > 0) {
           const aggregated = item.cargo_shipment_logs.reduce((acc: any, log: any) => {
             if (!acc[log.personnel_name]) acc[log.personnel_name] = 0;
             acc[log.personnel_name] += Number(log.added_count || 0);
             return acc;
           }, {});
           
           logSummary = Object.entries(aggregated)
             .filter(([_, count]: [string, any]) => count !== 0)
             .sort((a: any, b: any) => b[1] - a[1])
             .map(([name, count]) => `${name}: ${count}`)
             .join(' | ');
        }

        return {
          'Geliş Tarihi': format(new Date(item.arrival_date), 'dd.MM.yyyy', { locale: tr }),
          'Toplam Koli': item.total_boxes,
          'Sayılan Koli': item.counted_boxes,
          'Kalan Koli': remaining,
          'Durum': status.text,
          'Bitiş Tarihi': item.completion_date ? format(new Date(item.completion_date), 'dd.MM.yyyy HH:mm', { locale: tr }) : '-',
          'Geçen Süre (Gün)': item.completion_date && item.counted_boxes >= item.total_boxes ? diffDays : '-',
          'Ortalama Hız (Koli/Gün)': item.completion_date && item.counted_boxes >= item.total_boxes ? speed : '-',
          'Sayım Yapanlar (Özet)': logSummary || '-',
          'Şoför/Plaka': driver_info,
          'Admin Notu': display_notes,
          'Personel Notu': item.personnel_notes || '-'
        };
      });

      // 2. Detaylı Log Tablosu (Tüm Hareketler)
      const logsData: any[] = [];
      shipments.forEach(item => {
        if (item.cargo_shipment_logs && item.cargo_shipment_logs.length > 0) {
          const sortedLogs = [...item.cargo_shipment_logs].sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
          sortedLogs.forEach(log => {
            logsData.push({
              'Sevkiyat Geliş Tarihi': format(new Date(item.arrival_date), 'dd.MM.yyyy', { locale: tr }),
              'Sevkiyat Toplam Koli': item.total_boxes,
              'İşlem Tarihi': format(new Date(log.created_at), 'dd.MM.yyyy HH:mm:ss', { locale: tr }),
              'Personel': log.personnel_name,
              'İşlem (Koli Adedi)': log.added_count > 0 ? `+${log.added_count}` : log.added_count,
              'İşlem Tipi': log.added_count > 0 ? 'Sayım Ekleme' : 'Sayım Çıkarma/Düzeltme'
            });
          });
        }
      });

      const wb = XLSX.utils.book_new();
      
      const wsMain = XLSX.utils.json_to_sheet(exportData);
      XLSX.utils.book_append_sheet(wb, wsMain, "Koli_Sevkiyatlar");
      
      if (logsData.length > 0) {
        const wsLogs = XLSX.utils.json_to_sheet(logsData);
        XLSX.utils.book_append_sheet(wb, wsLogs, "Tüm_Log_Hareketleri");
      }
      
      XLSX.writeFile(wb, `Sevkiyat_Sayimlari_${format(new Date(), 'dd_MM_yyyy')}.xlsx`);
      toast.success('Excel dosyası başarıyla indirildi');
    } catch (e: any) {
      toast.error('Excel oluşturulurken hata: ' + e.message);
    }
  };

  if (isLoading) return <div className="p-8 text-center animate-pulse">Yükleniyor...</div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center bg-card p-4 rounded-xl border">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Package className="w-6 h-6 text-primary" /> Koli / Sevkiyat Takibi
        </h2>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={handleExportExcel} className="hidden sm:flex">
            <Download className="w-4 h-4 mr-2" /> Excel'e Aktar
          </Button>

          <Dialog open={isDriverManagerOpen} onOpenChange={setIsDriverManagerOpen}>
            <DialogTrigger asChild>
              <Button variant="outline"><Package className="w-4 h-4 mr-2" /> Şoför Yönetimi</Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Kayıtlı Şoförler</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-2 p-3 bg-muted/50 rounded-lg">
                  <Input placeholder="Ad Soyad" value={driverForm.name} onChange={e => setDriverForm({...driverForm, name: e.target.value})} />
                  <Input placeholder="Plaka" value={driverForm.plate} onChange={e => setDriverForm({...driverForm, plate: e.target.value})} />
                  <Input placeholder="Telefon / İletişim" value={driverForm.phone} onChange={e => setDriverForm({...driverForm, phone: e.target.value})} />
                  <Button onClick={() => {
                    if(!driverForm.name || !driverForm.plate) return toast.error('Ad ve Plaka zorunludur');
                    const newDriver = { id: crypto.randomUUID(), ...driverForm };
                    updateDriversMutation.mutate([...drivers, newDriver]);
                    setDriverForm({ name: '', plate: '', phone: '' });
                  }} className="w-full"><Plus className="w-4 h-4 mr-2" /> Şoför Ekle</Button>
                </div>
                <div className="max-h-[300px] overflow-y-auto space-y-2">
                  {drivers.length === 0 ? <p className="text-sm text-muted-foreground text-center">Kayıtlı şoför yok.</p> : null}
                  {drivers.map((d: any) => (
                    <div key={d.id} className="flex justify-between items-center p-2 border rounded bg-card">
                      <div className="text-sm">
                        <div className="font-medium">{d.name} <span className="text-muted-foreground text-xs">({d.plate})</span></div>
                        <div className="text-xs text-muted-foreground">{d.phone}</div>
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => {
                        updateDriversMutation.mutate(drivers.filter((x: any) => x.id !== d.id));
                      }}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={isOpen} onOpenChange={(open) => {
            setIsOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button className="bg-primary/90 hover:bg-primary"><Plus className="w-4 h-4 mr-2" /> Yeni Sevkiyat Ekle</Button>
            </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingId ? 'Sevkiyatı Düzenle' : 'Yeni Sevkiyat Ekle'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Geliş Tarihi</Label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input 
                    type="date" 
                    className="pl-9"
                    value={form.arrival_date} 
                    onChange={e => setForm({...form, arrival_date: e.target.value})} 
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Toplam Koli Adedi</Label>
                  <Input 
                    type="number" 
                    min="0"
                    value={form.total_boxes} 
                    onChange={e => setForm({...form, total_boxes: parseInt(e.target.value) || 0})} 
                  />
                </div>
                <div className="space-y-2">
                  <Label>Sayılan Koli</Label>
                  <Input 
                    type="number" 
                    min="0"
                    max={form.total_boxes}
                    value={form.counted_boxes} 
                    onChange={e => {
                      const val = parseInt(e.target.value) || 0;
                      setForm({...form, counted_boxes: Math.min(val, form.total_boxes)});
                    }} 
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Kayıtlı Şoför Seç</Label>
                  <Select onValueChange={(val) => {
                    const d = drivers.find((x: any) => x.id === val);
                    if(d) setForm({...form, driver_info: `${d.name} | ${d.plate} | ${d.phone}`});
                  }}>
                    <SelectTrigger><SelectValue placeholder="Şoför seçin" /></SelectTrigger>
                    <SelectContent>
                      {drivers.length === 0 ? (
                        <SelectItem value="none" disabled>Kayıtlı şoför yok</SelectItem>
                      ) : (
                        drivers.map((d: any) => (
                          <SelectItem key={d.id} value={d.id}>{d.name} ({d.plate})</SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Tır Şoförü / Plaka Bilgisi</Label>
                  <Input 
                    placeholder="Ad Soyad | Plaka | İletişim"
                    value={form.driver_info} 
                    onChange={e => setForm({...form, driver_info: e.target.value})} 
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Admin Notu / Açıklama</Label>
                <Input 
                  placeholder="Araç plakası veya ek notlar..."
                  value={form.notes} 
                  onChange={e => setForm({...form, notes: e.target.value})} 
                />
              </div>

              <Button 
                className="w-full mt-4" 
                onClick={() => upsertMutation.mutate(form)}
                disabled={upsertMutation.isPending}
              >
                {upsertMutation.isPending ? 'Kaydediliyor...' : 'Kaydet'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      <Card className="glass-card">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tarih</TableHead>
                <TableHead className="text-center">Toplam Koli</TableHead>
                <TableHead className="text-center">Sayılan</TableHead>
                <TableHead className="text-center">Kalan</TableHead>
                <TableHead>Durum & İstatistik</TableHead>
                <TableHead>Şoför/Araç</TableHead>
                <TableHead>Son İşlemler (Log)</TableHead>
                <TableHead>Notlar</TableHead>
                <TableHead className="text-right">İşlemler</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shipments?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">Kayıtlı sevkiyat bulunamadı.</TableCell>
                </TableRow>
              ) : (
                shipments?.map((item: any) => {
                  const remaining = Math.max(0, item.total_boxes - item.counted_boxes);
                  const status = calculateStatusInfo(item.total_boxes, item.counted_boxes);
                  
                  let driver_info = '';
                  let display_notes = item.notes || '';
                  const match = (item.notes || '').match(/^\[Şoför:\s*(.*?)\]\s*(.*)$/s);
                  if (match) {
                    driver_info = match[1];
                    display_notes = match[2];
                  }

                  return (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">
                        {format(new Date(item.arrival_date), 'dd MMMM yyyy', { locale: tr })}
                      </TableCell>
                      <TableCell className="text-center font-semibold">{item.total_boxes}</TableCell>
                      <TableCell className="text-center text-primary font-semibold">{item.counted_boxes}</TableCell>
                      <TableCell className="text-center text-destructive font-semibold">{remaining}</TableCell>
                      <TableCell>
                        <div className="space-y-1 block">
                          <span className={`px-2 py-1 rounded text-xs font-semibold ${status.color} inline-block`}>
                            {status.text}
                          </span>
                          {item.completion_date && item.counted_boxes >= item.total_boxes && (
                            <div className="text-xs text-muted-foreground mt-2 border-t pt-1">
                              <div><span className="font-semibold">Bitiş:</span> {format(new Date(item.completion_date), 'dd MMM HH:mm', { locale: tr })}</div>
                              <div><span className="font-semibold">Süre:</span> {
                                (() => {
                                  // calculate days
                                  const diffTime = Math.abs(new Date(item.completion_date).getTime() - new Date(item.arrival_date).getTime());
                                  const diffDays = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
                                  return `${diffDays} Gün`;
                                })()
                              }</div>
                              <div><span className="font-semibold">Hız:</span> {
                                (() => {
                                  const diffTime = Math.abs(new Date(item.completion_date).getTime() - new Date(item.arrival_date).getTime());
                                  const diffDays = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
                                  return `${Math.round(item.total_boxes / diffDays)} koli/gün`;
                                })()
                              }</div>
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {driver_info ? (
                          <div className="text-xs font-medium bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 p-2 rounded border border-blue-100 dark:border-blue-900">
                            {driver_info.split('|').map((part: string, idx: number) => (
                              <div key={idx} className={idx === 0 ? "font-bold" : "text-muted-foreground"}>
                                {part.trim()}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-xs italic">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="max-h-[100px] overflow-y-auto space-y-1 pr-1 text-xs min-w-[150px]">
                          {item.cargo_shipment_logs && item.cargo_shipment_logs.length > 0 ? (
                            (() => {
                              // Aggregate logs by personnel_name
                              const aggregated = item.cargo_shipment_logs.reduce((acc: any, log: any) => {
                                if (!acc[log.personnel_name]) {
                                  acc[log.personnel_name] = { total: 0, latest: log.created_at };
                                }
                                acc[log.personnel_name].total += Number(log.added_count || 0);
                                if (new Date(log.created_at).getTime() > new Date(acc[log.personnel_name].latest).getTime()) {
                                  acc[log.personnel_name].latest = log.created_at;
                                }
                                return acc;
                              }, {});
                              
                              return Object.entries(aggregated)
                                .map(([name, data]: [string, any]) => ({ personnel_name: name, added_count: data.total, created_at: data.latest }))
                                .filter(log => log.added_count !== 0)
                                .sort((a, b) => b.added_count - a.added_count)
                                .map((log: any, i: number) => (
                                  <div key={i} className="bg-muted/50 p-1.5 rounded border-l-2 border-primary pl-2 mb-1">
                                    <span className="font-semibold text-foreground">{log.personnel_name}: </span>
                                    <span className={log.added_count > 0 ? 'text-success font-medium' : 'text-destructive font-medium'}>
                                      {log.added_count > 0 ? `+${log.added_count}` : log.added_count} Koli
                                    </span>
                                    <span className="text-[10px] text-muted-foreground ml-1" title="Son İşlem Zamanı">({format(new Date(log.created_at), 'dd.MM HH:mm', { locale: tr })})</span>
                                  </div>
                                ));
                            })()
                          ) : (
                            <span className="text-muted-foreground text-xs italic">Kayıt yok</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {display_notes && <div className="mb-1"><span className="font-semibold text-primary">Admin:</span> {display_notes}</div>}
                        {item.personnel_notes && <div><span className="font-semibold text-muted-foreground">Personel:</span> {item.personnel_notes}</div>}
                        {!display_notes && !item.personnel_notes && <span className="text-muted-foreground italic">-</span>}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(item)}>
                          <Pencil className="w-4 h-4 text-blue-500" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => {
                          if (window.confirm('Bu kaydı silmek istediğinize emin misiniz?')) {
                            deleteMutation.mutate(item.id);
                          }
                        }}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default CargoManagement;
