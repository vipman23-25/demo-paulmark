import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { Download, Plus, Trash2, Timer, RefreshCw, ArrowUpDown } from 'lucide-react';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';

const OvertimeManagement = () => {
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    personnel_id: '', record_date: '', days: '', hours: '', minutes: '', record_type: '', description: '',
  });
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);
  const [summaryFilterId, setSummaryFilterId] = useState<string>('all');

  const { data: personnel = [] } = useQuery({
    queryKey: ['active_personnel'],
    queryFn: async () => {
      const { data, error } = await supabase.from('personnel').select('*').eq('is_active', true);
      if (error) throw error;
      return data;
    }
  });

  const { data: overtimeTypes = [] } = useQuery({
    queryKey: ['system_settings_overtime_types'],
    queryFn: async () => {
      const { data, error } = await supabase.from('system_settings' as any).select('setting_value').eq('setting_key', 'general').single();
      if (!error && data?.setting_value?.overtimeTypes) {
        return data.setting_value.overtimeTypes as string[];
      }
      return ['Fazla Mesai', 'Alacak (Kullanım)'];
    }
  });

  const { data: records = [], isLoading, refetch } = useQuery({
    queryKey: ['overtime_records'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('overtime_records')
        .select(`
          *,
          personnel (
            first_name,
            last_name,
            department
          )
        `)
        .order('record_date', { ascending: false })
        .limit(200);
        
      if (error) {
        toast.error('Mesai verileri yüklenemedi: ' + error.message);
        throw error;
      }
      return data;
    }
  });

  const addMutation = useMutation({
    mutationFn: async (newRecord: any) => {
      const { data, error } = await supabase.from('overtime_records').insert([newRecord]).select();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['overtime_records'] });
      toast.success('Kayıt başarıyla eklendi');
      resetForm();
    },
    onError: (error: any) => toast.error('Ekleme başarısız: ' + error.message)
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string, updates: any }) => {
      const { data, error } = await supabase.from('overtime_records').update(updates).eq('id', id).select();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['overtime_records'] });
      toast.success('Kayıt başarıyla güncellendi');
      resetForm();
    },
    onError: (error: any) => toast.error('Güncelleme başarısız: ' + error.message)
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('overtime_records').delete().eq('id', id);
      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['overtime_records'] });
      toast.success('Kayıt silindi');
    },
    onError: (error: any) => toast.error('Silme başarısız: ' + error.message)
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from('overtime_records').delete().in('id', ids);
      if (error) throw error;
      return ids;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['overtime_records'] });
      toast.success('Seçili kayıtlar silindi');
      setSelectedIds([]);
    },
    onError: (error: any) => toast.error('Toplu silme başarısız: ' + error.message)
  });

  const toggleSelectAll = () => {
    if (selectedIds.length === records.length && records.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(records.map((r: any) => r.id));
    }
  };

  const toggleSelect = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(i => i !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const handleBulkDelete = () => {
    if (confirm(`Seçili ${selectedIds.length} kaydı silmek istediğinize emin misiniz?`)) {
      bulkDeleteMutation.mutate(selectedIds);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.personnel_id || !form.record_date) {
      toast.error('Lütfen tüm zorunlu alanları doldurun');
      return;
    }

    const selectedPerson = personnel.find((p: any) => p.id === form.personnel_id);
    if (selectedPerson?.employment_type === 'part_time') {
      toast.error('Part time personellere mesai girişi yapılamaz!');
      return;
    }

    const d = parseFloat(form.days.toString().replace(',', '.') || '0');
    const h = parseFloat(form.hours.toString().replace(',', '.') || '0');
    const m = parseFloat(form.minutes.toString().replace(',', '.') || '0');
    const totalHours = Number(((d * 8) + h + (m / 60)).toFixed(2));

    if (totalHours <= 0) {
      toast.error('Lütfen en az 1 dakika mesai süresi girin');
      return;
    }

    const payload = {
      personnel_id: form.personnel_id,
      record_date: form.record_date,
      hours: totalHours,
      record_type: form.record_type || overtimeTypes[0] || 'Fazla Mesai',
      description: form.description
    };

    if (editingId) {
      updateMutation.mutate({ id: editingId, updates: payload });
    } else {
      addMutation.mutate(payload);
    }
  };

  const resetForm = () => {
    setIsOpen(false);
    setEditingId(null);
    setForm({ personnel_id: '', record_date: '', days: '', hours: '', minutes: '', record_type: overtimeTypes[0] || '', description: '' });
  };

  const handleEdit = (r: any) => {
    const totalH = parseFloat(r.hours);
    const d = Math.floor(totalH / 8);
    const remH = totalH - (d * 8);
    const h = Math.floor(remH);
    const m = Math.round((remH - h) * 60);

    setForm({
      personnel_id: r.personnel_id,
      record_date: r.record_date.split('T')[0],
      days: d ? d.toString() : '',
      hours: h ? h.toString() : '',
      minutes: m ? m.toString() : '',
      record_type: r.record_type,
      description: r.description || '',
    });
    setEditingId(r.id);
    setIsOpen(true);
  };

  const deleteRecord = (id: string) => {
    if (confirm('Bu kaydı silmek istediğinizden emin misiniz?')) {
      deleteMutation.mutate(id);
    }
  };

  // Calculate summary
  const summary = personnel.map(p => {
    const pRecords = records.filter((r: any) => r.personnel_id === p.id);
    const overtime = pRecords.filter((r: any) => !(r.record_type || '').toLowerCase().includes('alacak') && !(r.record_type || '').toLowerCase().includes('kullanım'))
      .reduce((s: any, r: any) => s + Number(r.hours), 0);
    const credit = pRecords.filter((r: any) => (r.record_type || '').toLowerCase().includes('alacak') || (r.record_type || '').toLowerCase().includes('kullanım'))
      .reduce((s: any, r: any) => s + Number(r.hours), 0);
    return { ...p, overtime, credit, balance: overtime - credit };
  }).filter(p => p.balance !== 0);

  const formatDuration = (totalH: number) => {
    const abs = Math.abs(totalH);
    const d = Math.floor(abs / 8);
    const remH = abs - (d * 8);
    const h = Math.floor(remH);
    const m = Math.round((remH - h) * 60);
    
    const parts = [];
    if (d > 0) parts.push(`${d} Gün`);
    if (h > 0) parts.push(`${h} Saat`);
    if (m > 0) parts.push(`${m} Dk`);
    const formatted = parts.length > 0 ? parts.join(' ') : '0 Saat';
    return totalH < 0 ? `- ${formatted}` : formatted;
  };

  const exportToExcel = async () => {
    const exportData = records.map((r: any) => ({
      'Personel Ad Soyad': r.personnel ? `${r.personnel.first_name} ${r.personnel.last_name}` : 'Bilinmeyen',
      'Tür': r.record_type || 'Bilinmiyor',
      'Tarih': format(new Date(r.record_date), 'dd.MM.yyyy', { locale: tr }),
      'Süre': formatDuration(Number(r.hours)),
      'Açıklama': r.description || '-'
    }));

    const { utils, writeFile } = await import('xlsx');
    const ws = utils.json_to_sheet(exportData);
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, "Fazla Mesai Raporu");
    writeFile(wb, "Fazla_Mesai_Raporu.xlsx");
  };

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const sortedRecords = [...records].sort((a: any, b: any) => {
    if (!sortConfig) return 0;
    if (sortConfig.key === 'name') {
      const nameA = a.personnel ? `${a.personnel.first_name} ${a.personnel.last_name}`.toLowerCase() : '';
      const nameB = b.personnel ? `${b.personnel.first_name} ${b.personnel.last_name}`.toLowerCase() : '';
      if (nameA < nameB) return sortConfig.direction === 'asc' ? -1 : 1;
      if (nameA > nameB) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    }
    if (sortConfig.key === 'date') {
      const dateA = new Date(a.record_date).getTime();
      const dateB = new Date(b.record_date).getTime();
      return sortConfig.direction === 'asc' ? dateA - dateB : dateB - dateA;
    }
    return 0;
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Timer className="h-6 w-6" /> Fazla Mesai / Alacak Takibi
        </h2>
        <div className="flex gap-2">
          {selectedIds.length > 0 && (
            <Button variant="destructive" onClick={handleBulkDelete} disabled={bulkDeleteMutation.isPending}>
              <Trash2 className="w-4 h-4 mr-2" /> Toplu Sil ({selectedIds.length})
            </Button>
          )}
          <Button variant="outline" onClick={exportToExcel}><Download className="w-4 h-4 mr-2" /> Excel İndir</Button>
          <Button variant="outline" size="icon" onClick={() => refetch()} title="Yenile">
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Dialog open={isOpen} onOpenChange={(o) => { setIsOpen(o); if (!o) resetForm(); }}>
            <DialogTrigger asChild>
              <Button><Plus className="w-4 h-4 mr-2" />Kayıt Ekle</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{editingId ? "Kaydı Düzenle" : "Yeni Kayıt"}</DialogTitle></DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="personnel_id">Personel</Label>
                  <Select value={form.personnel_id} onValueChange={(v) => setForm({...form, personnel_id: v})}>
                    <SelectTrigger><SelectValue placeholder="Personel seçin" /></SelectTrigger>
                    <SelectContent>
                      {personnel.map((p: any) => (
                        <SelectItem key={p.id} value={p.id}>{p.first_name} {p.last_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="record_type">Tür</Label>
                  <Select value={form.record_type || overtimeTypes[0]} onValueChange={(v) => setForm({...form, record_type: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {overtimeTypes.map((t: string) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="record_date">Tarih</Label>
                    <Input id="record_date" type="date" value={form.record_date} onChange={e => setForm({...form, record_date: e.target.value})} />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <Label htmlFor="days" className="text-xs">Gün (8s)</Label>
                      <Input id="days" type="number" min="0" placeholder="0" value={form.days} onChange={e => setForm({...form, days: e.target.value})} />
                    </div>
                    <div>
                      <Label htmlFor="hours" className="text-xs">Saat</Label>
                      <Input id="hours" type="number" min="0" max="23" placeholder="0" value={form.hours} onChange={e => setForm({...form, hours: e.target.value})} />
                    </div>
                    <div>
                      <Label htmlFor="minutes" className="text-xs">Dakika</Label>
                      <Input id="minutes" type="number" min="0" max="59" placeholder="0" value={form.minutes} onChange={e => setForm({...form, minutes: e.target.value})} />
                    </div>
                  </div>
                </div>
                <div>
                  <Label htmlFor="description">Açıklama</Label>
                  <Textarea id="description" value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
                </div>
                <Button type="submit" disabled={addMutation.isPending || updateMutation.isPending} className="w-full">
                  {addMutation.isPending || updateMutation.isPending ? 'İşleniyor...' : (editingId ? 'Güncelle' : 'Ekle')}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {summary.length > 0 && (
        <Card className="glass-card">
          <CardHeader className="pb-3 border-b mb-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <CardTitle className="text-lg">Personel Bakiye Özeti</CardTitle>
            <Select value={summaryFilterId} onValueChange={setSummaryFilterId}>
              <SelectTrigger className="w-full md:w-[250px]">
                <SelectValue placeholder="Personel Seçin..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tüm Personeller</SelectItem>
                {summary.map((s: any) => (
                  <SelectItem key={s.id} value={s.id}>{s.first_name} {s.last_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {summary.filter(s => summaryFilterId === 'all' || s.id === summaryFilterId).map((s: any) => (
                <div key={s.id} className="bg-secondary/10 p-4 rounded-lg border border-border/50">
                  <div className="font-semibold text-base border-b border-border/50 pb-2 mb-3">{s.first_name} {s.last_name}</div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between items-center"><span className="text-muted-foreground">Kazanılan Mesai:</span><span className="font-medium text-foreground">{formatDuration(s.overtime)}</span></div>
                    <div className="flex justify-between items-center"><span className="text-muted-foreground">Kullanılan Alacak:</span><span className="font-medium text-foreground">{formatDuration(s.credit)}</span></div>
                    <div className="flex justify-between items-center border-t border-border/50 pt-2 mt-1">
                      <span className="font-medium">Kalan Bakiye:</span>
                      <span className={`font-bold text-base ${s.balance > 0 ? 'text-success' : s.balance < 0 ? 'text-destructive' : 'text-foreground'}`}>
                        {formatDuration(s.balance)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="glass-card">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">
                    <Checkbox 
                      checked={records.length > 0 && selectedIds.length === records.length}
                      onCheckedChange={toggleSelectAll}
                      aria-label="Tümünü seç"
                    />
                  </TableHead>
                  <TableHead className="cursor-pointer hover:bg-secondary/20 group" onClick={() => handleSort('name')}>
                    <div className="flex items-center gap-1">
                      Personel <ArrowUpDown className="w-3 h-3 text-muted-foreground group-hover:text-foreground" />
                    </div>
                  </TableHead>
                  <TableHead>Tür</TableHead>
                  <TableHead className="cursor-pointer hover:bg-secondary/20 group" onClick={() => handleSort('date')}>
                    <div className="flex items-center gap-1">
                      Tarih <ArrowUpDown className="w-3 h-3 text-muted-foreground group-hover:text-foreground" />
                    </div>
                  </TableHead>
                  <TableHead>Saat</TableHead>
                  <TableHead>Açıklama</TableHead>
                  <TableHead className="text-right">İşlem</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground animate-pulse">Kayıtlar yükleniyor...</TableCell></TableRow>
                ) : sortedRecords.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Kayıt bulunamadı</TableCell></TableRow>
                ) : (
                  sortedRecords.map((r: any) => (
                    <TableRow key={r.id}>
                      <TableCell>
                        <Checkbox 
                          checked={selectedIds.includes(r.id)}
                          onCheckedChange={() => toggleSelect(r.id)}
                          aria-label="Kaydı seç"
                        />
                      </TableCell>
                      <TableCell className="font-medium">{r.personnel ? `${r.personnel.first_name} ${r.personnel.last_name}` : 'Bilinmeyen'}</TableCell>
                      <TableCell>
                        <Badge variant={!(r.record_type || '').toLowerCase().includes('alacak') && !(r.record_type || '').toLowerCase().includes('kullanım') ? 'default' : 'secondary'}>
                          {r.record_type || 'Bilinmiyor'}
                        </Badge>
                      </TableCell>
                      <TableCell>{format(new Date(r.record_date), 'dd.MM.yyyy', { locale: tr })}</TableCell>
                      <TableCell className="font-semibold">{formatDuration(Number(r.hours))}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{r.description || '-'}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="icon" onClick={() => handleEdit(r)} disabled={deleteMutation.isPending}>
                            <Timer className="h-4 w-4 text-blue-500 hover:text-blue-700" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => deleteRecord(r.id)} disabled={deleteMutation.isPending}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
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

export default OvertimeManagement;
