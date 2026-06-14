import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Settings, PlayCircle, FileText } from 'lucide-react';
import TaskSettingsTab from './TaskSettingsTab';
import TaskEngineTab from './TaskEngineTab';
import TaskReportsTab from './TaskReportsTab';

const TaskAutomation = () => {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center bg-card p-4 rounded-xl border">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2 text-primary">
            Görev Otomasyonu (Depo & Mutfak)
          </h2>
          <p className="text-muted-foreground text-sm mt-1">
            Depo ve Mutfak gibi günlük operasyonel görevlerin adil ve otomatik dağıtımı.
          </p>
        </div>
      </div>

      <Tabs defaultValue="settings" className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-4">
          <TabsTrigger value="settings" className="flex items-center gap-2"><Settings className="w-4 h-4"/> Ayarlar & Kapsam</TabsTrigger>
          <TabsTrigger value="engine" className="flex items-center gap-2"><PlayCircle className="w-4 h-4"/> Otomatik Dağıtım</TabsTrigger>
          <TabsTrigger value="reports" className="flex items-center gap-2"><FileText className="w-4 h-4"/> Raporlar</TabsTrigger>
        </TabsList>

        <TabsContent value="settings">
          <TaskSettingsTab />
        </TabsContent>

        <TabsContent value="engine">
          <TaskEngineTab />
        </TabsContent>

        <TabsContent value="reports">
          <TaskReportsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default TaskAutomation;
