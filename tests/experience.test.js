/* Tests for the social footer, the industry experience section, the homepage FAQ, the service
 * links into the enquiry form, the self-hosted typeface and the baseline security headers.
 * Run with `npm test` in this folder; browser tests use Playwright's Chromium. */
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { loadSocial } = require('./social-config.cjs');

let chromium;
try { ({ chromium } = require('playwright')); } catch (e) { chromium = null; }

const ROOT = path.resolve(__dirname, '..');
const SITE = 'https://buildwisegroup.dev';
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');
const PAGES = ['index.html', 'cybersecurity.html', 'scan.html', 'website-audit.html', 'privacy.html', 'security.html', 'ai-automation-nigeria.html', 'ai-automation-lagos.html', 'ai-agents.html', 'whatsapp-automation.html', 'custom-software-development.html', 'ai-visibility.html', 'business-automation.html', 'ai-receptionist.html'];
const TYPES = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.avif': 'image/avif', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2' };
const text = html => html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ');
const section = (html, id) => html.match(new RegExp(`<section[^>]*id="${id}"[\\s\\S]*?</section>`))[0];
const orgOf = html => JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1])['@graph'].find(n => n['@type'] === 'Organization');

const FAQ = [
  'What does BuildWise Group do?',
  'What types of AI products do you build?',
  'Can BuildWise automate existing business processes?',
  'Does BuildWise build custom software?',
  'Can you build an AI employee for my business?',
  'What industries do you work with?',
  'How does a typical project begin?',
  'How do I request a consultation or proposal?',
  'Do you provide ongoing maintenance and support?',
  'How can I contact BuildWise?'
];

/* ---------- Social profiles ---------- */
test('social profiles: the founder-verified Instagram and X accounts are live, and nothing else', () => {
  assert.deepEqual(loadSocial(), [
    { id: 'instagram', label: 'Instagram', url: 'https://www.instagram.com/buildwisehq/' },
    { id: 'x', label: 'X (formerly Twitter)', url: 'https://x.com/buildwisex' }
  ]);
});

test('social profiles: only https addresses on the network’s own host are ever shown', () => {
  const withUrls = (ig, x) => read('social-links.js').replace("url: 'https://www.instagram.com/buildwisehq/'", `url: '${ig}'`).replace("url: 'https://x.com/buildwisex'", `url: '${x}'`);
  assert.deepEqual(loadSocial(withUrls('https://www.instagram.com/buildwise.example/', 'https://x.com/buildwise_example')).map(p => p.id), ['instagram', 'x']);
  for (const [ig, x] of [['http://instagram.com/a', 'https://evil.example/x.com'], ['https://instagram.com/', 'https://x.com'], ['instagram.com/a', 'https://x.com.evil.example/a'], ['https://www.instagram.com.evil.example/a', 'javascript:alert(1)']]) {
    assert.deepEqual(loadSocial(withUrls(ig, x)), [], `${ig} and ${x} are rejected`);
  }
});

test('social profiles: structured data and X metadata match the verified profiles exactly', () => {
  const live = loadSocial();
  const html = read('index.html');
  const org = orgOf(html);
  if (live.length) assert.deepEqual(org.sameAs, live.map(p => p.url), 'sameAs lists every verified profile and nothing else');
  else assert.ok(!('sameAs' in org), 'no sameAs while no profile is verified');
  const x = live.find(p => p.id === 'x');
  const twitterSite = html.match(/<meta name="twitter:site" content="([^"]+)">/);
  if (x) assert.equal(twitterSite && twitterSite[1].toLowerCase(), `@${new URL(x.url).pathname.split('/')[1].toLowerCase()}`);
  else assert.equal(twitterSite, null, 'no twitter:site until the X account is verified');
});

test('social profiles: every page footer has the shared, hidden social slot and loads the config', () => {
  for (const file of PAGES) {
    const html = read(file);
    const footer = html.match(/<footer[\s\S]*?<\/footer>/)[0];
    assert.match(footer, /<ul class="footer-social" data-social-links aria-label="BuildWise Group on social media" hidden><\/ul>/, `${file} footer has the social slot`);
    assert.match(html, /<script defer src="\/?social-links\.js"><\/script>/, `${file} loads social-links.js`);
    assert.match(footer, /href="https:\/\/wa\.me\/2349165681202/, `${file} footer offers WhatsApp`);
    assert.match(footer, /Send a project enquiry/, `${file} footer offers the enquiry form`);
    assert.match(footer, /href="\/?#faq"/, `${file} footer links to the FAQ`);
  }
});

/* ---------- Industry experience ---------- */
test('industries: every area is labelled as client work, a BuildWise product or a capability', () => {
  const html = section(read('index.html'), 'industries');
  assert.match(html, /<h2 class="section-title" id="industriesTitle"[^>]*>Technology built for real-world industries\.<\/h2>/);
  const items = [...html.matchAll(/<li class="ind"[\s\S]*?<\/li>/g)].map(m => m[0]);
  assert.equal(items.length, 5);
  const tagOf = item => [...item.matchAll(/class="ind-tag ind-tag-(client|product|cap)"/g)].map(m => m[1]);
  for (const item of items) assert.equal(tagOf(item).length, 1, 'exactly one evidence label per area');
  const byName = Object.fromEntries(items.map(item => [text(item.match(/<h3>([\s\S]*?)<\/h3>/)[1]).trim(), { tag: tagOf(item)[0], text: text(item) }]));
  assert.deepEqual(Object.keys(byName), ['Healthcare & aesthetics', 'Recruitment & career technology', 'Financial technology & trading tools', 'Business operations & automation', 'Digital products & software']);
  assert.equal(byName['Healthcare & aesthetics'].tag, 'client');
  assert.match(byName['Healthcare & aesthetics'].text, /website maintenance/i);
  assert.match(byName['Healthcare & aesthetics'].text, /Maya/);
  for (const [name, product] of [['Recruitment & career technology', 'Huntly'], ['Financial technology & trading tools', 'Traider'], ['Business operations & automation', 'Staff']]) {
    assert.equal(byName[name].tag, 'product', `${product} is a BuildWise product, not client work`);
    assert.match(byName[name].text, new RegExp(product));
  }
  assert.equal(byName['Digital products & software'].tag, 'cap');
  assert.equal((html.match(/ind-tag-client"/g) || []).length, 2, 'one client engagement, plus the key');
});

test('industries: no client names, logos, outreach targets or inflated claims', () => {
  const body = text(section(read('index.html'), 'industries'));
  const banned = [/Marvels/i, /\bclinic\b/i, /London/i, /<img/i, /logo/i, /trusted by/i, /our clients include/i, /testimonial/i, /case stud/i, /\d+\+?\s*(?:clients|customers|projects|businesses)/i, /leading|world[- ]class|award/i, /%/];
  for (const re of banned) assert.ok(!re.test(body), `no claim matching ${re}`);
  assert.match(body, /We name clients only with their permission/);
  assert.ok(!/Client engagement[^.]*(Huntly|Traider|Staff ·)/.test(body));
});

/* ---------- FAQ ---------- */
test('faq: the ten questions are in the page HTML, answered without unsupported promises', () => {
  const html = section(read('index.html'), 'faq');
  const questions = [...html.matchAll(/<summary>([^<]+)<svg/g)].map(m => m[1]);
  assert.deepEqual(questions, FAQ);
  const body = text(html);
  const banned = [/\$\s?\d|£\s?\d|€\s?\d/, /\b\d+\s*(?:business\s+)?(?:hours?|days?|weeks?|months?)\b/i, /guarantee/i, /\bSLA\b|service[- ]level/i, /24\/7|round[- ]the[- ]clock/i, /fixed price/i, /certified/i, /mailto:/i, /instagram/i];
  for (const re of banned) assert.ok(!re.test(body), `no claim matching ${re}`);
  assert.match(body, /Staff is still being validated/);
  assert.ok(!JSON.stringify(read('index.html')).includes('FAQPage'), 'no FAQPage markup: FAQ rich results are limited to government and health sites');
  assert.match(read('index.html'), /<a href="#faq">FAQ<\/a>/, 'the FAQ is in the main navigation');
});

/* ---------- Palette ---------- */
test('palette: the four approved brand colours are the site tokens, and the old values are gone', () => {
  const root = read('styles.css').match(/:root \{([\s\S]*?)\n\}/)[1];
  for (const [name, value] of [['obsidian', '#0B0D12'], ['warm-white', '#F4F1EA'], ['graphite', '#303640'], ['cobalt', '#4764FF']]) {
    assert.match(root, new RegExp(`--${name}: ${value};`), `--${name} is ${value}`);
  }
  for (const file of ['styles.css', 'scanner.css', 'cybersecurity.css', 'website-audit.css', ...PAGES, '404.html', 'favicon.svg']) {
    assert.ok(!/#0B0D10|#FAFAF8|#1E4FFF|rgba\(30, 79, 255|rgba\(250, 250, 248|rgba\(11, 13, 16,/i.test(read(file)), `${file} uses only the approved palette`);
  }
  const css = ['styles.css', 'scanner.css', 'cybersecurity.css', 'website-audit.css'].map(read).join('\n');
  assert.ok(!/var\(--(offwhite|graphite-2)\)/.test(css), 'the retired token names are gone (--graphite now means #303640, not the old dark background)');
});

test('palette: cobalt text on light backgrounds uses the accessible shade, and text on cobalt is solid white', () => {
  const css = ['styles.css', 'scanner.css', 'cybersecurity.css', 'website-audit.css'].map(read).join('\n');
  const decorative = /^\.(cap:hover \.cap-icon|cap:hover \.cap-arrow|cap-feature \.cap-arrow|dot-blue|faq-list summary \.ico) /;
  const textCobalt = css.split('\n').filter(line => /(?<![-\w])color: var\(--cobalt\)/.test(line) && !decorative.test(line));
  assert.deepEqual(textCobalt, [], 'text uses --cobalt-deep (6.1:1 on warm white), not --cobalt (4.1:1)');
  assert.ok(!/[^-]color: rgba\(255, 255, 255, \.\d+\)/.test(css), 'no translucent white text, which drops below 4.5:1 on cobalt');
});

/* ---------- Typeface, metadata and headers ---------- */
test('the typeface is self-hosted, preloaded and licensed; no page calls Google Fonts', () => {
  assert.ok(fs.statSync(path.join(ROOT, 'assets/fonts/manrope-latin.woff2')).size > 10000);
  assert.match(read('assets/fonts/OFL.txt'), /SIL Open Font License/);
  assert.match(read('styles.css'), /@font-face \{\s*font-family: "Manrope";[\s\S]*?font-display: swap;[\s\S]*?url\("\/assets\/fonts\/manrope-latin\.woff2"\)/);
  for (const file of [...PAGES, '404.html']) assert.ok(!/fonts\.(googleapis|gstatic)\.com/.test(read(file)), `${file} does not load Google Fonts`);
  for (const file of PAGES) assert.match(read(file), /<link rel="preload" href="\/assets\/fonts\/manrope-latin\.woff2" as="font" type="font\/woff2" crossorigin>/, `${file} preloads the font`);
});

test('homepage metadata and organisation data describe the real business', () => {
  const html = read('index.html');
  const title = html.match(/<title>([^<]+)<\/title>/)[1].replace(/&amp;/g, '&');
  assert.match(title, /^BuildWise Group — /);
  assert.ok(title.length <= 70, 'title fits in search results');
  const org = orgOf(html);
  assert.equal(org.contactPoint.telephone, '+2349165681202', 'the only phone is the published WhatsApp number');
  assert.deepEqual(org.brand.map(b => b.name), ['Huntly', 'Traider', 'Staff']);
  assert.ok(!('email' in org) && !/[\w.+-]+@[\w-]+\.[a-z]/i.test(JSON.stringify(org)), 'no email address');
  for (const type of ['AggregateRating', 'Review', 'Offer']) assert.ok(!html.includes(`"@type": "${type}"`), `no ${type} markup`);
  const privacy = read('privacy.html');
  assert.match(privacy, /<meta property="og:url" content="https:\/\/buildwisegroup\.dev\/privacy">/);
  assert.match(privacy, /<meta property="og:image" content="https:\/\/buildwisegroup\.dev\/assets\/og-image\.jpg">/);
});

test('every response gets baseline security headers, set once', () => {
  const headers = read('_headers');
  const all = headers.match(/^\/\*\n((?:  .+\n)+)/m)[1];
  for (const h of ['X-Content-Type-Options: nosniff', 'Referrer-Policy: strict-origin-when-cross-origin', 'X-Frame-Options: DENY', 'Permissions-Policy: ']) assert.ok(all.includes(h), h);
  const rest = headers.replace(all, '');
  for (const name of ['X-Content-Type-Options', 'Referrer-Policy', 'X-Frame-Options', 'Permissions-Policy']) {
    assert.ok(!rest.includes(`${name}:`), `${name} is not repeated (Pages would join the values)`);
  }
  const csp = headers.match(/\/website-audit\n  Content-Security-Policy: (.+)/)[1];
  assert.match(csp, /font-src 'self'/);
  assert.ok(!/googleapis|gstatic/.test(csp), 'the audit page policy no longer allows Google Fonts');
});

/* ---------- Browser ---------- */
const opts = { skip: chromium ? false : 'playwright is not installed (run npm install in tests/)' };
let server; let origin; let browser;

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

test.after(async () => {
  if (browser) await browser.close();
  if (server) server.close();
});

async function open(urlPath, contextOptions = {}, setup) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 860 }, ...contextOptions });
  const page = await context.newPage();
  const errors = [];
  const outside = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('request', r => { if (!r.url().startsWith(origin) && !r.url().startsWith('data:')) outside.push(r.url()); });
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, route => route.abort());
  if (setup) await setup(page);
  await page.goto(origin + urlPath);
  return { page, context, errors: () => errors.filter(e => !/ERR_FAILED/.test(e)), outside };
}

const LIVE = [
  ['https://www.instagram.com/buildwisehq/', 'BuildWise Group on Instagram (opens in a new tab)'],
  ['https://x.com/buildwisex', 'BuildWise Group on X (formerly Twitter) (opens in a new tab)']
];

test('social footer: the verified profiles show on every page, on phone and desktop, as safe, labelled links', opts, async () => {
  for (const urlPath of ['/', '/cybersecurity', '/scan', '/website-audit', '/privacy', '/security']) {
    for (const viewport of [{ width: 360, height: 780 }, { width: 1440, height: 900 }]) {
      const { page, context, errors } = await open(urlPath, { viewport, reducedMotion: 'reduce' });
      const list = page.locator('.site-footer [data-social-links]');
      const links = list.locator('a');
      await links.first().waitFor({ state: 'attached' });
      assert.ok(await list.isVisible(), `${urlPath}: the social list is shown`);
      const found = await links.evaluateAll(els => els.map(a => [a.getAttribute('href'), a.getAttribute('aria-label'), a.target, a.rel]));
      assert.deepEqual(found.map(([href, label]) => [href, label]), LIVE, `${urlPath} at ${viewport.width}px`);
      for (const [, , target, rel] of found) {
        assert.equal(target, '_blank');
        assert.match(rel, /\bnoopener\b/);
        assert.match(rel, /\bnoreferrer\b/);
      }
      await links.first().scrollIntoViewIfNeeded();
      for (const box of await links.evaluateAll(els => els.map(a => a.getBoundingClientRect().toJSON()))) {
        assert.ok(box.width >= 44 && box.height >= 44, 'comfortable tap target');
      }
      assert.ok(await links.locator('svg[aria-hidden="true"]').count() === 2, 'icons are decorative; the label carries the name');
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      assert.equal(overflow, 0);
      assert.deepEqual(errors(), []);
      await context.close();
    }
  }
});

test('social footer: a profile on the wrong host, or no verified profile at all, shows nothing', opts, async () => {
  const swap = (ig, x) => read('social-links.js').replace("url: 'https://www.instagram.com/buildwisehq/'", `url: '${ig}'`).replace("url: 'https://x.com/buildwisex'", `url: '${x}'`);
  for (const [ig, x, expected] of [['https://www.instagram.com/buildwisehq/', 'https://x.com.evil.example/buildwisex', 1], ['', '', 0]]) {
    const { page, context, errors } = await open('/', { reducedMotion: 'reduce' }, p => p.route('**/social-links.js', route => route.fulfill({ contentType: 'text/javascript', body: swap(ig, x) })));
    await page.waitForLoadState('load');
    const list = page.locator('.site-footer [data-social-links]');
    assert.equal(await list.locator('a').count(), expected);
    assert.equal(await list.isHidden(), expected === 0, 'an empty list stays hidden');
    assert.deepEqual(errors(), []);
    await context.close();
  }
});

test('faq and industries: readable on phone, tablet and desktop, keyboard-operable, no sideways scroll', opts, async () => {
  for (const viewport of [{ width: 360, height: 780 }, { width: 768, height: 1024 }, { width: 1440, height: 900 }]) {
    const { page, context, errors } = await open('/', { viewport, reducedMotion: 'reduce' });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert.equal(overflow, 0, `no sideways scroll at ${viewport.width}px`);
    const small = await page.evaluate(() => [...document.querySelectorAll('#industries p, #industries h3, #faq p, #faq summary')].filter(el => el.offsetParent && !el.classList.contains('label') && parseFloat(getComputedStyle(el).fontSize) < 13).length);
    assert.equal(small, 0, `text is at least 13px at ${viewport.width}px`);
    const summaries = page.locator('#faq summary');
    assert.equal(await summaries.count(), 10);
    const heights = await summaries.evaluateAll(els => els.map(el => el.getBoundingClientRect().height));
    assert.ok(heights.every(h => h >= 44), 'each question is a comfortable tap target');
    await summaries.nth(4).focus();
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('#faq details').nth(4).getAttribute('open'), '');
    assert.ok(await page.locator('#faq details').nth(4).locator('p').isVisible());
    await page.keyboard.press('Space');
    assert.equal(await page.locator('#faq details').nth(4).getAttribute('open'), null, 'closes again from the keyboard');
    assert.deepEqual(errors(), []);
    await context.close();
  }
});

test('service links open the enquiry form with the matching project type', opts, async () => {
  const { page, context, errors } = await open('/', { reducedMotion: 'reduce' });
  await page.waitForSelector('#enquiryForm:not([hidden])');
  for (const [name, type] of [['Discuss an AI product', 'AI product development'], ['Discuss an automation', 'Business automation and integrations'], ['Discuss custom software', 'SaaS or web application development'], ['Discuss a website', 'Website or digital experience']]) {
    await page.getByRole('link', { name }).click();
    await page.waitForFunction(() => location.hash === '#contact');
    assert.equal(await page.inputValue('#enqType'), type, `${name} preselects ${type}`);
  }
  assert.deepEqual(errors(), []);
  await context.close();
});

test('the homepage loads nothing from other origins and uses the self-hosted font', opts, async () => {
  const { page, context, errors, outside } = await open('/', { reducedMotion: 'reduce' });
  await page.waitForLoadState('load');
  await page.evaluate(() => document.fonts.ready);
  assert.ok(await page.evaluate(() => document.fonts.check('600 16px Manrope')), 'Manrope is loaded');
  assert.deepEqual(outside, [], 'no third-party requests on load');
  assert.deepEqual(errors(), []);
  await context.close();
});

test('brand links use their visible text as their accessible name', opts, async () => {
  const { page, context } = await open('/', { reducedMotion: 'no-preference' });
  const names = await page.locator('a.brand').evaluateAll(els => els.map(el => el.textContent.replace(/\s+/g, ' ').trim()));
  assert.deepEqual(names, ['BuildWise Group, back to top', 'BuildWise Group, back to top']);
  assert.equal(await page.locator('a.brand[aria-label]').count(), 0);
  await context.close();
});
