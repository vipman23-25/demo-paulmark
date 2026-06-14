import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Settings, PlayCircle, FileBarChart2 } from 'lucide-react';
import ShiftSettingsTab from './ShiftManagement/ShiftSettingsTab';
import ShiftEngineTab from './ShiftManagement/ShiftEngineTab';
import ShiftReportsTab from './ShiftManagement/ShiftReportsTab';

const ShiftManagement = () => {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center print:hidden">
        <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
          Vardiya Yönetimi Sistemi
        </h2>
      </div>

      <Tabs defaultValue="engine" className="w-full">
        <TabsList className="mb-4 print:hidden">
          <TabsTrigger value="engine" className="flex items-center gap-2"><PlayCircle className="w-4 h-4"/> Vardiya Tablosu (Motor)</TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-2"><Settings className="w-4 h-4"/> Kurallar & Ayarlar</TabsTrigger>
          <TabsTrigger value="reports" className="flex items-center gap-2"><FileBarChart2 className="w-4 h-4"/> Raporlar</TabsTrigger>
        </TabsList>

        <TabsContent value="engine">
          <ShiftEngineTab />
        </TabsContent>

        <TabsContent value="settings">
          <ShiftSettingsTab />
        </TabsContent>

        <TabsContent value="reports">
          <ShiftReportsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ShiftManagement;
