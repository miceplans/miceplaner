// 사용법: node scripts/compare.mjs <route> <figma-screenshot.png> [width=1440] [height=900]
// dev 서버(http://localhost:3100)가 떠 있어야 한다. 결과: 유사도(%)와 diff 이미지 경로 출력.
import { chromium } from 'playwright';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import fs from 'node:fs';

const [route, figmaPng, w = '1440', h = '900'] = process.argv.slice(2);
const out = `/tmp/compare-${route.replace(/\W+/g, '_') || 'root'}`;
const ref = PNG.sync.read(fs.readFileSync(figmaPng));
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: Number(w), height: Number(h) }, deviceScaleFactor: 1 });
await page.goto(`http://localhost:3100${route}`, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
const buf = await page.screenshot({ fullPage: true });
await browser.close();
const mine = PNG.sync.read(buf);
const W = Math.min(ref.width, mine.width), H = Math.min(ref.height, mine.height);
const crop = (p) => { const o = new PNG({ width: W, height: H }); PNG.bitblt(p, o, 0, 0, W, H, 0, 0); return o; };
const a = crop(ref), b = crop(mine), diff = new PNG({ width: W, height: H });
const bad = pixelmatch(a.data, b.data, diff.data, W, H, { threshold: 0.12 });
fs.writeFileSync(`${out}-mine.png`, buf);
fs.writeFileSync(`${out}-diff.png`, PNG.sync.write(diff));
console.log(JSON.stringify({ route, figma: [ref.width, ref.height], mine: [mine.width, mine.height], similarity: +(100 - (bad / (W * H)) * 100).toFixed(2), mine: `${out}-mine.png`, diff: `${out}-diff.png` }));
