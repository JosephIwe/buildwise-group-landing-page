/* Tests for scripts/check-production.mjs, against a fake server. No real network. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { PATHS, plan, runAll } from '../scripts/check-production.mjs';

const BASE = 'https://buildwisegroup.dev';

/* A fake site: http:// answers with `httpBehaviour`, https:// serves the pages. */
function fakeSite(httpBehaviour) {
  const seen = [];
  const fetch = async (url, init) => {
    seen.push({ url, init });
    const u = new URL(url);
    if (u.protocol === 'http:') return httpBehaviour(u);
    if (u.pathname === '/api/website-audit') {
      if (init.method !== 'POST') return new Response('{}', { status: 405 });
      return Response.json({ report: { confirmed: [] } });
    }
    return new Response('<!doctype html>', { status: 200 });
  };
  return { fetch, seen };
}
const correct = u => new Response(null, { status: 301, headers: { location: `https://${u.host}${u.pathname}${u.search}` } });

test('the plan covers the required addresses, including one with a query string', () => {
  const urls = plan(BASE).map(c => c.url);
  for (const u of ['http://buildwisegroup.dev/', 'http://buildwisegroup.dev/scan', 'http://buildwisegroup.dev/website-audit', 'https://buildwisegroup.dev/', 'http://www.buildwisegroup.dev/', 'https://www.buildwisegroup.dev/']) assert.ok(urls.includes(u), u);
  assert.ok(PATHS.some(p => p.includes('?')));
  assert.equal(plan(BASE).find(c => c.url.includes('?') && c.url.startsWith('http:')).location, 'https://buildwisegroup.dev/scan?utm_source=check&ref=a%20b');
});

test('a correct 301 to the same host, path and query passes every check, without following redirects', async () => {
  const site = fakeSite(correct);
  const results = await runAll(site.fetch, BASE);
  assert.ok(results.every(r => r.ok), JSON.stringify(results.filter(r => !r.ok)));
  assert.ok(site.seen.every(s => s.init.redirect === 'manual'));
  assert.ok(!site.seen.some(s => s.init.method === 'POST'), 'no audit is run unless asked');
});

test('today’s behaviour (HTTP answers 200) fails the redirect checks', async () => {
  const results = await runAll(fakeSite(() => new Response('<!doctype html>', { status: 200 })).fetch, BASE);
  const http = results.filter(r => r.url.startsWith('http:'));
  assert.equal(http.length, 5);
  assert.ok(http.every(r => !r.ok && r.got === '200'));
  assert.ok(results.filter(r => r.url.startsWith('https:')).every(r => r.ok));
});

test('temporary redirects, dropped queries, changed paths and other hosts fail', async () => {
  const cases = [
    u => new Response(null, { status: 302, headers: { location: `https://${u.host}${u.pathname}${u.search}` } }),
    u => new Response(null, { status: 308, headers: { location: `https://${u.host}${u.pathname}${u.search}` } }),
    u => new Response(null, { status: 301, headers: { location: `https://${u.host}${u.pathname}` } }),
    u => new Response(null, { status: 301, headers: { location: `https://${u.host}/` } }),
    u => new Response(null, { status: 301, headers: { location: `https://buildwise-group.pages.dev${u.pathname}${u.search}` } }),
    u => new Response(null, { status: 301, headers: { location: `http://${u.host}${u.pathname}${u.search}` } })
  ];
  for (const behaviour of cases) {
    const results = await runAll(fakeSite(behaviour).fetch, BASE);
    assert.ok(results.some(r => r.url.startsWith('http:') && !r.ok), behaviour.toString());
  }
});

test('a network error is a failed check, not a crash', async () => {
  const results = await runAll(async () => { throw new TypeError('fetch failed'); }, BASE);
  assert.ok(results.every(r => !r.ok && /request failed/.test(r.got)));
});

test('--audit runs exactly one same-origin audit POST and needs a report back', async () => {
  const site = fakeSite(correct);
  const results = await runAll(site.fetch, BASE, { audit: true });
  const posts = site.seen.filter(s => s.init.method === 'POST');
  assert.equal(posts.length, 1);
  assert.equal(posts[0].init.headers.origin, 'https://buildwisegroup.dev');
  assert.deepEqual(JSON.parse(posts[0].init.body), { url: 'https://buildwisegroup.dev/' });
  assert.ok(results.at(-1).ok);
  const failing = fakeSite(correct);
  const orig = failing.fetch;
  const broken = async (url, init) => (init.method === 'POST' ? Response.json({ error: { code: 'internal' } }, { status: 200 }) : orig(url, init));
  assert.equal((await runAll(broken, BASE, { audit: true })).at(-1).ok, false);
});

test('www may be served as is or sent to the bare domain, but http://www must still go to https://', async () => {
  const toApex = u => new Response(null, { status: 301, headers: { location: `https://buildwisegroup.dev${u.pathname}${u.search}` } });
  const site = fakeSite(correct);
  const orig = site.fetch;
  const apex = async (url, init) => {
    const u = new URL(url);
    if (u.hostname === 'www.buildwisegroup.dev' && u.protocol === 'https:') return toApex(u);
    return orig(url, init);
  };
  assert.ok((await runAll(apex, BASE)).every(r => r.ok));
  const wwwHttp = async (url, init) => (new URL(url).hostname === 'www.buildwisegroup.dev' && url.startsWith('http:') ? new Response('x', { status: 200 }) : orig(url, init));
  const results = await runAll(wwwHttp, BASE);
  assert.equal(results.find(r => r.url === 'http://www.buildwisegroup.dev/').ok, false);
});
