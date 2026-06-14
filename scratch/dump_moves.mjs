import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { readFileSync } from 'fs';

// Extract env from .env.local
const envContent = readFileSync('.env.local', 'utf-8');
const anonKeyMatch = envContent.match(/VITE_SUPABASE_ANON_KEY=(.*)/);
const urlMatch = envContent.match(/VITE_SUPABASE_URL=(.*)/);

if (!anonKeyMatch || !urlMatch) {
    console.error("Missing supabase env vars");
    process.exit(1);
}

const supabase = createClient(urlMatch[1], anonKeyMatch[1]);

async function run() {
    const { data: personnel, error: pErr } = await supabase.from('personnel').select('*').ilike('first_name', '%şahin%');
    if (pErr) console.error(pErr);
    console.log("Personnel:", personnel);
    
    if (personnel && personnel.length > 0) {
        const { data: moves, error: mErr } = await supabase.from('personnel_movements').select('*').eq('personnel_id', personnel[0].id);
        console.log("Movements:", moves);
    }
}
run();
