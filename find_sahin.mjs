import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envStr = fs.readFileSync('.env.local', 'utf8');
let url = '', key = '';
envStr.split('\n').forEach(line => {
    if (line.startsWith('VITE_SUPABASE_URL=')) url = line.split('=')[1].trim();
    if (line.startsWith('VITE_SUPABASE_PUBLISHABLE_KEY=')) key = line.split('=')[1].trim();
});

const supabase = createClient(url, key);

async function run() {
    const { data: personnel } = await supabase.from('personnel').select('*');
    const sahins = personnel.filter(p => p.first_name?.toUpperCase().includes('ŞAHİN') || p.last_name?.toUpperCase().includes('ŞEYHUN'));
    console.log("Sahins:", sahins);
    
    for (const sahin of sahins) {
        const { data: moves } = await supabase.from('personnel_movements').select('*').eq('personnel_id', sahin.id);
        console.log(`Moves for ${sahin.first_name} ${sahin.last_name} (${sahin.id}):`, moves);
    }
}
run();
