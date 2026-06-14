import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_PUBLISHABLE_KEY);
async function run() {
  const { data, error } = await supabase.from('break_records').select('*').is('break_end', null).order('break_start', { ascending: false }).limit(5);
  console.log(error ? 'ERROR: ' + error.message : JSON.stringify(data, null, 2));
}
run();
