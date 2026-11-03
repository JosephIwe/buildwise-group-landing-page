/* Tests for /ai-automation (the commercial AI automation page), its assessment form and
 * the reusable sales proposal. The page is generated from content/ai-automation.mjs; the
 * staleness check lives in growth.test.js. Web3Forms and every outside host are answered
 * or blocked locally, so nothing is sent anywhere. */
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
const URL_ = `${SITE}/ai-automation`;
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');
const text = html => html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ');
const jsonld = html => JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
const E = require(path.join(ROOT, 'contact-form.js'));
const F = require(path.join(ROOT, 'automation-form.js'));
const PAGE = read('ai-automation.html');
const BODY = text(PAGE);

let C;
test.before(async () => { C = await import(pathToFileURL(path.join(ROOT, 'content/ai-automation.mjs'))); });

/* ---------- Page ---------- */
test('page: route, metadata and positioning', () => {
  const title = PAGE.match(/<title>([^<]+)<\/title>/)[1];
  const description = PAGE.match(/<meta name="description" content="([^"]+)">/)[1];
  assert.ok(title.length <= 70, `title fits (${title.length})`);
  assert.ok(description.length >= 110 && description.length <= 175, `description length (${description.length})`);
  assert.match(PAGE, new RegExp(`<link rel="canonical" href="${URL_}">`));
  assert.match(PAGE, new RegExp(`<meta property="og:url" content="${URL_}">`));
  assert.match(PAGE, /<meta property="og:image" content="https:\/\/buildwisegroup\.dev\/assets\/og-image\.jpg">/);
  assert.match(PAGE, /<meta name="twitter:card" content="summary_large_image">/);
  assert.ok(!/<meta name="robots"/.test(PAGE), 'indexable');
  const h1s = PAGE.match(/<h1[\s\S]*?<\/h1>/g);
  assert.equal(h1s.length, 1);
  assert.equal(text(h1s[0]).trim(), 'Your business shouldn’t lose customers because your team is busy.');
  for (const id of ['problems', 'how-it-works', 'booking-automation', 'staff', 'industries', 'process', 'packages', 'boundaries', 'faq', 'enquire']) {
    assert.match(PAGE, new RegExp(`id="${id}"`), `has the ${id} section`);
  }
  assert.ok(BODY.split(' ').length > 1500, 'substantial content');
  assert.match(read('sitemap.xml'), new RegExp(`<loc>${URL_}</loc>`));
});

test('page: linked from the homepage, every footer and llms.txt; every local link resolves', () => {
  assert.match(read('index.html'), /<a href="\/ai-automation"><span class="svc-dir-name">/);
  assert.match(read('llms.txt'), /https:\/\/buildwisegroup\.dev\/ai-automation\)/);
  const pages = fs.readdirSync(ROOT).filter(f => f.endsWith('.html') && f !== '404.html').concat(fs.readdirSync(path.join(ROOT, 'insights')).map(f => `insights/${f}`));
  for (const f of pages) assert.match(read(f).match(/<footer[\s\S]*?<\/footer>/)[0], /href="\/ai-automation"/, `${f} footer links the page`);
  for (const m of PAGE.matchAll(/href="(\/[^"#?]*)/g)) {
    const p = m[1];
    if (p === '/' || /\.(css|js|svg|png|woff2|webp|avif)$/.test(p)) continue;
    assert.ok(fs.existsSync(path.join(ROOT, `${p}.html`)) || fs.existsSync(path.join(ROOT, p)), `${p} resolves`);
  }
  for (const m of PAGE.matchAll(/(?:src|srcset)="([^"]+)"/g)) {
    for (const part of m[1].split(',')) {
      const p = part.trim().split(' ')[0];
      if (p.startsWith('/')) assert.ok(fs.existsSync(path.join(ROOT, p)), `${p} exists`);
    }
  }
  for (const m of PAGE.matchAll(/href="#([^"]+)"/g)) assert.match(PAGE, new RegExp(`id="${m[1]}"`), `#${m[1]} has a target`);
});

test('pricing: the page, structured data and proposal show the agreed prices, and no others', () => {
  const byId = Object.fromEntries(C.PACKAGES.map(p => [p.id, p.price]));
  assert.deepEqual(byId, { assessment: 250, implementation: 1250, staff: 149, operations: 250 });
  assert.equal(C.COMBINED.price, 399);
  const allowed = new Set(['250', '1,250', '149', '399']);
  const shown = [...BODY.matchAll(/\$(\d{1,3}(?:,\d{3})*)/g)].map(m => m[1]);
  assert.ok(shown.length >= 8);
  for (const n of shown) assert.ok(allowed.has(n), `unexpected price $${n}`);
  assert.match(BODY, /\$399 per month/);
  assert.match(BODY, /Up to 200 minutes a month/);
  const offers = jsonld(PAGE)['@graph'][1].hasOfferCatalog.itemListElement;
  assert.deepEqual(offers.map(o => [o.name, o.price, o.priceCurrency]), C.PACKAGES.map(p => [p.name, p.price, 'USD']));
  for (const o of offers.filter(o => [149, 250].includes(o.price) && o.priceSpecification)) assert.equal(o.priceSpecification.unitText, 'month');
  const proposal = read('sales/ai-automation-proposal.md');
  for (const n of ['$250', '$1,250', '$149', '$399', '200 minutes', '$1,500']) assert.ok(proposal.includes(n), `proposal shows ${n}`);
  for (const n of [...proposal.matchAll(/\$(\d{1,3}(?:,\d{3})*)/g)].map(m => m[1])) assert.ok(new Set([...allowed, '1,500']).has(n), `proposal: unexpected price $${n}`);
});

test('pricing: implementation, subscription, operations and third-party costs are kept apart; usage is never unlimited', () => {
  for (const line of ['Buildwise implementation fees', 'Staff product subscription', 'Buildwise managed operations', 'Third-party usage and integrations']) assert.match(BODY, new RegExp(line));
  assert.match(BODY, /Usage is never unlimited/);
  assert.ok(!/\bunlimited (usage|minutes|conversations|messages|calls)\b/i.test(BODY), 'no unlimited promise');
  assert.match(BODY, /only with your written approval/);
  assert.match(BODY, /Subject to Staff’s verified production pricing and usage controls/);
  for (const p of C.PACKAGES) assert.ok(p.excludes.length >= 2, `${p.id} lists what is not included`);
});

test('claims: Staff capabilities carry their real status; nothing unverified is sold as available now', () => {
  const groups = Object.fromEntries(C.STAFF.groups.map(g => [g.key, g.items.join(' | ')]));
  assert.deepEqual(Object.keys(groups), ['now', 'early', 'integration']);
  for (const word of [/voice/i, /video/i, /phone/i, /language model/i, /reminder/i, /CRM/i, /calendar/i]) {
    assert.ok(!word.test(groups.now), `"${word}" is not listed as available now`);
  }
  assert.match(groups.early, /voice/i);
  assert.match(groups.early, /video/i);
  assert.match(groups.early, /WhatsApp booking confirmations and reminders/);
  assert.match(groups.integration, /booking software/);
  assert.match(BODY, /Staff does not take payments/);
  assert.match(BODY, /“booked” only when the booking system confirms/i);
  // The receptionist page's approved stance on voice still holds here
  assert.ok(!/24\/7 phone|answers every call|never miss(es)? a call/i.test(BODY));
});

test('claims: no invented results, testimonials, client names, guarantees, emails or old spellings', () => {
  const banned = [
    /\b(industry[- ]leading|market[- ]leading|number[- ]one|award[- ]winning|top[- ]rated)\b/i,
    /\bwe guarantee\b|\bguaranteed\b/i,
    /\b\d{1,3}\s?% (more|less|fewer|increase|reduction|savings|faster)\b/i,
    /\bMarvels\b/i, /MeetStaff/i, /\bBuildWise\b/, /five[- ]star|★|\bour clients say\b|testimonial/i,
    /[\w.+-]+@[\w-]+\.(com|dev|ng|io|co)\b/, /mailto:/
  ];
  for (const re of banned) assert.ok(!re.test(BODY) && !re.test(PAGE.replace(/<script[\s\S]*?<\/script>/g, '')), `page breaks a claims rule: ${re}`);
  const proposal = read('sales/ai-automation-proposal.md');
  for (const re of [/\bMarvels\b/i, /MeetStaff/i, /\bBuildWise\b/, /[\w.+-]+@[\w-]+\.(com|dev|ng|io|co)\b/, /testimonial(?!s, ratings)/i]) assert.ok(!re.test(proposal), `proposal breaks a claims rule: ${re}`);
  assert.match(proposal, /Buildwise does not guarantee business outcomes/);
});

test('structured data: WebPage, Service with priced offers and BreadcrumbList, nothing unsupported', () => {
  const graph = jsonld(PAGE)['@graph'];
  assert.deepEqual(graph.map(n => n['@type']), ['WebPage', 'Service', 'BreadcrumbList']);
  assert.equal(graph[1].provider['@id'], `${SITE}/#organization`);
  assert.equal(graph[2].itemListElement.at(-1).item, URL_);
  const raw = JSON.stringify(graph);
  for (const banned of ['LocalBusiness', 'PostalAddress', 'aggregateRating', 'review', 'FAQPage', 'email', 'Marvels']) assert.ok(!raw.includes(banned), `no ${banned}`);
});

/* ---------- Form logic ---------- */
const VALID = {
  business: 'Glow Studio', name: 'Ada Obi', email: 'ada@glowstudio.example', industry: 'Aesthetics clinic', locations: '1',
  challenge: 'Enquiries go unanswered or get slow replies', automations: ['Answering customer enquiries', 'Appointment booking and rescheduling'],
  details: 'About 40 WhatsApp enquiries a week; bookings in a paper diary.', phone: '', package: ''
};

test('form: valid requests pass; every required field is checked', () => {
  assert.equal(F.normalizeRequest(VALID).valid, true);
  const { errors } = F.normalizeRequest({});
  assert.deepEqual(Object.keys(errors).sort(), ['automations', 'business', 'challenge', 'details', 'email', 'industry', 'locations', 'name'].sort());
});

test('form: rejects bad emails, unlisted options, oversize text and bad phone numbers', () => {
  const bad = patch => F.normalizeRequest({ ...VALID, ...patch }).errors;
  assert.ok(bad({ email: 'ada@glow' }).email);
  assert.ok(bad({ email: 'a b@x.com' }).email);
  assert.ok(bad({ industry: 'Bank' }).industry, 'only listed industries');
  assert.ok(bad({ locations: '1000' }).locations);
  assert.ok(bad({ challenge: '<script>' }).challenge);
  assert.ok(bad({ automations: ['Answering customer enquiries', 'Delete the database'] }).automations);
  assert.ok(bad({ automations: [] }).automations);
  assert.ok(bad({ details: 'short' }).details);
  assert.ok(bad({ details: 'x'.repeat(3001) }).details);
  assert.ok(bad({ business: 'x'.repeat(121) }).business);
  assert.ok(bad({ phone: 'call me' }).phone.includes('+[country code] 000 000 0000'));
  assert.ok(bad({ package: 'Free forever' }).package);
});

test('form: input is cleaned of control characters and duplicate choices', () => {
  const { values } = F.normalizeRequest({ ...VALID, business: ' Glow\u0000 Studio\n ', automations: ['Answering customer enquiries', 'Answering customer enquiries'] });
  assert.equal(values.business, 'Glow Studio');
  assert.deepEqual(values.automations, ['Answering customer enquiries']);
});

test('form: payload uses the existing Web3Forms key and subject, with every captured field', () => {
  const p = F.buildPayload(F.normalizeRequest({ ...VALID, phone: '+234 800 000 0000', package: 'AI Opportunity Assessment' }).values, { page: `${URL_}#enquire` });
  assert.equal(p.access_key, E.ACCESS_KEY, 'same public key as every other form');
  assert.equal(p.subject, 'New Buildwise Project Enquiry: AI business automation (Aesthetics clinic)');
  assert.equal(p.replyto, VALID.email);
  for (const [k, v] of Object.entries({ company: 'Glow Studio', name: 'Ada Obi', industry: 'Aesthetics clinic', locations: '1', main_challenge: VALID.challenge, desired_automation: VALID.automations.join('; '), interested_in: 'AI Opportunity Assessment', whatsapp_number: '+234 800 000 0000', page: `${URL_}#enquire`, project_type: 'AI business automation' })) assert.equal(p[k], v, k);
  assert.equal(p.botcheck, false);
  const src = read('automation-form.js');
  assert.ok(!/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(src), 'no key of its own');
  assert.ok(!/localStorage|sessionStorage|location\.(hash|search)\s*=/.test(src), 'nothing stored in the browser or the address bar');
  assert.ok(!/web3forms|form provider/i.test(PAGE.replace(/<script[\s\S]*?<\/script>/g, '')), 'delivery details stay out of the page');
});

test('form: the markup lists exactly the options the validator accepts, with labels and error slots', () => {
  const options = id => [...PAGE.match(new RegExp(`<select[^>]*id="${id}"[\\s\\S]*?</select>`))[0].matchAll(/<option>([^<]+)<\/option>/g)].map(m => m[1].replace(/&amp;/g, '&'));
  assert.deepEqual(options('autoIndustry'), F.INDUSTRIES);
  assert.deepEqual(options('autoLocations'), F.LOCATIONS);
  assert.deepEqual(options('autoChallenge'), F.CHALLENGES);
  assert.deepEqual(options('autoPackage'), F.PACKAGES);
  assert.deepEqual([...PAGE.matchAll(/name="desired_automation" value="([^"]+)"/g)].map(m => m[1]), F.AUTOMATIONS);
  for (const id of ['autoBusiness', 'autoName', 'autoEmail', 'autoIndustry', 'autoLocations', 'autoChallenge', 'autoDetails', 'autoPhone', 'autoPackage']) assert.match(PAGE, new RegExp(`<label for="${id}">`), `${id} is labelled`);
  for (const name of ['business', 'name', 'email', 'industry', 'locations', 'challenge', 'automations', 'details', 'phone', 'package']) assert.match(PAGE, new RegExp(`id="auto-${name}-error"`));
  for (const m of PAGE.matchAll(/data-package="([^"]+)"/g)) assert.ok(F.PACKAGES.includes(m[1]), `${m[1]} is a package option`);
  assert.match(PAGE, /<script defer src="\/contact-form\.js"><\/script>[\s\S]*<script defer src="\/automation-form\.js"><\/script>/, 'loads after the shared enquiry module');
});

test('proposal: the reusable proposal has all thirteen sections and no unfilled facts presented as real', () => {
  const md = read('sales/ai-automation-proposal.md');
  const headings = [...md.matchAll(/^## (\d+)\. (.+)$/gm)].map(m => m[2]);
  assert.deepEqual(headings, ['Executive overview', 'Business challenges', 'Proposed solution', 'AI employee capabilities', 'Implementation scope', 'Integration requirements', 'Deployment timeline', 'Pricing breakdown', 'Monthly operating costs', 'Exclusions and assumptions', 'Security and data handling', 'Client responsibilities', 'Acceptance and next steps']);
  for (const industry of ['Aesthetics clinics', 'Dental clinics', 'Salons, spas and barbers', 'Other appointment-based businesses']) assert.ok(md.includes(industry), industry);
  assert.match(md, /\[Client business name\]/, 'template placeholders, not a named client');
  assert.match(read('_headers'), /^\/sales\/\*\n  X-Robots-Tag: noindex$/m, 'the proposal source is kept out of search');
});

/* ---------- Browser ---------- */
const TYPES = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.avif': 'image/avif', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2' };
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

async function open(urlPath, viewport = { width: 1280, height: 860 }, reply = { status: 200, body: '{"success":true}' }) {
  const context = await browser.newContext({ viewport, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const errors = [];
  const sent = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/ERR_FAILED/.test(m.text())) errors.push(m.text()); });
  await page.route('https://api.web3forms.com/**', route => { sent.push(JSON.parse(route.request().postData())); route.fulfill({ status: reply.status, contentType: 'application/json', body: reply.body }); });
  await page.route(/^https?:\/\/(?!127\.0\.0\.1|api\.web3forms\.com)/, route => route.abort());
  await page.goto(origin + urlPath);
  await page.waitForLoadState('load');
  return { page, context, errors, sent };
}

async function fill(page) {
  await page.fill('#autoBusiness', 'Glow Studio');
  await page.fill('#autoName', 'Ada Obi');
  await page.fill('#autoEmail', 'ada@glowstudio.example');
  await page.selectOption('#autoIndustry', 'Dental clinic');
  await page.selectOption('#autoLocations', '2 to 3');
  await page.selectOption('#autoChallenge', 'No-shows and late cancellations');
  await page.check('input[name="desired_automation"][value="Reminders and follow-ups"]', { force: true });
  await page.fill('#autoDetails', 'Two branches, bookings by phone and WhatsApp, reminders sent by hand.');
}

test('browser: renders on phone, tablet and desktop without errors or sideways scrolling', opts, async () => {
  for (const width of [360, 768, 1440]) {
    const { page, context, errors } = await open('/ai-automation', { width, height: 900 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), 0, `no overflow at ${width}px`);
    const tiny = await page.evaluate(() => [...document.querySelectorAll('main p:not(.label), main li, main dd')].filter(e => e.offsetParent && parseFloat(getComputedStyle(e).fontSize) < 12).length);
    assert.equal(tiny, 0, 'body text is readable');
    assert.ok(await page.isVisible('h1'));
    await page.locator('#enquire').scrollIntoViewIfNeeded();
    await page.waitForSelector('#automationForm:not([hidden])');
    assert.ok(await page.isHidden('#automationUnavailable'));
    assert.deepEqual(errors, [], `no console errors at ${width}px`);
    await context.close();
  }
});

test('browser: invalid submissions are stopped with focused, announced errors and nothing is sent', opts, async () => {
  const { page, context, sent, errors } = await open('/ai-automation#enquire');
  await page.waitForSelector('#automationForm:not([hidden])');
  await page.click('#automationSubmit');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'autoBusiness');
  assert.match(await page.textContent('#automationStatus'), /fix the highlighted fields/);
  assert.equal(await page.getAttribute('.auto-checks', 'aria-invalid'), 'true');
  assert.match(await page.textContent('#auto-automations-error'), /at least one/);
  await fill(page);
  await page.fill('#autoEmail', 'ada@glow');
  await page.click('#automationSubmit');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'autoEmail');
  assert.equal(sent.length, 0);
  assert.deepEqual(errors, []);
  await context.close();
});

test('browser: a package button preselects it, and a valid request is delivered once and counted as a lead', opts, async () => {
  const { page, context, sent, errors } = await open('/ai-automation', { width: 390, height: 844 });
  await page.click('#pkg-implementation .auto-pkg-cta');
  await page.waitForSelector('#automationForm:not([hidden])');
  assert.equal(await page.inputValue('#autoPackage'), 'AI Business Automation Implementation');
  await fill(page);
  await page.click('#automationSubmit');
  await page.waitForSelector('#automationSuccess:not([hidden])');
  assert.equal(sent.length, 1);
  const p = sent[0];
  assert.equal(p.access_key, E.ACCESS_KEY);
  assert.equal(p.company, 'Glow Studio');
  assert.equal(p.industry, 'Dental clinic');
  assert.equal(p.locations, '2 to 3');
  assert.equal(p.main_challenge, 'No-shows and late cancellations');
  assert.equal(p.desired_automation, 'Reminders and follow-ups');
  assert.equal(p.interested_in, 'AI Business Automation Implementation');
  assert.equal(p.page, `${URL_}#enquire`);
  const events = await page.evaluate(() => (window.dataLayer || []).filter(e => e.event === 'generate_lead'));
  assert.equal(events.length, 1);
  assert.equal(events[0].project_type, 'AI business automation');
  assert.ok(!/Ada|glowstudio|Glow/.test(JSON.stringify(events)), 'no personal details in analytics events');
  assert.equal(await page.evaluate(() => document.activeElement.tagName), 'H4', 'focus moves to the confirmation');
  assert.deepEqual(errors, []);
  await context.close();
});

test('browser: a rejected request keeps what was typed and offers WhatsApp', opts, async () => {
  const { page, context, sent } = await open('/ai-automation#enquire', undefined, { status: 400, body: '{"success":false}' });
  await page.waitForSelector('#automationForm:not([hidden])');
  await fill(page);
  await page.click('#automationSubmit');
  await page.waitForFunction(() => document.querySelector('#automationStatus').classList.contains('is-error'));
  assert.equal(sent.length, 1);
  assert.match(await page.textContent('#automationStatus'), /WhatsApp/);
  assert.equal(await page.inputValue('#autoBusiness'), 'Glow Studio');
  assert.ok(await page.isHidden('#automationSuccess'));
  await context.close();
});
