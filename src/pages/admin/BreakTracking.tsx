import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Clock, AlertTriangle, Trash2, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import BreakPlanning from './BreakPlanning';

const BreakTracking = () => {
  const queryClient = useQueryClient();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [filter, setFilter] = useState<'all' | 'weekly' | 'monthly'>('all');
  const [, setTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel('breaktracking_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'break_records' }, () => {
        queryClient.invalidateQueries({ queryKey: ['breaks'] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Fetch breaks with personnel data joined
  const { data: breaksData, isLoading, refetch } = useQuery({
    queryKey: ['breaks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('break_records')
        .select(`
          *,
          personnel (
            first_name,
            last_name,
            department
          )
        `)
        .order('break_start', { ascending: false })
        .limit(200);

      if (error) {
        toast.error('Mola verileri yüklenemedi: ' + error.message);
        throw error;
      }
      return data;
    }
  });

  // Fetch settings for break limits
  const { data: breakLimit = 60 } = useQuery({
    queryKey: ['system_settings_break_limit'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('system_settings' as any)
        .select('setting_value')
        .eq('setting_key', 'general')
        .single();
      
      if (!error && data?.setting_value?.breakLimitMinutes) {
        return Number(data.setting_value.breakLimitMinutes);
      }
      return 60;
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('break_records').delete().eq('id', id);
      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['breaks'] });
    },
    onError: (error: any) => {
      toast.error('Silme başarısız: ' + error.message);
    }
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from('break_records').delete().in('id', ids);
      if (error) throw error;
      return ids;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['breaks'] });
      toast.success(`${data.length} kayıt silindi`);
      setSelectedIds([]);
    },
    onError: (error: any) => {
      toast.error('Toplu silme başarısız: ' + error.message);
    }
  });

  const getDuration = (start: string, end: string | null) => {
    const s = new Date(start);
    const e = end ? new Date(end) : new Date();
    const diff = Math.round((e.getTime() - s.getTime()) / (1000 * 60));
    return diff;
  };

  const filteredBreaks = (breaksData || []).filter(b => {
    if (filter === 'all') return true;
    const date = new Date(b.break_start);
    const now = new Date();
    if (filter === 'weekly') return date >= new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    if (filter === 'monthly') return date >= new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    return true;
  });

  const toggleSelection = (id: string) => {
    setSelectedIds(p => p.includes(id) ? p.filter(i => i !== id) : [...p, id]);
  };

  const handleBulkDelete = () => {
    if (selectedIds.length === 0) return;
    if (confirm(`${selectedIds.length} adet kaydı silmek istediğinize emin misiniz?`)) {
      bulkDeleteMutation.mutate(selectedIds);
    }
  };

  const handleDeleteBreak = (id: string) => {
    if (confirm('Bu molayı silmek istediğinizden emin misiniz?')) {
      deleteMutation.mutate(id, {
        onSuccess: () => toast.success('Mola kaydı silindi')
      });
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Clock className="h-6 w-6" /> Mola Takibi ve Planlama
        </h2>
      </div>

      <Tabs defaultValue="tracking" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="tracking">Gerçek Zamanlı Takip</TabsTrigger>
          <TabsTrigger value="planning">Akıllı Planlama</TabsTrigger>
        </TabsList>

        <TabsContent value="tracking" className="space-y-6 mt-0">
          <div className="flex justify-between items-center flex-wrap gap-4 mb-4">
            <div></div>
            <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => refetch()} title="Yenile">
            <RefreshCw className="h-4 w-4" />
          </Button>
          {selectedIds.length > 0 && (
            <Button variant="destructive" onClick={handleBulkDelete} disabled={bulkDeleteMutation.isPending}>
              <Trash2 className="w-4 h-4 mr-2" /> Toplu Sil ({selectedIds.length})
            </Button>
          )}
          <Select value={filter} onValueChange={(v: any) => setFilter(v)}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Filtrele" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tümü</SelectItem>
              <SelectItem value="weekly">Bu Hafta</SelectItem>
              <SelectItem value="monthly">Bu Ay</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card className="glass-card">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox 
                      checked={filteredBreaks.length > 0 && selectedIds.length === filteredBreaks.length}
                      onCheckedChange={(c) => setSelectedIds(c ? filteredBreaks.map(b => b.id) : [])}
                    />
                  </TableHead>
                  <TableHead>Personel</TableHead>
                  <TableHead>Departman</TableHead>
                  <TableHead>Mola Başlangıcı</TableHead>
                  <TableHead>Mola Bitişi</TableHead>
                  <TableHead>Süre (dk)</TableHead>
                  <TableHead>Durum</TableHead>
                  <TableHead>İşlem</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground animate-pulse">
                      Mola kayıtları yükleniyor...
                    </TableCell>
                  </TableRow>
                ) : filteredBreaks.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      Kayıt bulunamadı
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredBreaks.map((b: any) => {
                    const duration = getDuration(b.break_start, b.break_end);
                    const isLate = duration > breakLimit;
                    const isOngoing = !b.break_end;
                    
                    return (
                      <TableRow key={b.id} className={isLate ? 'bg-destructive/5' : ''}>
                        <TableCell>
                          <Checkbox checked={selectedIds.includes(b.id)} onCheckedChange={() => toggleSelection(b.id)} />
                        </TableCell>
                        <TableCell className="font-medium">
                          {b.personnel ? `${b.personnel.first_name} ${b.personnel.last_name}` : 'Bilinmeyen'}
                        </TableCell>
                        <TableCell>{b.personnel?.department || '-'}</TableCell>
                        <TableCell>
                          {format(new Date(b.break_start), 'dd.MM.yyyy HH:mm', { locale: tr })}
                        </TableCell>
                        <TableCell>
                          {b.break_end
                            ? format(new Date(b.break_end), 'dd.MM.yyyy HH:mm', { locale: tr })
                            : '-'}
                        </TableCell>
                        <TableCell className={isLate ? 'text-destructive font-bold' : ''}>
                          {duration} dk
                          {isLate && <span className="ml-1 text-xs opacity-80">(+{duration - breakLimit} dk)</span>}
                        </TableCell>
                        <TableCell>
                          {isOngoing ? (
                            <Badge variant="secondary" className="bg-warning/20 text-warning">
                              <AlertTriangle className="w-3 h-3 mr-1" /> Molada
                            </Badge>
                          ) : isLate ? (
                            <Badge variant="destructive">Gecikmeli</Badge>
                          ) : (
                            <Badge variant="default">Tamamlandı</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" onClick={() => handleDeleteBreak(b.id)} disabled={deleteMutation.isPending}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      </TabsContent>

      <TabsContent value="planning" className="mt-0">
        <BreakPlanning />
      </TabsContent>
      </Tabs>
    </div>
  );
};

export default BreakTracking;
