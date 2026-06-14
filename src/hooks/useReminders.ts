import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

const alertedReminderIds = new Set<string>();

export const useReminders = () => {
  const { user, isAdmin } = useAuth();
  
  useEffect(() => {
    if (!user || !isAdmin) return;

    const checkReminders = async () => {
      try {
        const { data: reminders, error } = await supabase
          .from('reminders')
          .select('*')
          .eq('is_active', true);
          
        if (error || !reminders) return;

        for (const r of reminders) {
          const reminderDate = new Date(r.reminder_date).setHours(0, 0, 0, 0);
          const today = new Date().setHours(0, 0, 0, 0);
          
          if (reminderDate < today && (!r.recurrence || r.recurrence === 'none')) {
            // ARTIK SİLİNMİYOR: Kullanıcı "kalıcı olsun" dediği için tutuyoruz.
            continue;
          }
          
          if (reminderDate === today && !alertedReminderIds.has(r.id)) {
            toast.info(`⏰ Günlük Hatırlatma: ${r.title}`, {
              description: r.description || undefined,
              duration: 10000,
            });
            alertedReminderIds.add(r.id);
          }
        }
      } catch (e) {
        console.error('Error checking reminders:', e);
      }
    };

    checkReminders();
    const interval = setInterval(checkReminders, 60000);
    
    return () => clearInterval(interval);
  }, [user, isAdmin]);
};
