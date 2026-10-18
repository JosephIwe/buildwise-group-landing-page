/* Tests for the Website & AI Visibility Audit (lib/audit). No real network: see fixtures/fake-net.mjs. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { AuditError, LIMITS, createContext, dohResolver, isBlockedIp, parseTarget, safeFetch } from '../lib/audit/net.mjs';
import { extractHtml, readJsonLd } from '../lib/audit/html.mjs';
import { checkAccess, parseRobots, patternMatches } from '../lib/audit/robots.mjs';
import { parseSitemap } from '../lib/audit/sitemap.mjs';
import { runAudit } from '../lib/audit/run.mjs';
import { createLimiter, handleAudit, MESSAGES, POLICY } from '../lib/audit/handler.mjs';
import { SEVERITIES } from '../lib/audit/checks.mjs';
import { CRAWLERS } from '../lib/audit/crawlers.mjs';
import { fakeNet, goodSite, page, goodHead, goodBody } from './fixtures/fake-net.mjs';

const ORIGIN = 'https://acme.example.com';
const code = async (promise, expected) => {
  await assert.rejects(promise, error => { assert.ok(error instanceof AuditError, String(error)); assert.equal(error.code, expected); return true; });
};
const audit = (routes, options = {}, input = 'acme.example.com') => {
  const net = fakeNet(routes, options);
  return runAudit(input, { ...net, limits: options.limits }).then(report => ({ report, net }));
};
const all = r => [...r.confirmed, ...r.advisory];
const titled = (r, re) => all(r).find(f => re.test(f.title));

/* ---------- URL validation and prohibited destinations ---------- */
test('only public http(s) addresses on default ports are accepted', () => {
  for (const [input, href] of [['example.com', 'https://example.com/'], ['HTTP://Example.COM/a?b=1#c', 'http://example.com/a?b=1'], ['example.com:443/x', 'https://example.com/x'], ['https://bücher.de', 'https://xn--bcher-kva.de/'], ['shop.example.co.uk.', 'https://shop.example.co.uk/']]) {
    assert.equal(parseTarget(input).href, href, input);
  }
  const invalid = ['', '   ', 'localhost', 'acme', 'ftp://example.com', 'file:///etc/passwd', 'javascript:alert(1)', 'data:text/html,hi', 'gopher://example.com', 'http://user:pass@example.com', 'exa mple.com', `https://${'a'.repeat(2100)}.com`, 'http://-bad-.com', 'https://example.123'];
  for (const input of invalid) assert.throws(() => parseTarget(input), e => e.code === 'invalid_url', input);
  const blocked = ['http://127.0.0.1', 'http://127.1', 'http://2130706433', 'http://0x7f000001', 'http://0177.0.0.1', 'http://[::1]', 'http://[::ffff:127.0.0.1]', 'http://169.254.169.254/latest/meta-data/', 'http://10.0.0.1', 'http://192.168.1.1', 'example.com:8080', 'http://example.com:22', 'https://router.local', 'https://metadata.google.internal', 'https://printer.lan', 'https://x.home.arpa', 'https://localhost.localdomain', 'https://app.localhost'];
  for (const input of blocked) assert.throws(() => parseTarget(input), e => e.code === 'blocked_destination', input);
});

test('private, loopback, link-local, metadata and reserved IP ranges are blocked', () => {
  const blocked = ['0.0.0.0', '10.1.2.3', '100.64.0.1', '100.100.100.200', '127.0.0.1', '169.254.169.254', '172.16.0.1', '172.31.255.255', '192.0.0.1', '192.0.2.1', '192.168.0.1', '198.18.0.1', '198.51.100.1', '203.0.113.1', '224.0.0.1', '240.0.0.1', '255.255.255.255',
    '::', '::1', '::ffff:10.0.0.1', '::ffff:8.8.8.8', '64:ff9b::a00:1', '100::1', 'fc00::1', 'fd00:ec2::254', 'fe80::1', 'fec0::1', 'ff02::1', '2001:db8::1', '2001::1', '2002:7f00:1::1', '3fff::1', 'not-an-ip', '1.2.3', '01.2.3.4'];
  for (const ip of blocked) assert.equal(isBlockedIp(ip), true, ip);
  for (const ip of ['8.8.8.8', '1.1.1.1', '93.184.215.14', '172.32.0.1', '100.128.0.1', '2606:4700:4700::1111', '2001:4860:4860::8888', '2a00:1450:4009:81f::200e']) assert.equal(isBlockedIp(ip), false, ip);
});

/* ---------- DNS ---------- */
test('a hostname resolving to any private address is refused before any request', async () => {
  for (const ips of [['10.0.0.5'], ['93.184.215.14', '127.0.0.1'], ['::1'], ['169.254.169.254'], ['fd00::1']]) {
    const net = fakeNet(goodSite(), { dns: { 'acme.example.com': ips } });
    await code(runAudit('acme.example.com', net), 'blocked_destination');
    assert.equal(net.requests.length, 0, `no request for ${ips}`);
  }
});

test('unresolvable hosts and resolver failures are reported safely', async () => {
  await code(runAudit('acme.example.com', fakeNet(goodSite(), { dns: { 'acme.example.com': [] } })), 'dns_failed');
  await code(runAudit('acme.example.com', fakeNet(goodSite(), { dns: { 'acme.example.com': new Error('resolver 10.0.0.53 refused') } })), 'dns_failed');
  const slow = { ...fakeNet(goodSite()), resolve: () => new Promise(() => {}) };
  await code(runAudit('acme.example.com', { ...slow, limits: { ...LIMITS, timeoutMs: 50 } }), 'dns_failed');
});

test('the DNS-over-HTTPS resolver reads A and AAAA answers and NXDOMAIN', async () => {
  const answers = {
    A: { Status: 0, Answer: [{ type: 5, data: 'cdn.example.net.' }, { type: 1, data: '93.184.215.14' }] },
    AAAA: { Status: 0, Answer: [{ type: 28, data: '2606:2800:21f:cb07:6820:80da:af6b:8b2c' }] }
  };
  const seen = [];
  const resolver = dohResolver(async url => { seen.push(url); const type = new URL(url).searchParams.get('type'); return new Response(JSON.stringify(answers[type])); });
  assert.deepEqual(await resolver('acme.example.com'), ['93.184.215.14', '2606:2800:21f:cb07:6820:80da:af6b:8b2c']);
  assert.ok(seen.every(u => u.startsWith('https://cloudflare-dns.com/dns-query?name=acme.example.com&type=')));
  const nx = dohResolver(async () => new Response(JSON.stringify({ Status: 3 })));
  assert.deepEqual(await nx('nope.example.com'), []);
  const servfail = dohResolver(async () => new Response(JSON.stringify({ Status: 2 })));
  await code(servfail('x.example.com'), 'dns_failed');
});

/* ---------- Redirects ---------- */
test('every redirect hop is validated and resolved again', async () => {
  const cases = [
    ['to a host that resolves privately', 'https://internal.example.net/', { 'internal.example.net': ['192.168.0.10'] }, 'blocked_redirect'],
    ['to an IP address', 'http://169.254.169.254/latest/meta-data/', {}, 'blocked_redirect'],
    ['to localhost', 'http://localhost:8080/', {}, 'blocked_redirect'],
    ['to a non-web scheme', 'file:///etc/passwd', {}, 'bad_redirect'],
    ['to a malformed address', 'http://[::1', {}, 'bad_redirect']
  ];
  for (const [name, location, dns, expected] of cases) {
    const net = fakeNet({ [`${ORIGIN}/`]: { status: 302, location } }, { dns });
    await code(runAudit('acme.example.com', net), expected);
    assert.equal(net.requests.length, 1, `${name}: the target of the redirect is never requested`);
  }
});

test('DNS rebinding through a redirect to a second hostname is caught', async () => {
  // The first host is public; it redirects to a name that points at the metadata service.
  const net = fakeNet({ [`${ORIGIN}/`]: { status: 301, location: 'https://rebind.example.org/' } }, { dns: { 'rebind.example.org': ['169.254.169.254'] } });
  await code(runAudit('acme.example.com', net), 'blocked_redirect');
  assert.deepEqual(net.lookups, ['acme.example.com', 'rebind.example.org']);
  assert.ok(!net.requests.some(r => r.url.includes('rebind')));
});

test('redirect chains are capped and relative redirects are followed', async () => {
  const loop = {};
  for (let i = 0; i < 10; i += 1) loop[`${ORIGIN}/${i}`] = { status: 301, location: `/${i + 1}` };
  loop[`${ORIGIN}/`] = { status: 301, location: '/0' };
  const net = fakeNet(loop);
  await code(runAudit('acme.example.com', net), 'too_many_redirects');
  assert.equal(net.requests.length, LIMITS.redirects + 1);

  const { report } = await audit(goodSite(ORIGIN, { [`${ORIGIN}/start`]: { status: 301, location: '/' } }), {}, 'acme.example.com/start');
  assert.equal(report.finalUrl, `${ORIGIN}/`);
  assert.equal(report.redirects.length, 1);
});

test('requests are read-only GETs that identify the audit and carry no credentials', async () => {
  const { net } = await audit(goodSite());
  assert.ok(net.requests.length > 3);
  for (const r of net.requests) {
    assert.equal(r.method, 'GET');
    assert.match(r.headers['user-agent'], /^BuildWiseAudit\/1\.0 \(\+https:\/\/buildwisegroup\.dev\/website-audit\)$/);
    assert.ok(!('cookie' in r.headers) && !('authorization' in r.headers));
  }
  assert.ok(net.requests.length <= LIMITS.targetRequests);
});

/* ---------- Timeouts, size and type limits ---------- */
test('a request that never answers times out', async () => {
  const limits = { ...LIMITS, timeoutMs: 60 };
  const net = fakeNet({ [`${ORIGIN}/`]: (url, init) => new Promise((_, reject) => init.signal.addEventListener('abort', () => reject(new Error('aborted')))) });
  const started = Date.now();
  await code(runAudit('acme.example.com', { ...net, limits }), 'timeout');
  assert.ok(Date.now() - started < 1000);
});

test('a body that stalls mid-stream times out and is cancelled', async () => {
  let cancelled = false;
  const stalled = () => new Response(new ReadableStream({
    start(c) { c.enqueue(new TextEncoder().encode('<html><title>x')); },
    cancel() { cancelled = true; }
  }), { headers: { 'content-type': 'text/html' } });
  await code(runAudit('acme.example.com', { ...fakeNet({ [`${ORIGIN}/`]: stalled }), limits: { ...LIMITS, timeoutMs: 80 } }), 'timeout');
  assert.ok(cancelled, 'the stream is cancelled');
});

test('oversized responses stop at the byte limit and are reported', async () => {
  let pulled = 0;
  let cancelled = false;
  const huge = () => new Response(new ReadableStream({
    pull(c) { pulled += 1; c.enqueue(new TextEncoder().encode(`<p>${'word '.repeat(20000)}</p>`)); if (pulled > 500) c.close(); },
    cancel() { cancelled = true; }
  }), { headers: { 'content-type': 'text/html' } });
  const { report } = await audit(goodSite(ORIGIN, { [`${ORIGIN}/`]: huge }));
  assert.equal(report.htmlBytes, LIMITS.htmlBytes);
  assert.ok(cancelled && pulled < 20, 'reading stops soon after the limit');
  assert.ok(titled(report, /larger than/));
});

test('non-HTML pages are not read and cannot be audited', async () => {
  for (const type of ['application/pdf', 'image/png', 'application/octet-stream', 'application/json']) {
    await code(runAudit('acme.example.com', fakeNet({ [`${ORIGIN}/`]: { type, body: 'x'.repeat(100) } })), 'not_html');
  }
});

test('the request budget is enforced and what was skipped is reported as not checked', async () => {
  const limits = { ...LIMITS, targetRequests: 4 };
  const { report, net } = await audit(goodSite(), { limits });
  assert.ok(net.requests.length <= 4);
  assert.ok(report.notChecked.some(n => /internal link|sitemap/i.test(n.title)), 'skipped work is listed');
});

test('at most four distinct hostnames are looked up per audit', async () => {
  const hops = {};
  ['a', 'b', 'c', 'd', 'e'].forEach((h, i, list) => { hops[`https://${h}.example.com/`] = { status: 301, location: `https://${list[i + 1] || 'a'}.example.com/` }; });
  const net = fakeNet(hops);
  await assert.rejects(runAudit('a.example.com', net));
  assert.ok(net.lookups.length <= LIMITS.hostLookups);
});

/* ---------- Malformed pages ---------- */
test('malformed and hostile HTML is parsed quickly without errors', () => {
  const nasty = [
    '<html><head><title>Unclosed',
    '<!-- never closed <title>x</title>',
    '<a href="/x" title="unclosed quote><h1>Heading</h1>',
    '<script>document.write("<h1>fake</h1>")',
    '<<<>>><//><h1 <h1>><h1>Real</h1>',
    '\u0000�<html lang=en><title>T&amp;C &#x1F600; &#99999999; &bogus;</title>'
  ];
  for (const html of nasty) assert.doesNotThrow(() => extractHtml(html, `${ORIGIN}/`), html);
  const f = extractHtml(nasty[5], `${ORIGIN}/`);
  assert.equal(f.titles[0], 'T&C 😀 &#99999999; &bogus;');
  assert.deepEqual(extractHtml(nasty[3], `${ORIGIN}/`).headings, [], 'script content is not parsed as markup');

  // Pathological input: many unclosed tags, comments and quotes in 1 MB.
  for (const unit of ['<a href=x>', '<!--', '<h1>', '<a href="', '<title>', '<div class="x" ']) {
    const html = unit.repeat(Math.floor(1000000 / unit.length));
    const started = process.hrtime.bigint();
    extractHtml(html, `${ORIGIN}/`);
    const ms = Number(process.hrtime.bigint() - started) / 1e6;
    assert.ok(ms < 1500, `${unit} took ${ms.toFixed(0)} ms`);
  }
});

test('the HTML reader finds the facts the checks rely on', () => {
  const f = extractHtml(page({ head: goodHead, body: goodBody }), `${ORIGIN}/`);
  assert.equal(f.lang, 'en');
  assert.equal(f.titles[0], 'Acme Plumbing | Emergency plumbers in Leeds');
  assert.deepEqual(f.canonical, ['https://acme.example.com/']);
  assert.deepEqual(f.headings.map(h => [h.level, h.text]), [[1, 'Emergency plumbers in Leeds'], [2, 'Services']]);
  assert.ok(f.anchors.some(a => a.href === 'mailto:hello@acme.example.com' && a.text === 'Email us'));
  assert.equal(readJsonLd(f.jsonLd)[0].types[0], 'Plumber');
  assert.equal(readJsonLd(['{bad json'])[0].ok, false);
  assert.ok(f.words > 100);
});

/* ---------- robots.txt ---------- */
test('robots.txt parsing follows RFC 9309 grouping and precedence', () => {
  const robots = parseRobots('﻿User-agent: GPTBot\r\nUser-agent: CCBot\r\nDisallow: /\r\n\r\n# comment\nUser-agent: *\nDisallow: /private\nAllow: /private/open\nDisallow: /*.pdf$\nDisallow:\n\nuser-AGENT: googlebot\nDisallow: /nogoogle\nUser-agent: Googlebot\nAllow: /\n\nSitemap: https://acme.example.com/sitemap.xml\nnonsense line\nCrawl-delay: 5');
  assert.equal(robots.groups.length, 4);
  assert.deepEqual(robots.groups[0].agents.map(a => a.name), ['gptbot', 'ccbot'], 'consecutive user-agent lines share a group');
  assert.equal(robots.sitemaps[0].url, 'https://acme.example.com/sitemap.xml');
  assert.equal(robots.invalid, 1);
  assert.deepEqual(robots.invalidSamples, [{ line: 18, text: 'nonsense line' }]);

  const at = (token, path) => checkAccess(robots, token, path);
  assert.equal(at('GPTBot', '/').allowed, false);
  assert.equal(at('gptbot', '/').rule.line, 3, 'agent names match case-insensitively');
  assert.equal(at('CCBot', '/anything').allowed, false);
  assert.equal(at('ClaudeBot', '/').matchedBy, 'wildcard');
  assert.equal(at('ClaudeBot', '/').allowed, true);
  assert.equal(at('ClaudeBot', '/private/x').allowed, false);
  assert.equal(at('ClaudeBot', '/private/open/x').allowed, true, 'the longest match wins');
  assert.equal(at('ClaudeBot', '/doc.pdf').allowed, false);
  assert.equal(at('ClaudeBot', '/doc.pdf?x=1').allowed, true, '$ anchors the end');
  // Two groups for Googlebot are combined; "Allow: /" is shorter than "/nogoogle".
  assert.equal(at('Googlebot', '/nogoogle/page').allowed, false);
  assert.equal(at('Googlebot', '/private').allowed, true, 'a specific group replaces the * group');
  assert.equal(checkAccess(parseRobots(''), 'GPTBot', '/').matchedBy, 'none');
});

test('robots.txt edge cases: ties, empty rules, orphan rules and wildcards', () => {
  const tie = parseRobots('User-agent: *\nDisallow: /page\nAllow: /page');
  assert.equal(checkAccess(tie, 'X', '/page').allowed, true, 'allow wins a tie');
  const empty = parseRobots('User-agent: *\nDisallow:');
  assert.equal(checkAccess(empty, 'X', '/').allowed, true, 'an empty Disallow allows everything');
  const orphan = parseRobots('Disallow: /\nUser-agent: *\nAllow: /');
  assert.equal(orphan.orphanRules, 1);
  assert.equal(checkAccess(orphan, 'X', '/').allowed, true);
  assert.equal(patternMatches('/a*b*c', '/axxbyyc/zz'), true);
  assert.equal(patternMatches('/a*b$', '/axxbc'), false);
  assert.equal(patternMatches('*', '/anything'), true);
  assert.equal(patternMatches('/fish', '/Fish'), false, 'paths are case-sensitive');
  const encoded = parseRobots('User-agent: *\nDisallow: /café');
  assert.equal(checkAccess(encoded, 'X', '/caf%C3%A9/menu').allowed, false, 'percent-encoding is normalised');
  // A pattern built to backtrack does not stall.
  const started = Date.now();
  patternMatches(`/${'*a'.repeat(200)}b`, `/${'a'.repeat(2000)}`);
  assert.ok(Date.now() - started < 500);
});

test('sitemaps: urlset, index, HTML pages and off-host entries', () => {
  assert.deepEqual(parseSitemap('<?xml version="1.0"?><urlset><url><loc>https://acme.example.com/</loc></url><url><loc>/relative</loc></url><url><loc>https://other.example.org/</loc></url></urlset>', 'acme.example.com'),
    { kind: 'urlset', count: 3, invalid: 1, offHost: 1, closed: true, invalidSamples: ['/relative'] });
  assert.equal(parseSitemap('<sitemapindex><sitemap><loc>https://acme.example.com/a.xml</loc></sitemap></sitemapindex>', 'acme.example.com').kind, 'sitemapindex');
  assert.equal(parseSitemap('<!doctype html><html></html>', 'x').kind, 'html');
  assert.equal(parseSitemap('just text', 'x').kind, 'not-xml');
  assert.equal(parseSitemap('<urlset><url><loc>https://www.acme.example.com/</loc></url>', 'acme.example.com').offHost, 0, 'www is the same site');
});

/* ---------- Findings ---------- */
test('a healthy site gets no confirmed findings and no invented ones', async () => {
  const { report } = await audit(goodSite());
  assert.deepEqual(report.confirmed.map(f => f.title), []);
  assert.ok(report.passed.length >= 10);
  assert.equal('score' in report, false, 'no overall score');
  assert.ok(!JSON.stringify(report).match(/\b\d+\s*\/\s*100\b|readiness score/i));
});

test('every finding has a title, severity, evidence, reason and fix, and is either confirmed or advisory', async () => {
  const broken = {
    [`${ORIGIN}/`]: { type: 'text/html', headers: { 'x-robots-tag': 'noindex' }, body: '<html><head><meta name="robots" content="noindex,nofollow"><link rel="canonical" href="https://a.example.com/"><link rel="canonical" href="https://b.example.com/"><script type="application/ld+json">{oops</script></head><body><h1>Welcome</h1><h1>Again</h1><a href="/gone">Gone</a></body></html>' },
    [`http://acme.example.com/`]: { type: 'text/html', body: 'plain http' },
    [`${ORIGIN}/robots.txt`]: { type: 'text/plain', body: 'User-agent: *\nDisallow: /\nwhat is this' },
    [`${ORIGIN}/gone`]: { status: 404 }
  };
  const { report } = await audit(broken);
  for (const f of all(report)) {
    assert.ok(f.title && f.why && f.fix && f.category, f.title);
    assert.ok(SEVERITIES.includes(f.severity), f.title);
    assert.ok(['confirmed', 'advisory'].includes(f.type));
    assert.ok(f.evidence.length >= 1 && f.evidence.every(e => typeof e === 'string' && e.length), `${f.title} has evidence`);
  }
  assert.ok(report.confirmed.every(f => f.type === 'confirmed') && report.advisory.every(f => f.type === 'advisory'));
  const expect = [[/tells search engines not to index/, 'Critical'], [/noindex header/, 'Critical'], [/not to follow its links/, 'Medium'], [/Conflicting canonical/, 'Medium'], [/Structured data cannot be read/, 'Medium'],
    [/HTTP address does not redirect/, 'Medium'], [/blocks Googlebot/, 'Critical'], [/AI search crawlers/, 'High'], [/line crawlers will ignore/, 'Low'], [/broken internal link/, 'Medium'], [/No mobile viewport/, 'Medium']];
  for (const [re, severity] of expect) {
    const f = titled(report, re);
    assert.ok(f, `finding ${re}`);
    assert.equal(f.severity, severity, f.title);
    assert.equal(f.type, 'confirmed', f.title);
  }
  assert.equal(titled(report, /does not say what you do/).type, 'advisory');
  assert.match(titled(report, /blocks Googlebot/).evidence.join(' '), /Disallow: \/ \(line 2\)/);
  const order = report.confirmed.map(f => SEVERITIES.indexOf(f.severity));
  assert.deepEqual(order, [...order].sort((a, b) => a - b), 'confirmed findings are ordered by severity');
});

test('crawler rules distinguish search, AI search, user fetches and training', async () => {
  const robots = 'User-agent: GPTBot\nDisallow: /\n\nUser-agent: ClaudeBot\nDisallow: /\n\nUser-agent: Google-Extended\nDisallow: /\n\nUser-agent: *\nAllow: /';
  const { report } = await audit(goodSite(ORIGIN, { [`${ORIGIN}/robots.txt`]: { type: 'text/plain', body: robots } }));
  const row = t => report.crawlers.find(c => c.token === t);
  assert.equal(row('GPTBot').access, 'blocked');
  assert.equal(row('GPTBot').purpose, 'ai-training');
  assert.match(row('GPTBot').rule, /User-agent: GPTBot \(line 1\), Disallow: \/ \(line 2\)/);
  assert.equal(row('OAI-SearchBot').access, 'allowed');
  assert.equal(row('Googlebot').access, 'allowed');
  assert.equal(row('Google-Extended').purpose, 'control');
  assert.deepEqual(report.confirmed, [], 'opting out of training is a choice, not an error');
  assert.ok(report.passed.includes('AI search crawlers are allowed to crawl this page.'));
  assert.equal(report.crawlers.length, CRAWLERS.length);
  for (const c of CRAWLERS) assert.match(c.docs, /^https:\/\//);

  const search = await audit(goodSite(ORIGIN, { [`${ORIGIN}/robots.txt`]: { type: 'text/plain', body: 'User-agent: OAI-SearchBot\nUser-agent: PerplexityBot\nDisallow: /' } }));
  const f = titled(search.report, /AI search crawlers/);
  assert.equal(f.severity, 'High');
  assert.match(f.limits, /does not guarantee/);
});

test('robots.txt states: missing, server error, HTML and unreachable', async () => {
  const missing = await audit(goodSite(ORIGIN, { [`${ORIGIN}/robots.txt`]: { status: 404 } }));
  assert.equal(titled(missing.report, /No robots\.txt/).type, 'advisory');
  assert.ok(missing.report.crawlers.every(c => c.access === 'allowed'));

  const error = await audit(goodSite(ORIGIN, { [`${ORIGIN}/robots.txt`]: { status: 503 } }));
  assert.equal(titled(error.report, /server error/).severity, 'High');
  assert.ok(error.report.crawlers.every(c => c.access === 'blocked'));

  const html = await audit(goodSite(ORIGIN, { [`${ORIGIN}/robots.txt`]: { type: 'text/html', body: '<!doctype html><html></html>' } }));
  assert.ok(titled(html.report, /web page instead of rules/));

  const down = await audit(goodSite(ORIGIN, { [`${ORIGIN}/robots.txt`]: () => { throw new Error('connect ECONNREFUSED 10.1.1.1:443'); } }));
  assert.ok(down.report.notChecked.some(n => /robots\.txt/.test(n.title)));
  assert.ok(down.report.crawlers.every(c => c.access === 'unknown'));
  assert.ok(!JSON.stringify(down.report).includes('ECONNREFUSED'), 'upstream errors never reach the report');
});

test('the report never claims a crawler visited, indexed or cited the site', async () => {
  const { report } = await audit(goodSite());
  const claims = [...report.passed, ...report.crawlers.map(c => c.rule)].join(' ');
  assert.ok(!/\b(has (been )?(visited|indexed|cited)|is indexed|appears in|will (appear|rank))\b/i.test(claims), claims);
  assert.match(report.disclaimer, /not a guarantee/);
  assert.match(report.disclaimer, /does not mean it has visited/);
  assert.ok(report.notChecked.some(n => /crawled, indexed or cited/.test(n.title)));
});

test('content checks: thin pages, missing H1, contact routes and structured data need evidence', async () => {
  const thin = await audit(goodSite(ORIGIN, { [`${ORIGIN}/`]: { type: 'text/html', body: '<html lang="en"><head><title>App</title><meta name="viewport" content="width=device-width"></head><body><div id="root"></div><script src="/app.js"></script></body></html>' } }));
  const f = titled(thin.report, /Very little text/);
  assert.equal(f.type, 'advisory');
  assert.match(f.limits, /does not run JavaScript/);
  assert.ok(titled(thin.report, /No main heading/));
  assert.ok(titled(thin.report, /No contact route/));
  assert.ok(titled(thin.report, /No internal links/));

  const micro = await audit(goodSite(ORIGIN, { [`${ORIGIN}/`]: { type: 'text/html', body: page({ head: goodHead.replace(/<script[\s\S]*<\/script>/, ''), body: `<div itemscope itemtype="https://schema.org/Plumber">${goodBody}</div>` }) } }));
  assert.ok(!titled(micro.report, /structured data/i), 'microdata is not reported as missing structured data');
  assert.ok(micro.report.notChecked.some(n => /Microdata/.test(n.title)));
});

/* ---------- The HTTP handler ---------- */
const SELF = 'https://buildwisegroup.dev';
const post = (body, headers = {}) => new Request(`${SELF}/api/website-audit`, { method: 'POST', headers: { origin: SELF, 'content-type': 'application/json', 'cf-connecting-ip': '203.0.113.9', ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body) });
const deps = (routes, extra = {}) => ({ ...fakeNet(routes), limiter: createLimiter(), cache: null, ...extra });
const read = async res => ({ status: res.status, body: await res.json(), headers: res.headers });

test('handler: only same-origin JSON POSTs are accepted', async () => {
  const d = deps(goodSite());
  assert.equal((await handleAudit(new Request(`${SELF}/api/website-audit`), d)).status, 405);
  assert.equal((await handleAudit(post({ url: 'acme.example.com' }, { origin: '' }), d)).status, 403);
  assert.equal((await handleAudit(post({ url: 'acme.example.com' }, { origin: 'https://evil.example.net' }), d)).status, 403);
  assert.equal((await handleAudit(post({ url: 'acme.example.com' }, { 'sec-fetch-site': 'cross-site' }), d)).status, 403);
  assert.equal((await handleAudit(post({ url: 'acme.example.com' }, { 'content-type': 'text/plain' }), d)).status, 400);
  assert.equal((await handleAudit(post('{not json'), d)).status, 400);
  assert.equal((await handleAudit(post({ url: 'x'.repeat(POLICY.bodyBytes) }), d)).status, 400);
  assert.equal(d.requests.length, 0);
});

test('handler: success returns the report with no-store and noindex headers', async () => {
  const res = await read(await handleAudit(post({ url: 'acme.example.com' }), deps(goodSite())));
  assert.equal(res.status, 200);
  assert.equal(res.body.report.finalUrl, `${ORIGIN}/`);
  assert.equal(res.headers.get('cache-control'), 'no-store');
  assert.equal(res.headers.get('x-robots-tag'), 'noindex');
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
});

test('handler: errors are fixed messages that never expose internal details', async () => {
  const blocked = await read(await handleAudit(post({ url: 'http://169.254.169.254/latest/meta-data/' }), deps({})));
  assert.equal(blocked.status, 422);
  assert.equal(blocked.body.error.message, MESSAGES.blocked_destination);
  const privateDns = await read(await handleAudit(post({ url: 'acme.example.com' }), { ...deps(goodSite()), ...fakeNet(goodSite(), { dns: { 'acme.example.com': ['10.20.30.40'] } }) }));
  assert.equal(privateDns.status, 422);
  assert.ok(!JSON.stringify(privateDns.body).includes('10.20.30.40'));
  const crash = await read(await handleAudit(post({ url: 'acme.example.com' }), deps({ [`${ORIGIN}/`]: () => { throw new Error('secret token abc at 10.0.0.5'); } })));
  assert.equal(crash.status, 502);
  assert.ok(!JSON.stringify(crash.body).match(/secret|10\.0\.0\.5|stack/));
  const internal = await read(await handleAudit(post({ url: 'acme.example.com' }), { ...deps(goodSite()), resolve: () => { throw new TypeError('boom /srv/app.js:12'); } }));
  assert.ok(!JSON.stringify(internal.body).includes('/srv/app.js'));
  const invalid = await read(await handleAudit(post({ url: 'not a url' }), deps({})));
  assert.equal(invalid.status, 400);
  assert.equal(invalid.body.error.code, 'invalid_url');
});

test('handler: per-client rate limit and concurrency limit', async () => {
  const limiter = createLimiter();
  const d = deps(goodSite(), { limiter });
  for (let i = 0; i < POLICY.perClient; i += 1) assert.equal((await handleAudit(post({ url: 'acme.example.com' }), d)).status, 200);
  const limited = await handleAudit(post({ url: 'acme.example.com' }), d);
  assert.equal(limited.status, 429);
  assert.ok(Number(limited.headers.get('retry-after')) > 0);
  assert.equal((await handleAudit(post({ url: 'acme.example.com' }, { 'cf-connecting-ip': '198.51.100.7' }), d)).status, 200, 'other clients are unaffected');
  assert.equal((await handleAudit(post({ url: 'not a url' }), d)).status, 400, 'invalid input is rejected without counting');

  // Concurrency: hold three audits open, the fourth is turned away.
  let release;
  const gate = new Promise(r => { release = r; });
  const slow = { ...goodSite(), [`${ORIGIN}/`]: async () => { await gate; return new Response(page({ head: goodHead, body: goodBody }), { headers: { 'content-type': 'text/html' } }); } };
  const busy = deps(slow);
  const running = [1, 2, 3].map(i => handleAudit(post({ url: 'acme.example.com' }, { 'cf-connecting-ip': `192.0.2.${i}` }), busy));
  await new Promise(r => setTimeout(r, 20));
  const fourth = await handleAudit(post({ url: 'acme.example.com' }, { 'cf-connecting-ip': '192.0.2.99' }), busy);
  assert.equal(fourth.status, 503);
  release();
  assert.deepEqual((await Promise.all(running)).map(r => r.status), [200, 200, 200]);
  assert.equal(busy.limiter.running, 0, 'slots are released');
});

test('handler: a cached report is served without requesting the site again', async () => {
  const store = new Map();
  const cache = { match: async req => (store.has(req.url) ? store.get(req.url).clone() : undefined), put: async (req, res) => { store.set(req.url, res); } };
  const d = deps(goodSite(), { cache });
  assert.equal((await read(await handleAudit(post({ url: 'acme.example.com' }), d))).body.cached, false);
  const before = d.requests.length;
  const again = await read(await handleAudit(post({ url: 'https://acme.example.com/' }), d));
  assert.equal(again.body.cached, true);
  assert.equal(d.requests.length, before);
  assert.ok([...store.keys()].every(k => /\/cache\/[0-9a-f]{64}$/.test(k)), 'cache keys do not contain the address');
});

/* ---------- Production remediation (October 2026) ---------- */
test('the HTTP to HTTPS finding quotes the request it saw, and each outcome is reported', async () => {
  const origin = 'https://acme.example.com';
  // http:// answers 200 with no redirect: one confirmed Medium finding with the exact evidence.
  let { report } = await audit(goodSite(origin, { 'http://acme.example.com/': { type: 'text/html', body: 'plain http' } }));
  const f = titled(report, /HTTP address does not redirect/);
  assert.equal(f.severity, 'Medium');
  assert.ok(report.confirmed.includes(f));
  assert.deepEqual(f.evidence, ['GET http://acme.example.com/ returned 200 without redirecting to https://']);
  // A 301 to https:// passes.
  ({ report } = await audit(goodSite(origin)));
  assert.equal(titled(report, /HTTP address/), undefined);
  assert.ok(report.passed.some(p => /http:\/\/acme\.example\.com\/ redirects to HTTPS/.test(p)));
  // A redirect that stays on http:// is still flagged.
  ({ report } = await audit(goodSite(origin, { 'http://acme.example.com/': { status: 301, location: 'http://www.acme.example.com/' }, 'http://www.acme.example.com/': { type: 'text/html', body: 'x' } })));
  assert.ok(titled(report, /HTTP address does not redirect/));
  // No answer on http:// is not a finding, but it is listed as not checked rather than dropped.
  ({ report } = await audit(goodSite(origin, { 'http://acme.example.com/': () => { throw new TypeError('connection refused'); } })));
  assert.equal(titled(report, /HTTP address/), undefined);
  const nc = report.notChecked.find(n => /http:\/\/ redirects to https/.test(n.title));
  assert.match(nc.reason, /did not answer/);
  assert.ok(!report.passed.some(p => /redirects to HTTPS/.test(p)));
});

test('the opening-text excerpt leaves navigation menus out and is a raw excerpt', () => {
  const html = page({ body: '<a href="#main">Skip to content</a><header><nav aria-label="Main"><a href="/a">Solutions</a><nav><a href="/b">Nested</a></nav><a href="/c">Work</a></nav></header><main id="main"><h1>Kitchen fitting in Leeds</h1><p>We fit kitchens.</p></main>' });
  const h = extractHtml(html, 'https://acme.example.com/');
  assert.equal(h.textSample, 'Skip to content Kitchen fitting in Leeds We fit kitchens.');
  // Menu links are still collected for the link and contact checks.
  assert.deepEqual(h.anchors.map(a => a.text), ['Skip to content', 'Solutions', 'Nested', 'Work']);
  assert.ok(h.words >= 9, 'menu words still count towards the page’s text');
  // A page that is nothing but a menu still shows its text instead of "None found".
  assert.equal(extractHtml(page({ body: '<nav><a href="/">Home</a></nav>' }), 'https://acme.example.com/').textSample, 'Home');
  // An unclosed <nav> cannot hide the rest of the page from the excerpt.
  assert.match(extractHtml(page({ body: '<nav><a href="/">Home</a><p>Our story</p>' }), 'https://acme.example.com/').textSample, /Home/);
});
