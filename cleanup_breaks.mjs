import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_PUBLISHABLE_KEY);
async function run() {
  const { data: personnelData } = await supabase.from('break_records').select('personnel_id').is('break_end', null);
  const pIds = [...new Set(personnelData.map(p => p.personnel_id))];
  
  for (const pid of pIds) {
    const { data: activeBreaks } = await supabase.from('break_records').select('*').eq('personnel_id', pid).is('break_end', null).order('break_start', { ascending: false });
    if (activeBreaks && activeBreaks.length > 0) {
      // Keep the most recent one, or just close all of them. Let's just close ALL of them right now.
      for (const b of activeBreaks) {
        await supabase.from('break_records').update({ break_end: new Date().toISOString() }).eq('id', b.id);
        console.log('Closed break:', b.id);
      }
    }
  }
  console.log('Cleanup done!');
}
run();
