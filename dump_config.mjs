import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
async function run() {
  const { data } = await supabase.from('system_settings').select('setting_value').eq('setting_key', 'shift_engine_config').maybeSingle();
  console.log(JSON.stringify(data?.setting_value, null, 2));
}
run();
