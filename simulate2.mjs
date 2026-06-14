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
    const { data: personnel } = await supabase.from('personnel').select('*').eq('is_active', true);
    const { data: movements } = await supabase.from('personnel_movements').select('*').order('id', { ascending: false }).limit(5000);
    
    const p = personnel.find(p => p.id === 'f0bc696f-8fa8-456a-9c2a-5fe37ddd01bc'); // Real Sahin
    if (!p) {
        console.log("Sahin not found or not active");
        return;
    }
    
    const pMovements = movements.filter(m => m.personnel_id === p.id);
    console.log("Movements for Sahin:", pMovements);
    
    const weekDates = ['2026-06-15', '2026-06-16', '2026-06-17', '2026-06-18', '2026-06-19', '2026-06-20', '2026-06-21'];
    const shifts = {};
    
    weekDates.forEach((dateStr) => {
        const hasMovement = pMovements.find(m => {
            if (!m.start_date) return false;
            
            let mStart = m.start_date.includes('T') ? m.start_date.split('T')[0] : m.start_date;
            let mEnd = m.end_date ? (m.end_date.includes('T') ? m.end_date.split('T')[0] : m.end_date) : mStart;
            
            if (mStart.includes('.')) {
                const p = mStart.split('.');
                if (p.length === 3) mStart = `${p[2]}-${p[1]}-${p[0]}`;
            }
            if (mEnd.includes('.')) {
                const p = mEnd.split('.');
                if (p.length === 3) mEnd = `${p[2]}-${p[1]}-${p[0]}`;
            }

            return mStart <= dateStr && mEnd >= dateStr;
        });

        if (hasMovement && hasMovement.movement_type && !shifts[dateStr]) {
            let mType = String(hasMovement.movement_type).trim();
            if (mType.toUpperCase().includes('YILLIK')) mType = 'Y';
            shifts[dateStr] = mType; 
        }
    });
    
    console.log("Generated Shifts for Sahin:", shifts);
}

run();
