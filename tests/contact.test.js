/* Tests for the homepage contact section: the WhatsApp link, the no-public-email policy, and the
 * project enquiry form (validation in Node, submission flows in Chromium).
 * Web3Forms is never contacted: browser tests answer api.web3forms.com locally. */
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const E = require('../contact-form.js');

let chromium;
try { ({ chromium } = require('playwright')); } catch (e) { chromium = null; }

const ROOT = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');
const WHATSAPP = 'https://wa.me/2349165681202?text=Hello%20Buildwise%2C%20I%20visited%20your%20website%20and%20would%20like%20to%20discuss%20a%20project.';
const KEY = '5abaf1c0-5ac4-4c1d-8d26-dac30dfa159b';
const PUBLIC_FILES = ['README.md', 'index.html', 'scan.html', 'website-audit.html', '404.html', 'privacy.html', 'llms.txt', 'robots.txt', 'sitemap.xml', 'contact-form.js', 'script.js', 'scanner.js', 'scanner-engine.js', 'website-audit.js', 'analytics.js', 'hero-story.js'];
const valid = {
  name: 'Ada Lovelace', email: 'ada@example.com', company: 'Analytical Engines Ltd',
  projectType: 'AI product development', budget: 'Not sure yet',
  message: 'We want an assistant that drafts replies to customer enquiries.', contactMethod: 'Email'
};

/* ---------- Validation and payload (Node) ---------- */
test('the Web3Forms public access key is configured and the endpoint is Web3Forms', () => {
  assert.equal(E.ACCESS_KEY, KEY);
  assert.equal(E.ENDPOINT, 'https://api.web3forms.com/submit');
});

test('no personal or other email address is published anywhere on the public site', () => {
  for (const file of PUBLIC_FILES) {
    const text = read(file);
    assert.ok(!/gmail\.com|josephiwe\.com/i.test(text), `${file} exposes no personal email`);
    assert.ok(!/mailto:[^"'`?\s]+@/i.test(text), `${file} has no mailto link with an address`);
    assert.ok(!/[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+\.[A-Za-z]{2,}/.test(text.replace(/name@company\.com|name@gmail/g, '')), `${file} contains no email address`);
  }
  const ld = JSON.parse(read('index.html').match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
  assert.ok(!/"email"/.test(JSON.stringify(ld)), 'structured data lists no email');
});

test('the private recipient never appears in the payload, errors or success text', () => {
  const { values } = E.normalizeEnquiry(valid);
  const payload = JSON.stringify(E.buildPayload(values, { accessKey: KEY }));
  assert.ok(!/gmail|"to"|ccemail/i.test(payload), 'the recipient is set in Web3Forms by the key, not sent from the page');
  for (const text of Object.values(E.FAILURE_TEXT)) assert.ok(!/@/.test(text), 'failure messages contain no email address');
});

test('Instagram is not offered as a contact route', () => {
  for (const file of ['index.html', 'scan.html', 'website-audit.html', '404.html', 'privacy.html', 'llms.txt']) {
    assert.ok(!/instagram/i.test(read(file)), `${file} has no Instagram link`);
  }
});

test('required fields are enforced and optional ones are not', () => {
  const { errors, valid: ok } = E.normalizeEnquiry({});
  assert.equal(ok, false);
  assert.deepEqual(Object.keys(errors).sort(), ['email', 'message', 'name', 'projectType']);
  const minimal = E.normalizeEnquiry({ name: 'Ada', email: 'ada@example.com', projectType: 'Other', message: 'x'.repeat(20) });
  assert.equal(minimal.valid, true, 'company, budget, contact method and phone are optional');
});

test('invalid email addresses are rejected', () => {
  for (const email of ['ada', 'ada@', 'ada@example', 'ada example@x.com', 'a@b.c', '<ada@x.com>', 'ada@@x.com', `${'a'.repeat(250)}@x.com`]) {
    assert.ok(E.normalizeEnquiry({ ...valid, email }).errors.email, `${email} is rejected`);
  }
  for (const email of ['ada@example.com', 'ada.l+site@mail.example.co.uk', ' ADA@Example.COM ']) {
    assert.equal(E.normalizeEnquiry({ ...valid, email }).errors.email, undefined, `${email} is accepted`);
  }
});

test('project type, budget and contact method only accept listed values', () => {
  assert.ok(E.normalizeEnquiry({ ...valid, projectType: 'Crypto mining' }).errors.projectType);
  assert.ok(E.normalizeEnquiry({ ...valid, budget: '$1' }).errors.budget);
  assert.ok(E.normalizeEnquiry({ ...valid, contactMethod: 'Fax' }).errors.contactMethod);
  assert.equal(E.PROJECT_TYPES.length, 6);
  assert.ok(E.BUDGETS.includes('Not sure yet'));
});

test('the message needs enough detail and has a length limit', () => {
  assert.match(E.normalizeEnquiry({ ...valid, message: 'Hi' }).errors.message, /more detail/);
  assert.match(E.normalizeEnquiry({ ...valid, message: 'x'.repeat(E.LIMITS.message + 1) }).errors.message, /under/);
  assert.ok(E.normalizeEnquiry({ ...valid, name: 'x'.repeat(101) }).errors.name);
  assert.ok(E.normalizeEnquiry({ ...valid, company: 'x'.repeat(121) }).errors.company);
});

test('input is normalised: whitespace and control characters are removed', () => {
  const { values } = E.normalizeEnquiry({ ...valid, name: '  Ada \u0000\n Lovelace ', message: `Line one\r\n\r\n\r\n\r\nLine two\u0007 is here, with detail.` });
  assert.equal(values.name, 'Ada Lovelace');
  assert.equal(values.message, 'Line one\n\nLine two is here, with detail.');
});

test('a WhatsApp number is only kept, and checked, when WhatsApp is preferred', () => {
  assert.equal(E.normalizeEnquiry({ ...valid, contactMethod: 'Email', phone: '+44 7700 900123' }).values.phone, '');
  assert.equal(E.normalizeEnquiry({ ...valid, contactMethod: 'WhatsApp', phone: '+44 7700 900123' }).values.phone, '+44 7700 900123');
  assert.ok(E.normalizeEnquiry({ ...valid, contactMethod: 'WhatsApp', phone: 'call me' }).errors.phone);
  assert.equal(E.normalizeEnquiry({ ...valid, contactMethod: 'WhatsApp', phone: '' }).valid, true);
});

test('the payload carries every field, a descriptive subject and the reply-to address', () => {
  const { values } = E.normalizeEnquiry({ ...valid, contactMethod: 'WhatsApp', phone: '+234 916 568 1202' });
  const p = E.buildPayload(values, { accessKey: 'k', page: 'https://buildwisegroup.dev/#contact' });
  assert.equal(p.access_key, 'k');
  assert.equal(p.subject, 'New Buildwise Project Enquiry: AI product development');
  assert.equal(p.replyto, 'ada@example.com');
  assert.equal(p.email, 'ada@example.com');
  assert.equal(p.from_name, 'Buildwise website', 'the sender name is ours, never the prospect\'s');
  assert.ok(!('from_email' in p), 'the prospect never becomes the sender');
  for (const key of ['name', 'company', 'project_type', 'budget', 'preferred_contact', 'message', 'whatsapp_number', 'page']) assert.ok(p[key], `${key} is included`);
  assert.equal(p.botcheck, false);
  const bare = E.buildPayload(E.normalizeEnquiry({ name: 'Ada', email: 'ada@example.com', projectType: 'Other', message: 'x'.repeat(20) }).values, { accessKey: 'k' });
  assert.equal(bare.company, 'Not given');
  assert.equal(bare.budget, 'Not given');
  assert.equal(bare.preferred_contact, 'No preference');
  assert.ok(!('whatsapp_number' in bare));
});

test('submission only succeeds when Web3Forms confirms success', async () => {
  const reply = (status, body) => async () => ({ ok: status < 300, status, json: async () => (typeof body === 'string' ? JSON.parse(body) : body) });
  assert.deepEqual(await E.submitEnquiry({}, { fetchImpl: reply(200, { success: true }) }), { ok: true });
  assert.deepEqual(await E.submitEnquiry({}, { fetchImpl: reply(200, { success: false }) }), { ok: false, reason: 'rejected' });
  assert.deepEqual(await E.submitEnquiry({}, { fetchImpl: reply(200, {}) }), { ok: false, reason: 'rejected' });
  assert.deepEqual(await E.submitEnquiry({}, { fetchImpl: reply(400, { success: false, message: 'Invalid access key' }) }), { ok: false, reason: 'rejected' });
  assert.deepEqual(await E.submitEnquiry({}, { fetchImpl: reply(429, { success: false }) }), { ok: false, reason: 'rate-limited' });
  assert.deepEqual(await E.submitEnquiry({}, { fetchImpl: reply(500, 'not json') }).catch(() => 'threw'), { ok: false, reason: 'rejected' });
  assert.deepEqual(await E.submitEnquiry({}, { fetchImpl: async () => { throw new TypeError('Failed to fetch'); } }), { ok: false, reason: 'network' });
  const hang = (url, init) => new Promise((_, reject) => init.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))));
  assert.deepEqual(await E.submitEnquiry({}, { fetchImpl: hang, timeoutMs: 20 }), { ok: false, reason: 'timeout' });
  for (const text of Object.values(E.FAILURE_TEXT)) assert.ok(!/key|web3forms|form service|provider|status|error code/i.test(text), 'failure messages stay generic');
});

test('the privacy policy is linked from the form and every footer, and makes no unverified claims', () => {
  const policy = read('privacy.html');
  assert.match(policy, /Web3Forms/, 'the form processor is disclosed on the policy page');
  assert.match(policy, /Cloudflare Web Analytics/);
  assert.match(policy, /Google Fonts/);
  assert.ok(!/30 days|thirty days/i.test(policy), 'no retention period that is not verified');
  assert.ok(!/no (cookies or )?tracking/i.test(policy), 'no blanket no-tracking claim');
  assert.match(policy, /href="https:\/\/wa\.me\/2349165681202"/, 'requests go to the verified WhatsApp number');
  const form = read('index.html').match(/<p class="enq-privacy">[\s\S]*?<\/p>/)[0];
  assert.match(form, /href="\/privacy"/);
  for (const file of ['index.html', 'scan.html', 'website-audit.html', 'privacy.html']) {
    const footer = read(file).match(/<footer[\s\S]*?<\/footer>/)[0];
    assert.match(footer, /href="\/privacy"/, `${file} footer links to the privacy policy`);
  }
});

test('the public pages do not name the form provider or describe how the form is delivered', () => {
  for (const file of ['index.html', 'scan.html', 'website-audit.html', '404.html']) {
    const text = read(file).replace(/<script[\s\S]*?<\/script>/g, '');
    assert.ok(!/web3forms|form provider|form service/i.test(text), `${file} keeps delivery details out of the page`);
  }
});

test('every WhatsApp link uses the business number and opens safely', () => {
  const html = read('index.html');
  const waLinks = [...html.matchAll(/href="(https:\/\/wa\.me\/[^"]+)"/g)].map(m => m[1]);
  assert.ok(waLinks.length >= 4, 'contact section, no-script panel, footer and mobile menu');
  waLinks.forEach(href => assert.equal(href, WHATSAPP));
  assert.equal(decodeURIComponent(new URL(WHATSAPP).searchParams.get('text')), 'Hello Buildwise, I visited your website and would like to discuss a project.');
  for (const m of html.matchAll(/<a [^>]*href="https:\/\/wa\.me[^"]*"[^>]*>/g)) {
    assert.match(m[0], /target="_blank"/);
    assert.match(m[0], /rel="noopener noreferrer"/);
  }
});

/* ---------- Browser ---------- */
const TYPES = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.avif': 'image/avif', '.png': 'image/png', '.jpg': 'image/jpeg' };
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

/* Opens the homepage. `key` simulates a configured access key; `provider` answers
   each Web3Forms request and records what was sent. */
async function open({ key = KEY, provider, viewport = { width: 1280, height: 860 } } = {}) {
  const context = await browser.newContext({ viewport, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const errors = [];
  const sent = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.route(/fonts\.(googleapis|gstatic)\.com/, route => route.abort());
  await page.route('**/contact-form.js', route => route.fulfill({
    contentType: 'text/javascript',
    body: read('contact-form.js').replace(/const ACCESS_KEY = '[^']*';/, `const ACCESS_KEY = ${JSON.stringify(key)};`)
  }));
  await page.route('https://api.web3forms.com/**', async route => {
    sent.push(JSON.parse(route.request().postData()));
    if (provider) return provider(route, sent.length);
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{"success":true,"message":"Email sent successfully!"}' });
  });
  await page.goto(`${origin}/index.html#contact`);
  return { page, context, sent, errors: () => errors };
}

async function fill(page, overrides = {}) {
  const v = { ...valid, ...overrides };
  await page.fill('#enqName', v.name);
  await page.fill('#enqEmail', v.email);
  await page.fill('#enqCompany', v.company);
  await page.selectOption('#enqType', v.projectType);
  await page.selectOption('#enqBudget', v.budget);
  await page.fill('#enqMessage', v.message);
}

test('form: without an access key the form stays hidden and WhatsApp is offered, with no email address', opts, async () => {
  const { page, context, sent } = await open({ key: '' });
  assert.equal(await page.locator('#enquiryForm').isVisible(), false);
  const panel = page.locator('#enquiryUnavailable');
  assert.ok(await panel.isVisible());
  assert.equal(await panel.locator('a[href^="mailto:"]').count(), 0);
  assert.equal(await panel.locator('a[href^="https://wa.me"]').getAttribute('href'), WHATSAPP);
  assert.equal(sent.length, 0);
  await context.close();
});

test('form: with the configured key the form shows and the fallback panel is hidden', opts, async () => {
  const context = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await context.newPage();
  await page.route(/fonts\.(googleapis|gstatic)\.com/, route => route.abort());
  await page.goto(`${origin}/index.html#contact`);
  await page.waitForSelector('#enquiryForm:not([hidden])');
  assert.equal(await page.locator('#enquiryUnavailable').isVisible(), false);
  assert.equal(await page.locator('#enquiryTitle').textContent(), 'Send a project enquiry');
  assert.equal((await page.locator('#whatsappCta').textContent()).trim().startsWith('Chat on WhatsApp'), true);
  const text = await page.locator('body').textContent();
  assert.ok(!/@[a-z0-9-]+\.[a-z]/i.test(text.replace('@company.com', '')), 'no email address is visible on the rendered page');
  assert.equal(await page.locator('a[href^="mailto:"]').count(), 0, 'no mailto link on the homepage');
  assert.equal(await page.locator('a[href*="instagram"]').count(), 0, 'no Instagram link on the homepage');
  await context.close();
});

test('form: required fields and invalid email are explained, and nothing is sent', opts, async () => {
  const { page, context, sent, errors } = await open();
  await page.waitForSelector('#enquiryForm:not([hidden])');
  await page.click('#enquirySubmit');
  assert.equal(await page.locator('#enq-name-error').textContent(), 'Enter your full name.');
  assert.equal(await page.locator('#enq-email-error').textContent(), 'Enter your work email address.');
  assert.equal(await page.locator('#enq-projectType-error').textContent(), 'Choose the type of project.');
  assert.equal(await page.locator('#enq-message-error').textContent(), 'Tell us about your project.');
  assert.equal(await page.locator('#enqName').getAttribute('aria-invalid'), 'true');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'enqName', 'focus moves to the first problem');
  assert.equal(await page.locator('#enq-company-error').textContent(), '', 'optional fields are not flagged');

  await fill(page, { email: 'ada@example' });
  await page.click('#enquirySubmit');
  assert.match(await page.locator('#enq-email-error').textContent(), /valid email/);
  assert.equal(await page.evaluate(() => document.activeElement.id), 'enqEmail');
  await page.fill('#enqEmail', 'ada@example.com');
  assert.equal(await page.locator('#enq-email-error').textContent(), '', 'the error clears once fixed');
  assert.equal(sent.length, 0);
  assert.deepEqual(errors(), []);
  await context.close();
});

test('form: a confirmed submission shows success and sends every field', opts, async () => {
  const { page, context, sent, errors } = await open();
  await page.waitForSelector('#enquiryForm:not([hidden])');
  await fill(page);
  await page.check('input[name="preferred_contact"][value="WhatsApp"]', { force: true });
  assert.ok(await page.locator('#enqPhone').isVisible(), 'WhatsApp number appears when WhatsApp is chosen');
  await page.fill('#enqPhone', '+234 916 568 1202');
  await page.click('#enquirySubmit');
  await page.waitForSelector('#enquirySuccess:not([hidden])');
  assert.equal(await page.locator('#enquiryForm').isVisible(), false);
  assert.equal(await page.evaluate(() => document.activeElement.textContent), 'Thank you. Your enquiry has been sent.');
  assert.equal(sent.length, 1);
  const p = sent[0];
  assert.equal(p.access_key, KEY);
  assert.equal(p.subject, 'New Buildwise Project Enquiry: AI product development');
  assert.equal(p.replyto, 'ada@example.com');
  assert.equal(p.name, 'Ada Lovelace');
  assert.equal(p.company, 'Analytical Engines Ltd');
  assert.equal(p.budget, 'Not sure yet');
  assert.equal(p.preferred_contact, 'WhatsApp');
  assert.equal(p.whatsapp_number, '+234 916 568 1202');
  assert.equal(p.botcheck, false);
  await page.click('#enquiryAgain');
  assert.ok(await page.locator('#enquiryForm').isVisible());
  assert.equal(await page.inputValue('#enqName'), '', 'a new enquiry starts empty');
  assert.deepEqual(errors(), []);
  await context.close();
});

test('form: provider rejection keeps everything the prospect typed', opts, async () => {
  const { page, context } = await open({
    provider: route => route.fulfill({ status: 400, contentType: 'application/json', body: '{"success":false,"message":"Invalid access key"}' })
  });
  await page.waitForSelector('#enquiryForm:not([hidden])');
  await fill(page);
  await page.click('#enquirySubmit');
  await page.waitForFunction(() => document.getElementById('enquiryStatus').classList.contains('is-error'));
  const status = await page.locator('#enquiryStatus').textContent();
  assert.match(status, /could not be sent/);
  assert.ok(!/access key|@/i.test(status), 'provider details and email addresses are not shown');
  assert.equal(await page.locator('#enquirySuccess').isVisible(), false, 'no success without confirmation');
  assert.equal(await page.inputValue('#enqName'), valid.name);
  assert.equal(await page.inputValue('#enqMessage'), valid.message);
  assert.equal(await page.inputValue('#enqType'), valid.projectType);
  assert.equal(await page.isEnabled('#enquirySubmit'), true, 'the prospect can retry');
  await context.close();
});

test('form: a network failure is explained and a retry can succeed', opts, async () => {
  const { page, context, sent } = await open({ provider: (route, n) => (n === 1 ? route.abort('failed') : route.fulfill({ status: 200, contentType: 'application/json', body: '{"success":true}' })) });
  await page.waitForSelector('#enquiryForm:not([hidden])');
  await fill(page);
  await page.click('#enquirySubmit');
  await page.waitForFunction(() => document.getElementById('enquiryStatus').classList.contains('is-error'));
  assert.match(await page.locator('#enquiryStatus').textContent(), /could not be sent. Check your connection/);
  assert.equal(await page.inputValue('#enqEmail'), valid.email);
  await page.click('#enquirySubmit');
  await page.waitForSelector('#enquirySuccess:not([hidden])');
  assert.equal(sent.length, 2);
  await context.close();
});

test('form: shows a loading state and ignores repeated clicks while sending', opts, async () => {
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const { page, context, sent } = await open({
    provider: async route => { await gate; return route.fulfill({ status: 200, contentType: 'application/json', body: '{"success":true}' }); }
  });
  await page.waitForSelector('#enquiryForm:not([hidden])');
  await fill(page);
  await page.click('#enquirySubmit');
  await page.waitForFunction(() => document.getElementById('enquirySubmit').disabled);
  assert.equal(await page.locator('#enquirySubmitText').textContent(), 'Sending enquiry…');
  assert.equal(await page.locator('#enquirySubmit').getAttribute('aria-busy'), 'true');
  await page.locator('#enquiryForm').evaluate(form => { form.requestSubmit(); form.requestSubmit(); });
  await page.keyboard.press('Enter');
  release();
  await page.waitForSelector('#enquirySuccess:not([hidden])');
  assert.equal(sent.length, 1, 'only one submission reaches the provider');
  await context.close();
});

test('form: a filled honeypot is passed to the provider rather than faking success', opts, async () => {
  const { page, context, sent } = await open({
    provider: route => route.fulfill({ status: 200, contentType: 'application/json', body: '{"success":false,"message":"Spam detected"}' })
  });
  await page.waitForSelector('#enquiryForm:not([hidden])');
  await fill(page);
  await page.locator('input[name="botcheck"]').evaluate(el => { el.checked = true; });
  await page.click('#enquirySubmit');
  await page.waitForFunction(() => document.getElementById('enquiryStatus').classList.contains('is-error'));
  assert.equal(sent[0].botcheck, true);
  assert.equal(await page.locator('#enquirySuccess').isVisible(), false);
  await context.close();
});

test('form: keyboard users can complete and send it in a logical order', opts, async () => {
  const { page, context, sent } = await open();
  await page.waitForSelector('#enquiryForm:not([hidden])');
  await page.focus('#whatsappCta');
  const order = [];
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Tab');
    order.push(await page.evaluate(() => document.activeElement.id || document.activeElement.name || document.activeElement.textContent.trim()));
  }
  const at = id => order.indexOf(id);
  assert.equal(at('enqName'), 0, `the form follows the WhatsApp button: ${order}`);
  assert.ok(at('enqName') < at('enqEmail') && at('enqEmail') < at('enqCompany') && at('enqCompany') < at('enqType') && at('enqType') < at('enqBudget') && at('enqBudget') < at('preferred_contact') && at('preferred_contact') < at('enqMessage'), `fields in visual order: ${order}`);
  assert.ok(!order.includes('botcheck'), 'the honeypot is not focusable');
  const outline = await page.locator('#enqMessage').evaluate(el => { el.focus(); return getComputedStyle(el).boxShadow; });
  assert.notEqual(outline, 'none', 'focused fields show a visible focus ring');

  await page.focus('#enqName');
  await page.keyboard.type(valid.name); await page.keyboard.press('Tab');
  await page.keyboard.type(valid.email); await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await page.keyboard.press('ArrowDown');
  await page.focus('#enqMessage');
  await page.keyboard.type(valid.message);
  await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'enquirySubmit');
  await page.keyboard.press('Enter');
  await page.waitForSelector('#enquirySuccess:not([hidden])');
  assert.equal(sent[0].project_type, E.PROJECT_TYPES[0]);
  await context.close();
});

test('contact: no horizontal overflow, and tap targets are large enough, on phone, tablet and desktop', opts, async () => {
  for (const viewport of [{ width: 360, height: 740 }, { width: 768, height: 1024 }, { width: 1440, height: 900 }]) {
    const { page, context } = await open({ viewport });
    await page.waitForSelector('#enquiryForm:not([hidden])');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, `no overflow at ${viewport.width}px`);
    for (const sel of ['#whatsappCta', '#enquirySubmit', '#enqName', '#enqType', '.enq-choice span', '.footer-links a']) {
      const box = await page.locator(sel).first().boundingBox();
      assert.ok(box && box.height >= 44, `${sel} is at least 44px tall at ${viewport.width}px (${box && box.height})`);
    }
    const fixed = await page.evaluate(() => [...document.querySelectorAll('#contact *, .site-footer *')].filter(el => getComputedStyle(el).position === 'fixed').length);
    assert.equal(fixed, 0, 'no floating buttons');
    await context.close();
  }
});
