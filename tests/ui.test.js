/* Browser tests for the homepage entry point and the scanner page.
 * Run with `npm install && npm test` in this folder. Uses Playwright's Chromium. */
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

let chromium;
try { ({ chromium } = require('playwright')); } catch (e) { chromium = null; }

const ROOT = path.resolve(__dirname, '..');
const TYPES = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png' };
let server; let origin; let browser;

const opts = { skip: chromium ? false : 'playwright is not installed (run npm install in tests/)' };

test.before(async () => {
  if (!chromium) return;
  server = http.createServer((req, res) => {
    const url = decodeURIComponent(req.url.split('?')[0].split('#')[0]);
    const file = path.join(ROOT, url.endsWith('/') ? `${url}index.html` : url);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
});

test.after(async () => {
  if (browser) await browser.close();
  if (server) server.close();
});

async function open(urlPath, contextOptions = {}) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 860 }, ...contextOptions });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  // Fonts are external; keep tests offline and deterministic.
  await page.route(/fonts\.(googleapis|gstatic)\.com/, route => route.abort());
  await page.goto(origin + urlPath);
  return { page, context, errors: () => errors.filter(e => !/fonts|ERR_FAILED/.test(e)) };
}

const choose = (page, label) => page.getByText(label, { exact: true }).click();

async function completeScan(page, { context = '' } = {}) {
  await choose(page, 'Retail & e-commerce'); await page.click('#scanNext');
  await choose(page, '11 to 50 people'); await page.click('#scanNext');
  await choose(page, 'Reduce costs'); await page.click('#scanNext');
  await choose(page, 'Stock, supply and orders'); await page.click('#scanNext');
  await choose(page, 'Copying data between systems'); await page.click('#scanNext');
  await page.click('#scanSkip');
  if (context) await page.fill('#scanText', context);
  await page.click('#scanNext');
  await page.waitForSelector('#report:not([hidden])');
}

test('homepage shows the scanner entry point and keeps existing contact links', opts, async () => {
  const { page, context, errors } = await open('/index.html');
  const entry = page.locator('#scan');
  await assert.doesNotReject(entry.waitFor());
  assert.equal(await page.locator('#scanEntryTitle').textContent(), 'Find your next business advantage.');
  assert.match(await entry.textContent(), /Discover where AI, automation and software could help your business save time, reduce costs or unlock new revenue\./);
  const cta = page.getByRole('link', { name: 'Scan my business' });
  assert.equal(await cta.getAttribute('href'), 'scan.html');
  assert.match(await page.locator('.contact-actions .btn-light').getAttribute('href'), /^mailto:hello@josephiwe\.com/);
  assert.deepEqual(await page.locator('.desktop-nav a').evaluateAll(a => a.map(x => x.getAttribute('href'))), ['#solutions', '#work', '#ventures', '#about']);
  await cta.click();
  await page.waitForURL(/scan\.html$/);
  await page.waitForSelector('#scanForm:not([hidden])');
  assert.deepEqual(errors(), []);
  await context.close();
});

test('questionnaire validates required answers and can be completed by keyboard', opts, async () => {
  const { page, context, errors } = await open('/scan.html');
  await page.waitForSelector('#scanForm:not([hidden])');
  assert.equal(await page.locator('#scanCount').textContent(), 'Question 1 of 7');
  assert.ok(await page.locator('#scanBack').isHidden());
  assert.ok(await page.locator('#scanSkip').isHidden(), 'required questions cannot be skipped');

  await page.click('#scanNext');
  assert.equal(await page.locator('#scanError').textContent(), 'Please choose an option to continue.');
  assert.equal(await page.locator('#scanFieldset').getAttribute('aria-invalid'), 'true');

  // Keyboard: focus the first radio, move with arrows, submit with Enter.
  await page.locator('input[name="industry"]').first().focus();
  await page.keyboard.press('Space');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  assert.equal(await page.locator('#scanCount').textContent(), 'Question 2 of 7');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'scanQuestion', 'focus moves to the new question');
  for (let i = 0; i < 3; i += 1) {
    await page.keyboard.press('Tab');
    await page.keyboard.press('Space');
    await page.keyboard.press('Enter');
  }
  assert.equal(await page.locator('#scanCount').textContent(), 'Question 5 of 7 · Optional');
  assert.ok(await page.locator('#scanSkip').isVisible());
  await page.click('#scanSkip');
  await page.click('#scanSkip');
  assert.equal(await page.locator('#scanNextText').textContent(), 'See my report');
  await page.click('#scanNext');
  await page.waitForSelector('#report:not([hidden])');
  assert.equal(await page.locator('.op').count(), 3);
  assert.equal(await page.evaluate(() => document.activeElement.id), 'reportTitle');
  assert.deepEqual(errors(), []);
  await context.close();
});

test('multi-select questions enforce the six-item limit', opts, async () => {
  const { page, context } = await open('/scan.html');
  await choose(page, 'Manufacturing'); await page.click('#scanNext');
  await choose(page, 'Just me'); await page.click('#scanNext');
  await choose(page, 'Grow revenue'); await page.click('#scanNext');
  await choose(page, 'Marketing and content'); await page.click('#scanNext');
  const boxes = page.locator('input[name="tasks"]');
  for (let i = 0; i < 6; i += 1) await boxes.nth(i).check({ force: true });
  assert.equal(await boxes.nth(6).isDisabled(), true);
  await boxes.nth(0).uncheck({ force: true });
  assert.equal(await boxes.nth(6).isDisabled(), false);
  await context.close();
});

test('report contains every required section and honest labelling', opts, async () => {
  const { page, context, errors } = await open('/scan.html');
  await completeScan(page, { context: 'Our stock counts are always wrong.' });
  const first = page.locator('.op').first();
  const text = await first.textContent();
  ['Why this was selected for you', 'The problem it addresses', 'Proposed solution', 'How it would work', 'Expected benefits', 'Implementation complexity', 'Main dependencies', 'Risks and limitations', 'Suggested first experiment', 'Indicative implementation sequence']
    .forEach(h => assert.ok(text.includes(h), h));
  assert.match(await page.locator('.basis-method').textContent(), /Generated recommendation.*rule-based/s);
  assert.match(await page.locator('#reportMeta').textContent(), /Not verified analysis/);
  assert.match(await page.locator('#reportAnswers').textContent(), /Our stock counts are always wrong\./);
  assert.ok(!/%|£|\$|€|ROI/.test(await page.locator('#reportOps').textContent()), 'no invented figures');

  // Progressive disclosure: the first plan is open, the others start closed.
  const toggles = page.locator('.op-toggle');
  assert.equal(await toggles.nth(0).getAttribute('aria-expanded'), 'true');
  assert.equal(await toggles.nth(1).getAttribute('aria-expanded'), 'false');
  assert.ok(await page.locator('.op').nth(1).locator('.op-more').isHidden());
  await toggles.nth(1).click();
  assert.ok(await page.locator('.op').nth(1).locator('.op-more').isVisible());

  // Next steps.
  const help = decodeURIComponent(await page.locator('#helpLink').getAttribute('href'));
  assert.match(help, /^mailto:hello@josephiwe\.com\?subject=Scanner report: /);
  assert.match(help, /Suggested opportunities:\n1\. /);
  assert.ok(help.length < 2400, 'mailto stays within a safe length');
  assert.match(await page.locator('#saveEmail').getAttribute('href'), /^mailto:\?subject=/);
  await page.click('#exploreToggle');
  assert.ok((await page.locator('#exploreList li').count()) >= 3);

  const [download] = await Promise.all([page.waitForEvent('download'), page.click('#saveDownload')]);
  assert.match(download.suggestedFilename(), /^buildwise-opportunity-report-\d{4}-\d{2}-\d{2}\.txt$/);
  const content = fs.readFileSync(await download.path(), 'utf8');
  assert.match(content, /INDICATIVE PLAN/);
  assert.deepEqual(errors(), []);
  await context.close();
});

test('report links reopen the report, and broken links show an error state', opts, async () => {
  const { page, context, errors } = await open('/scan.html');
  await completeScan(page, { context: 'secret detail' });
  const url = page.url();
  assert.match(url, /#r=v1\./);
  const title = await page.locator('#reportTitle').textContent();
  await page.goto('about:blank');
  await page.goto(url);
  await page.waitForSelector('#report:not([hidden])');
  assert.equal(await page.locator('#reportTitle').textContent(), title);
  assert.match(await page.locator('#reportMeta').textContent(), /Opened from a link/);
  assert.ok(!(await page.locator('#reportAnswers').textContent()).includes('secret detail'), 'notes are not in links');

  await page.goto(`${origin}/scan.html#r=v1.broken!`);
  await page.waitForSelector('#scanFail:not([hidden])');
  assert.match(await page.locator('#scanFailTitle').textContent(), /could not be opened/);
  assert.ok(await page.locator('#scanRetry').isHidden());
  await page.click('#scanRestart');
  await page.waitForSelector('#scanForm:not([hidden])');
  assert.equal(await page.locator('#scanCount').textContent(), 'Question 1 of 7');
  assert.deepEqual(errors(), []);
  await context.close();
});

test('edit answers returns to the questionnaire with answers kept', opts, async () => {
  const { page, context } = await open('/scan.html');
  await completeScan(page);
  await page.click('#reportEdit');
  await page.waitForSelector('#scanForm:not([hidden])');
  assert.ok(await page.locator('input[value="retail"]').isChecked());
  assert.ok(!page.url().includes('#r='));
  await context.close();
});

test('progress survives a reload mid-questionnaire', opts, async () => {
  const { page, context } = await open('/scan.html');
  await choose(page, 'Hospitality & food'); await page.click('#scanNext');
  await choose(page, 'Just me'); await page.click('#scanNext');
  await page.reload();
  await page.waitForSelector('#scanForm:not([hidden])');
  assert.equal(await page.locator('#scanCount').textContent(), 'Question 3 of 7');
  await page.click('#scanBack');
  assert.ok(await page.locator('input[value="solo"]').isChecked());
  await context.close();
});

test('free text is rendered as text, never as markup', opts, async () => {
  const { page, context } = await open('/scan.html');
  await completeScan(page, { context: '<img src=x onerror="window.__pwned=1"><b>bold</b>' });
  assert.equal(await page.evaluate(() => window.__pwned), undefined);
  assert.equal(await page.locator('#reportAnswers img, #reportAnswers b').count(), 0);
  assert.match(await page.locator('#reportAnswers').textContent(), /<b>bold<\/b>/);
  await context.close();
});

test('shows an error state when the engine fails to load', opts, async () => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.route('**/scanner-engine.js', route => route.abort());
  await page.goto(`${origin}/scan.html`);
  await page.waitForSelector('#scanFail:not([hidden])');
  assert.match(await page.locator('#scanFailTitle').textContent(), /could not load/);
  await context.close();
});

test('responsive: no horizontal overflow on phone, tablet and desktop', opts, async () => {
  for (const width of [360, 390, 820, 1440]) {
    const { page, context } = await open('/scan.html', { viewport: { width, height: 800 } });
    await completeScan(page);
    for (const where of ['report', 'home']) {
      if (where === 'home') { await page.goto(`${origin}/index.html`); await page.locator('#scan').scrollIntoViewIfNeeded(); }
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      assert.ok(overflow <= 0, `${where} at ${width}px overflows by ${overflow}px`);
    }
    await context.close();
  }
});

test('reduced motion: the flow still works without animation', opts, async () => {
  const { page, context, errors } = await open('/scan.html', { reducedMotion: 'reduce' });
  await choose(page, 'Finance & insurance'); await page.click('#scanNext');
  assert.equal(await page.locator('#scanForm').getAttribute('class'), 'scan-step');
  await choose(page, 'More than 250 people'); await page.click('#scanNext');
  await choose(page, 'Make better decisions with data'); await page.click('#scanNext');
  await choose(page, 'Reporting and finding the numbers'); await page.click('#scanNext');
  await page.click('#scanSkip'); await page.click('#scanSkip'); await page.click('#scanNext');
  await page.waitForSelector('#report:not([hidden])', { timeout: 2000 });
  assert.equal(await page.locator('.op').first().getAttribute('data-rank'), '1');
  assert.deepEqual(errors(), []);
  await context.close();
});
