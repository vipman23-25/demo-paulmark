import fs from 'fs';

const oldContent = fs.readFileSync('old_dayoff.tsx', 'utf8');
const start = oldContent.indexOf('<Card className="glass-card mt-6');
const end = oldContent.indexOf('</Card>', start) + 7;
const card = oldContent.substring(start, end);

const cur = fs.readFileSync('src/pages/admin/DayOffView.tsx', 'utf8');
const idx = cur.indexOf('<TabsContent value="swaps"');
const res = cur.substring(0, idx) + '        <TabsContent value="preferences" className="space-y-4">\n          ' + card + '\n        </TabsContent>\n\n' + cur.substring(idx);

fs.writeFileSync('src/pages/admin/DayOffView.tsx', res, 'utf8');
console.log('Done');
