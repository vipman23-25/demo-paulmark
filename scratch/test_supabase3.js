import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const env = fs.readFileSync('.env.local', 'utf-8');
const url = env.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const key = env.match(/VITE_SUPABASE_PUBLISHABLE_KEY=(.*)/)[1].trim();

const supabase = createClient(url, key);

async function run() {
    const { data: p } = await supabase.from('personnel').select('id, first_name, last_name');
    const matched = p.filter(x => x.first_name.toUpperCase().includes('ŞAHİN'));
    console.log("Personnel:", matched);
    if (matched && matched.length > 0) {
        const { data: m } = await supabase.from('personnel_movements').select('*').eq('personnel_id', matched[0].id);
        console.log("Movements:", m);
    }
}
run();
