import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envText = fs.readFileSync('.env.local', 'utf8');
const urlMatch = envText.match(/VITE_SUPABASE_URL=(.*)/);
const keyMatch = envText.match(/VITE_SUPABASE_ANON_KEY=(.*)/);

const supabase = createClient(urlMatch[1].trim(), keyMatch[1].trim());

async function run() {
   const { data } = await supabase.from('system_settings').select('setting_value').eq('setting_key', 'general').single();
   const img = data?.setting_value?.loginPageImage;
   console.log("Image length:", img ? img.length : "null");
}
run();
