import { supabase } from '@/integrations/supabase/client';

export const logAction = async (
  actionType: string,
  details: string,
  userId: string | null = null,
  userName: string | null = null
) => {
  try {
    // Session'dan kullanıcı bilgilerini almaya çalış (eğer parametre olarak gelmediyse)
    if (!userId || !userName) {
      const { data: { session } } = await supabase.auth.getSession();
      
      // auth user id vs public.users name fetching is too complex here without extra queries.
      // We will rely on caller to pass userName if possible.
      // But if user is authenticated, we log their ID at least.
      if (session && session.user && !userId) {
        userId = session.user.id;
      }
    }

    const { error } = await supabase
      .from('system_logs')
      .insert([
        {
          user_id: userId || 'Sistem',
          user_name: userName || 'Bilinmiyor',
          action_type: actionType,
          details: details
        }
      ]);

    if (error) {
      console.error('Log kaydetme hatası:', error);
    }
  } catch (err) {
    console.error('Beklenmeyen log hatası:', err);
  }
};
