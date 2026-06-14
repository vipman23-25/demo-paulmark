import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const envContent = fs.readFileSync('.env.local', 'utf-8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) envVars[match[1]] = match[2].trim();
});

const supabaseUrl = envVars['VITE_SUPABASE_URL'];
const supabaseKey = envVars['VITE_SUPABASE_PUBLISHABLE_KEY'];

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase.from('system_settings').select('*').eq('setting_key', 'shift_codes').single();
  if (error) {
    console.error(error);
    return;
  }
  
  let codes = data.setting_value || [];
  
  // Keep unique codes based on 'code' field
  const seen = new Set();
  const uniqueCodes = [];
  for (const c of codes) {
    if (!seen.has(c.code)) {
      seen.add(c.code);
      uniqueCodes.push(c);
    }
  }
  
  console.log("Original length:", codes.length);
  console.log("Unique length:", uniqueCodes.length);
  
  const { error: updateError } = await supabase.from('system_settings').update({ setting_value: uniqueCodes }).eq('setting_key', 'shift_codes');
  if (updateError) {
    console.error(updateError);
  } else {
    console.log("Successfully deduplicated shift codes!");
  }
}

run();
