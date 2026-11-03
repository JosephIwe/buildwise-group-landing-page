/* Tests for the SEO / AI-visibility / growth upgrade: the generated service pages and
 * Insights drafts, their structured data and claims, robots.txt crawler groups, the
 * sitemap, internal links and the conversion events in analytics.js.
 * Run with `npm test` in this folder; browser tests use Playwright's Chromium.
 * Web3Forms and every other outside host are answered or blocked locally. */
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

let chromium;
try { ({ chromium } = require('playwright')); } catch (e) { chromium = null; }

const ROOT = path.resolve(__dirname, '..');
const SITE = 'https://buildwisegroup.dev';
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');
const text = html => html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ');
const jsonld = html => JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
const E = require(path.join(ROOT, 'contact-form.js'));
const TYPES = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.avif': 'image/avif', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2' };

let content, builder;
test.before(async () => {
  content = await import(pathToFileURL(path.join(ROOT, 'content/services.mjs')));
  builder = await import(pathToFileURL(path.join(ROOT, 'scripts/build-pages.mjs')));
});

const SLUGS = ['ai-automation-nigeria', 'ai-automation-lagos', 'ai-agents', 'whatsapp-automation', 'custom-software-development', 'ai-visibility', 'business-automation', 'ai-receptionist'];

/* ---------- Generated output ---------- */
test('generated pages are up to date with content/ (run `node scripts/build-pages.mjs`)', () => {
  const outputs = builder.build({ check: true });
  for (const [file, html] of outputs) assert.equal(read(file), html, `${file} matches its source; rebuild and commit`);
  for (const file of ['index.html', 'cybersecurity.html', 'scan.html', 'website-audit.html', 'privacy.html', 'security.html']) {
    assert.ok(read(file).includes(builder.FOOTER_SERVICES()), `${file} has the current footer service links`);
  }
});

test('the eight service pages exist at the agreed URLs, each with its own search intent', () => {
  assert.deepEqual(content.SERVICES.map(s => s.slug).sort(), [...SLUGS].sort());
  const seen = { title: new Set(), description: new Set(), h1: new Set() };
  for (const slug of SLUGS) {
    const html = read(`${slug}.html`);
    const title = html.match(/<title>([^<]+)<\/title>/)[1];
    const description = html.match(/<meta name="description" content="([^"]+)">/)[1];
    const h1s = html.match(/<h1[\s\S]*?<\/h1>/g);
    assert.equal(h1s.length, 1, `${slug}: one h1`);
    const h1 = text(h1s[0]).trim();
    for (const [k, v] of [['title', title], ['description', description], ['h1', h1]]) {
      assert.ok(!seen[k].has(v), `${slug}: ${k} is unique`); seen[k].add(v);
    }
    assert.ok(title.length <= 70, `${slug}: title fits in results (${title.length})`);
    assert.ok(description.length >= 110 && description.length <= 175, `${slug}: description is a useful length (${description.length})`);
    assert.match(html, new RegExp(`<link rel="canonical" href="${SITE}/${slug}">`));
    assert.match(html, new RegExp(`<meta property="og:url" content="${SITE}/${slug}">`));
    assert.ok(!/<meta name="robots"/.test(html), `${slug}: indexable`);
    assert.match(html, /<html lang="en">/);
    assert.ok(text(html).split(' ').length > 1100, `${slug}: substantial content, not a thin page`);
  }
});

test('service pages: structured data is valid, accurate and matches the page', () => {
  for (const slug of SLUGS) {
    const html = read(`${slug}.html`);
    const graph = jsonld(html)['@graph'];
    const types = graph.map(n => n['@type']);
    assert.deepEqual(types, ['WebPage', 'Service', 'BreadcrumbList'], `${slug}: WebPage, Service and BreadcrumbList`);
    const service = graph[1];
    assert.equal(service.provider['@id'], `${SITE}/#organization`);
    assert.equal(service.url, `${SITE}/${slug}`);
    assert.equal(graph[2].itemListElement.at(-1).item, `${SITE}/${slug}`);
    const raw = JSON.stringify(graph);
    for (const banned of ['LocalBusiness', 'PostalAddress', 'address', 'aggregateRating', 'review', 'FAQPage', 'foundingDate', 'numberOfEmployees', 'award', 'email']) {
      assert.ok(!raw.includes(`"${banned}`) && !raw.includes(`"@type":"${banned}`), `${slug}: no ${banned} in structured data`);
    }
  }
  const org = jsonld(read('index.html'))['@graph'].find(n => n['@type'] === 'Organization');
  assert.deepEqual(org.areaServed.map(a => a.name), ['Nigeria', 'Worldwide']);
  assert.ok(!('address' in org) && !('foundingDate' in org) && !('aggregateRating' in org));
});

test('claims rules: no invented results, rankings, offices or guarantees on new pages and articles', () => {
  const files = [...SLUGS.map(s => `${s}.html`), 'insights.html', ...fs.readdirSync(path.join(ROOT, 'insights')).map(f => `insights/${f}`)];
  const banned = [
    /\b(industry[- ]leading|market[- ]leading|number[- ]one|award[- ]winning|top[- ]rated|best (AI|software|automation) (company|agency))\b/i,
    /\bwe guarantee\b|\bguaranteed to (rank|appear|be recommended)\b/i,
    /\b\d{1,3}\s?% (more|less|fewer|increase|reduction|savings|faster)\b/i,
    /\b(our|visit our|visit us at our) (Lagos |Abuja )?(office|premises|headquarters)\b/i,
    /\bMarvels\b/i,
    /five[- ]star|★|\bour clients say\b/i,
    /[\w.+-]+@[\w-]+\.(com|dev|ng|io|co)\b/
  ];
  for (const file of files) {
    const body = text(read(file));
    for (const re of banned) assert.ok(!re.test(body), `${file} breaks a claims rule: ${body.match(re)}`);
  }
  assert.match(text(read('ai-automation-lagos.html')), /do not have a physical office/);
  assert.match(text(read('ai-visibility.html')), /No one can guarantee/);
});

test('service pages: the enquiry form is preselected, labelled by page and delivered like every other enquiry', () => {
  for (const s of content.SERVICES) {
    const html = read(`${s.slug}.html`);
    assert.ok(E.PROJECT_TYPES.includes(s.projectType), `${s.slug}: ${s.projectType} is a valid type`);
    const select = html.match(/<select[^>]*id="enqType"[\s\S]*?<\/select>/)[0];
    const options = [...select.matchAll(/<option(?: selected)?>([^<]+)<\/option>/g)].map(m => m[1]);
    assert.deepEqual([...options].sort(), [...E.PROJECT_TYPES].sort(), `${s.slug} offers every type`);
    assert.equal([...select.matchAll(/<option selected>([^<]+)</g)].map(m => m[1]).join(), s.projectType);
    assert.match(html, new RegExp(`data-page="${SITE}/${s.slug}#enquire"`));
    for (const m of html.matchAll(/href="(https:\/\/wa\.me\/[^"]+)"/g)) assert.equal(new URL(m[1].replace(/&amp;/g, '&')).pathname, '/2349165681202');
    assert.ok(!/mailto:/.test(html), `${s.slug}: no email address`);
  }
});

test('internal links: every service page is linked from the homepage and every footer, and every local link resolves', () => {
  const home = read('index.html');
  for (const slug of SLUGS) assert.match(home, new RegExp(`href="/${slug}"`), `homepage links to /${slug}`);
  const files = ['index.html', 'cybersecurity.html', 'scan.html', 'website-audit.html', 'privacy.html', 'security.html', ...SLUGS.map(s => `${s}.html`), 'insights.html', ...fs.readdirSync(path.join(ROOT, 'insights')).map(f => `insights/${f}`)];
  for (const file of files) {
    const html = read(file);
    const footer = html.match(/<footer[\s\S]*?<\/footer>/)[0];
    for (const slug of SLUGS) assert.match(footer, new RegExp(`href="/${slug}"`), `${file} footer links to /${slug}`);
    for (const m of html.matchAll(/href="(\/[^"#?]*)/g)) {
      const p = m[1];
      if (p === '/' || p.startsWith('/assets/') || /\.(css|js|svg|png|woff2)$/.test(p)) continue;
      const exists = fs.existsSync(path.join(ROOT, `${p}.html`)) || fs.existsSync(path.join(ROOT, p));
      assert.ok(exists, `${file}: ${p} resolves to a page`);
    }
  }
  // Every page links on to related services
  for (const slug of SLUGS) assert.ok((read(`${slug}.html`).match(/class="svc-related"[\s\S]*?<\/ul>/)[0].match(/<li /g) || []).length >= 3);
});

/* ---------- Insights ---------- */
test('insights: ten articles, drafts stay out of search and the sitemap until approved', () => {
  const articles = builder.loadArticles();
  assert.equal(articles.length, 10);
  const sitemap = read('sitemap.xml');
  for (const a of articles) {
    const html = read(`insights/${a.slug}.html`);
    assert.ok(content.SERVICES.some(s => s.slug === a.service), `${a.slug} links a real service`);
    assert.match(html, new RegExp(`href="/${a.service}"`), `${a.slug} links to its service page`);
    const graph = jsonld(html)['@graph'];
    assert.equal(graph[0]['@type'], 'Article');
    assert.equal(graph[0].author['@id'], `${SITE}/#organization`, 'authored by the organisation, not an invented person');
    if (a.status === 'published') {
      assert.ok(!/<meta name="robots"/.test(html));
      assert.ok(sitemap.includes(`${SITE}/insights/${a.slug}<`));
    } else {
      assert.match(html, /<meta name="robots" content="noindex, follow">/, `${a.slug} draft is noindex`);
      assert.match(html, /Draft for review/);
      assert.ok(!sitemap.includes(`/insights/${a.slug}`), `${a.slug} draft is not in the sitemap`);
    }
    assert.ok(text(html.match(/<div class="container art-narrow art-body">[\s\S]*?<\/div>/)[0]).split(' ').length > 550, `${a.slug}: a substantial article`);
  }
  if (!articles.some(a => a.status === 'published')) {
    assert.match(read('insights.html'), /<meta name="robots" content="noindex, follow">/);
    for (const f of ['index.html', ...SLUGS.map(s => `${s}.html`)]) {
      assert.ok(!/href="\/insights/.test(read(f)), `${f} doesn't link unpublished Insights pages`);
    }
  }
});

/* ---------- Crawlers ---------- */
test('robots.txt: search and AI-search crawlers are explicitly allowed, with /api/ kept private for each', () => {
  const robots = read('robots.txt');
  const groups = robots.split(/\n(?=User-agent:)/).filter(g => g.startsWith('User-agent:'));
  const byAgent = Object.fromEntries(groups.map(g => [g.match(/^User-agent: (.+)$/m)[1], g]));
  for (const agent of ['Googlebot', 'Bingbot', 'OAI-SearchBot', 'ChatGPT-User', 'PerplexityBot', 'Claude-SearchBot', '*']) {
    assert.ok(byAgent[agent], `${agent} has a group`);
    assert.match(byAgent[agent], /^Allow: \/$/m);
    assert.match(byAgent[agent], /^Disallow: \/api\/$/m);
    assert.ok(!/^Disallow: \/\s*$/m.test(byAgent[agent]), `${agent} is not blocked`);
  }
  assert.ok(!/GPTBot/.test(groups.join('\n')), 'training crawlers are left to the owner’s decision, under *');
});

test('_headers keeps source folders out of search', () => {
  const h = read('_headers');
  for (const dir of ['/content/*', '/scripts/*']) assert.match(h, new RegExp(`^${dir.replace('*', '\\*')}\\n  X-Robots-Tag: noindex$`, 'm'));
});

/* ---------- Browser checks ---------- */
let browser, server, origin;
const opts = { skip: !chromium && 'playwright is not installed' };
test.before(async () => {
  if (!chromium) return;
  server = http.createServer((req, res) => {
    const url = decodeURIComponent(req.url.split('?')[0].split('#')[0]);
    let file = path.join(ROOT, url.endsWith('/') ? `${url}index.html` : url);
    if (!path.extname(file) && fs.existsSync(`${file}.html`)) file = `${file}.html`;
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
});
test.after(async () => { if (browser) await browser.close(); if (server) server.close(); });

async function open(urlPath, viewport = { width: 1280, height: 860 }) {
  const context = await browser.newContext({ viewport, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const errors = [];
  const sent = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/ERR_FAILED/.test(m.text())) errors.push(m.text()); });
  await page.route('https://api.web3forms.com/**', route => { sent.push(JSON.parse(route.request().postData())); route.fulfill({ status: 200, contentType: 'application/json', body: '{"success":true}' }); });
  await page.route(/^https?:\/\/(?!127\.0\.0\.1|api\.web3forms\.com)/, route => route.abort());
  await page.goto(origin + urlPath);
  await page.waitForLoadState('load');
  return { page, context, errors, sent };
}

test('service pages and articles render without errors or sideways scrolling on phone and desktop', opts, async () => {
  const paths = [...SLUGS.map(s => `/${s}`), '/insights', '/insights/whatsapp-ai-automation-nigeria'];
  for (const width of [360, 1440]) {
    for (const p of paths) {
      const { page, context, errors } = await open(p, { width, height: 860 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), 0, `${p} at ${width}px has no horizontal overflow`);
      assert.deepEqual(errors, [], `${p}: no console errors`);
      const tiny = await page.evaluate(() => [...document.querySelectorAll('main p:not(.label), main li, main dd')].filter(e => e.offsetParent && parseFloat(getComputedStyle(e).fontSize) < 12).length);
      assert.equal(tiny, 0, `${p}: body text is readable`);
      await context.close();
    }
  }
});

test('service page: an enquiry is sent with the page’s type and source, and counted as a lead', opts, async () => {
  const { page, context, sent, errors } = await open('/whatsapp-automation#enquire');
  await page.waitForSelector('#enquiryForm:not([hidden])');
  assert.equal(await page.inputValue('#enqType'), 'WhatsApp automation');
  await page.fill('#enqName', 'Ada Obi');
  await page.fill('#enqEmail', 'ada@example.com');
  await page.fill('#enqMessage', 'We get about 300 WhatsApp messages a week about prices and delivery.');
  await page.click('#enquirySubmit');
  await page.waitForSelector('#enquirySuccess:not([hidden])');
  assert.equal(sent.length, 1);
  assert.equal(sent[0].project_type, 'WhatsApp automation');
  assert.equal(sent[0].page, `${SITE}/whatsapp-automation#enquire`);
  const events = await page.evaluate(() => window.dataLayer.filter(e => e.event === 'generate_lead'));
  assert.equal(events.length, 1);
  assert.equal(events[0].project_type, 'WhatsApp automation');
  assert.ok(!JSON.stringify(events).includes('ada@example.com') && !JSON.stringify(events).includes('Ada'), 'no personal details in analytics events');
  assert.deepEqual(errors, []);
  await context.close();
});

test('analytics: WhatsApp and consultation clicks are recorded, and nothing is sent to Google while GA4 is off', opts, async () => {
  const { page, context } = await open('/');
  const outside = [];
  page.on('request', r => { if (/google|gtag/.test(r.url())) outside.push(r.url()); });
  await page.evaluate(() => { document.querySelectorAll('a[href^="https://wa.me"]').forEach(a => a.removeAttribute('target')); });
  await page.evaluate(() => { document.addEventListener('click', e => e.preventDefault()); });
  await page.click('.hero-actions a[data-track="cta_consultation"]');
  await page.click('#whatsappCta');
  const events = await page.evaluate(() => window.dataLayer.map(e => e.event));
  assert.ok(events.includes('cta_click') && events.includes('whatsapp_click'), events.join());
  assert.equal(typeof await page.evaluate(() => window.gtag), 'undefined');
  assert.deepEqual(outside, []);
  await context.close();
});

test('homepage: the new positioning says what, who and where in the first screen', opts, async () => {
  const { page, context } = await open('/');
  assert.equal((await page.locator('h1').textContent()).replace(/\s+/g, ' ').trim(), 'Building intelligent businesses.');
  const copy = await page.locator('.hero-copy').textContent();
  for (const words of ['AI-powered systems', 'intelligent agents', 'custom software', 'Nigeria', 'internationally']) assert.ok(copy.includes(words), words);
  assert.equal(await page.locator('.hero-actions a.btn').textContent().then(t => t.trim()), 'Book a consultation');
  assert.equal(await page.locator('.hero-actions a.hero-link').getAttribute('href'), '#solutions');
  assert.equal(await page.locator('.svc-dir-cta a').getAttribute('href'), '/ai-automation-nigeria#enquire');
  assert.match(await page.title(), /AI Automation, AI Agents & Custom Software/);
  await context.close();
});

/* ---------- Review decisions (Osim, 3 Nov 2026): regression guards ---------- */
const FORM_PAGES = ['index.html', 'cybersecurity.html', ...SLUGS.map(s => `${s}.html`)];
const NEUTRAL_PHONE = '+[country code] 000 000 0000';

test('review: no UK-specific phone example on any form; every form uses the neutral international example', () => {
  const served = fs.readdirSync(ROOT).filter(f => /\.(html|js)$/.test(f)).concat(fs.readdirSync(path.join(ROOT, 'insights')).map(f => `insights/${f}`));
  for (const f of served) assert.ok(!/\+44\s?7700|7700 900123/.test(read(f)), `${f} has no UK placeholder number`);
  for (const f of FORM_PAGES) {
    const input = read(f).match(/<input[^>]*id="enqPhone"[^>]*>/)[0];
    assert.ok(input.includes(`placeholder="${NEUTRAL_PHONE}"`), `${f}: neutral phone placeholder`);
  }
  const { errors } = E.normalizeEnquiry({ name: 'Ada Obi', email: 'ada@example.com', projectType: E.PROJECT_TYPES[0], message: 'We need help answering customer messages faster.', contactMethod: 'WhatsApp', phone: 'call me' });
  assert.ok(errors.phone.includes(NEUTRAL_PHONE) && !/\+44/.test(errors.phone), errors.phone);
  assert.match(read('contact-form.js'), /for example \+\[country code\] 000 000 0000/);
});

test('review: WhatsApp links go to the official number with a prefilled message naming the service', () => {
  for (const s of content.SERVICES) {
    const links = [...read(`${s.slug}.html`).matchAll(/href="(https:\/\/wa\.me\/[^"]+)"/g)].map(m => new URL(m[1].replace(/&amp;/g, '&')));
    assert.ok(links.length >= 1, `${s.slug} has a WhatsApp link`);
    for (const u of links) {
      assert.equal(u.pathname, '/2349165681202');
      assert.equal(u.searchParams.get('text'), s.waText, `${s.slug}: prefilled message`);
      assert.match(s.waText, /^Hello Buildwise/);
    }
  }
  for (const u of [...read('index.html').matchAll(/href="(https:\/\/wa\.me\/[^"]+)"/g)].map(m => new URL(m[1].replace(/&amp;/g, '&')))) {
    assert.equal(u.pathname, '/2349165681202');
    assert.ok(u.searchParams.get('text').startsWith('Hello Buildwise'));
  }
});

test('review: approved copy decisions stay in place', () => {
  assert.match(text(read('index.html')), /Building intelligent businesses\./);
  const rec = text(read('ai-receptionist.html'));
  assert.match(rec, /WhatsApp and web chat first/);
  assert.match(rec, /Phone and voice assessed per project/);
  assert.ok(!/24\/7 phone|answers every call|guaranteed/i.test(rec), 'voice is not promised');
  assert.match(read('analytics.js'), /const TOKEN = '';/);
  assert.match(read('analytics.js'), /const GA4_ID = '';/);
  for (const f of fs.readdirSync(path.join(ROOT, 'content/insights'))) assert.match(read(`content/insights/${f}`), /^status: draft$/m, `${f} stays a draft`);
});

test('review: every service form preselects its service and shows the neutral phone example on phone and desktop', opts, async () => {
  for (const width of [360, 1440]) {
    for (const s of content.SERVICES) {
      const { page, context, errors } = await open(`/${s.slug}#enquire`, { width, height: 860 });
      await page.waitForSelector('#enquiryForm:not([hidden])');
      assert.equal(await page.inputValue('#enqType'), s.projectType, `${s.slug} at ${width}px`);
      assert.equal(await page.getAttribute('#enqPhone', 'placeholder'), NEUTRAL_PHONE);
      assert.ok(await page.isVisible('#enquirySubmit'), `${s.slug}: submit visible at ${width}px`);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), 0);
      assert.deepEqual(errors, []);
      await context.close();
    }
  }
});
