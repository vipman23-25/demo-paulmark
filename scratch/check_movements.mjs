import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '../.env.local' });

import fs from 'fs';
const envFile = fs.readFileSync('.env.local', 'utf8');
const envUrlMatch = envFile.match(/VITE_SUPABASE_URL=(.*)/);
const envKeyMatch = envFile.match(/VITE_SUPABASE_ANON_KEY=(.*)/);

const supabaseUrl = envUrlMatch ? envUrlMatch[1].trim() : '';
const supabaseKey = envKeyMatch ? envKeyMatch[1].trim() : '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkMovements() {
  const { data, error } = await supabase.from('system_settings').select('*').eq('setting_key', 'general').single();
  if (error) {
      console.error(error);
      return;
  }
  
  console.log(JSON.stringify(data.setting_value.movementTypes, null, 2));
}

checkMovements();
