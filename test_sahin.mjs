import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const envStr = fs.readFileSync('.env.local', 'utf8');
let url = '', key = '';
envStr.split('\n').forEach(line => {
    if (line.startsWith('VITE_SUPABASE_URL=')) url = line.split('=')[1].trim();
    if (line.startsWith('VITE_SUPABASE_ANON_KEY=')) key = line.split('=')[1].trim();
});

const supabase = createClient(url, key);
const res = await supabase.from('personnel').select('*').eq('id', 'c62fbdfd-0348-43d9-a78c-0f9cce9e3ed8');
console.log(JSON.stringify(res.data, null, 2));
