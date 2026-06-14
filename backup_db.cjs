const { Client } = require('pg');
const fs = require('fs');

async function backup() {
    console.log('Connecting to database...');
    const client = new Client({
        connectionString: 'postgresql://postgres.kiqptcpukecbeegkpnui:turgay23keban@aws-0-eu-central-1.pooler.supabase.com:6543/postgres'
    });
    
    try {
        await client.connect();
        console.log('Connected! Fetching tables...');
        
        const res = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
        const tables = res.rows.map(row => row.table_name);
        
        console.log('Found tables:', tables.join(', '));
        
        const dump = {};
        
        for (const table of tables) {
            console.log('Fetching data from ' + table + '...');
            const dataRes = await client.query('SELECT * FROM "' + table + '"');
            dump[table] = dataRes.rows;
        }
        
        fs.writeFileSync('veritabani_yedek_08_05_2026.json', JSON.stringify(dump, null, 2));
        console.log('Backup successful! File saved as veritabani_yedek_08_05_2026.json');
        
    } catch (err) {
        console.error('Error during backup:', err.message);
    } finally {
        await client.end();
    }
}
backup();
