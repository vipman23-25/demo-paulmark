import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '../.env.local' });

// Need to read the .env.local file to get the URL and KEY
import fs from 'fs';
const envFile = fs.readFileSync('.env.local', 'utf8');
const envUrlMatch = envFile.match(/VITE_SUPABASE_URL=(.*)/);
const envKeyMatch = envFile.match(/VITE_SUPABASE_ANON_KEY=(.*)/);

const supabaseUrl = envUrlMatch ? envUrlMatch[1].trim() : '';
const supabaseKey = envKeyMatch ? envKeyMatch[1].trim() : '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function addCombos() {
  const { data, error } = await supabase.from('system_settings').select('*').eq('setting_key', 'shift_engine_config').single();
  if (error && error.code !== 'PGRST116') {
      console.error(error);
      return;
  }
  
  let config = data?.setting_value || {};
  let groups = config.department_groups || [];
  
  // Sadece eğer 4'ten az kombinasyon varsa örnekleri ekleyelim
  if (groups.length < 4) {
      const examples = [
          { groupName: "Kombinasyon 1 (Bayan & Çocuk)", departments: ["Kadın", "Çocuk"], personnels: [] },
          { groupName: "Kombinasyon 2 (Erkek & Spor)", departments: ["Erkek", "Spor"], personnels: [] },
          { groupName: "Kombinasyon 3 (Kasa & Müşteri Hizm.)", departments: ["Kasa", "Müşteri Hizmetleri"], personnels: [] },
          { groupName: "Kombinasyon 4 (Ayakkabı & Aksesuar)", departments: ["Ayakkabı", "Aksesuar"], personnels: [] }
      ];
      
      // Merge unique ones
      examples.forEach(ex => {
          if (!groups.find(g => g.groupName === ex.groupName)) {
              groups.push(ex);
          }
      });
      
      config.department_groups = groups;
      
      await supabase.from('system_settings').upsert({
          setting_key: 'shift_engine_config',
          setting_value: config
      }, { onConflict: 'setting_key' });
      
      console.log("Kombinasyonlar başarıyla eklendi!");
  } else {
      console.log("Zaten yeterince kombinasyon var.");
  }
}

addCombos();
