import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trash2, Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export const SettingsTab = ({ settings, setSettings, handleSave, isSaving }: any) => {
  const [newSlot, setNewSlot] = useState('');
  const [newDeptName, setNewDeptName] = useState('');
  const [newDeptCrit, setNewDeptCrit] = useState('1');
  const [newDeptIncluded, setNewDeptIncluded] = useState('');
  const [newRuleSlot, setNewRuleSlot] = useState('');
  const [newRuleShifts, setNewRuleShifts] = useState('');
  const [newRuleDayType, setNewRuleDayType] = useState('weekday');

  const addSlot = () => {
    if (!newSlot) return;
    setSettings({ ...settings, slots: [...(settings.slots || []), { id: Date.now().toString(), timeRange: newSlot }] });
    setNewSlot('');
  };

  const addDept = () => {
    if (!newDeptName || !newDeptIncluded) return;
    const depts = newDeptIncluded.split(',').map(s => s.trim()).filter(Boolean);
    setSettings({
      ...settings,
      departmentGroups: [...(settings.departmentGroups || []), { id: Date.now().toString(), name: newDeptName, criticalLimit: parseInt(newDeptCrit) || 1, includedDepartments: depts }]
    });
    setNewDeptName('');
    setNewDeptIncluded('');
  };

  const addRule = () => {
    if (!newRuleSlot || !newRuleShifts) return;
    const shifts = newRuleShifts.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
    setSettings({
      ...settings,
      rules: [...(settings.rules || []), { id: Date.now().toString(), slotId: newRuleSlot, targetShifts: shifts, dayType: newRuleDayType }]
    });
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
                <Trash2 className="w-3 h-3 cursor-pointer hover:text-red-500" onClick={() => setSettings({ ...settings, slots: settings.slots.filter((x: any) => x.id !== s.id) })} />
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>2. Reyon Grupları ve Kritik Sınırlar</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-2 mb-4">
            <Input placeholder="Grup Adı (Örn: Giriş Kat)" value={newDeptName} onChange={e => setNewDeptName(e.target.value)} />
            <Input placeholder="Dahil Reyonlar (Virgülle ayırın: ERKEK, KADIN)" className="md:col-span-2" value={newDeptIncluded} onChange={e => setNewDeptIncluded(e.target.value)} />
            <div className="flex gap-2">
              <Input type="number" placeholder="Kritik Limit" value={newDeptCrit} onChange={e => setNewDeptCrit(e.target.value)} />
              <Button onClick={addDept}><Plus className="w-4 h-4" /></Button>
            </div>
          </div>
          <div className="space-y-2">
            {(settings.departmentGroups || []).map((g: any) => (
              <div key={g.id} className="flex justify-between items-center p-3 border rounded">
                <div>
                  <p className="font-semibold">{g.name} <span className="text-muted-foreground text-xs font-normal ml-2">(Minimum {g.criticalLimit} Kişi Kalmalı)</span></p>
                  <p className="text-xs text-muted-foreground">{g.includedDepartments.join(', ')}</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setSettings({ ...settings, departmentGroups: settings.departmentGroups.filter((x: any) => x.id !== g.id) })}><Trash2 className="w-4 h-4 text-red-500" /></Button>
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
                  <Button variant="ghost" size="sm" onClick={() => setSettings({ ...settings, rules: settings.rules.filter((x: any) => x.id !== r.id) })}><Trash2 className="w-4 h-4 text-red-500" /></Button>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={isSaving} className="w-full">
        {isSaving ? 'Kaydediliyor...' : 'Tüm Ayarları Kaydet'}
      </Button>
    </div>
  );
};
