const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf-8');
const url = env.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1].trim();

const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(url, key);

async function run() {
    const { data: p } = await supabase.from('personnel').select('id, first_name, last_name').ilike('first_name', '%şahin%');
    console.log("Personnel:", p);
    if (p && p.length > 0) {
        const { data: m } = await supabase.from('personnel_movements').select('*').eq('personnel_id', p[0].id);
        console.log("Movements:", m);
    }
}
run();
