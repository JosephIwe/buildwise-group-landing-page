/*
 * Website audit: the HTTP handler behind POST /api/website-audit.
 *
 * Accepts a small same-origin JSON body ({ "url": "..." }), applies request
 * and concurrency limits, serves a recent result from cache when it has one,
 * runs the audit and returns the report as JSON. Errors are a fixed code and
 * message: no upstream error text, addresses or stack traces are returned.
 *
 * Limits here are per Cloudflare isolate (in memory), because Pages Functions
 * do not offer the Workers rate-limiting binding. They stop a single client
 * from hammering one location; a zone-wide rate-limiting rule in the
 * Cloudflare dashboard is the global backstop (see README).
 */
import { AuditError, dohResolver, parseTarget } from './net.mjs';
import { runAudit } from './run.mjs';

export const MESSAGES = {
  invalid_url: 'Enter a full website address, like example.com.',
  blocked_destination: 'That address can’t be audited because it doesn’t point to a public website.',
  blocked_redirect: 'The website redirected to an address that can’t be audited.',
  dns_failed: 'We couldn’t find that website. Check the address and try again.',
  unreachable: 'We couldn’t connect to that website. It may be down or refusing automated requests.',
  timeout: 'The website took too long to respond. Please try again later.',
  too_many_redirects: 'The website redirected too many times, so we stopped.',
  bad_redirect: 'The website sent a redirect we couldn’t follow.',
  not_html: 'That address doesn’t return a web page we can read. Try the site’s homepage.',
  budget: 'The audit reached its request limit before it could finish.',
  bad_request: 'The request was not understood.',
  forbidden: 'Audits can only be started from the BuildWise website.',
  method_not_allowed: 'Use the form on the Website & AI Visibility Audit page.',
  rate_limited: 'You’ve run several audits in a short time. Please wait a few minutes and try again.',
  busy: 'The audit service is busy. Please try again in a minute.',
  internal: 'Something went wrong on our side. Please try again.'
};
const STATUS = { invalid_url: 400, bad_request: 400, blocked_destination: 422, blocked_redirect: 422, not_html: 422, dns_failed: 422, unreachable: 502, timeout: 504, too_many_redirects: 502, bad_redirect: 502, budget: 502, forbidden: 403, method_not_allowed: 405, rate_limited: 429, busy: 503, internal: 500 };

export const POLICY = Object.freeze({
  perClient: 5, // audits per client IP per window, per isolate
  windowMs: 10 * 60 * 1000,
  perIsolate: 40, // audits per window across all clients, per isolate
  concurrent: 3, // audits running at once, per isolate
  bodyBytes: 4096,
  cacheSeconds: 600
});

const HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
  'x-robots-tag': 'noindex',
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer'
};

export const json = (body, status = 200, extra = {}) => new Response(JSON.stringify(body), { status, headers: { ...HEADERS, ...extra } });
export const errorResponse = (code, extra) => json({ error: { code, message: MESSAGES[code] || MESSAGES.internal } }, STATUS[code] || 500, extra);

/* Sliding-window counters kept in isolate memory. */
export function createLimiter(policy = POLICY, now = () => Date.now()) {
  const clients = new Map();
  let all = [];
  let running = 0;
  const prune = list => list.filter(t => now() - t < policy.windowMs);
  return {
    acquire(client) {
      all = prune(all);
      const mine = prune(clients.get(client) || []);
      if (mine.length >= policy.perClient) return { ok: false, code: 'rate_limited', retryAfter: Math.ceil((policy.windowMs - (now() - mine[0])) / 1000) };
      if (all.length >= policy.perIsolate || running >= policy.concurrent) return { ok: false, code: 'busy', retryAfter: 60 };
      mine.push(now());
      all.push(now());
      clients.set(client, mine);
      if (clients.size > 5000) clients.delete(clients.keys().next().value);
      running += 1;
      let released = false;
      return { ok: true, release: () => { if (!released) { released = true; running -= 1; } } };
    },
    get running() { return running; }
  };
}

async function readBody(request, limit) {
  const declared = Number(request.headers.get('content-length') || 0);
  if (declared > limit) return null;
  const text = await request.text();
  return text.length > limit ? null : text;
}

async function cacheKey(origin, url) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(url));
  const hex = [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
  return new Request(`${origin}/api/website-audit/cache/${hex}`);
}

/*
 * deps: { fetch, resolve?, cache?, limiter, now?, waitUntil? }
 * cache is a Cache API object (caches.default in production) or null.
 */
export async function handleAudit(request, deps) {
  if (request.method !== 'POST') return errorResponse('method_not_allowed', { allow: 'POST' });
  const self = new URL(request.url);
  const origin = request.headers.get('origin');
  const site = request.headers.get('sec-fetch-site');
  if (origin !== self.origin || (site && site !== 'same-origin')) return errorResponse('forbidden');
  if (!/^application\/json\b/i.test(request.headers.get('content-type') || '')) return errorResponse('bad_request');

  let input;
  try {
    const text = await readBody(request, POLICY.bodyBytes);
    if (text == null) return errorResponse('bad_request');
    const body = JSON.parse(text);
    input = body && typeof body.url === 'string' ? body.url : null;
  } catch (e) {
    return errorResponse('bad_request');
  }
  if (!input) return errorResponse('invalid_url');

  // Validate before counting against the limits, so a typo does not use up a visitor's audits.
  let target;
  try { target = parseTarget(input); } catch (error) { return errorResponse(error.code); }

  const client = request.headers.get('cf-connecting-ip') || 'unknown';
  const slot = deps.limiter.acquire(client);
  if (!slot.ok) return errorResponse(slot.code, { 'retry-after': String(slot.retryAfter) });

  try {
    const key = deps.cache ? await cacheKey(self.origin, target.href) : null;
    if (key) {
      const hit = await deps.cache.match(key).catch(() => null);
      if (hit) {
        const report = await hit.json();
        return json({ report, cached: true });
      }
    }
    const report = await runAudit(input, { fetch: deps.fetch, resolve: deps.resolve || dohResolver(deps.fetch), now: deps.now });
    if (key) {
      const stored = new Response(JSON.stringify(report), { headers: { 'content-type': 'application/json', 'cache-control': `public, max-age=${POLICY.cacheSeconds}` } });
      const put = deps.cache.put(key, stored).catch(() => {});
      if (deps.waitUntil) deps.waitUntil(put); else await put;
    }
    return json({ report, cached: false });
  } catch (error) {
    if (error instanceof AuditError) return errorResponse(MESSAGES[error.code] ? error.code : 'internal');
    return errorResponse('internal');
  } finally {
    slot.release();
  }
}
