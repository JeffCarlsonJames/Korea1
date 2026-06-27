const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png' };

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let p = decodeURIComponent(req.url.split('?')[0]);
      if (p === '/') p = '/index.html';
      const file = path.join(ROOT, p);
      if (!file.startsWith(ROOT) || !fs.existsSync(file)) { res.writeHead(404); res.end('nf'); return; }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
      fs.createReadStream(file).pipe(res);
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

(async () => {
  const server = await startServer();
  const port = server.address().port;
  const base = `http://127.0.0.1:${port}/`;
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  // Block the live-rate API so the default 1365 rate is deterministic.
  await page.route('**er-api.com**', (route) => route.abort());

  const fails = [];
  const ok = (name, cond) => { console.log((cond ? 'PASS ' : 'FAIL ') + name); if (!cond) fails.push(name); };

  await page.goto(base, { waitUntil: 'networkidle' });

  // Rate text shows default
  ok('default rate shown', (await page.textContent('#rateText')).includes('1,365'));

  // Add ₩13,650 -> $10.00 at rate 1365
  await page.fill('#krwInput', '13650');
  ok('preview shows ~$10', (await page.textContent('#preview')).includes('$10.00'));
  await page.click('#addBtn');
  await page.waitForTimeout(100);
  ok('total USD = $10.00 after first add', (await page.textContent('#totalUsd')).trim() === '$10.00');
  ok('total KRW shows 13,650', (await page.textContent('#totalKrw')).includes('13,650'));
  ok('count shows 1 expense', (await page.textContent('#count')).includes('1 expense'));

  // Add ₩6,825 -> $5.00, total should accumulate to $15.00
  await page.fill('#krwInput', '6825');
  await page.click('#addBtn');
  await page.waitForTimeout(100);
  ok('total accumulates to $15.00', (await page.textContent('#totalUsd')).trim() === '$15.00');
  ok('two items in list', (await page.$$('li.item')).length === 2);

  // Persistence: reload and confirm total survives
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(150);
  ok('total persists after reload', (await page.textContent('#totalUsd')).trim() === '$15.00');
  ok('items persist after reload', (await page.$$('li.item')).length === 2);

  // Delete one expense -> total drops to $10.00 (newest first; delete top removes the $5)
  await page.click('li.item .del');
  await page.waitForTimeout(100);
  ok('total after delete = $10.00', (await page.textContent('#totalUsd')).trim() === '$10.00');
  ok('one item remains', (await page.$$('li.item')).length === 1);

  // Edit rate to 1000 and confirm preview math (does not retroactively change history)
  await page.click('#editRate');
  await page.waitForTimeout(100);
  await page.fill('#rateInput', '1000');
  await page.click('#saveRate');
  await page.waitForTimeout(100);
  ok('rate updated to 1,000', (await page.textContent('#rateText')).includes('1,000'));
  ok('history total unchanged by rate edit', (await page.textContent('#totalUsd')).trim() === '$10.00');
  await page.fill('#krwInput', '5000');
  ok('preview uses new rate ($5)', (await page.textContent('#preview')).includes('$5.00'));

  await page.screenshot({ path: path.join(ROOT, 'tools', 'screenshot.png') });

  await browser.close();
  server.close();
  console.log(fails.length ? ('\n' + fails.length + ' FAILURES') : '\nALL PASSED');
  process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
