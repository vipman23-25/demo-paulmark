import fs from 'fs';
import path from 'path';

const brand = process.env.VITE_APP_BRAND || 'paulmark'; // default to paulmark

console.log(`[BRAND] Preparing assets for brand: ${brand}`);

const rootDir = process.cwd();
const brandDir = path.join(rootDir, 'brand', brand);
const publicDir = path.join(rootDir, 'public');

if (fs.existsSync(brandDir)) {
    try {
        fs.copyFileSync(path.join(brandDir, 'logo.png'), path.join(publicDir, 'logo.png'));
        fs.copyFileSync(path.join(brandDir, 'manifest.json'), path.join(publicDir, 'manifest.json'));
        console.log(`[BRAND] Successfully copied logo.png and manifest.json for ${brand}`);
    } catch (e) {
        console.error('[BRAND] Error copying brand assets:', e);
    }
} else {
    console.warn(`[BRAND] Warning: Brand directory ${brandDir} not found.`);
}

// Update index.html dynamically
const indexPath = path.join(rootDir, 'index.html');
if (fs.existsSync(indexPath)) {
    let indexHtml = fs.readFileSync(indexPath, 'utf-8');
    const title = brand === 'magazatakibi' || brand === 'demo' ? 'Mağaza Takibi' : 'Paulmark Mağaza Takibi';
    
    indexHtml = indexHtml.replace(/<title>.*?<\/title>/, `<title>${title}</title>`);
    indexHtml = indexHtml.replace(/<meta name="title" content=".*?" \/>/, `<meta name="title" content="${title}" />`);
    indexHtml = indexHtml.replace(/<meta property="og:title" content=".*?" \/>/, `<meta property="og:title" content="${title}" />`);
    indexHtml = indexHtml.replace(/<meta name="apple-mobile-web-app-title" content=".*?" \/>/, `<meta name="apple-mobile-web-app-title" content="${title}" />`);
    
    fs.writeFileSync(indexPath, indexHtml);
    console.log(`[BRAND] Updated index.html with title: ${title}`);
}
