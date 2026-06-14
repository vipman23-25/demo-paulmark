import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trash2, Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';

export const SettingsTab = ({ settings, setSettings, handleSave, isSaving }: any) => {
  const [newSlot, setNewSlot] = useState('');
  
  // Department Group State
  const [newDeptName, setNewDeptName] = useState('');
  const [newDeptCritWeekday, setNewDeptCritWeekday] = useState('1');
  const [newDeptCritWeekend, setNewDeptCritWeekend] = useState('1');
  const [selectedPersonnelIds, setSelectedPersonnelIds] = useState<string[]>([]);

  // Rules State
  const [newRuleSlot, setNewRuleSlot] = useState('');
  const [newRuleShifts, setNewRuleShifts] = useState('');
  const [newRuleDayType, setNewRuleDayType] = useState('weekday');

  const { data: personnelData = [], isLoading: isLoadingPersonnel } = useQuery({
    queryKey: ['personnel_for_break_planning'],
    queryFn: async () => {
      const { data } = await supabase.from('personnel').select('id, first_name, last_name, department').eq('is_active', true);
      return data || [];
    }
  });

  // Group personnel by department
  const groupedPersonnel = personnelData.reduce((acc: any, p: any) => {
    const dept = p.department?.trim() || 'Diğer';
    if (!acc[dept]) acc[dept] = [];
    acc[dept].push(p);
    return acc;
  }, {});
  const sortedDepartments = Object.keys(groupedPersonnel).sort();

  const addSlot = () => {
    if (!newSlot) return;
    const updated = { ...settings, slots: [...(settings.slots || []), { id: Date.now().toString(), timeRange: newSlot }] };
    setSettings(updated);
    handleSave(updated);
    setNewSlot('');
  };

  const togglePersonnelSelection = (id: string) => {
    setSelectedPersonnelIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const toggleDepartmentSelection = (dept: string, selectAll: boolean) => {
    const deptPersonnelIds = groupedPersonnel[dept].map((p: any) => p.id);
    if (selectAll) {
      setSelectedPersonnelIds(prev => Array.from(new Set([...prev, ...deptPersonnelIds])));
    } else {
      setSelectedPersonnelIds(prev => prev.filter(id => !deptPersonnelIds.includes(id)));
    }
  };

  const addDept = () => {
    if (!newDeptName || selectedPersonnelIds.length === 0) return;
    const updated = {
      ...settings,
      departmentGroups: [
        ...(settings.departmentGroups || []), 
        { 
          id: Date.now().toString(), 
          name: newDeptName, 
          criticalLimitWeekday: parseInt(newDeptCritWeekday) || 1, 
          criticalLimitWeekend: parseInt(newDeptCritWeekend) || 1, 
          includedPersonnelIds: selectedPersonnelIds 
        }
      ]
    };
    setSettings(updated);
    handleSave(updated);
    setNewDeptName('');
    setSelectedPersonnelIds([]);
    setNewDeptCritWeekday('1');
    setNewDeptCritWeekend('1');
  };

  const addRule = () => {
    if (!newRuleSlot || !newRuleShifts) return;
    const shifts = newRuleShifts.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
    const updated = {
      ...settings,
      rules: [...(settings.rules || []), { id: Date.now().toString(), slotId: newRuleSlot, targetShifts: shifts, dayType: newRuleDayType }]
    };
    setSettings(updated);
    handleSave(updated);
    setNewRuleShifts('');
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>1. Mola Slotları</CardTitle></CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-4">
            <Input placeholder="Örn: 13:30 - 14:00" value={newSlot} onChange={e => setNewSlot(e.target.value)} />
            <Button onClick={addSlot}><Plus className="w-4 h-4 mr-1" /> Ekle</Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {(settings.slots || []).map((s: any) => (
              <Badge key={s.id} variant="secondary" className="px-3 py-1 flex items-center gap-2 text-sm">
                {s.timeRange}
                <Trash2 className="w-3 h-3 cursor-pointer hover:text-red-500" onClick={() => {
                  const updated = { ...settings, slots: settings.slots.filter((x: any) => x.id !== s.id) };
                  setSettings(updated);
                  handleSave(updated);
                }} />
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>2. Reyon Grupları ve Kritik Sınırlar</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-4 mb-6 p-4 border rounded-md bg-muted/20">
            <h4 className="font-medium text-sm">Yeni Grup Oluştur</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Grup Adı</Label>
                <Input placeholder="Örn: Giriş Kat" value={newDeptName} onChange={e => setNewDeptName(e.target.value)} />
              </div>
              <div className="flex gap-4">
                <div className="space-y-2 flex-1">
                  <Label>Hafta İçi Kritik Sınır</Label>
                  <Input type="number" min="0" value={newDeptCritWeekday} onChange={e => setNewDeptCritWeekday(e.target.value)} />
                </div>
                <div className="space-y-2 flex-1">
                  <Label>Hafta Sonu Kritik Sınır</Label>
                  <Input type="number" min="0" value={newDeptCritWeekend} onChange={e => setNewDeptCritWeekend(e.target.value)} />
                </div>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>Dahil Edilecek Personelleri / Reyonları Seçin</Label>
              {isLoadingPersonnel ? (
                <p className="text-sm text-muted-foreground">Personeller yükleniyor...</p>
              ) : sortedDepartments.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sistemde aktif personel bulunamadı.</p>
              ) : (
                <div className="max-h-[300px] overflow-y-auto border rounded-md p-4 bg-background space-y-6">
                  {sortedDepartments.map((dept) => {
                    const deptPersonnel = groupedPersonnel[dept];
                    const deptPersonnelIds = deptPersonnel.map((p: any) => p.id);
                    const allSelected = deptPersonnelIds.every((id: string) => selectedPersonnelIds.includes(id));
                    const someSelected = deptPersonnelIds.some((id: string) => selectedPersonnelIds.includes(id));
                    
                    return (
                      <div key={dept} className="space-y-2 border-b pb-4 last:border-0 last:pb-0">
                        <div className="flex items-center space-x-2 bg-muted/50 p-2 rounded-md">
                          <Checkbox 
                            id={`dept-${dept}`} 
                            checked={allSelected} 
                            onCheckedChange={(checked) => toggleDepartmentSelection(dept, checked === true)} 
                          />
                          <label htmlFor={`dept-${dept}`} className="text-sm font-bold leading-none cursor-pointer flex-1">
                            {dept} Reyonu Tümünü Seç ({deptPersonnel.length} Kişi)
                          </label>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 pl-6">
                          {deptPersonnel.map((p: any) => (
                            <div key={p.id} className="flex items-center space-x-2">
                              <Checkbox 
                                id={`personnel-${p.id}`} 
                                checked={selectedPersonnelIds.includes(p.id)} 
                                onCheckedChange={() => togglePersonnelSelection(p.id)} 
                              />
                              <label htmlFor={`personnel-${p.id}`} className="text-sm leading-none cursor-pointer">
                                {p.first_name} {p.last_name}
                              </label>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <Button onClick={addDept} className="w-full mt-4" disabled={!newDeptName || selectedPersonnelIds.length === 0}>
              <Plus className="w-4 h-4 mr-2" /> Grubu Ekle ({selectedPersonnelIds.length} Kişi Seçildi)
            </Button>
          </div>

          <div className="space-y-2">
            <h4 className="font-medium text-sm mb-2">Kayıtlı Gruplar</h4>
            {(settings.departmentGroups || []).length === 0 && <p className="text-sm text-muted-foreground">Henüz kayıtlı grup yok.</p>}
            {(settings.departmentGroups || []).map((g: any) => (
              <div key={g.id} className="flex justify-between items-center p-3 border rounded">
                <div>
                  <p className="font-semibold">{g.name}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {g.includedPersonnelIds ? `${g.includedPersonnelIds.length} Personel Tanımlı` : `Reyonlar: ${g.includedDepartments?.join(', ')}`}
                  </p>
                  <p className="text-xs text-blue-600 mt-1 font-medium">
                    Kritik Sınır: Hafta İçi ({g.criticalLimitWeekday ?? g.criticalLimit ?? 1}), Hafta Sonu ({g.criticalLimitWeekend ?? g.criticalLimit ?? 1})
                  </p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => {
                  const updated = { ...settings, departmentGroups: settings.departmentGroups.filter((x: any) => x.id !== g.id) };
                  setSettings(updated);
                  handleSave(updated);
                }}><Trash2 className="w-4 h-4 text-red-500" /></Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>3. Dağıtım Kuralları</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-2 mb-4">
            <Select value={newRuleSlot} onValueChange={setNewRuleSlot}>
              <SelectTrigger><SelectValue placeholder="Slot Seçin" /></SelectTrigger>
              <SelectContent>
                {(settings.slots || []).map((s: any) => <SelectItem key={s.id} value={s.id}>{s.timeRange}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input placeholder="Vardiya Tipleri (Örn: S, SABAH)" className="md:col-span-2" value={newRuleShifts} onChange={e => setNewRuleShifts(e.target.value)} />
            <div className="flex gap-2">
              <Select value={newRuleDayType} onValueChange={setNewRuleDayType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekday">Hafta İçi</SelectItem>
                  <SelectItem value="weekend">Hafta Sonu</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={addRule}><Plus className="w-4 h-4" /></Button>
            </div>
          </div>
          <div className="space-y-2">
            {(settings.rules || []).map((r: any) => {
              const slotStr = settings.slots?.find((s: any) => s.id === r.slotId)?.timeRange || 'Bilinmeyen Slot';
              return (
                <div key={r.id} className="flex justify-between items-center p-3 border rounded">
                  <div>
                    <Badge variant="outline" className="mr-2">{r.dayType === 'weekday' ? 'Hafta İçi' : 'Hafta Sonu'}</Badge>
                    <span className="font-semibold">{slotStr}</span> ➔ Vardiya: {r.targetShifts.join(', ')}
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => {
                    const updated = { ...settings, rules: settings.rules.filter((x: any) => x.id !== r.id) };
                    setSettings(updated);
                    handleSave(updated);
                  }}><Trash2 className="w-4 h-4 text-red-500" /></Button>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
