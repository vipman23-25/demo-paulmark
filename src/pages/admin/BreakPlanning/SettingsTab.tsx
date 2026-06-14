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
  const [selectedDepts, setSelectedDepts] = useState<string[]>([]);

  // Rules State
  const [newRuleSlot, setNewRuleSlot] = useState('');
  const [newRuleShifts, setNewRuleShifts] = useState('');
  const [newRuleDayType, setNewRuleDayType] = useState('weekday');

  const { data: departments = [] } = useQuery({
    queryKey: ['unique_departments_break_planning'],
    queryFn: async () => {
      const { data } = await supabase.from('personnel').select('department').eq('is_active', true);
      if (!data) return [];
      const depts = new Set(data.map(d => d.department?.trim()).filter(Boolean));
      return Array.from(depts).sort() as string[];
    }
  });

  const addSlot = () => {
    if (!newSlot) return;
    const updated = { ...settings, slots: [...(settings.slots || []), { id: Date.now().toString(), timeRange: newSlot }] };
    setSettings(updated);
    handleSave(updated);
    setNewSlot('');
  };

  const toggleDeptSelection = (dept: string) => {
    setSelectedDepts(prev => prev.includes(dept) ? prev.filter(d => d !== dept) : [...prev, dept]);
  };

  const addDept = () => {
    if (!newDeptName || selectedDepts.length === 0) return;
    const updated = {
      ...settings,
      departmentGroups: [
        ...(settings.departmentGroups || []), 
        { 
          id: Date.now().toString(), 
          name: newDeptName, 
          criticalLimitWeekday: parseInt(newDeptCritWeekday) || 1, 
          criticalLimitWeekend: parseInt(newDeptCritWeekend) || 1, 
          includedDepartments: selectedDepts 
        }
      ]
    };
    setSettings(updated);
    handleSave(updated);
    setNewDeptName('');
    setSelectedDepts([]);
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
              <Label>Dahil Edilecek Reyonları Seçin</Label>
              {departments.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sistemde kayıtlı reyon bulunamadı.</p>
              ) : (
                <div className="flex flex-wrap gap-4 mt-2 p-4 border rounded-md bg-background">
                  {departments.map((dept) => (
                    <div key={dept} className="flex items-center space-x-2">
                      <Checkbox 
                        id={`dept-${dept}`} 
                        checked={selectedDepts.includes(dept)} 
                        onCheckedChange={() => toggleDeptSelection(dept)} 
                      />
                      <label htmlFor={`dept-${dept}`} className="text-sm font-medium leading-none cursor-pointer">
                        {dept}
                      </label>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Button onClick={addDept} className="w-full mt-4" disabled={!newDeptName || selectedDepts.length === 0}>
              <Plus className="w-4 h-4 mr-2" /> Grubu Ekle
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
                    Reyonlar: <span className="font-medium">{g.includedDepartments?.join(', ')}</span>
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
