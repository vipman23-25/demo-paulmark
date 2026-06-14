import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

let envStr;
try {
  envStr = fs.readFileSync('.env.local', 'utf-8');
} catch (e) {
  envStr = fs.readFileSync('.env', 'utf-8');
}

const envVars = {};
for (const line of envStr.split('\n')) {
  const [key, ...vals] = line.split('=');
  if (key && vals.length > 0) envVars[key.trim()] = vals.join('=').trim().replace(/"/g, '');
}

const supabaseUrl = envVars['VITE_SUPABASE_URL'];
const supabaseKey = envVars['VITE_SUPABASE_PUBLISHABLE_KEY'];

const supabase = createClient(supabaseUrl, supabaseKey);

async function createAdmin() {
  console.log("Creating turgaydolu23@gmail.com via GoTrue API...");
  const { data, error } = await supabase.auth.signUp({
    email: 'turgaydolu23@gmail.com',
    password: 'password123',
    options: {
      data: {
        display_name: 'Admin'
      }
    }
  });

  if (error) {
    console.error("SignUp Error:", error);
  } else {
    console.log("Admin user created successfully:", data.user?.id);
  }
}

createAdmin();
