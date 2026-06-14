import { createClient } from '@supabase/supabase-js';
import * as xlsx from 'xlsx';
import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';

// Supabase configuration
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY; // Service key or anon key

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing Supabase credentials!");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Nodemailer configuration
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;

if (!SMTP_USER || !SMTP_PASS) {
  console.error("Missing SMTP credentials!");
  process.exit(1);
}

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: SMTP_USER,
    pass: SMTP_PASS,
  },
});

async function exportTableToSheet(tableName, wb) {
  try {
    const { data, error } = await supabase.from(tableName).select('*');
    if (error) {
      console.error(`Error fetching ${tableName}:`, error.message);
      return;
    }
    const ws = xlsx.utils.json_to_sheet(data || []);
    xlsx.utils.book_append_sheet(wb, ws, tableName.substring(0, 31)); // Excel sheet name limit is 31 chars
    console.log(`Exported ${tableName} (${data?.length || 0} rows)`);
  } catch (err) {
    console.error(`Failed to export ${tableName}:`, err);
  }
}

async function runBackup() {
  console.log("Starting automated backup...");
  const dateStr = new Date().toISOString().split('T')[0];
  const fileName = `Yedek_${dateStr}.xlsx`;
  const tempPath = path.resolve(process.cwd(), fileName);

  const wb = xlsx.utils.book_new();

  // Define tables to backup
  const tables = [
    'personnel',
    'break_records',
    'shift_schedules',
    'personnel_movements',
    'overtime_records',
    'weekly_day_off',
    'reminders',
    'cargo_shipments',
    'logistics_records'
  ];

  for (const table of tables) {
    await exportTableToSheet(table, wb);
  }

  // Write Excel file locally
  xlsx.writeFile(wb, tempPath);
  console.log(`Created Excel backup at ${tempPath}`);

  // Send Email
  try {
    console.log("Sending email to vipman23@gmail.com...");
    const brandName = process.env.VITE_APP_BRAND === 'demo' || process.env.VITE_APP_BRAND === 'magazatakibi' ? 'MAĞAZA TAKİBİ' : 'Paulmark Mağaza Takibi';
    await transporter.sendMail({
      from: `"${brandName} Yedekleme Sistemi" <${SMTP_USER}>`,
      to: 'turgaydolu23@gmail.com',
      subject: `${brandName} Otomatik Yedekleme - ${dateStr}`,
      text: `Merhaba,\n\nSistemin haftalık otomatik yedeği ektedir.\n\nTarih: ${dateStr}\n\nİyi çalışmalar,\n${brandName} Otomasyon`,
      attachments: [
        {
          filename: fileName,
          path: tempPath,
        },
      ],
    });
    console.log("Email sent successfully!");
  } catch (err) {
    console.error("Failed to send email:", err);
  } finally {
    // Cleanup temp file
    if (fs.existsSync(tempPath)) {
      fs.unlinkSync(tempPath);
    }
  }
}

runBackup();
