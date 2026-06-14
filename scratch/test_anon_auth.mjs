import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error("Missing env vars");
  process.exit(1);
}

const supabase = createClient(url, key);

async function testAnon() {
  console.log("Testing anon access to personnel...");
  const { data, error } = await supabase.from('personnel').select('id').limit(1);
  console.log("Data:", data);
  console.log("Error:", error);
}

testAnon();
