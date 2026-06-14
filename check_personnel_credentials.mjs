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

async function check() {
  const { data, error } = await supabase
    .from('personnel')
    .select('first_name, last_name, tc_no, password_hash, is_active')
    .eq('is_active', true)
    .limit(5);
  
  if (error) {
    console.error("Error:", error);
  } else {
    console.log("Personnel Sample Data:");
    console.log(data);
  }
}

check();
