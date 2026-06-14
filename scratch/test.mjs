import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const envPath = path.join(process.cwd(), '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
let supabaseUrl = '';
let supabaseKey = '';
envContent.split('\n').forEach(line => {
    if (line.startsWith('VITE_SUPABASE_URL=')) supabaseUrl = line.split('=')[1].trim();
    if (line.startsWith('VITE_SUPABASE_PUBLISHABLE_KEY=')) supabaseKey = line.split('=')[1].trim();
});

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    const { data: personnel } = await supabase.from('personnel').select('*').ilike('first_name', '%ahin%');
    console.log("Personnel found:", personnel.map(p => ({id: p.id, name: p.first_name + ' ' + p.last_name})));
    
    if (personnel && personnel.length > 0) {
        const { data: movements, error } = await supabase.from('personnel_movements').select('*').eq('personnel_id', personnel[0].id).order('id', {ascending: false});
        console.log("Movements for " + personnel[0].first_name + ":");
        console.dir(movements, {depth: null});
    }
}
check();
