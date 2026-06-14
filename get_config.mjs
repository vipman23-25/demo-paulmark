import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envStr = fs.readFileSync('.env.local', 'utf8');
let url = '', key = '';
envStr.split('\n').forEach(line => {
    if (line.startsWith('VITE_SUPABASE_URL=')) url = line.split('=')[1].trim();
    if (line.startsWith('VITE_SUPABASE_PUBLISHABLE_KEY=')) key = line.split('=')[1].trim();
});

const supabase = createClient(url, key);

async function run() {
    const { data, error } = await supabase.from('system_settings').select('*').eq('setting_key', 'shift_engine_config').maybeSingle();
    console.log(JSON.stringify(data?.setting_value, null, 2));
}
run();
