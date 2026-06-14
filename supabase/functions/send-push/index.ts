import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import webpush from "npm:web-push@3.6.7"
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

    const payload = await req.json()
    // Payload can have `personnel_id`, `department_name`, `title`, `body`, `url`, etc.
    const { personnel_id, department_name, title, body, url, is_all, custom_filters, send_to_telegram, send_to_telegram_group } = payload

    // Generate VAPID details
    const vapidPublic = Deno.env.get('VAPID_PUBLIC_KEY')
    const vapidPrivate = Deno.env.get('VAPID_PRIVATE_KEY')
    
    // Fetch system settings for Telegram configuration
    const { data: settingsData } = await supabaseClient
      .from('system_settings')
      .select('setting_value')
      .eq('setting_key', 'notification_settings')
      .maybeSingle()

    const sysSettings = settingsData?.setting_value || {}
    const telegramBotToken = sysSettings.telegram_bot_token || Deno.env.get('TELEGRAM_BOT_TOKEN')
    const telegramGroupChatId = sysSettings.telegram_group_chat_id

    // Kural: Eğer global ayarlardan açık seçildiyse (veya ayarlanmadıysa = true), HER TÜRLÜ gönder.
    // Artık duyuru/payload içindeki eski ayarı tamamen yoksayıyoruz, tek patron Bildirim Ayarları sekmesi.
    let final_send_to_telegram = sysSettings.telegram_reminders_dm ?? true;
    let final_send_to_telegram_group = sysSettings.telegram_reminders_group ?? true;
    let final_send_web_push = true;

    if (payload.force_push_only) {
        final_send_to_telegram = false;
        final_send_to_telegram_group = false;
    }
    if (payload.force_telegram_only) {
        final_send_web_push = false;
    }

    let query = supabaseClient.from('personnel').select('*, push_subscriptions(*)')

    // Base target filtering
    if (personnel_id) {
      query = query.eq('id', personnel_id)
    } else if (department_name && department_name !== 'Tümü' && department_name !== 'Müdür Hariç Tümü') {
      query = query.eq('department', department_name)
    }

    const { data: personnelList, error } = await query
    
    if (error) throw error

    if (!personnelList || personnelList.length === 0) {
      return new Response(JSON.stringify({ message: "No personnel found", sent: 0, telegram_sent: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    let targets = personnelList

    if (department_name === 'Müdür Hariç Tümü') {
      targets = targets.filter((p: any) => !(p.department || '').toLowerCase().includes('müdür'))
    }

    // Advanced filtering
    if (custom_filters) {
      if (custom_filters.target_gender && custom_filters.target_gender !== 'none') {
        targets = targets.filter((p: any) => p.gender === custom_filters.target_gender)
      }
      if (custom_filters.target_employment_type && custom_filters.target_employment_type !== 'none') {
        targets = targets.filter((p: any) => p.employment_type === custom_filters.target_employment_type)
      }
    }

    const pushPayload = JSON.stringify({
      title: title || 'Yeni Bildirim',
      body: body || '',
      url: url || '/'
    })

    let webPushSuccessCount = 0
    let webPushFailureCount = 0
    let telegramSuccessCount = 0
    let telegramFailureCount = 0

    const pushPromises: Promise<any>[] = []

    // TELEGRAM GRUP GÖNDERİMİ (Eğer hedef SADECE bir kişi ise, gruba ATMA)
    const isTargetingSinglePerson = !!personnel_id;
    if (final_send_to_telegram_group && telegramBotToken && telegramGroupChatId && !isTargetingSinglePerson) {
      const telegramMessage = `📢 *${title || 'Genel Duyuru'}*\n\n${body || ''}`
      const telegramBody: any = {
        chat_id: telegramGroupChatId,
        text: telegramMessage,
        parse_mode: 'Markdown'
      }
      if (url && url !== '/') {
         telegramBody.reply_markup = {
           inline_keyboard: [[{ text: 'Aç / İncele', url: url.startsWith('http') ? url : `https://${url}` }]]
         }
      }

      const tgGroupPromise = fetch(`https://api.telegram.org/bot${telegramBotToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(telegramBody)
      }).then(res => res.json()).then(data => {
        if (data.ok) telegramSuccessCount++
        else {
          telegramFailureCount++
          console.error('Telegram Group Error:', data)
        }
      }).catch(err => {
        telegramFailureCount++
        console.error('Telegram Group Fetch Error:', err)
      })
      
      pushPromises.push(tgGroupPromise)
    }

    // BİREYSEL GÖNDERİMLER (WEB PUSH VE TELEGRAM DM)
    targets.forEach((p: any) => {
      // 1. Web Push
      if (final_send_web_push && vapidPublic && vapidPrivate && p.push_subscriptions && p.push_subscriptions.length > 0) {
        webpush.setVapidDetails('mailto:admin@paulmark.com', vapidPublic, vapidPrivate)
        
        p.push_subscriptions.forEach((sub: any) => {
          const pushSubscription = {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth }
          }
          const pushPromise = webpush.sendNotification(pushSubscription, pushPayload)
            .then(() => { webPushSuccessCount++ })
            .catch(async (err: any) => {
              webPushFailureCount++
              if (err.statusCode === 410 || err.statusCode === 404) {
                await supabaseClient.from('push_subscriptions').delete().eq('id', sub.id)
              }
            })
          pushPromises.push(pushPromise)
        })
      }

      // 2. Telegram Push (DM)
      if (final_send_to_telegram && telegramBotToken && p.telegram_chat_id) {
        const telegramMessage = `👤 *${title || 'Yeni Bildirim'}*\n\n${body || ''}`
        
        const telegramBody: any = {
          chat_id: p.telegram_chat_id,
          text: telegramMessage,
          parse_mode: 'Markdown'
        }
        
        if (url && url !== '/') {
           telegramBody.reply_markup = {
             inline_keyboard: [[{ text: 'Aç / İncele', url: url.startsWith('http') ? url : `https://${url}` }]]
           }
        }

        const tgPromise = fetch(`https://api.telegram.org/bot${telegramBotToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(telegramBody)
        }).then(res => res.json()).then(data => {
          if (data.ok) telegramSuccessCount++
          else {
            telegramFailureCount++
            console.error('Telegram Error:', data)
          }
        }).catch(err => {
          telegramFailureCount++
          console.error('Telegram Fetch Error:', err)
        })
        
        pushPromises.push(tgPromise)
      }
    })

    await Promise.all(pushPromises)

    return new Response(JSON.stringify({ 
      success: true, 
      sent: webPushSuccessCount, 
      failed: webPushFailureCount,
      telegram_sent: telegramSuccessCount,
      telegram_failed: telegramFailureCount,
      total_targets: targets.length 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error: any) {
    console.error('Edge Function Error:', error.message)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
