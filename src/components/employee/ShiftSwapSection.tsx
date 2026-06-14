import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { RefreshCw, Check, X, Clock } from 'lucide-react';

interface ShiftSwapSectionProps {
  personnelId: string;
  deptCoworkers: any[];
}

export function ShiftSwapSection({ personnelId, deptCoworkers }: ShiftSwapSectionProps) {
  const [swapDate, setSwapDate] = useState('');
  const [targetPersonnelId, setTargetPersonnelId] = useState('');
  const [requesterShift, setRequesterShift] = useState('');
  const [targetShift, setTargetShift] = useState('');
  
  const [pendingSwaps, setPendingSwaps] = useState<any[]>([]);
  const [myRequests, setMyRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchShifts = async () => {
      if (!swapDate || !targetPersonnelId || !personnelId) {
        setRequesterShift('');
        setTargetShift('');
        return;
      }
      
      const { data: reqShift } = await supabase
        .from('shift_schedules')
        .select('shift_type')
        .eq('personnel_id', personnelId)
        .eq('shift_date', swapDate)
        .maybeSingle();
        
      const { data: tgtShift } = await supabase
        .from('shift_schedules')
        .select('shift_type')
        .eq('personnel_id', targetPersonnelId)
        .eq('shift_date', swapDate)
        .maybeSingle();

      setRequesterShift(reqShift?.shift_type || 'İzinli');
      setTargetShift(tgtShift?.shift_type || 'İzinli');
    };
    
    fetchShifts();
  }, [swapDate, targetPersonnelId, personnelId]);

  const fetchSwaps = async () => {
    if (!personnelId) return;
    
    // Fetch requests targeting me
    const { data: incoming } = await supabase
      .from('shift_swap_requests')
      .select('*, requester:requester_id(first_name, last_name)')
      .eq('target_personnel_id', personnelId)
      .in('status', ['pending_colleague', 'pending_manager']);
      
    if (incoming) setPendingSwaps(incoming);

    // Fetch requests made by me
    const { data: outgoing } = await supabase
      .from('shift_swap_requests')
      .select('*, target:target_personnel_id(first_name, last_name)')
      .eq('requester_id', personnelId)
      .order('created_at', { ascending: false })
      .limit(10);
      
    if (outgoing) setMyRequests(outgoing);
  };

  useEffect(() => {
    fetchSwaps();
  }, [personnelId]);

  const handleSubmit = async () => {
    if (!swapDate || !targetPersonnelId || !requesterShift || !targetShift) {
      toast.error('Lütfen tüm alanları doldurun');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.from('shift_swap_requests').insert({
        requester_id: personnelId,
        target_personnel_id: targetPersonnelId,
        swap_date: swapDate,
        requester_shift: requesterShift,
        target_shift: targetShift,
        status: 'pending_manager'
      });

      if (error) throw error;
      
      toast.success('Takas talebiniz doğrudan müdür onayına gönderildi.');
      setSwapDate('');
      setTargetPersonnelId('');
      setRequesterShift('');
      setTargetShift('');
      fetchSwaps();
    } catch (error: any) {
      console.error('Swap error:', error);
      toast.error('Talep gönderilirken hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (id: string, action: 'approved' | 'rejected') => {
    try {
      const newStatus = action === 'approved' ? 'pending_manager' : 'rejected';
      const { error } = await supabase
        .from('shift_swap_requests')
        .update({ status: newStatus })
        .eq('id', id);

      if (error) throw error;
      toast.success(action === 'approved' ? 'Takas kabul edildi, müdür onayına gönderildi.' : 'Takas reddedildi.');
      fetchSwaps();
    } catch (error) {
      toast.error('İşlem başarısız');
    }
  };

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'pending_colleague': return <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full font-medium">Arkadaş Onayı Bekliyor</span>;
      case 'pending_manager': return <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full font-medium">Müdür Onayı Bekliyor</span>;
      case 'approved': return <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full font-medium">Onaylandı</span>;
      case 'rejected': return <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded-full font-medium">Reddedildi</span>;
      default: return null;
    }
  };

  return (
    <div className="space-y-4 mt-6">
      <Card className="glass-card border-blue-200 shadow-sm overflow-hidden relative">
        <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-blue-800">
            <RefreshCw className="h-5 w-5" /> Vardiya Takas Talebi
          </CardTitle>
          <CardDescription>Aynı reyondaki çalışma arkadaşınızla vardiyanızı takas edin.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <div className="space-y-2">
              <Label>Tarih</Label>
              <Input type="date" value={swapDate} onChange={(e) => setSwapDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Takas Edilecek Personel</Label>
              <Select value={targetPersonnelId} onValueChange={setTargetPersonnelId}>
                <SelectTrigger>
                  <SelectValue placeholder="Personel Seçin" />
                </SelectTrigger>
                <SelectContent>
                  {deptCoworkers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.first_name} {c.last_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Benim Vardiyam</Label>
              <Input placeholder="Seçim yapıldığında otomatik gelir" value={requesterShift} readOnly className="bg-muted/50" />
            </div>
            <div className="space-y-2">
              <Label>Alacağım Vardiya</Label>
              <Input placeholder="Seçim yapıldığında otomatik gelir" value={targetShift} readOnly className="bg-muted/50" />
            </div>
          </div>
          <Button onClick={handleSubmit} disabled={loading || !swapDate || !targetPersonnelId} className="w-full bg-blue-600 hover:bg-blue-700">
            Değişim Yap
          </Button>
        </CardContent>
      </Card>

      {/* Gelen Teklifler */}
      {pendingSwaps.length > 0 && (
        <Card className="glass-card border-amber-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold flex items-center gap-2">Gelen Takas Teklifleri</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {pendingSwaps.map(swap => (
                <div key={swap.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-amber-50 rounded-lg border border-amber-100">
                  <div className="mb-2 sm:mb-0">
                    <p className="text-sm font-semibold">{swap.requester?.first_name} {swap.requester?.last_name} sizinle takas yapmak istiyor.</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      <span className="font-medium text-black">Tarih:</span> {new Date(swap.swap_date).toLocaleDateString('tr-TR')} | 
                      <span className="font-medium text-black ml-2">Size Önerilen:</span> {swap.requester_shift} | 
                      <span className="font-medium text-black ml-2">Sizin Mevcut:</span> {swap.target_shift}
                    </p>
                  </div>
                  {swap.status === 'pending_colleague' ? (
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" className="text-green-600 border-green-200 hover:bg-green-50" onClick={() => handleAction(swap.id, 'approved')}>
                        <Check className="h-4 w-4 mr-1" /> Kabul Et
                      </Button>
                      <Button size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50" onClick={() => handleAction(swap.id, 'rejected')}>
                        <X className="h-4 w-4 mr-1" /> Reddet
                      </Button>
                    </div>
                  ) : (
                    getStatusBadge(swap.status)
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Gönderdiğim Teklifler */}
      {myRequests.length > 0 && (
        <Card className="glass-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold flex items-center gap-2 text-muted-foreground"><Clock className="h-4 w-4"/> Gönderdiğim Talepler</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {myRequests.map(swap => (
                <div key={swap.id} className="flex justify-between items-center p-2 text-sm border-b last:border-0">
                  <div>
                    <span className="font-medium">{swap.target?.first_name} {swap.target?.last_name}</span> - {new Date(swap.swap_date).toLocaleDateString('tr-TR')}
                  </div>
                  {getStatusBadge(swap.status)}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
