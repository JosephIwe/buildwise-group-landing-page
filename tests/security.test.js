/* Tests for the vulnerability disclosure policy (/security), /.well-known/security.txt
 * and SECURITY.md. Run with `npm test` in this folder; the layout test uses Playwright's Chromium. */
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

let chromium;
try { ({ chromium } = require('playwright')); } catch (e) { chromium = null; }

const ROOT = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');
const SITE = 'https://buildwisegroup.dev';
const REPORT = 'https://github.com/JosephIwe/buildwise-group-landing-page/security/advisories/new';
const PAGES = ['index.html', 'cybersecurity.html', 'scan.html', 'website-audit.html', 'privacy.html', 'security.html'];
const DAY = 24 * 60 * 60 * 1000;
const text = html => html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ');

/* RFC 9116 parser: returns { fields: [[name, value]], errors: [] }. */
function parseSecurityTxt(body) {
  const fields = [];
  const errors = [];
  body.split('\n').forEach((line, i) => {
    if (line.endsWith('\r')) line = line.slice(0, -1);
    if (line === '' || line.startsWith('#')) return;
    const m = /^([A-Za-z0-9-]+): (\S.*)$/.exec(line);
    if (!m) errors.push(`line ${i + 1} is not "Field: value": ${line}`);
    else fields.push([m[1].toLowerCase(), m[2]]);
  });
  return { fields, errors };
}

test('security.txt is valid RFC 9116 and points at the private GitHub route and /security', () => {
  const body = read('.well-known/security.txt');
  assert.ok(body.endsWith('\n'), 'ends with a newline');
  assert.ok(!/[^\x09\x0a\x20-\x7e]/.test(body), 'plain ASCII text');
  const { fields, errors } = parseSecurityTxt(body);
  assert.deepEqual(errors, []);
  const all = name => fields.filter(([n]) => n === name).map(([, v]) => v);
  const known = ['acknowledgments', 'canonical', 'contact', 'encryption', 'expires', 'hiring', 'policy', 'preferred-languages', 'csaf'];
  for (const [name] of fields) assert.ok(known.includes(name), `known field ${name}`);

  const contacts = all('contact');
  assert.ok(contacts.length >= 1, 'at least one Contact');
  assert.equal(contacts[0], REPORT, 'the first Contact is the private reporting route');
  for (const c of contacts) assert.match(c, /^(https:\/\/|mailto:|tel:)/, 'Contact is a URI; web URIs use https');
  assert.ok(!contacts.some(c => /^mailto:/.test(c)), 'no email address is published');

  const expires = all('expires');
  assert.equal(expires.length, 1, 'exactly one Expires');
  assert.match(expires[0], /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/, 'Expires is an RFC 3339 date-time');
  const left = Date.parse(expires[0]) - Date.now();
  assert.ok(left > 30 * DAY, `Expires (${expires[0]}) is more than 30 days away: renew it in .well-known/security.txt`);
  assert.ok(left < 366 * DAY, 'Expires is less than a year ahead, as RFC 9116 recommends');

  assert.deepEqual(all('policy'), [`${SITE}/security`]);
  assert.deepEqual(all('canonical'), [`${SITE}/.well-known/security.txt`]);
  assert.equal(all('preferred-languages').length, 1);
  for (const v of [...all('policy'), ...all('canonical')]) assert.match(v, /^https:\/\//);
});

test('security.txt is served as text/plain at the exact well-known path', () => {
  assert.ok(fs.existsSync(path.join(ROOT, '.well-known', 'security.txt')));
  assert.ok(!fs.existsSync(path.join(ROOT, 'security.txt')), 'no legacy root copy that could drift');
  assert.match(read('_headers'), /^\/\.well-known\/security\.txt\n\s+Content-Type: text\/plain; charset=utf-8$/m);
  assert.match(read('_headers'), /^\/SECURITY\.md\n\s+X-Robots-Tag: noindex$/m);
});

test('the policy routes reports privately and never asks for details on sales channels', () => {
  const html = read('security.html');
  const body = text(html);
  assert.match(html, /<link rel="canonical" href="https:\/\/buildwisegroup\.dev\/security">/);
  assert.equal((html.match(/<h1/g) || []).length, 1);
  assert.ok(html.includes(`href="${REPORT}"`), 'links to the private reporting route');
  assert.match(body, /Do not include any vulnerability details there/);
  assert.match(body, /Live site:/, 'explains what to do for the live website');
  assert.match(body, /buildwisegroup\.dev/);
  for (const topic of [/Respect privacy/, /denial-of-service/, /destructive/, /Keep it private until we have coordinated/, /What to include/, /How we handle reports/]) {
    assert.match(body, topic);
  }
  assert.match(read('SECURITY.md'), new RegExp(REPORT.replace(/[/.]/g, '\\$&')));
  assert.match(read('SECURITY.md'), /https:\/\/buildwisegroup\.dev\/security/);
});

test('the policy makes no unsupported promises', () => {
  const body = text(read('security.html')) + ' ' + read('SECURITY.md') + ' ' + read('.well-known/security.txt');
  const banned = [
    /\b\d+\s*(?:business\s+)?(?:hours?|days?|weeks?)\b/i, /within (?:a|one) (?:day|week)/i, /\bSLA\b/, /immediate(?:ly)?/i, /guarantee/i,
    /security team/i, /24\/7/, /round[- ]the[- ]clock/i, /certified|certification/i, /ISO ?27001/i, /\bSOC ?2\b/,
    /\$\s?\d/, /reward/i, /hall of fame/i, /bounty/i, /mailto:/i
  ];
  const rest = body.replace(/do not run a bug bounty programme/g, '');
  for (const re of banned) assert.ok(!re.test(rest), `no claim matching ${re}`);
  assert.match(body, /do not run a bug bounty programme/, 'states plainly that there is no bounty');
});

test('every page footer links to /security, and the sitemap lists it', () => {
  for (const file of PAGES) {
    const footer = read(file).match(/<footer[\s\S]*?<\/footer>/)[0];
    assert.match(footer, /<a href="\/security"[^>]*>Report a vulnerability<\/a>/, `${file} footer links to /security`);
    assert.match(footer, /href="\/privacy"/, `${file} keeps the privacy link`);
  }
  assert.match(read('security.html').match(/<footer[\s\S]*?<\/footer>/)[0], /href="\/security" aria-current="page"/);
  assert.match(read('sitemap.xml'), /<loc>https:\/\/buildwisegroup\.dev\/security<\/loc>/);
});

/* ---------- Browser ---------- */
const opts = { skip: chromium ? false : 'playwright is not installed (run npm install in tests/)' };
let server; let origin; let browser;

test.before(async () => {
  if (!chromium) return;
  server = http.createServer((req, res) => {
    const url = decodeURIComponent(req.url.split('?')[0]);
    let file = path.join(ROOT, url.endsWith('/') ? `${url}index.html` : url);
    if (!path.extname(file) && fs.existsSync(`${file}.html`)) file = `${file}.html`;
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
    const type = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.txt': 'text/plain' }[path.extname(file)];
    res.writeHead(200, { 'content-type': type || 'application/octet-stream' });
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

test('the /security page reads well on phone, tablet and desktop, and its report button is usable', opts, async () => {
  for (const viewport of [{ width: 360, height: 780 }, { width: 768, height: 1024 }, { width: 1440, height: 900 }]) {
    const context = await browser.newContext({ viewport, reducedMotion: 'reduce' });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error' && !/fonts|ERR_FAILED/.test(m.text())) errors.push(m.text()); });
    await page.route(/fonts\.(googleapis|gstatic)\.com/, route => route.abort());
    await page.goto(`${origin}/security`);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert.equal(overflow, 0, `no sideways scroll at ${viewport.width}px`);
    const small = await page.evaluate(() => [...document.querySelectorAll('main p, main li')].filter(el => el.offsetParent && !el.classList.contains('label') && parseFloat(getComputedStyle(el).fontSize) < 13).length);
    assert.equal(small, 0, `body text is at least 13px at ${viewport.width}px`);
    const button = page.getByRole('link', { name: /Report a vulnerability privately/ });
    assert.equal(await button.getAttribute('href'), REPORT);
    assert.equal(await button.getAttribute('rel'), 'noopener noreferrer');
    const box = await button.boundingBox();
    assert.ok(box.height >= 44, 'report button is a comfortable tap target');
    const [fg, bg] = await button.evaluate(el => [getComputedStyle(el).color, getComputedStyle(el).backgroundColor]);
    assert.notEqual(fg, bg, 'button text is visible against its background');
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => document.activeElement.textContent.trim()), 'Skip to content');
    assert.deepEqual(errors, []);
    await context.close();
  }
});

test('security.txt is reachable at /.well-known/security.txt', opts, async () => {
  const res = await fetch(`${origin}/.well-known/security.txt`);
  assert.equal(res.status, 200);
  assert.match(await res.text(), /^Contact: https:\/\/github\.com\//m);
});
