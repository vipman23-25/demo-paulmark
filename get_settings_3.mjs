import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

let envStr = fs.readFileSync('.env.local', 'utf-8');
const envVars = {};
for (const line of envStr.split('\n')) {
  const [key, ...vals] = line.split('=');
  if (key && vals.length > 0) envVars[key.trim()] = vals.join('=').trim().replace(/"/g, '');
}

const supabaseUrl = envVars['VITE_SUPABASE_URL'];
const supabaseKey = envVars['VITE_SUPABASE_PUBLISHABLE_KEY'];

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSettings() {
  const { data, error } = await supabase.from('system_settings').select('*').eq('setting_key', 'general');
  console.log("General Settings Data:");
  console.log(JSON.stringify(data[0].setting_value.movementTypes));
  
  if (error) console.error("Error:", error);
}

checkSettings();
