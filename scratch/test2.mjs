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
    const { data: personnel } = await supabase.from('personnel').select('*');
    const sahin = personnel.find(p => p.first_name.toLowerCase().includes('ahin') || p.first_name.toLowerCase().includes('şahin'));
    console.log("Personnel found:", sahin ? {id: sahin.id, name: sahin.first_name + ' ' + sahin.last_name} : 'None');
    
    if (sahin) {
        const { data: movements, error } = await supabase.from('personnel_movements').select('*').eq('personnel_id', sahin.id).order('id', {ascending: false});
        console.log("Movements for " + sahin.first_name + ":");
        console.dir(movements, {depth: null});
    }
}
check();
