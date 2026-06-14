import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { Edit2, Trash2, Plus, Clock, ToggleRight, ToggleLeft, RefreshCw, Download, Filter, Send, MessageCircle, Bell, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';

const ReminderManagement = () => {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    personnel_id: '',
    department_name: '',
    title: '',
    description: '',
    is_active: true,
    is_survey: false,
    recurrence: 'none',
    recurrence_days: ['1'],
    target_date: '',
    
    // Advanced Filters
    target_gender: '',
    target_shift: '',
    target_employment_type: '',
    target_break_status: '',
    target_task: '',
    target_time: '',
    
    display_type: 'popup',
    action_button_label: '',
    action_url: '',
    auto_close_seconds: '',
    send_to_telegram: true,
    send_to_telegram_group: true
  });

  const [isArchiveModalOpen, setIsArchiveModalOpen] = useState(false);
  const [archiveReminder, setArchiveReminder] = useState<any>(null);
  const [archiveStartDate, setArchiveStartDate] = useState('');
  const [archiveEndDate, setArchiveEndDate] = useState('');
  const [selectedArchiveIds, setSelectedArchiveIds] = useState<string[]>([]);

  const { data: personnel = [] } = useQuery({
    queryKey: ['active_personnel'],
    queryFn: async () => {
      const { data, error } = await supabase.from('personnel').select('*').eq('is_active', true);
      if (error) throw error;
      return data;
    }
  });

  const { data: reminders = [], isLoading, refetch } = useQuery({
    queryKey: ['reminders'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reminders')
        .select(`
          *,
          personnel (
            first_name,
            last_name
          ),
          responses:reminder_responses (
            *,
            personnel (first_name, last_name)
          )
        `)
        .or('display_type.neq.hidden,display_type.is.null')
        .order('is_active', { ascending: false })
        .order('id', { ascending: false });
      if (error) {
        toast.error('Veri yükleme hatası: ' + error.message);
        throw error;
      }
      return data;
    }
  });

  const { data: globalSettings } = useQuery({
    queryKey: ['system_notification_settings_reminders'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('system_settings' as any)
        .select('*')
        .eq('setting_key', 'notification_settings')
        .maybeSingle();
      if (error) throw error;
      return data?.setting_value || {};
    }
  });

  const addMutation = useMutation({
    mutationFn: async (newRecord: any) => {
      const { data, error } = await supabase.from('reminders').insert([newRecord]).select();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reminders'] });
      toast.success('Duyuru oluşturuldu');
      resetForm();
    },
    onError: (error: any) => toast.error('Oluşturma başarısız: ' + error.message)
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string, updates: any }) => {
      const { data, error } = await supabase.from('reminders').update(updates).eq('id', id).select();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reminders'] });
      toast.success('Duyuru güncellendi');
      if (isModalOpen) resetForm();
    },
    onError: (error: any) => toast.error('Güncelleme başarısız: ' + error.message)
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('reminders').delete().eq('id', id);
      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reminders'] });
      toast.success('Duyuru silindi');
    },
    onError: (error: any) => toast.error('Silme başarısız: ' + error.message)
  });

  const deleteResponsesMutation = useMutation({
    mutationFn: async (payloads: any[]) => {
      for (const p of payloads) {
        let q = supabase.from('reminder_responses' as any).delete().eq('reminder_id', p.reminder_id).eq('personnel_id', p.personnel_id).eq('response_date', p.response_date);
        if (p.id) q = supabase.from('reminder_responses' as any).delete().eq('id', p.id);
        const { error } = await q;
        if (error) throw error;
      }
      return payloads;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reminders'] });
      toast.success('Seçili yanıt kayıtları silindi');
      setSelectedArchiveIds([]);
    },
    onError: (error: any) => toast.error('Silme başarısız: ' + error.message)
  });

  const handleSubmit = () => {
    if ((!formData.personnel_id && !formData.department_name) || !formData.title.trim()) {
      toast.error('Lütfen Temel Hedef Kitle (Kişi veya Reyon) ve Başlık alanlarını doldurun');
      return;
    }

    const payload = {
      personnel_id: formData.personnel_id || null,
      department_name: formData.department_name === 'all' ? 'Tümü' : formData.department_name === 'all_except_managers' ? 'Müdür Hariç Tümü' : (formData.department_name || null),
      title: formData.title,
      description: formData.description,
      is_active: formData.is_active,
      is_survey: formData.is_survey,
      recurrence: formData.recurrence === 'none' ? 'none' : formData.recurrence === 'daily' ? 'daily' : `${formData.recurrence},${formData.recurrence_days.join(',')}`,
      target_date: formData.recurrence === 'none' && formData.target_date ? formData.target_date : null,
      target_day_of_week: formData.recurrence === 'weekly' ? formData.recurrence_days.join(',') : null,
      target_day_of_month: formData.recurrence === 'monthly' && formData.recurrence_days.length > 0 ? parseInt(formData.recurrence_days[0]) : null,
      target_gender: formData.target_gender || null,
      target_shift: formData.target_shift || null,
      target_employment_type: formData.target_employment_type || null,
      target_break_status: formData.target_break_status || null,
      target_task: formData.target_task || null,
      target_time: formData.target_time || null,
      display_type: formData.display_type || 'popup',
      action_button_label: formData.action_button_label || null,
      action_url: formData.action_url || null,
      auto_close_seconds: formData.auto_close_seconds ? parseInt(formData.auto_close_seconds) : null,
      send_to_telegram: false,
      send_to_telegram_group: false
    };

    if (editingId) {
      updateMutation.mutate({ id: editingId, updates: payload });
    } else {
      addMutation.mutate(payload);
    }
  };

  const handleDelete = (id: string) => {
    if (confirm('Silmek istediğinizden emin misiniz?')) {
      deleteMutation.mutate(id);
    }
  };



  const handleEdit = (reminder: any) => {
    let recType = 'none';
    let recDays = ['1'];

    if (reminder.recurrence) {
      const parts = reminder.recurrence.split(',');
      recType = parts[0];
      if (parts.length > 1) {
        recDays = parts.slice(1);
      }
    }

    setFormData({
      personnel_id: reminder.personnel_id || '',
      department_name: reminder.department_name === 'Tümü' ? 'all' : reminder.department_name === 'Müdür Hariç Tümü' ? 'all_except_managers' : (reminder.department_name || ''),
      title: reminder.title,
      description: reminder.description || '',
      is_active: reminder.is_active,
      is_survey: reminder.is_survey || false,
      recurrence: recType,
      recurrence_days: recDays,
      target_gender: reminder.target_gender || '',
      target_shift: reminder.target_shift || '',
      target_employment_type: reminder.target_employment_type || '',
      target_break_status: reminder.target_break_status || '',
      target_task: reminder.target_task || '',
      target_time: reminder.target_time || '',
      
      display_type: reminder.display_type === 'hidden' ? 'popup' : (reminder.display_type || 'popup'),
      action_button_label: reminder.action_button_label || '',
      action_url: reminder.action_url || '',
      auto_close_seconds: reminder.auto_close_seconds ? reminder.auto_close_seconds.toString() : '',
      send_to_telegram: reminder.send_to_telegram ?? true,
      send_to_telegram_group: reminder.send_to_telegram_group ?? true
    });
    setEditingId(reminder.id);
    setIsModalOpen(true);
  };

  const resetForm = () => {
    setFormData({
      personnel_id: '',
      department_name: '',
      title: '',
      description: '',
      is_active: true,
      is_survey: false,
      recurrence: 'none',
      recurrence_days: ['1'],
      target_gender: '',
      target_shift: '',
      target_employment_type: '',
      target_break_status: '',
      target_task: '',
      target_time: '',
      
      display_type: 'popup',
      action_button_label: '',
      action_url: '',
      auto_close_seconds: '',
      send_to_telegram: true,
      send_to_telegram_group: true
    });
    setEditingId(null);
    setIsModalOpen(false);
  };

  const toggleActive = (id: string, currentStatus: boolean) => {
    updateMutation.mutate({ id, updates: { is_active: !currentStatus } });
  };

  const filteredArchiveResponses = archiveReminder?.responses?.filter((r: any) => {
    if (archiveStartDate && r.response_date < archiveStartDate) return false;
    if (archiveEndDate && r.response_date > archiveEndDate) return false;
    return true;
  }).sort((a: any, b: any) => new Date(b.response_date).getTime() - new Date(a.response_date).getTime()) || [];

  const handleExportArchive = async () => {
    if (filteredArchiveResponses.length === 0) {
       toast.error('Aktarılacak kayıt bulunamadı');
       return;
    }
    try {
      const { utils, writeFile } = await import('xlsx');
      const exportData = filteredArchiveResponses.map((r: any) => ({
        'Personel': r.personnel ? `${r.personnel.first_name} ${r.personnel.last_name}` : 'Bilinmeyen',
        'Yanıt Tarihi': r.response_date ? format(new Date(r.response_date), 'dd.MM.yyyy') : '-',
        'Durum': r.status || '-',
        'Not/Açıklama': r.notes || '-'
      }));
      const ws = utils.json_to_sheet(exportData);
      const wb = utils.book_new();
      utils.book_append_sheet(wb, ws, `${archiveReminder.title} - Arşiv`);
      const sDate = archiveStartDate ? format(new Date(archiveStartDate), 'dd_MM') : 'Tumu';
      const eDate = archiveEndDate ? format(new Date(archiveEndDate), 'dd_MM') : 'Tumu';
      writeFile(wb, `Anket_Arsivi_${sDate}_${eDate}.xlsx`);
      toast.success("Excel başarıyla indirildi");
    } catch (e: any) {
      toast.error("Excel oluşturulurken hata: " + e.message);
    }
  };

  const handleExportExcel = async () => {
    if (!reminders || reminders.length === 0) {
      toast.error('Dışa aktarılacak duyuru bulunamadı');
      return;
    }
    try {
      const { utils, writeFile } = await import('xlsx');
      const exportData = reminders.map((r: any) => {
        let respondedNames = '-';
        let missingNames = '-';

        if (r.is_survey) {
          const respondedIds = (r.responses || []).map((resp:any) => resp.personnel_id);
          const respondedList = (r.responses || []).map((resp:any) => `${resp.personnel?.first_name} ${resp.personnel?.last_name} (${resp.status})`);
          respondedNames = respondedList.join(', ') || '-';

          let targetAudience = personnel;
          if (r.personnel_id) {
            targetAudience = personnel.filter((p:any) => p.id === r.personnel_id);
          } else if (r.department_name && r.department_name !== 'Tümü' && r.department_name !== 'Müdür Hariç Tümü') {
            targetAudience = personnel.filter((p:any) => p.department === r.department_name);
          } else if (r.department_name === 'Müdür Hariç Tümü') {
            targetAudience = personnel.filter((p:any) => !(p.department || '').toLowerCase().includes('müdür'));
          }

          const missingPersonnel = targetAudience.filter((p:any) => !respondedIds.includes(p.id));
          missingNames = missingPersonnel.map((p:any) => `${p.first_name} ${p.last_name}`).join(', ') || 'Tüm yanıtlar alındı';
        }

        return {
          'Başlık': r.title,
          'Açıklama': r.description || '-',
          'Durum': r.is_active ? 'Etkin' : 'Devre Dışı',
          'Temel Hedef Kitle': r.personnel ? `${r.personnel.first_name} ${r.personnel.last_name}` : (r.department_name === 'Tümü' ? 'Tüm Şirket' : r.department_name === 'Müdür Hariç Tümü' ? 'Tüm Çalışanlar (Müdür Hariç)' : `${r.department_name} Reyonu`),
          'Filtre - Cinsiyet': r.target_gender === 'Erkek' ? 'Sadece Erkekler' : r.target_gender === 'Kadın' ? 'Sadece Kadınlar' : 'Tümü',
          'Filtre - Vardiya': r.target_shift || 'Tümü',
          'Filtre - Personel Tipi': r.target_employment_type || 'Tümü',
          'Filtre - Mola Durumu': r.target_break_status === 'on_break' ? 'Sadece Moladakiler' : r.target_break_status === 'not_on_break' ? 'Molada Olmayanlar' : 'Tümü',
          'Filtre - Görev (Depo/Mutfak)': r.target_task || 'Tümü',
          'Tetikleme Saati': r.target_time || 'Anında',
          'Döngü (Tekrar)': r.recurrence !== 'none' ? r.recurrence : 'Yok',
          'Anket/Görev mi?': r.is_survey ? 'Evet' : 'Hayır',
          'Yanıtlayan Sayısı': r.is_survey ? (r.responses?.length || 0) : '-',
          'Yanıt Verenler': respondedNames,
          'Bekleyenler (Dönüş Yapmayanlar)': missingNames,
          'Oluşturulma Tarihi': r.created_at ? format(new Date(r.created_at), 'dd.MM.yyyy HH:mm', { locale: tr }) : '-'
        };
      });
      const ws = utils.json_to_sheet(exportData);
      const wb = utils.book_new();
      utils.book_append_sheet(wb, ws, "Duyurular");
      writeFile(wb, `Duyurular_${format(new Date(), 'dd_MM_yyyy')}.xlsx`);
      toast.success("Excel başarıyla indirildi");
    } catch (e: any) {
      toast.error("Excel oluşturulurken hata: " + e.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Gelişmiş Duyuru Yönetimi</h1>
          <p className="text-muted-foreground mt-1">Personel bildirimlerini akıllı filtrelerle otomatikleştirin.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" onClick={handleExportExcel}>
            <Download className="h-4 w-4 mr-2" /> Excel İndir
          </Button>
          <Button variant="outline" size="icon" onClick={() => refetch()} title="Yenile">
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button onClick={() => { resetForm(); setIsModalOpen(true); }} size="lg">
            <Plus className="h-4 w-4 mr-2" /> Yeni Gelişmiş Duyuru
          </Button>
        </div>
      </div>

      {isModalOpen && (
        <Card className="border-2 border-primary/20 shadow-lg relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500"></div>
          <CardHeader className="bg-muted/30 pb-4">
            <CardTitle className="text-xl flex items-center gap-2">
              <Filter className="w-5 h-5 text-primary" />
              {editingId ? 'Duyuru Şartlarını Düzenle' : 'Yeni Akıllı Bildirim (Tetikleyici) Oluştur'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            
            <div className="grid md:grid-cols-2 gap-8">
              {/* SOL KOLON: TEMEL BİLGİLER */}
              <div className="space-y-4">
                <div className="border-b pb-2 mb-4">
                  <h3 className="font-semibold text-lg text-primary">1. Temel Bilgiler & Mesaj</h3>
                </div>

                <div>
                  <label className="text-sm font-medium text-foreground">Ana Hedef Kitle (Personel veya Reyon) *</label>
                  <select
                    value={formData.personnel_id ? `p_${formData.personnel_id}` : formData.department_name ? `d_${formData.department_name}` : ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val.startsWith('p_')) {
                        setFormData({ ...formData, personnel_id: val.replace('p_', ''), department_name: '' });
                      } else if (val.startsWith('d_')) {
                        setFormData({ ...formData, department_name: val.replace('d_', ''), personnel_id: '' });
                      } else {
                        setFormData({ ...formData, department_name: '', personnel_id: '' });
                      }
                    }}
                    className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground mt-1"
                  >
                    <option value="">Seçiniz...</option>
                    <optgroup label="Reyonlar (Departman)">
                      <option value="d_all">Tüm Şirket Çalışanları (Herkes)</option>
                      <option value="d_all_except_managers">Tüm Çalışanlar (Müdür Hariç)</option>
                      {Array.from(new Set(personnel.map((p: any) => p.department).filter(Boolean))).map((dep: any) => (
                        <option key={`d_${dep}`} value={`d_${dep}`}>{dep} Reyonu</option>
                      ))}
                    </optgroup>
                    <optgroup label="Personeller (Tekil)">
                      {personnel.map((p: any) => (
                        <option key={`p_${p.id}`} value={`p_${p.id}`}>{p.first_name} {p.last_name}</option>
                      ))}
                    </optgroup>
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium text-foreground">Başlık *</label>
                  <Input
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="Bildirim Başlığı"
                    className="mt-1"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-foreground">Açıklama (Mesaj İçeriği)</label>
                  <Textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Bildirimin detaylı açıklaması..."
                    rows={4}
                    className="mt-1"
                  />
                </div>

                <div className="flex flex-col gap-3 pt-2">
                  <div className="flex items-center space-x-2">
                    <input 
                      type="checkbox"
                      id="is_survey"
                      className="rounded border-gray-300 text-primary focus:ring-primary w-4 h-4"
                      checked={formData.is_survey}
                      onChange={(e) => setFormData({ ...formData, is_survey: e.target.checked })}
                    />
                    <label htmlFor="is_survey" className="text-sm font-medium">Bu bir anket/görev onayıdır (Personelden yanıt istenecek)</label>
                  </div>
                  <div className="grid grid-cols-2 gap-4 mt-4 bg-muted/30 p-4 rounded-lg border">
                      <div>
                        <label className="text-sm font-medium">Gösterim Tipi</label>
                        <Select value={formData.display_type} onValueChange={(v) => setFormData({ ...formData, display_type: v })}>
                          <SelectTrigger className="mt-1">
                            <SelectValue placeholder="Seçiniz..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="popup">Pop-up (Ekranda Büyür)</SelectItem>
                            <SelectItem value="inline">Sadece Listeye Düşsün (Sessiz)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    <div>
                      <label className="text-sm font-medium">Otomatik Kapanma Süresi</label>
                      <Input 
                        type="number" 
                        placeholder="Örn: 10 (Saniye) - Boşsa kapanmaz" 
                        value={formData.auto_close_seconds} 
                        onChange={(e) => setFormData({ ...formData, auto_close_seconds: e.target.value })} 
                        className="mt-1"
                      />
                    </div>
                    <div className="col-span-2 sm:col-span-1">
                      <label className="text-sm font-medium">Özel Buton Yazısı</label>
                      <Input 
                        placeholder="Örn: Detayları Gör (Boşsa: Anladım)" 
                        value={formData.action_button_label} 
                        onChange={(e) => setFormData({ ...formData, action_button_label: e.target.value })} 
                        className="mt-1"
                      />
                    </div>
                    <div className="col-span-2 sm:col-span-1">
                      <label className="text-sm font-medium">Yönlendirme Linki (Opsiyonel)</label>
                      <Input 
                        placeholder="Örn: https://example.com" 
                        value={formData.action_url} 
                        onChange={(e) => setFormData({ ...formData, action_url: e.target.value })} 
                        className="mt-1"
                      />
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.is_active}
                      onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                      id="is_active"
                      className="w-4 h-4 rounded"
                    />
                    <label htmlFor="is_active" className="text-sm font-medium text-foreground">Duyuruyu Etkinleştir</label>
                  </div>
                </div>
              </div>

              {/* SAĞ KOLON: GELİŞMİŞ FİLTRELER */}
              <div className="space-y-4 bg-muted/10 p-4 rounded-xl border border-dashed">
                <div className="border-b pb-2 mb-4">
                  <h3 className="font-semibold text-lg text-primary flex items-center">
                    <Filter className="w-4 h-4 mr-2" /> 2. Akıllı Filtreler & Zamanlama
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">Sadece bu şartları sağlayanlar mesajı görür. Boş bırakırsanız herkese gider.</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase">Cinsiyet</label>
                    <Select value={formData.target_gender} onValueChange={(v) => setFormData({ ...formData, target_gender: v })}>
                      <SelectTrigger className="bg-background mt-1 h-8 text-sm"><SelectValue placeholder="Tümü" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Tümü</SelectItem>
                        <SelectItem value="Kadın">Sadece Kadınlar</SelectItem>
                        <SelectItem value="Erkek">Sadece Erkekler</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase">Vardiya Türü</label>
                    <Select value={formData.target_shift} onValueChange={(v) => setFormData({ ...formData, target_shift: v })}>
                      <SelectTrigger className="bg-background mt-1 h-8 text-sm"><SelectValue placeholder="Tümü" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Tümü</SelectItem>
                        <SelectItem value="Sabah">Sadece Sabah Vardiyası</SelectItem>
                        <SelectItem value="Akşam">Sadece Akşam Vardiyası</SelectItem>
                        <SelectItem value="Esnek">Sadece Esnek Vardiya</SelectItem>
                        <SelectItem value="İzinli">Sadece İzinliler</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase">Mola Durumu</label>
                    <Select value={formData.target_break_status} onValueChange={(v) => setFormData({ ...formData, target_break_status: v })}>
                      <SelectTrigger className="bg-background mt-1 h-8 text-sm"><SelectValue placeholder="Tümü" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Tümü</SelectItem>
                        <SelectItem value="on_break">Sadece Molada Olanlar</SelectItem>
                        <SelectItem value="not_on_break">Molada Olmayanlar (Çalışanlar)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase">Özel Görev</label>
                    <Select value={formData.target_task} onValueChange={(v) => setFormData({ ...formData, target_task: v })}>
                      <SelectTrigger className="bg-background mt-1 h-8 text-sm"><SelectValue placeholder="Tümü" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Tümü</SelectItem>
                        <SelectItem value="Mutfak">O Gün Mutfakta Görevli Olanlar</SelectItem>
                        <SelectItem value="Depo">O Gün Depoda Görevli Olanlar</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase">Personel Tipi</label>
                    <Select value={formData.target_employment_type} onValueChange={(v) => setFormData({ ...formData, target_employment_type: v })}>
                      <SelectTrigger className="bg-background mt-1 h-8 text-sm"><SelectValue placeholder="Tümü" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Tümü</SelectItem>
                        <SelectItem value="full_time">Tam Zamanlı (Full-Time)</SelectItem>
                        <SelectItem value="part_time">Yarı Zamanlı (Part-Time)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase">Saat / Dakika (Tetikleyici)</label>
                    <Input 
                      type="time" 
                      className="mt-1 h-8 text-sm bg-background" 
                      value={formData.target_time || ''}
                      onChange={(e) => setFormData({ ...formData, target_time: e.target.value })}
                    />
                  </div>
                </div>

                <div className="pt-4 border-t border-dashed mt-4">
                  <label className="text-sm font-medium text-foreground block mb-2">Döngüsel Tekrar (Takvim)</label>
                  <select
                    value={formData.recurrence}
                    onChange={(e) => setFormData({ ...formData, recurrence: e.target.value })}
                    className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground"
                  >
                    <option value="none">Bir Kez Göster (Tekrar Yok)</option>
                    <option value="daily">Her Gün Göster</option>
                    <option value="weekly">Her Hafta Belirli Günlerde Göster</option>
                  </select>

                  {formData.is_survey && formData.recurrence !== 'none' && (
                    <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200 text-xs rounded border border-blue-200 dark:border-blue-800">
                      <strong>Bilgi:</strong> Bu bir anket olduğu için, seçtiğiniz döngüde (örneğin her hafta) personelin ekranında anket otomatik olarak yeniden boş (yanıtlanmamış) olarak çıkacak ve tekrar yanıtlamaları gerekecektir.
                    </div>
                  )}

                  {formData.recurrence === 'none' && (
                    <div className="mt-3 animate-in fade-in slide-in-from-top-2">
                      <label className="text-xs text-muted-foreground mb-1 block">Hangi Tarihte Gönderilecek?</label>
                      <Input 
                        type="date" 
                        className="bg-background"
                        value={formData.target_date || ''}
                        onChange={(e) => setFormData({ ...formData, target_date: e.target.value })}
                      />
                    </div>
                  )}

                  {formData.recurrence === 'weekly' && (
                    <div className="mt-3 animate-in fade-in slide-in-from-top-2">
                      <label className="text-xs text-muted-foreground mb-1 block">Hangi Gün(ler)?</label>
                      <div className="flex flex-wrap gap-2">
                        {[
                          { val: '1', label: 'Pzt' }, { val: '2', label: 'Sal' }, { val: '3', label: 'Çar' },
                          { val: '4', label: 'Per' }, { val: '5', label: 'Cum' }, { val: '6', label: 'Cmt' }, { val: '0', label: 'Paz' }
                        ].map(day => (
                          <label key={day.val} className="flex items-center gap-1 bg-background border px-2 py-1 rounded cursor-pointer hover:bg-muted select-none">
                            <input 
                              type="checkbox" 
                              checked={formData.recurrence_days.includes(day.val)}
                              onChange={(e) => {
                                let newDays = [...formData.recurrence_days];
                                if (e.target.checked) newDays.push(day.val);
                                else newDays = newDays.filter(d => d !== day.val);
                                if (newDays.length === 0) newDays = [day.val];
                                setFormData({...formData, recurrence_days: newDays});
                              }}
                            />
                            <span className="text-xs font-medium">{day.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  {formData.recurrence === 'monthly' && (
                    <div className="mt-3 animate-in fade-in slide-in-from-top-2">
                      <label className="text-xs text-muted-foreground mb-1 block">Ayın Kaçıncı Günleri?</label>
                      <div className="grid grid-cols-7 gap-1">
                        {Array.from({length: 31}, (_, i) => String(i + 1)).map(d => (
                          <label key={d} className={`flex items-center justify-center py-1 rounded cursor-pointer text-xs border select-none ${formData.recurrence_days.includes(d) ? 'bg-primary text-primary-foreground border-primary font-bold' : 'bg-background hover:bg-muted'}`}>
                            <input 
                              type="checkbox" 
                              className="hidden"
                              checked={formData.recurrence_days.includes(d)}
                              onChange={(e) => {
                                let newDays = [...formData.recurrence_days];
                                if (e.target.checked) newDays.push(d);
                                else newDays = newDays.filter(x => x !== d);
                                if (newDays.length === 0) newDays = [d];
                                setFormData({...formData, recurrence_days: newDays});
                              }}
                            />
                            {d}
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-4 border-t">
              <Button variant="outline" onClick={resetForm}>İptal</Button>
              <Button onClick={handleSubmit} disabled={addMutation.isPending || updateMutation.isPending} size="lg" className="min-w-[150px]">
                {editingId ? 'Güncelle' : 'Kuralı Kaydet'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center p-8">
          <p className="text-muted-foreground animate-pulse">Yükleniyor...</p>
        </div>
      ) : reminders.length === 0 ? (
        <Card className="glass-card">
          <CardContent className="p-8 text-center">
            <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Henüz duyuru kuralı oluşturulmadı</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {reminders.map((reminder: any) => (
            <Card key={reminder.id} className="glass-card">
              <CardContent className="p-6">
                <div className="flex justify-between items-start gap-4 flex-wrap">
                  <div className="flex-1 min-w-[200px]">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-lg font-semibold text-foreground">{reminder.title}</h3>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        reminder.is_active 
                          ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-100' 
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-100'
                      }`}>
                        {reminder.is_active ? 'Etkin' : 'Devre Dışı'}
                      </span>
                      {reminder.is_survey && (
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-100">
                          Geri Bildirimli (Anket)
                        </span>
                      )}
                    </div>
                    
                    <div className="flex flex-wrap gap-2 mb-3">
                      <span className="text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200 px-2 py-1 rounded border border-blue-200 dark:border-blue-800">
                        🎯 Hedef: {reminder.personnel ? `${reminder.personnel.first_name} ${reminder.personnel.last_name}` : (reminder.department_name === 'Tümü' ? 'Tüm Şirket' : reminder.department_name === 'Müdür Hariç Tümü' ? 'Tüm Şirket (Müdür Hariç)' : `${reminder.department_name} Reyonu`)}
                      </span>
                      {reminder.target_gender && reminder.target_gender !== 'none' && <span className="text-xs bg-muted border px-2 py-1 rounded">Cinsiyet: {reminder.target_gender}</span>}
                      {reminder.target_shift && reminder.target_shift !== 'none' && <span className="text-xs bg-muted border px-2 py-1 rounded">Vardiya: {reminder.target_shift}</span>}
                      {reminder.target_break_status && reminder.target_break_status !== 'none' && <span className="text-xs bg-muted border px-2 py-1 rounded">Mola: {reminder.target_break_status === 'on_break' ? 'Molada Olanlar' : 'Çalışanlar'}</span>}
                      {reminder.target_task && reminder.target_task !== 'none' && <span className="text-xs bg-muted border px-2 py-1 rounded">Görev: {reminder.target_task}</span>}
                      {reminder.target_time && <span className="text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200 px-2 py-1 rounded border border-amber-200 dark:border-amber-800">⏰ Saat: {reminder.target_time}</span>}
                      {reminder.recurrence && reminder.recurrence !== 'none' && (
                        <span className="text-xs font-bold bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-200 px-2 py-1 rounded border border-indigo-200 dark:border-indigo-800">
                          🔄 {(() => {
                            if (reminder.recurrence === 'daily') return 'Her Gün';
                            if (reminder.recurrence.startsWith('weekly')) {
                              const dayMap: any = { '1': 'Pzt', '2': 'Sal', '3': 'Çar', '4': 'Per', '5': 'Cum', '6': 'Cmt', '0': 'Paz'};
                              const days = reminder.recurrence.split(',').slice(1);
                              return `Haftalık (${days.map((d: string) => dayMap[d]).join(', ')})`;
                            }
                            if (reminder.recurrence.startsWith('monthly')) return `Aylık (${reminder.recurrence.split(',').slice(1).join(', ')}. gün)`;
                            return reminder.recurrence;
                          })()}
                        </span>
                      )}
                    </div>

                    {reminder.description && (
                      <p className="text-sm text-muted-foreground bg-muted/30 p-3 rounded-lg border">{reminder.description}</p>
                    )}
                    
                    {reminder.is_survey && (
                      <div className="mt-4 p-3 bg-muted/30 rounded-lg border">
                        <h4 className="text-xs font-semibold text-foreground mb-2 text-primary uppercase">Yanıt Durumu</h4>
                        <p className="text-xs text-muted-foreground">{reminder.responses?.length || 0} kişi yanıt verdi.</p>
                        <Button variant="outline" size="sm" className="w-full mt-3 h-8 text-xs" onClick={() => {
                           setArchiveReminder(reminder);
                           setArchiveStartDate('');
                           setArchiveEndDate('');
                           setSelectedArchiveIds([]);
                           setIsArchiveModalOpen(true);
                        }}>
                           <Calendar className="w-3 h-3 mr-2" /> Yanıt Geçmişini Gör / İndir
                        </Button>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">

                    
                    <Button variant="ghost" size="sm" onClick={() => toggleActive(reminder.id, reminder.is_active)} title={reminder.is_active ? 'Devre dışı bırak' : 'Etkinleştir'}>
                      {reminder.is_active ? <ToggleRight className="h-6 w-6 text-green-500" /> : <ToggleLeft className="h-6 w-6 text-gray-400" />}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleEdit(reminder)} className="text-blue-500 hover:text-blue-700"><Edit2 className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(reminder.id)} className="text-red-500 hover:text-red-700"><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {isArchiveModalOpen && archiveReminder && (
        <Dialog open={isArchiveModalOpen} onOpenChange={setIsArchiveModalOpen}>
           <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                   <Calendar className="w-5 h-5 text-primary" /> 
                   {archiveReminder.title} - Yanıt Geçmişi / Arşivi
                </DialogTitle>
              </DialogHeader>
              <div className="flex-1 overflow-y-auto pr-2 space-y-4">
                 <div className="flex items-end gap-4 bg-muted/30 p-4 rounded-lg border flex-wrap">
                    <div>
                       <label className="text-xs font-semibold mb-1 block">Başlangıç Tarihi</label>
                       <Input type="date" value={archiveStartDate} onChange={e => setArchiveStartDate(e.target.value)} className="h-8 text-sm" />
                    </div>
                    <div>
                       <label className="text-xs font-semibold mb-1 block">Bitiş Tarihi</label>
                       <Input type="date" value={archiveEndDate} onChange={e => setArchiveEndDate(e.target.value)} className="h-8 text-sm" />
                    </div>
                    <Button variant="outline" size="sm" className="h-8" onClick={() => { setArchiveStartDate(''); setArchiveEndDate(''); }}>Temizle</Button>
                    <div className="flex-1"></div>
                    <Button variant="default" size="sm" className="h-8" onClick={handleExportArchive}>
                       <Download className="w-4 h-4 mr-2" /> Excel (Seçili Tarihleri İndir)
                    </Button>
                 </div>

                 {selectedArchiveIds.length > 0 && (
                    <div className="flex items-center justify-between bg-red-50 dark:bg-red-900/20 p-2 rounded border border-red-200 dark:border-red-900/50">
                       <span className="text-sm text-red-800 dark:text-red-200 font-medium">{selectedArchiveIds.length} kayıt seçildi</span>
                       <Button variant="destructive" size="sm" onClick={() => {
                          if (confirm('Seçili yanıtları kalıcı olarak silmek istediğinize emin misiniz?')) {
                             const payloads = filteredArchiveResponses.filter((r:any) => selectedArchiveIds.includes(r.id || `${r.reminder_id}_${r.personnel_id}_${r.response_date}`)).map((r:any) => ({ id: r.id, reminder_id: r.reminder_id, personnel_id: r.personnel_id, response_date: r.response_date }));
                             deleteResponsesMutation.mutate(payloads);
                          }
                       }} disabled={deleteResponsesMutation.isPending}>
                          <Trash2 className="w-4 h-4 mr-2" /> Seçilileri Sil
                       </Button>
                    </div>
                 )}

                 <div className="border rounded-lg overflow-hidden">
                   <Table>
                      <TableHeader className="bg-muted">
                        <TableRow>
                          <TableHead className="w-[50px]">
                            <Checkbox 
                              checked={filteredArchiveResponses.length > 0 && selectedArchiveIds.length === filteredArchiveResponses.length}
                              onCheckedChange={(c) => {
                                 if (c) {
                                    setSelectedArchiveIds(filteredArchiveResponses.map((r:any) => r.id || `${r.reminder_id}_${r.personnel_id}_${r.response_date}`));
                                 } else {
                                    setSelectedArchiveIds([]);
                                 }
                              }}
                            />
                          </TableHead>
                          <TableHead>Personel</TableHead>
                          <TableHead>Yanıt Tarihi</TableHead>
                          <TableHead>Durum</TableHead>
                          <TableHead>Not / Açıklama</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                         {filteredArchiveResponses.length === 0 ? (
                            <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">Kayıt bulunamadı</TableCell></TableRow>
                         ) : (
                            filteredArchiveResponses.map((r:any) => {
                               const uid = r.id || `${r.reminder_id}_${r.personnel_id}_${r.response_date}`;
                               return (
                               <TableRow key={uid}>
                                 <TableCell>
                                   <Checkbox 
                                     checked={selectedArchiveIds.includes(uid)}
                                     onCheckedChange={(c) => {
                                        if (c) setSelectedArchiveIds([...selectedArchiveIds, uid]);
                                        else setSelectedArchiveIds(selectedArchiveIds.filter(id => id !== uid));
                                     }}
                                   />
                                 </TableCell>
                                 <TableCell className="font-medium">{r.personnel ? `${r.personnel.first_name} ${r.personnel.last_name}` : 'Bilinmeyen'}</TableCell>
                                 <TableCell>{r.response_date ? format(new Date(r.response_date), 'dd.MM.yyyy') : '-'}</TableCell>
                                 <TableCell><Badge variant="outline">{r.status}</Badge></TableCell>
                                 <TableCell className="text-xs text-muted-foreground">{r.notes || '-'}</TableCell>
                               </TableRow>
                               );
                            })
                         )}
                      </TableBody>
                   </Table>
                 </div>
              </div>
           </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

export default ReminderManagement;
