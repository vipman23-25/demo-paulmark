import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envFile = fs.readFileSync('.env.local', 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const [key, ...val] = line.split('=');
  if (key && val.length > 0) env[key.trim()] = val.join('=').trim().replace(/['"]/g, '');
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY);

async function run() {
  const { data: settings } = await supabase.from('system_settings').select('*').eq('setting_key', 'general').single();
  const currentTypes = settings.setting_value.movementTypes || [];
  
  console.log('Current types:', currentTypes);

  const newTypes = [];
  const map = {}; 
  
  for (const t of currentTypes) {
    if (typeof t === 'string') {
      let code = t.substring(0, 1).toUpperCase();
      if (newTypes.find(x => x.code === code)) {
         code = t.substring(0, 2).toUpperCase();
      }
      // Special mappings requested by the user: 
      // User said "kısa ad: S Tür:Sabah Vardiya" earlier but Sabah Vardiya is not usually a movement type.
      if (t.toLowerCase().includes('izin')) code = 'İ';
      if (t.toLowerCase().includes('rapor')) code = 'R';
      
      newTypes.push({ code, label: t });
      map[t] = code;
    } else if (t.code && t.label) {
      newTypes.push(t);
      map[t.label] = t.code;
    }
  }

  console.log('New types:', newTypes);
  console.log('Map:', map);

  const updatedValue = { ...settings.setting_value, movementTypes: newTypes };
  const { error: setErr } = await supabase.from('system_settings').update({ setting_value: updatedValue }).eq('id', settings.id);
  if (setErr) {
    console.error('Settings update error:', setErr);
    return;
  }

  const { data: movements } = await supabase.from('personnel_movements').select('*');
  let updatedCount = 0;
  for (const m of (movements || [])) {
    if (map[m.movement_type] && map[m.movement_type] !== m.movement_type) {
       const { error: updErr } = await supabase.from('personnel_movements').update({ movement_type: map[m.movement_type] }).eq('id', m.id);
       if (!updErr) updatedCount++;
    }
  }

  console.log(`Updated ${updatedCount} movements.`);
}

run();
