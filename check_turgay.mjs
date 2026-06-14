import fs from 'fs';

const envFile = fs.readFileSync('.env.local', 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const [key, ...val] = line.split('=');
  if (key && val) env[key.trim()] = val.join('=').trim();
});

const supabaseUrl = env['VITE_SUPABASE_URL'];
const supabaseKey = env['VITE_SUPABASE_ANON_KEY'];

async function check() {
  const res = await fetch(`${supabaseUrl}/rest/v1/personnel?select=*`, {
    headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
  });
  const personnel = await res.json();
  const turgay = personnel.find(p => p.first_name === 'TURGAY' || p.first_name === 'Turgay');
  console.log('Turgay:', turgay);

  if (turgay) {
    const res2 = await fetch(`${supabaseUrl}/rest/v1/weekly_day_off?personnel_id=eq.${turgay.id}&select=*`, {
      headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
    });
    const dayOffs = await res2.json();
    console.log('Turgay Day Offs:', dayOffs);
  }
}

check();
