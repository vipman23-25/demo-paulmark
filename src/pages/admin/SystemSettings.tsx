import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Settings, Plus, Trash2, ImagePlus, X, Activity, Pencil, Check, CalendarDays } from 'lucide-react';
import { Camera, Image as ImageIcon, CheckCircle, Smartphone } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import BackupAndPurgeCard from '@/components/BackupAndPurgeCard';
import { useAuth } from '@/contexts/AuthContext';
import { DemoManagementCard } from '@/components/admin/DemoManagementCard';

export interface SystemSettings {
  breakLimitMinutes: number;
  movementTypes: { code: string; label: string }[];
  overtimeTypes: string[];
  taskStatuses?: string[];
  announcementImages?: string[];
  employeeDashboardFeatures?: {
    showOvertime: boolean;
    showBreakViolations: boolean;
    showLeaveStatus: boolean;
    showSalesTargets: boolean;
    showMovements: boolean;
    showReminders: boolean;
    showWeeklyDayOff: boolean;
    showCargoStatus: boolean;
    showActiveBreaks?: boolean;
    showShiftVisuals?: boolean;
    showLogistics?: boolean;
    showShiftSwaps?: boolean;
  };
  loginPageImage?: string | null;
  telegram_reminders_group?: boolean;
  telegram_reminders_dm?: boolean;
  leaveEntitlements?: {
    tier1: number;
    tier2: number;
    tier3: number;
  };
  geofence?: {
    isActive: boolean;
    lat: number;
    lng: number;
    radius: number;
  };
  weeklySchedule?: any[];
}

const defaultSettings: SystemSettings = {
  breakLimitMinutes: 60,
  movementTypes: [{ code: 'İ', label: 'İzin' }, { code: 'R', label: 'Hastalık İzni' }, { code: 'M', label: 'Muafiyet' }, { code: 'B', label: 'Başka Görev' }],
  overtimeTypes: ['Fazla Mesai', 'Alacak (Kullanım)'],
  taskStatuses: ['Yapıldı', 'Yapılmadı', 'Beklemede', 'Okudum & Anladım'],
  announcementImages: [],
  employeeDashboardFeatures: {
    showOvertime: true,
    showBreakViolations: true,
    showLeaveStatus: true,
    showSalesTargets: true,
    showMovements: true,
    showReminders: true,
    showWeeklyDayOff: true,
    showCargoStatus: true,
    showShiftVisuals: true,
    showActiveBreaks: true,
    showLogistics: true,
    showShiftSwaps: true
  },
  telegram_reminders_group: true,
  telegram_reminders_dm: true,
  leaveEntitlements: {
    tier1: 16,
    tier2: 20,
    tier3: 26
  },
  geofence: {
    isActive: false,
    lat: 41.0082,
    lng: 28.9784,
    radius: 100
  },
  weeklySchedule: []
};

const SystemSettingsView = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [newMovementCode, setNewMovementCode] = useState('');
  const [newMovementLabel, setNewMovementLabel] = useState('');
  const [editingMovementIdx, setEditingMovementIdx] = useState<number | null>(null);
  const [editMovementCode, setEditMovementCode] = useState('');
  const [editMovementLabel, setEditMovementLabel] = useState('');
  const [newOvertimeType, setNewOvertimeType] = useState('');
  const [newTaskStatus, setNewTaskStatus] = useState('');
  const [localLimit, setLocalLimit] = useState<string>('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [leaveTiers, setLeaveTiers] = useState({ tier1: '16', tier2: '20', tier3: '26' });
  const [newHolidayDate, setNewHolidayDate] = useState('');
  const [newHolidayName, setNewHolidayName] = useState('');
  
  // Geofence states
  const [geofenceActive, setGeofenceActive] = useState(false);
  const [geofenceLat, setGeofenceLat] = useState('41.0082');
  const [geofenceLng, setGeofenceLng] = useState('28.9784');
  const [geofenceRadiusStart, setGeofenceRadiusStart] = useState('100');
  const [geofenceRadiusEnd, setGeofenceRadiusEnd] = useState('100');

  const { data: holidays = [], isLoading: isLoadingHolidays } = useQuery({
    queryKey: ['public_holidays'],
    queryFn: async () => {
      const { data, error } = await supabase.from('public_holidays' as any).select('*').order('date', { ascending: true });
      if (error) {
        if (error.code === '42P01') return []; // table not created yet
        console.error(error);
        return [];
      }
      return data || [];
    }
  });

  const addHolidayMutation = useMutation({
    mutationFn: async (payload: { date: string, name: string }) => {
      const { data, error } = await supabase.from('public_holidays' as any).insert([payload]).select();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['public_holidays'] });
      setNewHolidayDate('');
      setNewHolidayName('');
      toast.success('Resmi tatil eklendi');
    },
    onError: (err: any) => toast.error('Ekleme hatası: ' + err.message)
  });

  const removeHolidayMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('public_holidays' as any).delete().eq('id', id);
      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['public_holidays'] });
      toast.success('Resmi tatil silindi');
    }
  });

  const { data: settings = defaultSettings, isLoading } = useQuery({
    queryKey: ['system_settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('system_settings' as any)
        .select('setting_value')
        .eq('setting_key', 'general')
        .single();
      
      if (error && error.code !== 'PGRST116') {
        toast.error('Ayarlar yüklenirken hata oluştu');
        throw error;
      }
      
      if (data?.setting_value) {
        return data.setting_value as SystemSettings;
      }
      return defaultSettings;
    }
  });

  useEffect(() => {
    if (settings) {
      setLocalLimit(settings.breakLimitMinutes?.toString() || '60');
      if (settings.leaveEntitlements) {
        setLeaveTiers({
          tier1: settings.leaveEntitlements.tier1.toString(),
          tier2: settings.leaveEntitlements.tier2.toString(),
          tier3: settings.leaveEntitlements.tier3.toString()
        });
      } else {
        setLeaveTiers({
          tier1: defaultSettings.leaveEntitlements!.tier1.toString(),
          tier2: defaultSettings.leaveEntitlements!.tier2.toString(),
          tier3: defaultSettings.leaveEntitlements!.tier3.toString()
        });
      }
      if (settings.geofence) {
        setGeofenceActive(settings.geofence.isActive);
        setGeofenceLat(settings.geofence.lat.toString());
        setGeofenceLng(settings.geofence.lng.toString());
        setGeofenceRadiusStart(settings.geofence.radiusStart?.toString() || settings.geofence.radius?.toString() || '100');
        setGeofenceRadiusEnd(settings.geofence.radiusEnd?.toString() || settings.geofence.radius?.toString() || '100');
      }
    }
  }, [settings]);

  const updateMutation = useMutation({
    mutationFn: async (newSettings: SystemSettings) => {
      const { data, error } = await supabase
        .from('system_settings' as any)
        .upsert({
          setting_key: 'general',
          setting_value: newSettings as any
        }, { onConflict: 'setting_key' })
        .select();
        
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system_settings'] });
    },
    onError: (error: any) => {
      toast.error('Ayar güncellenemedi: ' + error.message);
    }
  });

  const handleUpdateBreakLimit = () => {
    const limit = parseInt(localLimit, 10);
    if (isNaN(limit) || limit < 1) {
      toast.error('Geçerli bir dakika değeri giriniz');
      return;
    }
    const updated = { ...settings, breakLimitMinutes: limit };
    updateMutation.mutate(updated, {
      onSuccess: () => toast.success('Mola süresi güncellendi')
    });
  };

  const handleUpdateLeaveTiers = () => {
    const t1 = parseInt(leaveTiers.tier1, 10);
    const t2 = parseInt(leaveTiers.tier2, 10);
    const t3 = parseInt(leaveTiers.tier3, 10);
    if (isNaN(t1) || isNaN(t2) || isNaN(t3) || t1 < 0 || t2 < 0 || t3 < 0) {
      toast.error('Lütfen geçerli gün sayıları giriniz');
      return;
    }
    const updated = {
      ...settings,
      leaveEntitlements: { tier1: t1, tier2: t2, tier3: t3 }
    };
    updateMutation.mutate(updated, {
      onSuccess: () => toast.success('Yıllık izin gün sayıları güncellendi')
    });
  };

  const handleFeatureToggle = (featureKey: keyof NonNullable<SystemSettings['employeeDashboardFeatures']>) => {
    const currentFeatures = settings.employeeDashboardFeatures || defaultSettings.employeeDashboardFeatures!;
    const currentValue = currentFeatures[featureKey] ?? true;
    const updated = { 
      ...settings, 
      employeeDashboardFeatures: {
        ...currentFeatures,
        [featureKey]: !currentValue
      }
    };
    updateMutation.mutate(updated, {
      onSuccess: () => toast.success('Görünüm ayarı güncellendi')
    });
  };

  const addMovementType = () => {
    if (!newMovementCode.trim() || !newMovementLabel.trim() || settings.movementTypes.some((t: any) => t.code === newMovementCode.trim())) return;
    const updated = { ...settings, movementTypes: [...settings.movementTypes, { code: newMovementCode.trim(), label: newMovementLabel.trim() }] };
    updateMutation.mutate(updated, {
      onSuccess: () => {
        setNewMovementCode('');
        setNewMovementLabel('');
        toast.success('Hareket türü eklendi');
      }
    });
  };

  const startEditMovement = (idx: number, type: any) => {
    setEditingMovementIdx(idx);
    setEditMovementCode(type.code);
    setEditMovementLabel(type.label);
  };

  const saveEditMovement = (idx: number) => {
    if (!editMovementCode.trim() || !editMovementLabel.trim()) return;
    
    const exists = settings.movementTypes.some((t: any, i: number) => i !== idx && t.code === editMovementCode.trim());
    if (exists) {
      toast.error('Bu kısa kod zaten kullanımda');
      return;
    }

    const updatedTypes = [...settings.movementTypes];
    updatedTypes[idx] = { 
      ...updatedTypes[idx],
      code: editMovementCode.trim(), 
      label: editMovementLabel.trim() 
    };

    updateMutation.mutate({ ...settings, movementTypes: updatedTypes }, {
      onSuccess: () => {
        setEditingMovementIdx(null);
        toast.success('Hareket türü güncellendi');
      }
    });
  };

  const removeMovementType = (code: string) => {
    const updated = { ...settings, movementTypes: settings.movementTypes.filter((t: any) => t.code !== code) };
    updateMutation.mutate(updated, {
      onSuccess: () => toast.success('Hareket türü silindi')
    });
  };

  const updateMovementMapping = (code: string, field: 'mappedCode' | 'mappedCode2' | 'mappedCode3', mappedCode: string) => {
    const updatedTypes = settings.movementTypes.map((t: any) => 
      t.code === code ? { ...t, [field]: mappedCode === 'none' ? null : mappedCode } : t
    );
    updateMutation.mutate({ ...settings, movementTypes: updatedTypes }, {
      onSuccess: () => toast.success('Bayram Shift eşleşmesi güncellendi')
    });
  };

  const addOvertimeType = () => {
    if (!newOvertimeType.trim() || settings.overtimeTypes.includes(newOvertimeType.trim())) return;
    const updated = { ...settings, overtimeTypes: [...settings.overtimeTypes, newOvertimeType.trim()] };
    updateMutation.mutate(updated, {
      onSuccess: () => {
        setNewOvertimeType('');
        toast.success('Mesai türü eklendi');
      }
    });
  };

  const removeOvertimeType = (type: string) => {
    const updated = { ...settings, overtimeTypes: settings.overtimeTypes.filter(t => t !== type) };
    updateMutation.mutate(updated, {
      onSuccess: () => toast.success('Mesai türü silindi')
    });
  };

  const addTaskStatus = () => {
    const currentList = settings.taskStatuses || defaultSettings.taskStatuses!;
    if (!newTaskStatus.trim() || currentList.includes(newTaskStatus.trim())) return;
    const updated = { ...settings, taskStatuses: [...currentList, newTaskStatus.trim()] };
    updateMutation.mutate(updated, {
      onSuccess: () => {
        setNewTaskStatus('');
        toast.success('Görev etiketi eklendi');
      }
    });
  };

  const removeTaskStatus = (type: string) => {
    const currentList = settings.taskStatuses || defaultSettings.taskStatuses!;
    const updated = { ...settings, taskStatuses: currentList.filter(t => t !== type) };
    updateMutation.mutate(updated, {
      onSuccess: () => toast.success('Görev etiketi silindi')
    });
  };

  const handleLoginImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setUploadingImage(true);
    const reader = new FileReader();
    reader.onload = (event) => {
       const rawBase64 = event.target?.result as string;
       
       // Sıkıştırma işlemi (Compress image)
       const img = new Image();
       img.onload = () => {
         const canvas = document.createElement('canvas');
         canvas.width = img.width;
         canvas.height = img.height;
         const ctx = canvas.getContext('2d');
         if (ctx) {
           ctx.drawImage(img, 0, 0);
           // Boyutu düşürmek için kaliteyi 0.6 yapıyoruz
           const compressedBase64 = canvas.toDataURL('image/jpeg', 0.6);
           
           const updated = { ...settings, loginPageImage: compressedBase64 };
           updateMutation.mutate(updated, {
             onSuccess: () => {
                 toast.success('Giriş sayfası görseli güncellendi!');
                 setUploadingImage(false);
             },
             onError: (err) => {
                 toast.error('Görsel kaydedilirken hata: ' + err.message);
                 setUploadingImage(false);
             }
           });
         } else {
           setUploadingImage(false);
         }
       };
       img.onerror = () => {
         toast.error('Görsel sıkıştırılamadı');
         setUploadingImage(false);
       };
       img.src = rawBase64;
    };
    reader.onerror = () => {
       toast.error('Dosya okunamadı');
       setUploadingImage(false);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLoginImage = () => {
    const updated = { ...settings, loginPageImage: null };
    updateMutation.mutate(updated, {
      onSuccess: () => toast.success('Görsel kaldırıldı')
    });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    try {
      // Sıkıştırma işlemi (Compress image)
      const compressedBlob: Blob = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
          const img = new Image();
          img.src = event.target?.result as string;
          img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(img, 0, 0);
              canvas.toBlob(
                (blob) => {
                  if (blob) resolve(blob);
                  else reject(new Error('Sıkıştırma başarısız oldu'));
                },
                'image/jpeg',
                0.6
              );
            } else {
              reject(new Error('Canvas oluşturulamadı'));
            }
          };
          img.onerror = () => reject(new Error('Resim okunamadı'));
        };
        reader.onerror = () => reject(new Error('Dosya okunamadı'));
      });

      const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.jpg`;
      
      const { error: uploadError } = await supabase.storage.from('announcements').upload(fileName, compressedBlob, {
         contentType: 'image/jpeg'
      });
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('announcements').getPublicUrl(fileName);
      
      const currentImages = settings.announcementImages || [];
      const updated = { ...settings, announcementImages: [...currentImages, data.publicUrl] };
      
      updateMutation.mutate(updated, {
        onSuccess: () => toast.success('Görsel yüklendi')
      });
    } catch (err: any) {
      toast.error('Görsel yükleme hatası: ' + err.message);
    } finally {
      setUploadingImage(false);
      if (e.target) e.target.value = '';
    }
  };

  const handleRemoveImage = async (url: string) => {
    try {
      const updated = { ...settings, announcementImages: (settings.announcementImages || []).filter(img => img !== url) };
      updateMutation.mutate(updated, {
        onSuccess: () => toast.success('Görsel kaldırıldı')
      });
    } catch (err: any) {
      toast.error('Görsel kaldırma hatası: ' + err.message);
    }
  };

  if (isLoading) return <div className="p-8 text-center text-muted-foreground animate-pulse">Ayarlar yükleniyor...</div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-2 mb-6">
        <Settings className="w-8 h-8" />
        <h1 className="text-3xl font-bold text-foreground">Sistem Ayarları</h1>
      </div>

      {user?.email === 'turgaydolu23@gmail.com' && (
        <div className="mb-8">
          <DemoManagementCard />
        </div>
      )}

      {/* Masonry Layout Container for tight packing without gaps */}
      <div className="columns-1 md:columns-2 xl:columns-3 gap-6 space-y-6 [&>div]:break-inside-avoid">
        
        {/* Leave Entitlements Settings Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl flex items-center gap-2 text-foreground"><CalendarDays className="h-5 w-5 text-primary" /> <span>Yıllık İzin Hak Ediş Günleri</span></CardTitle>
            <CardDescription>Personelin çalışma yılına göre kazanacağı standart izin gün sayılarını belirleyin.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase">1-5 Yıl Arası</Label>
                <div className="flex items-center gap-2">
                  <Input 
                    type="number" 
                    min="1" 
                    className="w-full text-lg font-semibold"
                    value={leaveTiers.tier1} 
                    onChange={(e) => setLeaveTiers({...leaveTiers, tier1: e.target.value})} 
                  />
                  <span className="text-sm font-medium text-muted-foreground">Gün</span>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase">6-15 Yıl Arası</Label>
                <div className="flex items-center gap-2">
                  <Input 
                    type="number" 
                    min="1" 
                    className="w-full text-lg font-semibold"
                    value={leaveTiers.tier2} 
                    onChange={(e) => setLeaveTiers({...leaveTiers, tier2: e.target.value})} 
                  />
                  <span className="text-sm font-medium text-muted-foreground">Gün</span>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase">16+ Yıl</Label>
                <div className="flex items-center gap-2">
                  <Input 
                    type="number" 
                    min="1" 
                    className="w-full text-lg font-semibold"
                    value={leaveTiers.tier3} 
                    onChange={(e) => setLeaveTiers({...leaveTiers, tier3: e.target.value})} 
                  />
                  <span className="text-sm font-medium text-muted-foreground">Gün</span>
                </div>
              </div>
            </div>
            <Button onClick={handleUpdateLeaveTiers} disabled={updateMutation.isPending} className="w-full sm:w-auto">
              <Settings className="w-4 h-4 mr-2" />
              <span>İzin Ayarlarını Kaydet</span>
            </Button>
          </CardContent>
        </Card>

        {/* Personel Paneli Düzeni - Sol tarafta dikey olarak hizalı */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Activity className="w-5 h-5" /> <span>Personel Paneli Düzeni</span></CardTitle>
            <CardDescription>Personel giriş yaptığında göreceği kontrol paneli özet kutularını buradan açıp kapatabilirsiniz.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-3">
              {[
                { key: 'showOvertime', label: 'Toplam Fazla Mesai', desc: 'Personelin fazla mesai hakedişini gösterir' },
                { key: 'showBreakViolations', label: 'Mola İhlal Özeti', desc: 'Günlük mola ihlallerini gösterir' },
                { key: 'showLeaveStatus', label: 'Yıllık İzin Durumu', desc: 'Yıllık izin hakkı ve kalan izni gösterir' },
                { key: 'showSalesTargets', label: 'Aylık Satış Özetleri', desc: 'Kişisel ve reyon satış hedeflerini gösterir' },
                { key: 'showMovements', label: 'Son Kişisel Hareketleriniz', desc: 'Son personel hareketleri geçmişini gösterir' },
                { key: 'showReminders', label: 'Duyurular', desc: 'Personele yapılan genel veya özel duyuruları gösterir' },
                { key: 'showWeeklyDayOff', label: 'Haftalık İzin Günü', desc: 'Personelin haftalık izin günü seçim ekranını gösterir' },
                { key: 'showCargoStatus', label: 'Koli Sevkiyat Takibi', desc: 'Koli ve sevkiyat bekleme/sayım durumlarını gösterir' },
                { key: 'showActiveBreaks', label: 'Molada Olanlar', desc: 'Şu an molada olan personellerin listesini gösterir' },
                { key: 'showShiftVisuals', label: 'Personel Ekranı Shift Görseli', desc: 'Vardiya veya çalışma planı görsel yayınlarını gösterir' },
                { key: 'showShiftSwaps', label: 'Vardiya Değişikliği (Takas)', desc: 'Personelin kendi vardiyasını başka personelle değiştirmesini sağlar' }
              ].map(f => {
                 const features = settings.employeeDashboardFeatures || defaultSettings.employeeDashboardFeatures!;
                 const isChecked = features[f.key as keyof typeof features] ?? true;
                 return (
                   <div key={f.key} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border">
                     <div>
                       <p className="font-medium text-foreground text-sm">{f.label}</p>
                       <p className="text-[11px] text-muted-foreground mt-0.5">{f.desc}</p>
                     </div>
                     <Switch 
                       checked={isChecked} 
                       onCheckedChange={() => handleFeatureToggle(f.key as any)} 
                       disabled={updateMutation.isPending}
                     />
                   </div>
                 )
              })}
            </div>
          </CardContent>
        </Card>

        {/* Shift Görselleri - Sol tarafta dikey olarak hizalı */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><ImagePlus className="w-5 h-5" /> <span>Personel Ekranı Shift / Çalışma Programı Görselleri</span></CardTitle>
            <CardDescription>Personel ana ekranında yayınlanacak haftalık vardiya/çalışma programı görselleri yükleyin.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <Input 
                  type="file" 
                  accept="image/*" 
                  onChange={handleImageUpload} 
                  className="max-w-md"
                  disabled={uploadingImage} 
                />
                {uploadingImage && <span className="text-sm text-muted-foreground animate-pulse">Yükleniyor...</span>}
              </div>
              
              <div className="flex flex-col gap-4 mt-4">
                {(settings.announcementImages || []).map((imgUrl, idx) => (
                  <div key={idx} className="relative group rounded-lg overflow-hidden border border-border/50 bg-black/5 flex items-center justify-center p-2 min-h-[150px]">
                     <img src={imgUrl} alt={`Duyuru ${idx+1}`} className="w-full h-auto object-contain rounded-md" />
                     <Button 
                       variant="destructive" 
                       size="icon" 
                       className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                       onClick={() => handleRemoveImage(imgUrl)}
                     >
                       <X className="w-4 h-4" />
                     </Button>
                  </div>
                ))}
                {(!settings.announcementImages || settings.announcementImages.length === 0) && (
                  <div className="w-full py-8 text-center text-muted-foreground bg-muted/20 border border-dashed rounded-lg">
                    Henüz görsel yüklenmemiş.
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="glass-card">
          <CardHeader>
            <CardTitle>Mola Ayarları</CardTitle>
            <CardDescription>Personelin tek seferde kullanabileceği maksimum mola süresi</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-4">
              <div className="flex-1">
                <Label htmlFor="break_limit">Toplam Mola Süresi (Dakika)</Label>
                <Input
                  id="break_limit"
                  type="number"
                  value={localLimit}
                  onChange={(e) => setLocalLimit(e.target.value)}
                  className="mt-1"
                />
              </div>
              <Button onClick={handleUpdateBreakLimit} disabled={updateMutation.isPending}>
                Kaydet
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* GEOFENCE CARD */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Smartphone className="w-5 h-5" /> Coğrafi Çit (Geofence) Ayarları
            </CardTitle>
            <CardDescription>
              Personelin mobil uygulama üzerinden işlem (Mola vb.) yapabilmesi için mağaza sınırları içerisinde olmasını zorunlu kılar. Sadece mesai saatleri içinde aktiftir.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-base">Coğrafi Çit Aktif Mi?</Label>
              <Switch 
                checked={geofenceActive} 
                onCheckedChange={(checked) => {
                  setGeofenceActive(checked);
                  updateMutation.mutate({ 
                    ...settings, 
                    geofence: { 
                      isActive: checked, 
                      lat: parseFloat(geofenceLat), 
                      lng: parseFloat(geofenceLng), 
                      radius: parseInt(geofenceRadiusStart) || 100,
                      radiusStart: parseInt(geofenceRadiusStart) || 100,
                      radiusEnd: parseInt(geofenceRadiusEnd) || 100
                    } 
                  }, {
                    onSuccess: () => toast.success('Coğrafi çit durumu güncellendi')
                  });
                }} 
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
              <div className="space-y-2">
                <Label>Mağaza Enlemi (Latitude)</Label>
                <Input type="number" step="any" value={geofenceLat} onChange={e => setGeofenceLat(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Mağaza Boylamı (Longitude)</Label>
                <Input type="number" step="any" value={geofenceLng} onChange={e => setGeofenceLng(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Molaya Çıkış Sınırı (Metre)</Label>
                <Input type="number" value={geofenceRadiusStart} onChange={e => setGeofenceRadiusStart(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Moladan Dönüş Sınırı (Metre)</Label>
                <Input type="number" value={geofenceRadiusEnd} onChange={e => setGeofenceRadiusEnd(e.target.value)} />
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <Button 
                onClick={() => {
                  if (navigator.geolocation) {
                    navigator.geolocation.getCurrentPosition(
                      (position) => {
                        setGeofenceLat(position.coords.latitude.toString());
                        setGeofenceLng(position.coords.longitude.toString());
                        toast.success("Mevcut konumunuz alındı. Kaydetmeyi unutmayın.");
                      },
                      (error) => toast.error("Konum alınamadı: " + error.message)
                    );
                  } else {
                    toast.error("Tarayıcınız konum servisini desteklemiyor.");
                  }
                }} 
                variant="outline"
                className="flex-1"
              >
                Şu Anki Konumumu Al
              </Button>
              <Button 
                onClick={() => {
                  updateMutation.mutate({ 
                    ...settings, 
                    geofence: { 
                      isActive: geofenceActive, 
                      lat: parseFloat(geofenceLat), 
                      lng: parseFloat(geofenceLng), 
                      radius: parseInt(geofenceRadiusStart) || 100,
                      radiusStart: parseInt(geofenceRadiusStart) || 100,
                      radiusEnd: parseInt(geofenceRadiusEnd) || 100
                    } 
                  }, {
                    onSuccess: () => toast.success('Coğrafi çit ayarları kaydedildi')
                  });
                }}
                disabled={updateMutation.isPending}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white"
              >
                Konum Ayarlarını Kaydet
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader>
            <CardTitle>Personel Giriş Sayfası Görseli (Vardiya Tablosu)</CardTitle>
            <CardDescription>
              Çıktı aldığınız veya hazırladığınız 2 haftalık tablo görsellerini yükleyerek personellerin giriş sayfasında (Login) görmesini sağlayabilirsiniz.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="pt-2">
                <Label htmlFor="login_image_upload" className="font-semibold block mb-2">Görsel Seç (.png, .jpg)</Label>
                <Input type="file" id="login_image_upload" accept="image/*" onChange={handleLoginImageUpload} disabled={uploadingImage} />
              </div>
              {settings.loginPageImage && (
                <div className="mt-4 relative rounded-md border p-2 bg-white">
                   <img src={settings.loginPageImage} alt="Giriş Sayfası Görseli" className="w-full h-auto max-h-[250px] object-contain" />
                   <Button variant="destructive" size="sm" className="absolute top-4 right-4" onClick={() => handleRemoveLoginImage()}>Kaldır</Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader>
            <CardTitle>Personel Hareket Türleri</CardTitle>
            <CardDescription>Sisteme eklenebilecek hareket seçeneklerini yönetin</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Kısa Kod (Örn: S)"
                value={newMovementCode}
                onChange={(e) => setNewMovementCode(e.target.value)}
                className="w-1/3"
                maxLength={50}
              />
              <Input
                placeholder="Tür Adı (Örn: Sabah Vardiya)"
                value={newMovementLabel}
                onChange={(e) => setNewMovementLabel(e.target.value)}
              />
              <Button onClick={addMovementType} disabled={updateMutation.isPending}><Plus className="w-4 h-4" /></Button>
            </div>
            <ul className="space-y-2">
              {settings.movementTypes.map((type: any, idx: number) => (
                <li key={idx} className="flex flex-col gap-2 bg-muted/50 p-3 rounded border">
                  {editingMovementIdx === idx ? (
                    <div className="flex gap-2 w-full">
                      <Input
                        value={editMovementCode}
                        onChange={(e) => setEditMovementCode(e.target.value)}
                        className="w-16 h-8 text-xs"
                      />
                      <Input
                        value={editMovementLabel}
                        onChange={(e) => setEditMovementLabel(e.target.value)}
                        className="flex-1 h-8 text-xs"
                      />
                      <Button variant="ghost" size="sm" onClick={() => saveEditMovement(idx)} disabled={updateMutation.isPending} className="text-green-600 hover:text-green-700 h-8 w-8 p-0">
                        <Check className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setEditingMovementIdx(null)} disabled={updateMutation.isPending} className="text-red-500 hover:text-red-700 h-8 w-8 p-0">
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex justify-between items-center">
                      <span><strong className="mr-2 px-2 py-0.5 bg-primary/10 text-primary rounded">{type.code}</strong> {type.label}</span>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="sm" onClick={() => startEditMovement(idx, type)} disabled={updateMutation.isPending} className="text-blue-500 hover:text-blue-700 h-8 w-8 p-0">
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => removeMovementType(type.code)} disabled={updateMutation.isPending} className="text-red-500 hover:text-red-700 h-8 w-8 p-0">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                  <div className="flex flex-col gap-2 mt-2 pt-2 border-t border-muted-foreground/20">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground whitespace-nowrap w-20">Eşleşme 1:</span>
                      <select
                        className="flex-1 text-xs px-2 py-1 bg-background border rounded"
                        value={type.mappedCode || 'none'}
                        onChange={(e) => updateMovementMapping(type.code, 'mappedCode', e.target.value)}
                        disabled={updateMutation.isPending}
                      >
                        <option value="none">Eşleştirme Yok</option>
                        {settings.movementTypes.filter((t: any) => t.code !== type.code).map((t: any) => (
                          <option key={t.code} value={t.code}>{t.code} ({t.label})</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground whitespace-nowrap w-20">Eşleşme 2:</span>
                      <select
                        className="flex-1 text-xs px-2 py-1 bg-background border rounded"
                        value={type.mappedCode2 || 'none'}
                        onChange={(e) => updateMovementMapping(type.code, 'mappedCode2', e.target.value)}
                        disabled={updateMutation.isPending}
                      >
                        <option value="none">Eşleştirme Yok</option>
                        {settings.movementTypes.filter((t: any) => t.code !== type.code).map((t: any) => (
                          <option key={t.code} value={t.code}>{t.code} ({t.label})</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground whitespace-nowrap w-20">Eşleşme 3:</span>
                      <select
                        className="flex-1 text-xs px-2 py-1 bg-background border rounded"
                        value={type.mappedCode3 || 'none'}
                        onChange={(e) => updateMovementMapping(type.code, 'mappedCode3', e.target.value)}
                        disabled={updateMutation.isPending}
                      >
                        <option value="none">Eşleştirme Yok</option>
                        {settings.movementTypes.filter((t: any) => t.code !== type.code).map((t: any) => (
                          <option key={t.code} value={t.code}>{t.code} ({t.label})</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader>
            <CardTitle>Mesai Türleri</CardTitle>
            <CardDescription>Sisteme eklenebilecek fazla mesai bildirim seçeneklerini yönetin</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Yeni tür ekle..."
                value={newOvertimeType}
                onChange={(e) => setNewOvertimeType(e.target.value)}
              />
              <Button onClick={addOvertimeType} disabled={updateMutation.isPending}><Plus className="w-4 h-4" /></Button>
            </div>
            <ul className="space-y-2">
              {settings.overtimeTypes.map((type, idx) => (
                <li key={idx} className="flex justify-between items-center bg-muted/50 p-2 rounded">
                  <span>{type}</span>
                  <Button variant="ghost" size="sm" onClick={() => removeOvertimeType(type)} disabled={updateMutation.isPending} className="text-red-500 hover:text-red-700">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader>
            <CardTitle>Resmi ve Dini Tatiller</CardTitle>
            <CardDescription>Part time personellerin vardiya yazılamayacağı günleri belirleyin</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                type="date"
                value={newHolidayDate}
                onChange={(e) => setNewHolidayDate(e.target.value)}
                className="w-1/3"
              />
              <Input
                placeholder="Tatil Adı (Örn: 1 Mayıs)"
                value={newHolidayName}
                onChange={(e) => setNewHolidayName(e.target.value)}
              />
              <Button onClick={() => {
                if (newHolidayDate && newHolidayName) addHolidayMutation.mutate({ date: newHolidayDate, name: newHolidayName });
              }} disabled={addHolidayMutation.isPending}><Plus className="w-4 h-4" /></Button>
            </div>
            <ul className="space-y-2">
              {holidays.map((h: any) => (
                <li key={h.id} className="flex justify-between items-center bg-muted/50 p-2 rounded">
                  <span><strong className="mr-2 text-red-600">{h.date}</strong> {h.name}</span>
                  <Button variant="ghost" size="sm" onClick={() => removeHolidayMutation.mutate(h.id)} disabled={removeHolidayMutation.isPending} className="text-red-500 hover:text-red-700">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </li>
              ))}
              {holidays.length === 0 && <li className="text-sm text-muted-foreground">Sistemde kayıtlı tatil yok.</li>}
            </ul>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader>
            <CardTitle>Duyuru / Görev Etiketleri (Anket Durumları)</CardTitle>
            <CardDescription>Personelin anketlerde veya görevlerde işaretleyebileceği durum seçenekleri ("Yapıldı", "Yapılmadı")</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Yeni durum etiketi ekle..."
                value={newTaskStatus}
                onChange={(e) => setNewTaskStatus(e.target.value)}
              />
              <Button onClick={addTaskStatus} disabled={updateMutation.isPending}><Plus className="w-4 h-4" /></Button>
            </div>
            <ul className="space-y-2">
              {(settings.taskStatuses || defaultSettings.taskStatuses!).map((type, idx) => (
                <li key={idx} className="flex justify-between items-center bg-muted/50 p-2 rounded">
                  <span>{type}</span>
                  <Button variant="ghost" size="sm" onClick={() => removeTaskStatus(type)} disabled={updateMutation.isPending} className="text-red-500 hover:text-red-700">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <BackupAndPurgeCard />
      </div>

    </div>
  );
};

export default SystemSettingsView;
