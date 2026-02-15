import puppeteer from 'puppeteer';

const pages = [
  { name: 'bloomberg', url: 'http://localhost:3333/preview/bloomberg' },
  { name: 'daily-sheet', url: 'http://localhost:3333/preview/daily-sheet' },
  { name: 'war-room', url: 'http://localhost:3333/preview/war-room' },
];

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });

for (const p of pages) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto(p.url, { waitUntil: 'networkidle0', timeout: 60000 });
  await page.screenshot({ path: `screenshots/${p.name}-desktop.png`, fullPage: true });
  
  await page.setViewport({ width: 390, height: 844 });
  await page.goto(p.url, { waitUntil: 'networkidle0', timeout: 60000 });
  await page.screenshot({ path: `screenshots/${p.name}-mobile.png`, fullPage: true });
  
  console.log(`✅ ${p.name}`);
  await page.close();
}

await browser.close();
console.log('Done — 6 screenshots saved to screenshots/');
