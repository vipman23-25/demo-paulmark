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
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const results = await Promise.all([
        supabase.from('personnel').select('*').eq('is_active', true),
        supabase.from('personnel_movements').select('*').order('id', { ascending: false }).limit(5000),
        supabase.from('weekly_day_off').select('*').eq('status', 'approved'),
        supabase.from('department_shift_rules').select('*'),
        supabase.from('shift_schedules').select('*').gte('shift_date', thirtyDaysAgo),
        supabase.from('shift_preferences').select('*').eq('status', 'approved'),
        supabase.from('system_settings').select('*').in('setting_key', ['general', 'shift_engine_config']),
        supabase.from('shift_dependency_rules').select('*')
    ]);

    const errors = results.map((r, i) => r.error ? `Error at ${i}: ${r.error.message}` : null).filter(Boolean);
    if (errors.length) {
        console.error("Errors:", errors);
        return;
    }

    const engineConfigRaw = results[6].data?.find(s => s.setting_key === 'shift_engine_config');
    const engineConfig = engineConfigRaw?.setting_value || { blockMultipleAbsence: true };

    console.log("Movements length:", results[1].data?.length);
    console.log("Engine Config has general rules?", !!engineConfig?.demand_rules);
    console.log("Engine Config department_demand_rules keys:", Object.keys(engineConfig?.department_demand_rules || {}));
}
run();
