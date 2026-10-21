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
const TYPES = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.avif': 'image/avif', '.png': 'image/png', '.jpg': 'image/jpeg', '.txt': 'text/plain', '.xml': 'application/xml' };
let server; let origin; let browser;

const opts = { skip: chromium ? false : 'playwright is not installed (run npm install in tests/)' };

test.before(async () => {
  if (!chromium) return;
  server = http.createServer((req, res) => {
    const url = decodeURIComponent(req.url.split('?')[0].split('#')[0]);
    let file = path.join(ROOT, url.endsWith('/') ? `${url}index.html` : url);
    // Like Cloudflare Pages: /scan serves scan.html.
    if (!path.extname(file) && fs.existsSync(`${file}.html`)) file = `${file}.html`;
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
  assert.equal(await cta.getAttribute('href'), '/scan');
  assert.match(await page.locator('#whatsappCta').getAttribute('href'), /^https:\/\/wa\.me\/2349165681202\?text=/);
  assert.equal(await page.locator('#contact a[href^="mailto:"]').count(), 0, 'no public email address in the contact section');
  assert.deepEqual(await page.locator('.desktop-nav a').evaluateAll(a => a.map(x => x.getAttribute('href'))), ['#solutions', '#work', '#ventures', '#about']);
  await cta.click();
  await page.waitForURL(/\/scan$/);
  await page.waitForSelector('#scanForm:not([hidden])');
  assert.deepEqual(errors(), []);
  await context.close();
});

test('questionnaire validates required answers and can be completed by keyboard', opts, async () => {
  const { page, context, errors } = await open('/scan.html');
  await page.waitForSelector('#scanForm:not([hidden])');
  assert.equal(await page.locator('#scanCount').textContent(), 'Question 1 of 8');
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
  assert.equal(await page.locator('#scanCount').textContent(), 'Question 2 of 8');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'scanQuestion', 'focus moves to the new question');
  for (let i = 0; i < 3; i += 1) {
    await page.keyboard.press('Tab');
    await page.keyboard.press('Space');
    await page.keyboard.press('Enter');
  }
  assert.equal(await page.locator('#scanCount').textContent(), 'Question 5 of 8 · Optional');
  assert.ok(await page.locator('#scanSkip').isVisible());
  await page.click('#scanSkip');
  await page.click('#scanSkip');
  await page.click('#scanSkip');
  assert.equal(await page.locator('#scanNextText').textContent(), 'See my report');
  await page.click('#scanNext');
  await page.waitForSelector('#report:not([hidden])');
  assert.ok((await page.locator('.op').count()) >= 1);
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
  ['Why this was selected for you', 'The problem it addresses', 'Proposed solution', 'How it would work', 'Possible benefits to validate', 'Implementation complexity', 'Main dependencies', 'Risks and limitations', 'Suggested first experiment', 'Success metrics to track', 'To estimate costs, savings or ROI, we would need', 'Indicative implementation sequence', 'How this was scored']
    .forEach(h => assert.ok(text.includes(h), h));
  assert.match(await page.locator('.basis-method').textContent(), /Generated recommendation.*rule-based/s);
  assert.match(await page.locator('#reportMeta').textContent(), /Not verified findings/);
  assert.match(await page.locator('#reportAnswers').textContent(), /Our stock counts are always wrong\./);
  assert.ok(!/%|£|\$|€|\bROI\b/.test((await page.locator('#reportOps').textContent()).replaceAll('To estimate costs, savings or ROI', '')), 'no invented figures');

  // Progressive disclosure: the first plan is open, the others start closed.
  const toggles = page.locator('.op-toggle');
  assert.equal(await toggles.nth(0).getAttribute('aria-expanded'), 'true');
  assert.equal(await toggles.nth(1).getAttribute('aria-expanded'), 'false');
  assert.ok(await page.locator('.op').nth(1).locator('.op-more').isHidden());
  await toggles.nth(1).click();
  assert.ok(await page.locator('.op').nth(1).locator('.op-more').isVisible());

  // Next steps.
  const help = decodeURIComponent(await page.locator('#helpLink').getAttribute('href'));
  assert.match(help, /^https:\/\/wa\.me\/2349165681202\?text=Scanner report: /);
  assert.match(help, /Suggested opportunities:\n1\. /);
  assert.ok(help.length < 2400, 'the prefilled message stays within a safe length');
  assert.equal(await page.locator('#helpLink').getAttribute('target'), '_blank');
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
  assert.ok(!page.url().includes('#'), 'answers are never left in the address bar');
  const url = decodeURIComponent(await page.locator('#saveEmail').getAttribute('href')).match(/Full report: (\S+)/)[1];
  assert.match(url, /#r=v1\./);
  const title = await page.locator('#reportTitle').textContent();
  await page.goto('about:blank');
  await page.goto(url);
  await page.waitForSelector('#report:not([hidden])');
  assert.equal(await page.locator('#reportTitle').textContent(), title);
  assert.match(await page.locator('#reportMeta').textContent(), /Opened from a link/);
  assert.ok(!page.url().includes('#r='), 'the link token is removed from the address bar after opening');
  assert.ok(!(await page.locator('#reportAnswers').textContent()).includes('secret detail'), 'notes are not in links');

  await page.goto(`${origin}/scan.html#r=v1.broken!`);
  await page.waitForSelector('#scanFail:not([hidden])');
  assert.match(await page.locator('#scanFailTitle').textContent(), /could not be opened/);
  assert.ok(await page.locator('#scanRetry').isHidden());
  await page.click('#scanRestart');
  await page.waitForSelector('#scanForm:not([hidden])');
  assert.equal(await page.locator('#scanCount').textContent(), 'Question 1 of 8');
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
  assert.equal(await page.locator('#scanCount').textContent(), 'Question 3 of 8');
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
  await page.click('#scanSkip'); await page.click('#scanSkip'); await page.click('#scanSkip'); await page.click('#scanNext');
  await page.waitForSelector('#report:not([hidden])', { timeout: 2000 });
  assert.equal(await page.locator('.op').first().getAttribute('data-rank'), '1');
  assert.deepEqual(errors(), []);
  await context.close();
});

async function ventureImages(page) {
  await page.locator('#ventures').scrollIntoViewIfNeeded();
  await page.waitForFunction(() => [...document.querySelectorAll('.venture-media img')].every(img => img.complete && img.naturalWidth > 0));
  return page.locator('.venture-media img').evaluateAll(imgs => imgs.map(img => ({ src: img.currentSrc, alt: img.getAttribute('alt'), w: img.naturalWidth, h: img.naturalHeight, box: img.getBoundingClientRect().toJSON() })));
}

test('ventures: three distinct images load at 4:3 in every card', opts, async () => {
  for (const viewport of [{ width: 390, height: 844 }, { width: 1280, height: 860 }]) {
    const { page, context, errors } = await open('/index.html', { viewport });
    const imgs = await ventureImages(page);
    assert.equal(imgs.length, 3);
    assert.equal(new Set(imgs.map(i => i.src)).size, 3, 'each venture has its own image');
    for (const [i, name] of ['huntly', 'tradr', 'maya'].entries()) {
      assert.match(imgs[i].src, new RegExp(`assets/ventures/${name}-\\d+\\.(avif|webp)$`));
      assert.equal(imgs[i].alt, '', 'imagery is decorative; the card text carries the meaning');
      assert.ok(Math.abs(imgs[i].box.width / imgs[i].box.height - 4 / 3) < 0.02, `${name} frame keeps 4:3`);
      assert.ok(imgs[i].w <= 1200, `${name} does not download an oversized source`);
    }
    if (viewport.width > 720) {
      const spread = key => Math.max(...imgs.map(i => i.box[key])) - Math.min(...imgs.map(i => i.box[key]));
      assert.ok(spread('top') < 1, 'images align across the grid');
      assert.ok(spread('width') < 1 && spread('height') < 1, 'images share one size');
    }
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'no horizontal overflow');
    assert.deepEqual(errors(), []);
    await context.close();
  }
});

test('ventures: hover eases the image without moving text or resizing the card', opts, async () => {
  const { page, context, errors } = await open('/index.html');
  await ventureImages(page);
  const card = page.locator('.venture').nth(1);
  // Positions relative to the card, so a scroll caused by hovering does not count as movement.
  const measure = () => card.evaluate(el => {
    const c = el.getBoundingClientRect();
    const rel = node => { const r = node.getBoundingClientRect(); return [r.left - c.left, r.top - c.top, r.width, r.height]; };
    return { card: [c.width, c.height], title: rel(el.querySelector('h3')), text: rel(el.querySelector('p')), frame: rel(el.querySelector('.venture-media')) };
  });
  await page.waitForFunction(() => document.querySelectorAll('.venture.is-in').length === 3);
  await card.scrollIntoViewIfNeeded();
  await page.waitForTimeout(1200);
  const before = await measure();
  assert.equal(await card.locator('.venture-media img').evaluate(img => getComputedStyle(img).transitionDuration), '0.65s');
  await card.hover();
  await page.waitForTimeout(900);
  const after = await measure();
  assert.deepEqual(after, before, 'card, frame and text stay put');
  const scale = await card.locator('.venture-media img').evaluate(img => new DOMMatrix(getComputedStyle(img).transform).a);
  assert.ok(scale > 1.02 && scale < 1.04, `hover scale is restrained (${scale})`);
  assert.deepEqual(errors(), []);
  await context.close();
});

test('ventures: reduced motion and touch show the images without any zoom', opts, async () => {
  for (const contextOptions of [{ reducedMotion: 'reduce' }, { hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } }]) {
    const { page, context, errors } = await open('/index.html', contextOptions);
    const imgs = await ventureImages(page);
    assert.equal(imgs.length, 3);
    const card = page.locator('.venture').first();
    await card.hover();
    await page.waitForTimeout(800);
    assert.equal(await card.locator('.venture-media img').evaluate(img => new DOMMatrix(getComputedStyle(img).transform).a), 1);
    assert.deepEqual(errors(), []);
    await context.close();
  }
});

test('a refresh keeps the report without putting answers in the address bar', opts, async () => {
  const { page, context } = await open('/scan.html');
  await completeScan(page);
  const title = await page.locator('#reportTitle').textContent();
  await page.reload();
  await page.waitForSelector('#report:not([hidden])');
  assert.equal(await page.locator('#reportTitle').textContent(), title);
  assert.equal(new URL(page.url()).hash, '');
  await context.close();
});

test('privacy notice explains how answers and analytics are handled', opts, async () => {
  const { page, context } = await open('/scan.html');
  await page.click('.scanner-details summary');
  const text = await page.locator('.scanner-details').textContent();
  assert.match(text, /processed in this browser only/);
  assert.match(text, /Cloudflare Web Analytics/);
  assert.match(text, /never your answers, notes or report/);
  await context.close();
});

async function withBeacon(urlPath, token) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const beacon = [];
  const leaked = [];
  await page.route(/fonts\.(googleapis|gstatic)\.com/, route => route.abort());
  await page.route('**/static.cloudflareinsights.com/**', route => { beacon.push(route.request().url()); route.fulfill({ status: 200, contentType: 'text/javascript', body: '' }); });
  if (token) {
    const source = fs.readFileSync(path.join(ROOT, 'analytics.js'), 'utf8').replace("const TOKEN = '';", `const TOKEN = '${token}';`);
    await page.route('**/analytics.js', route => route.fulfill({ status: 200, contentType: 'text/javascript', body: source }));
  }
  page.on('request', req => { if (!req.url().startsWith(origin) && /retail|stock|Our%20notes/i.test(req.url() + (req.postData() || ''))) leaked.push(req.url()); });
  await page.goto(origin + urlPath);
  await page.waitForLoadState('load');
  return { page, context, beacon, leaked };
}

test('analytics stays off until a token is set', opts, async () => {
  const { context, beacon } = await withBeacon('/scan.html', '');
  assert.deepEqual(beacon, []);
  await context.close();
});

test('analytics counts page views but never receives answers', opts, async () => {
  const home = await withBeacon('/index.html', 'test-token');
  assert.equal(home.beacon.length, 1, 'beacon loads on the homepage');
  const tag = await home.page.locator('script[data-cf-beacon]').getAttribute('data-cf-beacon');
  assert.deepEqual(JSON.parse(tag), { token: 'test-token', spa: false });
  await home.context.close();

  const scan = await withBeacon('/scan.html', 'test-token');
  assert.equal(scan.beacon.length, 1, 'beacon loads on the scanner page');
  await completeScan(scan.page, { context: 'Our notes' });
  assert.equal(new URL(scan.page.url()).hash, '');
  assert.deepEqual(scan.leaked, []);
  const link = decodeURIComponent(await scan.page.locator('#saveEmail').getAttribute('href')).match(/Full report: (\S+)/)[1];
  await scan.context.close();

  const shared = await withBeacon(new URL(link).pathname + new URL(link).hash, 'test-token');
  await shared.page.waitForSelector('#report:not([hidden])');
  assert.deepEqual(shared.beacon, [], 'no beacon on a page opened from a report link');
  await shared.context.close();
});

/* ---------- Discoverability ---------- */
const SITE = 'https://buildwisegroup.dev';
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');

test('pages have unique titles, descriptions and canonical social metadata', opts, async () => {
  const pages = [['/index.html', `${SITE}/`], ['/scan.html', `${SITE}/scan`], ['/website-audit.html', `${SITE}/website-audit`]];
  const seen = { title: new Set(), description: new Set() };
  for (const [urlPath, canonical] of pages) {
    const { page, context, errors } = await open(urlPath);
    const meta = sel => page.locator(sel).getAttribute('content');
    const title = await page.title();
    const description = await meta('meta[name="description"]');
    assert.ok(!seen.title.has(title) && !seen.description.has(description), `${urlPath} has its own title and description`);
    seen.title.add(title); seen.description.add(description);
    assert.ok(description.length >= 70 && description.length <= 170, 'description is a useful length');
    assert.equal(await page.locator('link[rel="canonical"]').getAttribute('href'), canonical);
    assert.equal(await meta('meta[property="og:url"]'), canonical);
    assert.equal(await page.locator('meta[name="robots"]').count(), 0, 'landing pages are indexable');
    const image = await meta('meta[property="og:image"]');
    assert.ok(image.startsWith(`${SITE}/`) && fs.existsSync(path.join(ROOT, image.slice(SITE.length))), 'og:image is a local asset');
    assert.equal(await meta('meta[name="twitter:card"]'), 'summary_large_image');
    assert.equal(await page.locator('h1').count() >= 1, true);
    assert.deepEqual(errors(), []);
    await context.close();
  }
});

test('homepage structured data describes the organisation accurately', opts, async () => {
  const { page, context } = await open('/index.html');
  const data = JSON.parse(await page.locator('script[type="application/ld+json"]').textContent());
  const org = data['@graph'].find(n => n['@type'] === 'Organization');
  const site = data['@graph'].find(n => n['@type'] === 'WebSite');
  assert.equal(org.url, `${SITE}/`);
  assert.equal(site.url, `${SITE}/`);
  assert.ok(fs.existsSync(path.join(ROOT, org.logo.slice(SITE.length))), 'logo is a local asset');
  const body = await page.locator('body').textContent();
  assert.ok(!('email' in org), 'no personal email address in structured data');
  for (const name of ['Huntly', 'Tradr', 'Maya']) assert.ok(body.includes(name) && org.description.includes(name));
  assert.equal(await page.locator('h1').count(), 1, 'one h1 on the homepage');
  await context.close();
});

test('robots.txt and sitemap.xml list exactly the canonical public pages', () => {
  const robots = read('robots.txt');
  assert.match(robots, /^User-agent: \*$/m);
  assert.ok(!/^Disallow:\s*\/\s*$/m.test(robots), 'the site is not blocked');
  assert.match(robots, new RegExp(`^Sitemap: ${SITE}/sitemap.xml$`, 'm'));
  const locs = [...read('sitemap.xml').matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
  assert.deepEqual(locs, [`${SITE}/`, `${SITE}/scan`, `${SITE}/website-audit`, `${SITE}/privacy`]);
  assert.match(robots, /^Disallow: \/api\/$/m);
  assert.ok(!read('sitemap.xml').includes('#'), 'no report links in the sitemap');
  assert.match(read('index.html'), new RegExp(`rel="canonical" href="${locs[0]}"`));
  assert.match(read('scan.html'), new RegExp(`rel="canonical" href="${locs[1]}"`));
  assert.match(read('website-audit.html'), new RegExp(`rel="canonical" href="${locs[2]}"`));
  assert.match(read('privacy.html'), new RegExp(`rel="canonical" href="${locs[3]}"`));
});

test('unknown paths get a real 404 page that is not indexed', () => {
  // Without 404.html, Cloudflare Pages answers every unknown path with the homepage and a 200.
  const html = read('404.html');
  assert.match(html, /<meta name="robots" content="noindex">/);
  assert.match(html, /href="\/"/);
  assert.match(read('_headers'), /\/tests\/\*\n\s+X-Robots-Tag: noindex/);
});

test('a page showing a report is marked noindex, and the questionnaire is not', opts, async () => {
  const { page, context, errors } = await open('/scan');
  const robots = () => page.locator('meta[name="robots"]').count();
  assert.equal(await robots(), 0);
  await completeScan(page);
  assert.equal(await page.locator('meta[name="robots"]').getAttribute('content'), 'noindex');
  const url = decodeURIComponent(await page.locator('#saveEmail').getAttribute('href')).match(/Full report: (\S+)/)[1];
  assert.equal(new URL(url).pathname, '/scan', 'share links use the canonical path');
  await page.click('#reportRestart');
  await page.waitForSelector('#scanForm:not([hidden])');
  assert.equal(await robots(), 0);
  await page.goto('about:blank');
  await page.goto(url);
  await page.waitForSelector('#report:not([hidden])');
  assert.equal(await page.locator('meta[name="robots"]').getAttribute('content'), 'noindex');
  assert.deepEqual(errors(), []);
  await context.close();
});

test('local links and assets on every page resolve', () => {
  const missing = [];
  for (const file of ['index.html', 'scan.html', 'website-audit.html', '404.html', 'llms.txt']) {
    const refs = [...read(file).matchAll(/(?:href|src)="([^"]+)"|](https:\/\/buildwisegroup\.dev[^)]*)\)/g)].map(m => m[1] || m[2]);
    for (let ref of refs) {
      if (ref.startsWith(SITE)) ref = ref.slice(SITE.length) || '/';
      if (/^(https?:|mailto:|#|data:)/.test(ref)) continue;
      let target = path.join(ROOT, ref.split('#')[0].split('?')[0]);
      if (target.endsWith(path.sep)) target += 'index.html';
      if (!path.extname(target)) target += '.html';
      if (!fs.existsSync(target)) missing.push(`${file}: ${ref}`);
    }
  }
  assert.deepEqual(missing, []);
});

test('public files point only at the canonical domain', () => {
  for (const file of ['index.html', 'scan.html', 'website-audit.html', '404.html', 'privacy.html', 'robots.txt', 'sitemap.xml', 'llms.txt']) {
    assert.ok(!read(file).includes('pages.dev'), `${file} does not reference the pages.dev address`);
  }
});

/* ---------- Optional website ---------- */
async function toLastQuestion(page) {
  await choose(page, 'Retail & e-commerce'); await page.click('#scanNext');
  await choose(page, '11 to 50 people'); await page.click('#scanNext');
  await choose(page, 'Reduce costs'); await page.click('#scanNext');
  await choose(page, 'Stock, supply and orders'); await page.click('#scanNext');
  await page.click('#scanSkip'); await page.click('#scanSkip'); await page.click('#scanSkip');
}

test('website: optional field on the last question, validated, shown as not visited and never fetched', opts, async () => {
  const { page, context, errors } = await open('/scan.html');
  const outside = [];
  page.on('request', req => { if (/acme|evil/i.test(req.url())) outside.push(req.url()); });
  await toLastQuestion(page);
  assert.equal(await page.locator('#scanCount').textContent(), 'Question 8 of 8 · Optional', 'no extra question');
  assert.equal(await page.locator('label[for="scanWebsite"]').textContent(), 'Your website (optional)');

  await page.fill('#scanWebsite', 'localhost:3000');
  await page.click('#scanNext');
  assert.match(await page.locator('#scanError').textContent(), /like example\.com/);
  assert.equal(await page.locator('#scanWebsite').getAttribute('aria-invalid'), 'true');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'scanWebsite');
  assert.ok(await page.locator('#scanForm').isVisible(), 'an invalid address does not produce a report');

  await page.fill('#scanWebsite', 'https://www.acme-shop.co.uk/?session=abc123');
  await page.click('#scanNext');
  await page.waitForSelector('#report:not([hidden])');
  const answersText = await page.locator('#reportAnswers').textContent();
  assert.match(answersText, /www\.acme-shop\.co\.uk \(not visited\)/);
  assert.ok(!answersText.includes('abc123'), 'query strings are dropped');
  assert.match(await page.locator('#reportWebsite').textContent(), /did not visit or check it\. This report is based only on your answers\./);
  assert.match(await page.locator('#reportMeta').textContent(), /Website not visited/);

  const help = decodeURIComponent(await page.locator('#helpLink').getAttribute('href'));
  assert.match(help, /Website: www\.acme-shop\.co\.uk \(not checked by the scanner\)/);
  const link = decodeURIComponent(await page.locator('#saveEmail').getAttribute('href')).match(/Full report: (\S+)/)[1];
  assert.ok(!Buffer.from(link.split('#r=v1.')[1], 'base64url').toString().includes('acme'), 'report links leave the website out');
  assert.ok(!page.url().includes('acme'));
  assert.deepEqual(outside, [], 'the website is never requested');

  await page.reload();
  await page.waitForSelector('#report:not([hidden])');
  assert.match(await page.locator('#reportAnswers').textContent(), /acme-shop/);
  assert.deepEqual(errors(), []);
  await context.close();
});

test('website: skipping the last question clears it, and a report without one has no website note', opts, async () => {
  const { page, context } = await open('/scan.html');
  await toLastQuestion(page);
  await page.fill('#scanWebsite', 'not a website');
  await page.click('#scanSkip');
  await page.waitForSelector('#report:not([hidden])');
  assert.ok(await page.locator('#reportWebsite').isHidden());
  assert.ok(!(await page.locator('#reportAnswers').textContent()).includes('Website'));
  await context.close();
});


/* ---------- Website & AI Visibility Audit ---------- */
// The page talks to the real handler (lib/audit/handler.mjs) running in this process
// against a fake network, so no request leaves the machine.
let auditLib;
async function auditPage({ routes, viewport, handler } = {}) {
  if (!auditLib) {
    auditLib = {
      handler: await import('../lib/audit/handler.mjs'),
      net: await import('./fixtures/fake-net.mjs')
    };
  }
  const net = auditLib.net.fakeNet(routes || auditLib.net.goodSite());
  const deps = { ...net, limiter: auditLib.handler.createLimiter(), cache: null };
  const calls = [];
  const { page, context, errors } = await open('/website-audit.html', viewport ? { viewport } : {});
  await page.route('**/api/website-audit', async route => {
    const req = route.request();
    calls.push(JSON.parse(req.postData() || '{}'));
    if (handler) return handler(route);
    const headers = { ...req.headers(), origin: 'https://buildwisegroup.dev', 'cf-connecting-ip': '203.0.113.5' };
    const res = await auditLib.handler.handleAudit(new Request('https://buildwisegroup.dev/api/website-audit', { method: 'POST', headers, body: req.postData() }), deps);
    return route.fulfill({ status: res.status, headers: Object.fromEntries(res.headers), body: await res.text() });
  });
  await page.waitForSelector('#auditForm:not([hidden])');
  return { page, context, errors, calls, net };
}

test('audit: the page explains what it does and that it is not a guarantee', opts, async () => {
  const { page, context, errors } = await auditPage();
  assert.equal(await page.locator('#auditTitle').textContent(), 'Can search engines and AI systems understand your website?');
  assert.match(await page.locator('.scanner-intro').textContent(), /technical SEO, crawler-access and content-discoverability issues/);
  assert.equal((await page.locator('#auditSubmit').textContent()).trim(), 'Audit my website');
  assert.match(await page.locator('.scanner-privacy').textContent(), /not a guarantee of search rankings, AI citations or customers/);
  await page.click('.scanner-details summary');
  assert.match(await page.locator('.scanner-details').textContent(), /never logs in, submits forms, runs your site’s scripts/);
  assert.equal(await page.locator('meta[name="robots"]').count(), 0);
  assert.deepEqual(errors(), []);
  await context.close();
});

test('audit: a report separates confirmed findings, recommendations, crawler rules and what was not checked', opts, async () => {
  const { goodSite } = await import('./fixtures/fake-net.mjs');
  const routes = goodSite('https://acme.example.com', {
    'https://acme.example.com/robots.txt': { type: 'text/plain', body: 'User-agent: OAI-SearchBot\nDisallow: /\n\nUser-agent: GPTBot\nDisallow: /\n\nUser-agent: *\nAllow: /' },
    'https://acme.example.com/about': { status: 404 }
  });
  const { page, context, errors, calls } = await auditPage({ routes });
  await page.fill('#auditUrl', 'acme.example.com');
  await page.keyboard.press('Enter');
  await page.waitForSelector('#auditReport:not([hidden])');
  assert.deepEqual(calls, [{ url: 'acme.example.com' }]);
  assert.equal(await page.locator('#reportTitle').textContent(), 'Audit of acme.example.com');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'reportTitle');
  const confirmed = await page.locator('#confirmedList').textContent();
  assert.match(confirmed, /robots\.txt blocks AI search crawlers \(OAI-SearchBot\)/);
  assert.match(confirmed, /User-agent: OAI-SearchBot \(line 1\), Disallow: \/ \(line 2\)/);
  assert.match(confirmed, /1 broken internal link/);
  assert.match(confirmed, /Why it matters/);
  assert.match(confirmed, /Recommended fix/);
  assert.match(await page.locator('#advisoryList').textContent(), /Little descriptive text/);
  const gpt = page.locator('#crawlerRows tr', { hasText: 'GPTBot' });
  assert.match(await gpt.textContent(), /AI model training.*Opted out/);
  assert.match(await page.locator('#crawlerRows tr', { hasText: 'Googlebot' }).textContent(), /Allowed/);
  assert.match(await page.locator('#notCheckedList').textContent(), /crawled, indexed or cited/);
  assert.match(await page.locator('#reportDisclaimer').textContent(), /not a guarantee/);
  assert.ok(!(await page.locator('#auditReport').textContent()).match(/score/i) || (await page.locator('#reportMeta').textContent()).includes('No score'));
  assert.equal(await page.locator('meta[name="robots"]').getAttribute('content'), 'noindex');
  assert.ok(!page.url().includes('acme'), 'the audited address never appears in the page URL');

  const help = decodeURIComponent(await page.locator('#helpLink').getAttribute('href'));
  assert.ok(help.startsWith('https://wa.me/2349165681202?text=Website audit: acme.example.com'));
  assert.match(help, /\[High\] robots\.txt blocks AI search crawlers/);
  assert.match(await page.locator('.next-card-accent').textContent(), /Nothing is sent automatically/);
  assert.match(await page.locator('#crossCopy').textContent(), /AI Business Opportunity Scanner/);
  assert.equal(await page.locator('.next-card a[href="/scan"]').count(), 1);

  await page.reload();
  await page.waitForSelector('#auditReport:not([hidden])');
  assert.equal(await page.locator('#reportTitle').textContent(), 'Audit of acme.example.com', 'the report survives a reload in this tab');
  await page.click('#auditAgain');
  await page.waitForSelector('#auditForm:not([hidden])');
  assert.equal(await page.locator('meta[name="robots"]').count(), 0);
  assert.deepEqual(errors(), []);
  await context.close();
});

test('audit: content from the audited site is shown as text, never run as markup', opts, async () => {
  const { page: html } = await import('./fixtures/fake-net.mjs');
  const evil = '<img src=x onerror="window.__pwned=1"><script>window.__pwned=2</script>';
  const routes = {
    'https://evil.example.com/': { type: 'text/html', body: html({ head: `<title>${evil.replace(/</g, '&lt;')}</title><meta name="description" content="&lt;b onmouseover=alert(1)&gt;hi&lt;/b&gt;">`, body: `<h1>&lt;svg onload=window.__pwned=3&gt;</h1><a href="javascript:window.__pwned=4">x</a>` }) },
    'https://evil.example.com/robots.txt': { type: 'text/plain', body: 'User-agent: *\n<script>window.__pwned=5</script>\nDisallow: /<img src=x onerror=window.__pwned=6>' }
  };
  const { page, context } = await auditPage({ routes });
  await page.fill('#auditUrl', 'evil.example.com');
  await page.click('#auditSubmit');
  await page.waitForSelector('#auditReport:not([hidden])');
  assert.equal(await page.evaluate(() => window.__pwned), undefined);
  assert.equal(await page.locator('#auditReport img, #auditReport script, #auditReport svg:not(.ico), #auditReport b').count(), 0);
  assert.match(await page.locator('#reportIntro').textContent(), /<img src=x onerror="window.__pwned=1">/);
  assert.match(await page.locator('#auditReport').textContent(), /<script>window.__pwned=5<\/script>/);
  const hrefs = await page.locator('#auditReport a').evaluateAll(as => as.map(a => a.getAttribute('href')));
  assert.ok(hrefs.every(h => /^(https:|mailto:|\/)/.test(h)), hrefs.join(' '));
  await context.close();
});

test('audit: invalid and blocked addresses are explained without running an audit', opts, async () => {
  const { page, context, calls, net } = await auditPage();
  await page.click('#auditSubmit');
  assert.match(await page.locator('#auditError').textContent(), /like example\.com/);
  assert.equal(await page.locator('#auditUrl').getAttribute('aria-invalid'), 'true');
  assert.equal(calls.length, 0, 'an empty address is caught in the page');
  await page.fill('#auditUrl', 'http://169.254.169.254/latest/meta-data/');
  await page.click('#auditSubmit');
  await page.waitForFunction(() => /public website/.test(document.getElementById('auditError').textContent));
  assert.ok(await page.locator('#auditForm').isVisible());
  assert.equal(net.requests.length, 0, 'nothing was fetched');
  await context.close();
});

test('audit: failures show a clear message and a way to retry', opts, async () => {
  let mode = 'rate';
  const handler = route => {
    if (mode === 'rate') return route.fulfill({ status: 429, contentType: 'application/json', body: JSON.stringify({ error: { code: 'rate_limited', message: 'You’ve run several audits in a short time. Please wait a few minutes and try again.' } }) });
    if (mode === 'html') return route.fulfill({ status: 502, contentType: 'text/html', body: '<h1>Bad gateway</h1>' });
    return route.abort('failed');
  };
  const { page, context } = await auditPage({ handler });
  await page.fill('#auditUrl', 'acme.example.com');
  await page.click('#auditSubmit');
  await page.waitForSelector('#auditFail:not([hidden])');
  assert.match(await page.locator('#auditFailCopy').textContent(), /wait a few minutes/);
  assert.equal(await page.evaluate(() => document.activeElement.id), 'auditFailTitle');
  mode = 'html';
  await page.click('#auditRetry');
  await page.waitForFunction(() => /went wrong on our side/.test(document.getElementById('auditFailCopy').textContent));
  mode = 'network';
  await page.click('#auditRetry');
  await page.waitForFunction(() => /couldn’t reach the audit service/.test(document.getElementById('auditFailTitle').textContent));
  await page.click('#auditChange');
  assert.ok(await page.locator('#auditForm').isVisible());
  assert.equal(await page.inputValue('#auditUrl'), 'acme.example.com');
  await context.close();
});

test('audit: no horizontal overflow on phone, tablet and desktop, and reduced motion works', opts, async () => {
  for (const viewport of [{ width: 360, height: 780 }, { width: 768, height: 1024 }, { width: 1440, height: 900 }]) {
    const { page, context } = await auditPage({ viewport });
    const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert.equal(await overflow(), 0, `form at ${viewport.width}px`);
    await page.fill('#auditUrl', 'acme.example.com');
    await page.click('#auditSubmit');
    await page.waitForSelector('#auditReport:not([hidden])');
    assert.equal(await overflow(), 0, `report at ${viewport.width}px`);
    await context.close();
  }
  const { page, context } = await auditPage();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.fill('#auditUrl', 'acme.example.com');
  await page.click('#auditSubmit');
  await page.waitForSelector('#auditReport:not([hidden])');
  await context.close();
});

test('audit: keyboard users can reach every control in a logical order', opts, async () => {
  const { page, context } = await auditPage();
  await page.locator('#auditUrl').focus();
  await page.keyboard.type('acme.example.com');
  await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'auditSubmit');
  await page.keyboard.press('Enter');
  await page.waitForSelector('#auditReport:not([hidden])');
  const ids = [];
  for (let i = 0; i < 40; i += 1) {
    await page.keyboard.press('Tab');
    ids.push(await page.evaluate(() => document.activeElement.id || document.activeElement.tagName));
  }
  for (const id of ['helpLink', 'copySummary', 'saveDownload', 'savePrint', 'auditAgain']) assert.ok(ids.includes(id), `${id} is reachable`);
  assert.ok(ids.indexOf('helpLink') < ids.indexOf('auditAgain'));
  await context.close();
});

test('scanner report suggests the website audit and hands the address over without a URL', opts, async () => {
  const { page, context } = await open('/scan.html');
  await toLastQuestion(page);
  await page.fill('#scanWebsite', 'acme-shop.co.uk');
  await page.click('#scanNext');
  await page.waitForSelector('#report:not([hidden])');
  assert.ok(await page.locator('#reportCross').isVisible());
  assert.match(await page.locator('#crossLead').textContent(), /acme-shop\.co\.uk/);
  assert.equal(await page.locator('#crossLink').getAttribute('href'), '/website-audit');
  await page.route('**/website-audit', route => route.fulfill({ status: 200, contentType: 'text/html', body: fs.readFileSync(path.join(ROOT, 'website-audit.html'), 'utf8') }));
  await page.click('#crossLink');
  await page.waitForSelector('#auditForm:not([hidden])');
  assert.equal(await page.inputValue('#auditUrl'), 'https://acme-shop.co.uk/');
  assert.ok(!page.url().includes('acme'));
  await context.close();

  // Without a website, the suggestion only appears when the bottleneck is about leads or marketing.
  const other = await open('/scan.html');
  await completeScan(other.page);
  assert.ok(await other.page.locator('#reportCross').isHidden());
  await other.context.close();
});
