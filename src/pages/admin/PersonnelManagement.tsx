import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { logAction } from '@/utils/logger';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Download, Plus, Pencil, UserX, UserCheck, Trash2, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { Switch } from '@/components/ui/switch';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { useAuth } from '@/contexts/AuthContext';

interface Personnel {
  id: string;
  first_name: string;
  last_name: string;
  tc_no: string;
  department: string;
  start_date: string;
  end_date: string | null;
  is_active: boolean;
  password_hash: string;
  user_id?: string | null;
  employee_code?: string | null;
  gender?: string | null;
  module_visibility?: {
    showBreak?: boolean;
    showLeave?: boolean;
    showSales?: boolean;
    showAnnouncements?: boolean;
    showCargo?: boolean;
    showMovements?: boolean;
    showOvertime?: boolean;
    showOtherPersonnel?: boolean;
    showLogistics?: boolean;
    showShiftTracking?: boolean;
    showActiveBreaks?: boolean;
    showShiftVisuals?: boolean;
  };
  employment_type?: string;
  contract_start_date?: string | null;
  contract_end_date?: string | null;
  total_contract_days?: number | null;
  telegram_chat_id?: string | null;
}

const calculateWorkDuration = (startDate: string) => {
  const start = new Date(startDate);
  const now = new Date();
  start.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);
  
  const diffMs = now.getTime() - start.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24)); // Gün farkı
  const totalDays = diffDays >= 0 ? diffDays + 1 : 0; // İşe başlanan gün de sayılır
  
  const years = Math.floor(totalDays / 365);
  const remainingAfterYears = totalDays % 365;
  const months = Math.floor(remainingAfterYears / 30);
  const days = remainingAfterYears % 30;
  
  return { years, months, days, totalDays };
};

const PersonnelManagement = () => {
  const { demoRestrictions } = useAuth();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    first_name: '', last_name: '', tc_no: '', employee_code: '', gender: '', department: '', start_date: '', end_date: '', password_hash: '', is_active: true,
    employment_type: 'full_time', contract_start_date: '', contract_end_date: '', telegram_chat_id: '',
    module_visibility: {
      showBreak: true,
      showLeave: true,
      showSales: true,
      showAnnouncements: true,
      showCargo: true,
      showMovements: true,
      showOvertime: true,
      showOtherPersonnel: false,
      showLogistics: true,
      showShiftTracking: true,
      showActiveBreaks: true,
      showShiftVisuals: true
    }
  });

  // Fetch Personnel from Supabase
  const { data: personnel = [], isLoading } = useQuery({
    queryKey: ['personnel'],
    queryFn: async () => {
      let { data, error } = await supabase
        .from('personnel')
        .select('*')
        .order('created_at', { ascending: false });
      
      // Auto-retry once for Supabase lock collision
      if (error && error.message && error.message.includes('stole it')) {
        Object.keys(localStorage).forEach(key => {
          if (key.startsWith('lock:sb-') || key.startsWith('sb-')) {
            localStorage.removeItem(key);
          }
        });
        await new Promise(r => setTimeout(r, 500));
        
        const retry = await supabase.from('personnel').select('*').order('created_at', { ascending: false });
        data = retry.data;
        error = retry.error;
      }
      
      if (error) {
        toast.error(`Personel verileri çekilirken hata oluştu: ${error.message}`);
        console.error("Fetch error details:", error);
        throw error;
      }
      return data as Personnel[];
    }
  });

  // Mutations
  const addMutation = useMutation({
    mutationFn: async (newPersonnel: any) => {
      const { data, error } = await supabase.from('personnel').insert([newPersonnel]).select();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['personnel'] });
      toast.success('Personel başarıyla veritabanına eklendi');
      handleCloseDialog();
    },
    onError: (error: any) => {
      toast.error('Ekleme başarısız: ' + error.message);
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: any }) => {
      const { data, error } = await supabase.from('personnel').update(updates).eq('id', id).select();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['personnel'] });
      toast.success('Personel başarıyla güncellendi');
      handleCloseDialog();
    },
    onError: (error: any) => {
      toast.error('Güncelleme başarısız: ' + error.message);
    }
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: any }) => {
      const { data, error } = await supabase.from('personnel').update(updates).eq('id', id).select();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['personnel'] });
      toast.success(variables.updates.is_active ? 'Personel tekrar aktif edildi' : 'Personel pasife alındı');
    },
    onError: (error: any) => {
      toast.error('Durum değişikliği başarısız: ' + error.message);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async ({id, name}: {id: string, name: string}) => {
      const { error } = await supabase.from('personnel').delete().eq('id', id);
      if (error) throw error;
      return {id, name};
    },
    onSuccess: async (data) => {
      await logAction('PERSONEL_SİLİNDİ', `${data.name} isimli personel sistemden kalıcı olarak silindi.`);
      queryClient.invalidateQueries({ queryKey: ['personnel'] });
      toast.success('Personel kalıcı olarak silindi');
    },
    onError: (error: any) => {
      toast.error('Silme başarısız: ' + error.message);
    }
  });

  const handleCloseDialog = () => {
    setIsOpen(false);
    setForm({ 
      first_name: '', last_name: '', tc_no: '', employee_code: '', gender: '', department: '', start_date: '', end_date: '', password_hash: '', is_active: true,
      employment_type: 'full_time', contract_start_date: '', contract_end_date: '', telegram_chat_id: '',
      module_visibility: {
        showBreak: true, showLeave: true, showSales: true, showAnnouncements: true, showCargo: true, showMovements: true, showOvertime: true, showOtherPersonnel: false, showLogistics: true, showShiftTracking: true, showActiveBreaks: true, showShiftVisuals: true
      }
    });
    setEditingId(null);
  };

  const startEdit = (p: Personnel) => {
    setForm({
      first_name: p.first_name,
      last_name: p.last_name,
      tc_no: p.tc_no,
      employee_code: p.employee_code || '',
      gender: p.gender || '',
      department: p.department,
      start_date: p.start_date,
      end_date: p.end_date || '',
      password_hash: p.password_hash || '',
      is_active: p.is_active,
      employment_type: p.employment_type || 'full_time',
      contract_start_date: p.contract_start_date || '',
      contract_end_date: p.contract_end_date || '',
      telegram_chat_id: p.telegram_chat_id || '',
      module_visibility: {
        showBreak: p.module_visibility?.showBreak ?? true,
        showLeave: p.module_visibility?.showLeave ?? true,
        showSales: p.module_visibility?.showSales ?? true,
        showAnnouncements: p.module_visibility?.showAnnouncements ?? true,
        showCargo: p.module_visibility?.showCargo ?? true,
        showMovements: p.module_visibility?.showMovements ?? true,
        showOvertime: p.module_visibility?.showOvertime ?? true,
        showOtherPersonnel: p.module_visibility?.showOtherPersonnel ?? false,
        showLogistics: p.module_visibility?.showLogistics ?? true,
        showShiftTracking: p.module_visibility?.showShiftTracking ?? true,
        showActiveBreaks: p.module_visibility?.showActiveBreaks ?? true,
        showShiftVisuals: p.module_visibility?.showShiftVisuals ?? true
      }
    });
    setEditingId(p.id);
    setIsOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!form.first_name.trim() || !form.last_name.trim() || !form.tc_no.trim() || !form.department.trim() || !form.start_date.trim() || !form.password_hash.trim()) {
      toast.error('Lütfen tüm zorunlu alanları doldurun (şifre dahil)');
      return;
    }

    if (!editingId && demoRestrictions) {
      if (personnel.length >= (demoRestrictions.max_personnel_count || 50)) {
        toast.error(`Demo kısıtlaması: Sisteme en fazla ${demoRestrictions.max_personnel_count} personel eklenebilir.`);
        return;
      }
    }

    const payload = {
      first_name: form.first_name,
      last_name: form.last_name,
      tc_no: form.tc_no,
      employee_code: form.employee_code || null,
      gender: form.gender || null,
      department: form.department,
      start_date: form.start_date,
      end_date: form.is_active ? null : (form.end_date || new Date().toISOString().split('T')[0]),
      password_hash: form.password_hash,
      employment_type: form.employment_type,
      contract_start_date: form.employment_type === 'bayram_part_time' && form.contract_start_date ? form.contract_start_date : null,
      contract_end_date: form.employment_type === 'bayram_part_time' && form.contract_end_date ? form.contract_end_date : null,
      total_contract_days: form.employment_type === 'bayram_part_time' && form.contract_start_date && form.contract_end_date 
                           ? Math.ceil((new Date(form.contract_end_date).getTime() - new Date(form.contract_start_date).getTime()) / (1000 * 60 * 60 * 24)) + 1
                           : null,
      telegram_chat_id: form.telegram_chat_id || null,
      module_visibility: form.module_visibility,
      is_active: form.is_active,
    };

    if (editingId) {
      updateMutation.mutate({ id: editingId, updates: payload });
    } else {
      addMutation.mutate(payload);
    }
  };

  const toggleActive = (p: Personnel) => {
    const isActive = !p.is_active;
    const updates: any = { is_active: isActive };
    if (!isActive) updates.end_date = new Date().toISOString().split('T')[0];
    else updates.end_date = null;
    
    toggleActiveMutation.mutate({ id: p.id, updates });
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-48 animate-pulse text-muted-foreground">
        Personel kayıtları yükleniyor...
      </div>
    );
  }

  const exportToExcel = async () => {
    const exportData = personnel.map(p => ({
      'Ad Soyad': `${p.first_name} ${p.last_name}`,
      'TC No': p.tc_no,
      'Sicil ID': p.employee_code || '-',
      'Departman': p.department,
      'Cinsiyet': p.gender || '-',
      'Başlangıç': p.start_date ? format(new Date(p.start_date), 'dd.MM.yyyy') : '-',
      'Bitiş': p.end_date ? format(new Date(p.end_date), 'dd.MM.yyyy') : '-',
      'Durum': p.is_active ? 'Aktif' : 'Pasif'
    }));
    
    const { utils, writeFile } = await import('xlsx');
    const ws = utils.json_to_sheet(exportData);
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, "Personeller");
    writeFile(wb, "Personel_Listesi.xlsx");
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-foreground">Personel Yönetimi</h2>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportToExcel}><Download className="w-4 h-4 mr-2" /> Excel İndir</Button>
          <Dialog open={isOpen} onOpenChange={(o) => { setIsOpen(o); if (!o) handleCloseDialog(); }}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" /> Yeni Personel</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-xl md:max-w-2xl lg:max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingId ? 'Personel Güncelle' : 'Yeni Personel Ekle'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="first_name">Ad</Label>
                  <Input id="first_name" value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} />
                </div>
                <div>
                  <Label htmlFor="last_name">Soyad</Label>
                  <Input id="last_name" value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="employee_code">TC Kimlik / Sicil No</Label>
                  <Input id="employee_code" value={form.employee_code} onChange={(e) => setForm({ ...form, employee_code: e.target.value })} />
                </div>
                <div>
                  <Label>Cinsiyet</Label>
                  <select 
                    className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    value={form.gender}
                    onChange={(e) => setForm({ ...form, gender: e.target.value })}
                  >
                    <option value="">Seçiniz</option>
                    <option value="Erkek">Erkek</option>
                    <option value="Kadın">Kadın</option>
                  </select>
                </div>
              </div>

              <div>
                <Label htmlFor="tc_no">Kullanıcı Adı (Giriş için)</Label>
                <Input id="tc_no" value={form.tc_no} onChange={(e) => setForm({ ...form, tc_no: e.target.value })} />
              </div>

              <div>
                <Label htmlFor="department">Reyon/Departman</Label>
                <Input id="department" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} placeholder="Örn: ERKEK" />
              </div>

              <div>
                <Label htmlFor="password_hash">Şifre</Label>
                <Input id="password_hash" type="text" className="bg-muted/30 font-medium" value={form.password_hash} onChange={(e) => setForm({ ...form, password_hash: e.target.value })} placeholder="****" />
              </div>

              <div>
                <Label htmlFor="telegram_chat_id" className="text-[#0088cc] font-bold">Telegram Chat ID (Opsiyonel)</Label>
                <Input id="telegram_chat_id" type="text" value={form.telegram_chat_id} onChange={(e) => setForm({ ...form, telegram_chat_id: e.target.value })} placeholder="Örn: 123456789" />
              </div>

              <div className="pt-2">
                <Label className="text-sm font-bold block mb-2">Çalışma Tipi</Label>
                <select 
                  className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  value={form.employment_type}
                  onChange={(e) => setForm({ ...form, employment_type: e.target.value })}
                >
                  <option value="full_time">Full Time</option>
                  <option value="part_time">Part Time</option>
                  <option value="bayram_part_time">Bayram Part Time</option>
                </select>
              </div>

              {form.employment_type === 'bayram_part_time' && (
                <div className="grid grid-cols-2 gap-4 bg-amber-50 p-3 rounded-lg border border-amber-200">
                  <div>
                    <Label htmlFor="contract_start_date" className="text-amber-900">Sözleşme Başlangıç</Label>
                    <Input id="contract_start_date" type="date" value={form.contract_start_date || ''} onChange={(e) => setForm({ ...form, contract_start_date: e.target.value })} className="border-amber-300 bg-white" />
                  </div>
                  <div>
                    <Label htmlFor="contract_end_date" className="text-amber-900">Sözleşme Bitiş</Label>
                    <Input id="contract_end_date" type="date" value={form.contract_end_date || ''} onChange={(e) => setForm({ ...form, contract_end_date: e.target.value })} className="border-amber-300 bg-white" />
                  </div>
                  {form.contract_start_date && form.contract_end_date && (
                    <div className="col-span-2 text-sm font-bold text-amber-700 bg-amber-100 p-2 rounded text-center">
                      Toplam Çalışma Günü: {Math.max(0, Math.ceil((new Date(form.contract_end_date).getTime() - new Date(form.contract_start_date).getTime()) / (1000 * 60 * 60 * 24)) + 1)} Gün
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 pt-2">
                <div>
                  <Label htmlFor="start_date">İşe Giriş Tarihi</Label>
                  <Input id="start_date" type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
                </div>
                <div>
                  <Label htmlFor="end_date">İşten Çıkış Tarihi</Label>
                  <Input id="end_date" type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} disabled={form.is_active} />
                </div>
              </div>

              <div className="pt-2">
                <Label className="text-sm font-bold block mb-2">Çalışma Durumu</Label>
                <div className="flex items-center space-x-2 bg-muted/50 p-3 rounded-lg border">
                  <Switch id="is_active" checked={form.is_active} onCheckedChange={(c) => setForm({...form, is_active: c})} />
                  <Label htmlFor="is_active" className="cursor-pointer font-medium">{form.is_active ? 'Aktif (Çalışıyor)' : 'Pasif (İşten Ayrıldı)'}</Label>
                </div>
              </div>

              <Accordion type="single" collapsible className="w-full mt-2 border-t pt-2">
                <AccordionItem value="module-visibility" className="border-b-0">
                  <AccordionTrigger className="hover:no-underline py-2">
                    <span className="text-sm font-bold text-blue-900 dark:text-blue-200">Modül Görünürlüğü (Gelişmiş Ayarlar)</span>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-3 px-3 py-3 border rounded-lg bg-muted/20 h-48 overflow-y-auto custom-scrollbar mt-2">
                      {[
                        { key: 'showBreak', label: 'Molaya Çıktım (Mola Verme İşlemi)' },
                        { key: 'showActiveBreaks', label: 'Aktif Molalar Özeti (Molada Olanlar)' },
                        { key: 'showLeave', label: 'İzin' },
                        { key: 'showSales', label: 'Satış Hedefi' },
                        { key: 'showAnnouncements', label: 'Duyurular' },
                        { key: 'showCargo', label: 'Koli/Sevkiyat' },
                        { key: 'showLogistics', label: 'Kargo Takip Modülü' },
                        { key: 'showMovements', label: 'Hareketler' },
                        { key: 'showOvertime', label: 'Fazla Mesai' },
                        { key: 'showOtherPersonnel', label: 'Diğer Personeli Görebilir' },
                        { key: 'showShiftTracking', label: 'Reyonum ve Vardiya Durumum' },
                        { key: 'showShiftVisuals', label: 'Vardiya Görseli (Yüklenen Resim)' },
                      ].map((module) => (
                        <div key={module.key} className="flex items-center justify-between">
                          <Label htmlFor={module.key} className="text-sm font-medium leading-none cursor-pointer">
                            {module.label}
                          </Label>
                          <Switch
                            id={module.key}
                            checked={form.module_visibility[module.key as keyof typeof form.module_visibility]}
                            onCheckedChange={(checked) => 
                              setForm({ ...form, module_visibility: { ...form.module_visibility, [module.key]: checked } })
                            }
                          />
                        </div>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>

              <Button type="submit" disabled={addMutation.isPending || updateMutation.isPending} className="w-full bg-blue-600 hover:bg-blue-700 text-white mt-4">
                {addMutation.isPending || updateMutation.isPending ? 'İşleniyor...' : 'Güncelle'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      <Card className="glass-card">
        <CardHeader>
          <CardTitle>Aktif Personel ({personnel.filter(p => p.is_active).length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ad Soyad</TableHead>
                  <TableHead>TC No</TableHead>
                  <TableHead>Sicil ID</TableHead>
                  <TableHead>Departman</TableHead>
                  <TableHead>Tip</TableHead>
                  <TableHead>Başlangıç</TableHead>
                  <TableHead>Durum</TableHead>
                  <TableHead>İşlemler</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {personnel.filter(p => p.is_active).map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.first_name} {p.last_name}</TableCell>
                    <TableCell>{p.tc_no}</TableCell>
                    <TableCell>
                      {p.employee_code ? <Badge variant="secondary">{p.employee_code}</Badge> : '-'}
                    </TableCell>
                    <TableCell>{p.department}</TableCell>
                    <TableCell>
                      {p.employment_type === 'part_time' ? <Badge variant="outline" className="bg-orange-100 text-orange-800">Part Time</Badge> : 
                       p.employment_type === 'bayram_part_time' ? <Badge variant="outline" className="bg-amber-100 text-amber-800">Bayram Part Time</Badge> : 
                       <Badge variant="outline" className="bg-blue-100 text-blue-800">Full Time</Badge>}
                    </TableCell>
                    <TableCell>
                      <div>
                        {p.start_date && !isNaN(new Date(p.start_date).getTime()) 
                          ? format(new Date(p.start_date), 'dd.MM.yyyy') 
                          : '-'}
                      </div>
                      {p.start_date && !isNaN(new Date(p.start_date).getTime()) && (() => {
                        const { years, months, days, totalDays } = calculateWorkDuration(p.start_date);
                        return (
                          <div className="text-xs text-muted-foreground font-medium mt-1">
                            {years > 0 && `${years} Yıl `}{months > 0 && `${months} Ay `}{days} Gün <span className="opacity-70">({totalDays} Gün)</span>
                          </div>
                        );
                      })()}
                    </TableCell>
                    <TableCell><Badge variant="outline" className="bg-green-500/10">Aktif</Badge></TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm" onClick={() => startEdit(p)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => {
                           if (p.department?.toLowerCase().includes('müdür')) {
                             toast.error('Müdür bilgileri pasife alınamaz veya silinemez!');
                             return;
                           }
                           toggleActive(p);
                        }} disabled={toggleActiveMutation.isPending}>
                          <UserX className="w-4 h-4 text-red-500" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {personnel.filter(p => p.is_active).length === 0 && (
                  <TableRow>
                     <TableCell colSpan={6} className="text-center text-muted-foreground py-4">Kayıtlı aktif personel bulunmuyor</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {personnel.some(p => !p.is_active) && (
        <Card className="glass-card">
          <CardHeader>
            <CardTitle>Pasif Personel ({personnel.filter(p => !p.is_active).length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ad Soyad</TableHead>
                    <TableHead>TC No</TableHead>
                    <TableHead>Sicil ID</TableHead>
                    <TableHead>Departman</TableHead>
                    <TableHead>Bitiş Tarihi</TableHead>
                    <TableHead>İşlemler</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {personnel.filter(p => !p.is_active).map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.first_name} {p.last_name}</TableCell>
                      <TableCell>{p.tc_no}</TableCell>
                      <TableCell>{p.employee_code || '-'}</TableCell>
                      <TableCell>{p.department}</TableCell>
                      <TableCell>{p.end_date ? format(new Date(p.end_date), 'dd.MM.yyyy') : '-'}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button variant="ghost" size="sm" onClick={() => toggleActive(p)} disabled={toggleActiveMutation.isPending}>
                            <UserCheck className="w-4 h-4 text-green-500" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => {
                           if (demoRestrictions?.disable_delete_operations) {
                             toast.error('Demo modunda silme işlemi güvenlik nedeniyle kapalıdır.');
                             return;
                           }
                           if (p.department?.toLowerCase().includes('müdür')) {
                             toast.error('Müdür bilgileri sistemden kalıcı olarak silinemez!');
                             return;
                           }
                           deleteMutation.mutate({id: p.id, name: `${p.first_name} ${p.last_name}`});
                          }} disabled={deleteMutation.isPending || demoRestrictions?.disable_delete_operations}>
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default PersonnelManagement;
