import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { BellRing, Coffee, Briefcase, CalendarClock, Target, Moon, Save, Send, Lock, Edit2, Trash2, Plus, Clock, ToggleRight, ToggleLeft, RefreshCw, Filter } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export default function NotificationSettings() {
  const queryClient = useQueryClient();
  const [prefs, setPrefs] = useState<any>({});
  
  // CRUD State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    personnel_id: '',
    department_name: '',
    title: '',
    description: '',
    is_active: true,
    recurrence: 'none',
    recurrence_days: ['1'],
    target_date: '',
    target_gender: '',
    target_shift: '',
    target_employment_type: '',
    target_break_status: '',
    target_task: '',
    target_time: '',
    send_to_telegram: true,
    send_to_telegram_group: true
  });

  const { data: personnel = [] } = useQuery({
    queryKey: ['active_personnel_for_notif'],
    queryFn: async () => {
      const { data, error } = await supabase.from('personnel').select('id, first_name, last_name, department').eq('is_active', true);
      if (error) throw error;
      return data;
    }
  });

  const { data: settingsRecord, isLoading } = useQuery({
    queryKey: ['system_notification_settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('system_settings' as any)
        .select('*')
        .eq('setting_key', 'notification_settings')
        .maybeSingle();
      if (error) throw error;
      return data || { setting_value: {} };
    }
  });

  useEffect(() => {
    if (settingsRecord?.setting_value) {
      setPrefs({
        break_end: settingsRecord.setting_value.break_end ?? true,
        break_end_msg: settingsRecord.setting_value.break_end_msg || 'Molanız bitmek üzere (Son 5 dk), lütfen yerinize geçin.',
        
        morning_delay: settingsRecord.setting_value.morning_delay ?? true,
        morning_delay_msg: settingsRecord.setting_value.morning_delay_msg || 'Sabah vardiyasına geç kaldınız, yöneticinize bilgi verin.',
        
        evening_delay: settingsRecord.setting_value.evening_delay ?? true,
        evening_delay_msg: settingsRecord.setting_value.evening_delay_msg || 'Akşam vardiyasına geç kaldınız, yöneticinize bilgi verin.',
        
        wh_count: settingsRecord.setting_value.wh_count ?? true,
        wh_count_msg: settingsRecord.setting_value.wh_count_msg || 'Saat 17:00 depo koli sayımınızı yapmayı unutmayın.',
        
        kitchen_clean: settingsRecord.setting_value.kitchen_clean ?? true,
        kitchen_clean_msg: settingsRecord.setting_value.kitchen_clean_msg || 'Saat 21:00 mutfak temizlik işlemlerini tamamlayın.',
        
        day_off_notif: settingsRecord.setting_value.day_off_notif ?? true,
        day_off_notif_msg: settingsRecord.setting_value.day_off_notif_msg || 'Lütfen önümüzdeki hafta için izin gününüzü sisteme girin.',
        
        dynamic_poll: settingsRecord.setting_value.dynamic_poll ?? true,
        dynamic_poll_msg: settingsRecord.setting_value.dynamic_poll_msg || 'Yeni bir anket/görev atandı, lütfen yanıtlayın.',
        
        sales_notif: settingsRecord.setting_value.sales_notif ?? true,
        sales_notif_msg: settingsRecord.setting_value.sales_notif_msg || 'Satış hedefleriniz güncellenmiştir.',
        
        show_lock_screen: settingsRecord.setting_value.show_lock_screen ?? true,
        mute_day_off: settingsRecord.setting_value.mute_day_off ?? true,
        night_mode: settingsRecord.setting_value.night_mode ?? false,
        telegram_bot_token: settingsRecord.setting_value.telegram_bot_token || '',
        telegram_group_chat_id: settingsRecord.setting_value.telegram_group_chat_id || '',
        telegram_reminders_dm: settingsRecord.setting_value.telegram_reminders_dm ?? true,
        telegram_reminders_group: settingsRecord.setting_value.telegram_reminders_group ?? true,
      });
    }
  }, [settingsRecord]);

  const updatePrefs = (key: string, value: any) => {
    setPrefs((prev: any) => ({ ...prev, [key]: value }));
  };

  const saveMutation = useMutation({
    mutationFn: async (newPrefs: any) => {
      if (settingsRecord?.id) {
        const { error } = await supabase.from('system_settings' as any).update({ setting_value: newPrefs }).eq('id', settingsRecord.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('system_settings' as any).insert({ setting_key: 'notification_settings', setting_value: newPrefs });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system_notification_settings'] });
      toast.success('Sistem bildirim ayarları başarıyla güncellendi');
    },
    onError: (error: any) => {
      toast.error('Ayarlar güncellenirken hata oluştu: ' + error.message);
    }
  });

﻿  const { data: notifications = [], isLoading: isNotifLoading, refetch } = useQuery({
    queryKey: ['notifications_list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reminders')
        .select('*, personnel (first_name, last_name)')
        .eq('display_type', 'hidden')
        .order('is_active', { ascending: false })
        .order('id', { ascending: false });
      if (error) throw error;
      return data;
    }
  });

  const addMutation = useMutation({
    mutationFn: async (newRecord: any) => {
      const { data, error } = await supabase.from('reminders').insert([{...newRecord, display_type: 'hidden', is_survey: false}]).select();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications_list'] });
      toast.success('Bildirim kuralı oluşturuldu');
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
      queryClient.invalidateQueries({ queryKey: ['notifications_list'] });
      toast.success('Bildirim güncellendi');
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
      queryClient.invalidateQueries({ queryKey: ['notifications_list'] });
      toast.success('Bildirim silindi');
    },
    onError: (error: any) => toast.error('Silme başarısız: ' + error.message)
  });

  const handleSubmit = () => {
    if ((!formData.personnel_id && !formData.department_name) || !formData.title.trim()) {
      toast.error('Lütfen Hedef Kitle ve Başlık alanlarını doldurun');
      return;
    }

    const payload = {
      personnel_id: formData.personnel_id || null,
      department_name: formData.department_name === 'all' ? 'Tümü' : formData.department_name === 'all_except_managers' ? 'Müdür Hariç Tümü' : (formData.department_name || null),
      title: formData.title,
      description: formData.description,
      is_active: formData.is_active,
      is_survey: false,
      display_type: 'hidden',
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
      send_to_telegram: formData.send_to_telegram,
      send_to_telegram_group: formData.send_to_telegram_group
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
      if (parts.length > 1) recDays = parts.slice(1);
    }

    setFormData({
      personnel_id: reminder.personnel_id || '',
      department_name: reminder.department_name === 'Tümü' ? 'all' : reminder.department_name === 'Müdür Hariç Tümü' ? 'all_except_managers' : (reminder.department_name || ''),
      title: reminder.title,
      description: reminder.description || '',
      is_active: reminder.is_active,
      recurrence: recType,
      recurrence_days: recDays,
      target_gender: reminder.target_gender || '',
      target_shift: reminder.target_shift || '',
      target_employment_type: reminder.target_employment_type || '',
      target_break_status: reminder.target_break_status || '',
      target_task: reminder.target_task || '',
      target_time: reminder.target_time || '',
      target_date: reminder.target_date || '',
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
      recurrence: 'none',
      recurrence_days: ['1'],
      target_date: '',
      target_gender: '',
      target_shift: '',
      target_employment_type: '',
      target_break_status: '',
      target_task: '',
      target_time: '',
      send_to_telegram: true,
      send_to_telegram_group: true
    });
    setEditingId(null);
    setIsModalOpen(false);
  };

  const toggleActive = (id: string, currentStatus: boolean) => {
    updateMutation.mutate({ id, updates: { is_active: !currentStatus } });
  };

  const departments = Array.from(new Set(personnel.map((p: any) => p.department).filter(Boolean)));

  if (isLoading) return <div className="p-8 text-center text-muted-foreground animate-pulse">Ayarlar Yükleniyor...</div>;

  return (
    <div className="space-y-6 max-w-5xl mx-auto p-2 pb-12">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Global Bildirim Ayarları</h1>
        <p className="text-muted-foreground mt-1">Sistemdeki otomatik bildirimleri ve metinlerini yönetin, veya anlık bildirim fırlatın.</p>
      </div>



      {/* 1. TELEGRAM ENTEGRASYONU */}
      <Card className="glass-card border-blue-200 dark:border-blue-800">
        <CardHeader className="pb-3 border-b bg-blue-50/50 dark:bg-blue-900/20">
          <CardTitle className="flex items-center text-lg text-[#0088cc]"><Send className="w-5 h-5 mr-2" /> 1. Telegram Entegrasyonu ve Duyuru Ayarları</CardTitle>
          <CardDescription>Botunuzun şirkete ait genel Telegram grubuna ve personellere mesaj gönderebilmesi için gereken ayarlar.</CardDescription>
        </CardHeader>
        <CardContent className="pt-4 space-y-4">
          <div className="space-y-2">
            <Label className="font-semibold text-[#0088cc]">Telegram Bot Token</Label>
            <div className="p-2 border border-green-200 bg-green-50/50 dark:bg-green-900/10 rounded-md flex items-center h-10">
              <span className="truncate text-green-700 dark:text-green-400 font-semibold text-sm flex items-center gap-2">
                 <Lock className="w-4 h-4" /> Güvenlik sebebiyle ekrandan gizlenmiştir (Arka planda aktiftir)
              </span>
            </div>
            <p className="text-xs text-muted-foreground">BotFather'dan aldığınız HTTP API tokenı güvenliğiniz için gizlenmiştir. Değiştirmek isterseniz sistem yöneticinizle (Supabase Secrets üzerinden) iletişime geçin.</p>
          </div>
          
          <div className="space-y-2">
            <Label className="font-semibold text-[#0088cc]">Grup Chat ID (Opsiyonel)</Label>
            <Input 
              placeholder="Örn: -100123456789" 
              value={prefs.telegram_group_chat_id || ''} 
              onChange={e => updatePrefs('telegram_group_chat_id', e.target.value)} 
            />
            <p className="text-xs text-muted-foreground">Botu gruba ekleyip mesaj attıktan sonra bulabileceğiniz eksi (-) ile başlayan numara.</p>
          </div>

          <div className="pt-4 border-t border-blue-100 dark:border-blue-900 mt-4 space-y-4">
            <div className="flex items-center justify-between gap-4 bg-blue-50/50 dark:bg-blue-900/10 p-3 rounded-lg border border-blue-100 dark:border-blue-800">
              <div>
                <Label className="font-semibold text-blue-900 dark:text-blue-300">Duyurularda Seçili Personellere Telegram'dan Bireysel Gönder (DM)</Label>
                <p className="text-xs text-muted-foreground mt-1">Duyuru eklendiğinde personelin kendi Telegram mesaj kutusuna otomatik bildir.</p>
              </div>
              <Switch checked={prefs.telegram_reminders_dm} onCheckedChange={(c) => updatePrefs('telegram_reminders_dm', c)} />
            </div>
            
            <div className="flex items-center justify-between gap-4 bg-blue-50/50 dark:bg-blue-900/10 p-3 rounded-lg border border-blue-100 dark:border-blue-800">
              <div>
                <Label className="font-semibold text-blue-900 dark:text-blue-300">Duyurularda Telegram Şirket Grubuna At</Label>
                <p className="text-xs text-muted-foreground mt-1">Duyuru eklendiğinde yukarıda belirttiğiniz Grup Chat ID'ye otomatik bildir.</p>
              </div>
              <Switch checked={prefs.telegram_reminders_group} onCheckedChange={(c) => updatePrefs('telegram_reminders_group', c)} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 2. KİŞİSELLEŞTİRME VE ERİŞEBİLİRLİK */}
      <Card className="glass-card">
        <CardHeader className="pb-3 border-b">
          <CardTitle className="flex items-center text-lg text-primary"><Moon className="w-5 h-5 mr-2" /> 2. Kişiselleştirme Kuralları</CardTitle>
          <CardDescription>Bu ayarlar tüm sistem çalışanlarını kapsar.</CardDescription>
        </CardHeader>
        <CardContent className="pt-4 space-y-4">
          <div className="flex items-center justify-between gap-4 bg-muted/20 p-3 rounded-lg border">
            <Label className="font-semibold">Personellerin Kilit Ekranında Bildirim Gösterimine İzin Ver</Label>
            <Switch checked={prefs.show_lock_screen} onCheckedChange={(c) => updatePrefs('show_lock_screen', c)} />
          </div>
          <div className="flex items-center justify-between gap-4 bg-muted/20 p-3 rounded-lg border">
            <Label className="font-semibold">İzin Günlerindeki Personellere Bildirimleri Otomatik Sustur</Label>
            <Switch checked={prefs.mute_day_off} onCheckedChange={(c) => updatePrefs('mute_day_off', c)} />
          </div>
          <div className="flex items-center justify-between gap-4 bg-muted/20 p-3 rounded-lg border">
            <Label className="font-semibold">Gece Modu / Sessiz Saatler (23:00 - 07:00 arası bildirim gitmesin)</Label>
            <Switch checked={prefs.night_mode} onCheckedChange={(c) => updatePrefs('night_mode', c)} />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end pb-8 border-b">
        <Button onClick={() => saveMutation.mutate(prefs)} disabled={saveMutation.isPending} size="lg" className="w-full sm:w-auto">
          <Save className="w-4 h-4 mr-2" />
          {saveMutation.isPending ? 'Kaydediliyor...' : 'OTOMATİK AYARLARI KAYDET'}
        </Button>
      </div>

﻿      {/* 3. BİLDİRİM (PUSH/TELEGRAM) YÖNETİMİ */}
      <div className="flex justify-between items-center flex-wrap gap-4 mt-12 mb-4">
        <div>
          <h2 className="text-2xl font-bold text-indigo-700 dark:text-indigo-400 flex items-center"><Send className="w-6 h-6 mr-2" /> 3. Arka Plan Bildirim Kuralları</h2>
          <p className="text-muted-foreground mt-1">Sessizce Push/Telegram olarak giden ve ekranda pop-up olarak ÇIKMAYAN bildirim kuralları.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="icon" onClick={() => refetch()} title="Yenile">
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button onClick={() => { resetForm(); setIsModalOpen(true); }} size="lg" className="bg-indigo-600 hover:bg-indigo-700 text-white">
            <Plus className="h-4 w-4 mr-2" /> Yeni Bildirim Kuralı
          </Button>
        </div>
      </div>

      {isModalOpen && (
        <Card className="border-2 border-indigo-200 dark:border-indigo-800 shadow-lg relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-blue-500 to-indigo-500"></div>
          <CardHeader className="bg-muted/30 pb-4">
            <CardTitle className="text-xl flex items-center gap-2">
              <Filter className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              {editingId ? 'Bildirim Şartlarını Düzenle' : 'Yeni Bildirim (Push/Telegram) Kuralı Oluştur'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            
            <div className="grid md:grid-cols-2 gap-8">
              {/* SOL KOLON: TEMEL BİLGİLER */}
              <div className="space-y-4">
                <div className="border-b pb-2 mb-4">
                  <h3 className="font-semibold text-lg text-indigo-600 dark:text-indigo-400">1. Temel Bilgiler & Mesaj</h3>
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
                      {departments.map((dep: any) => (
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
                      id="send_to_telegram"
                      className="rounded border-gray-300 w-4 h-4"
                      checked={formData.send_to_telegram}
                      onChange={(e) => setFormData({ ...formData, send_to_telegram: e.target.checked })}
                    />
                    <label htmlFor="send_to_telegram" className="text-sm font-medium">Bireysel Telegram Mesajı Gönder (DM)</label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input 
                      type="checkbox"
                      id="send_to_telegram_group"
                      className="rounded border-gray-300 w-4 h-4"
                      checked={formData.send_to_telegram_group}
                      onChange={(e) => setFormData({ ...formData, send_to_telegram_group: e.target.checked })}
                    />
                    <label htmlFor="send_to_telegram_group" className="text-sm font-medium">Şirket Telegram Grubuna Gönder</label>
                  </div>

                  <div className="flex items-center gap-2 mt-2">
                    <input
                      type="checkbox"
                      checked={formData.is_active}
                      onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                      id="is_active_notif"
                      className="w-4 h-4 rounded"
                    />
                    <label htmlFor="is_active_notif" className="text-sm font-medium text-foreground">Kuralı Etkinleştir</label>
                  </div>
                </div>
              </div>

              {/* SAĞ KOLON: GELİŞMİŞ FİLTRELER */}
              <div className="space-y-4 bg-muted/10 p-4 rounded-xl border border-dashed">
                <div className="border-b pb-2 mb-4">
                  <h3 className="font-semibold text-lg text-indigo-600 dark:text-indigo-400 flex items-center">
                    <Filter className="w-4 h-4 mr-2" /> 2. Akıllı Filtreler & Zamanlama
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">Sadece bu şartları sağlayanlara bildirim gider.</p>
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
                        <SelectItem value="Mutfak">Mutfak Görevlileri</SelectItem>
                        <SelectItem value="Depo">Depo Görevlileri</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase">Personel Tipi</label>
                    <Select value={formData.target_employment_type} onValueChange={(v) => setFormData({ ...formData, target_employment_type: v })}>
                      <SelectTrigger className="bg-background mt-1 h-8 text-sm"><SelectValue placeholder="Tümü" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Tümü</SelectItem>
                        <SelectItem value="full_time">Tam Zamanlı</SelectItem>
                        <SelectItem value="part_time">Yarı Zamanlı</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase">Saat / Dakika</label>
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
                    <option value="none">Bir Kez Gönder (Tekrar Yok)</option>
                    <option value="daily">Her Gün Gönder</option>
                    <option value="weekly">Her Hafta Belirli Günlerde Gönder</option>
                    <option value="monthly">Her Ay Belirli Günlerde Gönder</option>
                  </select>

                  {formData.recurrence === 'none' && (
                    <div className="mt-3">
                      <label className="text-xs text-muted-foreground mb-1 block">Hangi Tarihte?</label>
                      <Input 
                        type="date" 
                        className="bg-background"
                        value={formData.target_date || ''}
                        onChange={(e) => setFormData({ ...formData, target_date: e.target.value })}
                      />
                    </div>
                  )}

                  {formData.recurrence === 'weekly' && (
                    <div className="mt-3">
                      <label className="text-xs text-muted-foreground mb-1 block">Hangi Gün(ler)?</label>
                      <div className="flex flex-wrap gap-2">
                        {[
                          { val: '1', label: 'Pzt' }, { val: '2', label: 'Sal' }, { val: '3', label: 'Çar' },
                          { val: '4', label: 'Per' }, { val: '5', label: 'Cum' }, { val: '6', label: 'Cmt' }, { val: '0', label: 'Paz' }
                        ].map(day => (
                          <label key={day.val} className="flex items-center gap-1 bg-background border px-2 py-1 rounded cursor-pointer">
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
                    <div className="mt-3">
                      <label className="text-xs text-muted-foreground mb-1 block">Ayın Kaçıncı Günleri?</label>
                      <div className="grid grid-cols-7 gap-1">
                        {Array.from({length: 31}, (_, i) => String(i + 1)).map(d => (
                          <label key={d} className={`flex items-center justify-center py-1 rounded cursor-pointer text-xs border select-none ${formData.recurrence_days.includes(d) ? 'bg-primary text-primary-foreground border-primary' : 'bg-background hover:bg-muted'}`}>
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
              <Button onClick={handleSubmit} disabled={addMutation.isPending || updateMutation.isPending} size="lg" className="min-w-[150px] bg-indigo-600 hover:bg-indigo-700 text-white">
                {editingId ? 'Güncelle' : 'Kuralı Kaydet'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isNotifLoading ? (
        <div className="flex items-center justify-center p-8"><p className="animate-pulse">Yükleniyor...</p></div>
      ) : notifications.length === 0 ? (
        <Card className="glass-card"><CardContent className="p-8 text-center"><BellRing className="h-12 w-12 text-muted-foreground mx-auto mb-4" /><p className="text-muted-foreground">Henüz bildirim kuralı oluşturulmadı</p></CardContent></Card>
      ) : (
        <div className="space-y-4">
          {notifications.map((notif: any) => (
            <Card key={notif.id} className="glass-card border-l-4 border-l-indigo-500">
              <CardContent className="p-6">
                <div className="flex justify-between items-start gap-4 flex-wrap">
                  <div className="flex-1 min-w-[200px]">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-lg font-semibold text-foreground">{notif.title}</h3>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${notif.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        {notif.is_active ? 'Etkin' : 'Devre Dışı'}
                      </span>
                    </div>
                    
                    <div className="flex flex-wrap gap-2 mb-3">
                      <span className="text-xs font-medium bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-200 px-2 py-1 rounded border border-indigo-200 dark:border-indigo-800">
                        🎯 Hedef: {notif.personnel ? `${notif.personnel.first_name} ${notif.personnel.last_name}` : (notif.department_name === 'Tümü' ? 'Tüm Şirket' : notif.department_name === 'Müdür Hariç Tümü' ? 'Tüm Şirket (Müdür Hariç)' : `${notif.department_name} Reyonu`)}
                      </span>
                      {notif.target_time && <span className="text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200 px-2 py-1 rounded border border-amber-200 dark:border-amber-800">⏰ Saat: {notif.target_time}</span>}
                      {notif.recurrence && notif.recurrence !== 'none' && (
                        <span className="text-xs font-bold bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200 px-2 py-1 rounded border border-blue-200 dark:border-blue-800">
                          🔄 {notif.recurrence.split(',')[0] === 'daily' ? 'Her Gün' : notif.recurrence.split(',')[0]}
                        </span>
                      )}
                    </div>
                    {notif.description && <p className="text-sm text-muted-foreground bg-muted/30 p-3 rounded-lg border">{notif.description}</p>}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => toggleActive(notif.id, notif.is_active)} title={notif.is_active ? 'Devre dışı bırak' : 'Etkinleştir'}>
                      {notif.is_active ? <ToggleRight className="h-6 w-6 text-green-500" /> : <ToggleLeft className="h-6 w-6 text-gray-400" />}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleEdit(notif)} className="text-blue-500 hover:text-blue-700"><Edit2 className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(notif.id)} className="text-red-500 hover:text-red-700"><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

    </div>
  );
}