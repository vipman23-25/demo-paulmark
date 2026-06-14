import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const now = new Date();
    
    // Türkiye saati UTC+3 sabittir (Yaz saati uygulaması yok)
    const istanbulOffsetMs = 3 * 60 * 60 * 1000;
    const trDate = new Date(now.getTime() + istanbulOffsetMs);
    
    const y = trDate.getUTCFullYear();
    const m = String(trDate.getUTCMonth() + 1).padStart(2, '0');
    const d = String(trDate.getUTCDate()).padStart(2, '0');
    const h = String(trDate.getUTCHours()).padStart(2, '0');
    const min = String(trDate.getUTCMinutes()).padStart(2, '0');
    
    const currentDateStr = `${y}-${m}-${d}`;
    const currentTimeStr = `${h}:${min}`;
    
    // Day of week in TR: 0=Sun, 1=Mon... 6=Sat
    const currentDayOfWeek = String(trDate.getUTCDay());
    const currentDayOfMonth = trDate.getUTCDate();

    // Hedef saati şu anki saate eşit olan AKTİF duyuruları getir
    const { data: allReminders, error } = await supabaseClient
      .from('reminders')
      .select('*')
      .eq('is_active', true)
      .eq('target_time', currentTimeStr);

    if (error) throw error;
    if (!allReminders || allReminders.length === 0) {
      return new Response(JSON.stringify({ message: 'No scheduled reminders for ' + currentTimeStr }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }
    
    // Gelişmiş Filtreleme (Cron Mantığı)
    const remindersToProcess = allReminders.filter(reminder => {
      // 1. Tek Seferlik (none)
      if (reminder.recurrence === 'none') {
        if (!reminder.target_date) return true; // Eski veriler için tarih yoksa her gün çalışır (fallback)
        return reminder.target_date === currentDateStr;
      }
      
      // 2. Her Gün (daily)
      if (reminder.recurrence === 'daily') {
        return true;
      }
      
      // 3. Haftalık (weekly)
      if (reminder.recurrence === 'weekly') {
        if (!reminder.target_day_of_week) return true; // Fallback
        const allowedDays = reminder.target_day_of_week.split(',');
        return allowedDays.includes(currentDayOfWeek);
      }
      
      // 4. Aylık (monthly)
      if (reminder.recurrence === 'monthly') {
        if (!reminder.target_day_of_month) return true; // Fallback
        return reminder.target_day_of_month === currentDayOfMonth;
      }
      
      return false;
    });

    if (remindersToProcess.length === 0) {
      return new Response(JSON.stringify({ message: 'Reminders found for this time but dates do not match.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    // Her biri için send-push fonksiyonunu tetikle
    const promises = remindersToProcess.map(async (reminder) => {
      const payload = {
         personnel_id: reminder.personnel_id,
         department_name: reminder.department_name,
         title: reminder.title,
         body: reminder.description,
         custom_filters: {
           target_gender: reminder.target_gender,
           target_employment_type: reminder.target_employment_type
         }
      };

      const { data, error: invokeErr } = await supabaseClient.functions.invoke('send-push', {
        body: payload
      });
      
      if (invokeErr) {
         console.error('Failed to send push for reminder', reminder.id, invokeErr);
      } else if (reminder.recurrence === 'none') {
         // Başarıyla gönderilen tek seferlik bildirimleri devre dışı bırak
         await supabaseClient
           .from('reminders')
           .update({ is_active: false })
           .eq('id', reminder.id);
      }
      return data;
    });

    await Promise.all(promises);

    return new Response(JSON.stringify({ success: true, processed: remindersToProcess.length, time: currentTimeStr }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
