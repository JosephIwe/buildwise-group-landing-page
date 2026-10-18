/*
 * Website audit: safe outbound fetching.
 *
 * Every address the audit requests (the page, each redirect hop, robots.txt, the
 * sitemap, link checks) goes through validateUrl and checkHost first:
 *   - only http and https on the default ports, no credentials, no IP literals;
 *   - no localhost, single-label or internal-only names;
 *   - the hostname is resolved over DNS-over-HTTPS and refused if any A or AAAA
 *     record is private, loopback, link-local, carrier-grade NAT, multicast,
 *     reserved, a documentation range or a cloud metadata address.
 * Redirects are followed by hand, one hop at a time, so every hop is checked
 * again. Requests are GET only, carry no cookies or credentials, time out,
 * stop reading at a byte limit and count against a per-audit request budget.
 *
 * Cloudflare Workers cannot fetch IP addresses directly and resolve hostnames
 * with Cloudflare's resolver, the same one queried here. Workers cannot pin the
 * address a check returned, so a record that changes between the check and the
 * request (DNS rebinding) is the residual risk; it is bounded because the
 * Workers runtime has no private network or metadata service to reach.
 */

export const LIMITS = Object.freeze({
  inputLength: 2048,
  redirects: 5,
  timeoutMs: 6000,
  auditMs: 20000,
  targetRequests: 20,
  hostLookups: 4,
  htmlBytes: 1000000,
  robotsBytes: 200000,
  sitemapBytes: 1000000,
  linkChecks: 5
});

export const USER_AGENT = 'BuildWiseAudit/1.0 (+https://buildwisegroup.dev/website-audit)';

export class AuditError extends Error {
  constructor(code, detail) {
    super(code);
    this.code = code;
    // Safe, visitor-facing context only (never addresses, stack traces or upstream messages).
    this.detail = detail || null;
  }
}

/* ---------- IP ranges ---------- */
const v4 = (a, b, c, d) => (((a << 24) >>> 0) + (b << 16) + (c << 8) + d) >>> 0;
const BLOCKED_V4 = [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16],
  ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24], ['192.31.196.0', 24], ['192.52.193.0', 24],
  ['192.88.99.0', 24], ['192.168.0.0', 16], ['192.175.48.0', 24], ['198.18.0.0', 15], ['198.51.100.0', 24],
  ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4]
].map(([ip, bits]) => [parseIPv4(ip), bits]);

export function parseIPv4(text) {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(String(text));
  if (!m) return null;
  const parts = m.slice(1).map(Number);
  if (parts.some(p => p > 255) || m.slice(1).some(p => p.length > 1 && p[0] === '0')) return null;
  return v4(...parts);
}

export function isBlockedIPv4(text) {
  const n = typeof text === 'number' ? text : parseIPv4(text);
  if (n == null) return true;
  return BLOCKED_V4.some(([base, bits]) => ((n ^ base) >>> (32 - bits)) === 0);
}

/* Returns the address as eight 16-bit numbers, or null. Accepts :: and a dotted IPv4 tail. */
export function parseIPv6(text) {
  let s = String(text).toLowerCase();
  if (s.startsWith('[') && s.endsWith(']')) s = s.slice(1, -1);
  if (s.includes('%') || !/^[0-9a-f:.]+$/.test(s)) return null;
  let tail = [];
  if (s.includes('.')) {
    const lastColon = s.lastIndexOf(':');
    const n = parseIPv4(s.slice(lastColon + 1));
    if (n == null) return null;
    tail = [n >>> 16, n & 0xffff];
    s = s.slice(0, lastColon + 1);
    if (!s.endsWith('::')) s = s.slice(0, -1);
  }
  const halves = s.split('::');
  if (halves.length > 2) return null;
  const parse = part => (part === '' ? [] : part.split(':').map(h => (/^[0-9a-f]{1,4}$/.test(h) ? parseInt(h, 16) : NaN)));
  const head = parse(halves[0]);
  const rest = halves.length === 2 ? parse(halves[1]) : [];
  if ([...head, ...rest].some(Number.isNaN)) return null;
  const total = head.length + rest.length + tail.length;
  if (halves.length === 1 && total !== 8) return null;
  if (halves.length === 2 && total > 7) return null;
  return [...head, ...Array(8 - total).fill(0), ...rest, ...tail];
}

const startsWith6 = (w, prefix, bits) => {
  for (let i = 0; i < 8 && bits > 0; i += 1, bits -= 16) {
    const take = Math.min(16, bits);
    const mask = (0xffff << (16 - take)) & 0xffff;
    if ((w[i] & mask) !== (prefix[i] & mask)) return false;
  }
  return true;
};
const P6 = text => parseIPv6(text);
// Only global unicast (2000::/3) is allowed, minus the special-purpose blocks inside it.
const BLOCKED_GLOBAL_V6 = [
  [P6('2001::'), 23], // IETF protocol assignments, including Teredo (2001::/32)
  [P6('2001:db8::'), 32], // documentation
  [P6('2002::'), 16], // 6to4, which can embed any IPv4 address
  [P6('3fff::'), 20] // documentation
];

export function isBlockedIPv6(text) {
  const w = Array.isArray(text) ? text : parseIPv6(text);
  if (!w) return true;
  if (!startsWith6(w, P6('2000::'), 3)) return true; // loopback, unspecified, mapped, NAT64, ULA, link-local, multicast...
  return BLOCKED_GLOBAL_V6.some(([p, bits]) => startsWith6(w, p, bits));
}

export const isBlockedIp = ip => (String(ip).includes(':') ? isBlockedIPv6(ip) : isBlockedIPv4(ip));

/* ---------- Addresses ---------- */
const BLOCKED_SUFFIXES = /(^|\.)(localhost|local|localdomain|internal|intranet|lan|home|corp|private|home\.arpa|in-addr\.arpa|ip6\.arpa|test|invalid|example|onion)$/;
const LABEL = /^(?!-)[a-z0-9-]{1,63}(?<!-)$/;

/* Checks a URL's shape without network access. Returns a URL object or throws. */
export function validateUrl(value) {
  let url;
  try { url = value instanceof URL ? new URL(value.href) : new URL(value); } catch (e) { throw new AuditError('invalid_url'); }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new AuditError('invalid_url');
  if (url.username || url.password) throw new AuditError('invalid_url');
  if (url.port && url.port !== '80' && url.port !== '443') throw new AuditError('blocked_destination', 'port');
  const host = url.hostname.toLowerCase().replace(/\.$/, '');
  if (host.startsWith('[') || parseIPv4(host) != null || /^[0-9.]+$/.test(host) || /^0x/i.test(host)) throw new AuditError('blocked_destination', 'ip');
  const labels = host.split('.');
  const tld = labels[labels.length - 1];
  if (host.length > 253 || labels.length < 2 || !labels.every(l => LABEL.test(l)) || !(/^[a-z]{2,63}$/.test(tld) || /^xn--[a-z0-9-]{2,59}$/.test(tld))) {
    throw new AuditError('invalid_url');
  }
  if (BLOCKED_SUFFIXES.test(host)) throw new AuditError('blocked_destination', 'name');
  url.hostname = host;
  url.hash = '';
  return url;
}

/* Turns what a visitor typed into a URL to audit. */
export function parseTarget(input) {
  const text = String(input == null ? '' : input).trim();
  if (!text || text.length > LIMITS.inputLength || /[\s\u0000-\u001f\u007f]/.test(text)) throw new AuditError('invalid_url');
  const hasScheme = /^[a-z][a-z0-9+.-]*:/i.test(text) && !/^[^:/]+:\d+(\/|$)/.test(text);
  if (hasScheme && !/^https?:\/\//i.test(text)) throw new AuditError('invalid_url');
  return validateUrl(hasScheme ? text : `https://${text}`);
}

/* ---------- DNS ---------- */
/* Resolves A and AAAA records with Cloudflare's DNS-over-HTTPS JSON API. */
export function dohResolver(fetchImpl, endpoint = 'https://cloudflare-dns.com/dns-query') {
  return async (host, signal) => {
    const query = async type => {
      const res = await fetchImpl(`${endpoint}?name=${encodeURIComponent(host)}&type=${type}`, { headers: { accept: 'application/dns-json' }, signal });
      if (!res.ok) throw new AuditError('dns_failed');
      const data = await res.json();
      if (data.Status === 3) return { nx: true, ips: [] };
      if (data.Status !== 0) throw new AuditError('dns_failed');
      const want = type === 'A' ? 1 : 28;
      return { nx: false, ips: (data.Answer || []).filter(a => a.type === want).map(a => String(a.data)) };
    };
    const [a, aaaa] = await Promise.all([query('A'), query('AAAA')]);
    return [...a.ips, ...aaaa.ips];
  };
}

/* ---------- Fetching ---------- */
export function createContext({ fetch: fetchImpl, resolve, now = () => Date.now(), limits = LIMITS }) {
  const start = now();
  const hosts = new Map();
  const log = [];
  let requests = 0;
  return {
    limits,
    log,
    deadline: start + limits.auditMs,
    remaining: () => start + limits.auditMs - now(),
    requestsLeft: () => limits.targetRequests - requests,
    async checkHost(host) {
      if (!hosts.has(host)) {
        if (hosts.size >= limits.hostLookups) throw new AuditError('budget');
        hosts.set(host, (async () => {
          let ips;
          try { ips = await withTimeout(signal => resolve(host, signal), Math.min(limits.timeoutMs, this.remaining())); } catch (e) {
            throw e instanceof AuditError && e.code !== 'timeout' ? e : new AuditError('dns_failed');
          }
          if (!ips || !ips.length) throw new AuditError('dns_failed');
          if (ips.some(isBlockedIp)) throw new AuditError('blocked_destination', 'address');
          return true;
        })());
      }
      return hosts.get(host);
    },
    async request(url, init) {
      if (requests >= limits.targetRequests) throw new AuditError('budget');
      requests += 1;
      return fetchImpl(url, init);
    },
    now
  };
}

export async function withTimeout(task, ms) {
  if (ms <= 0) throw new AuditError('timeout');
  const controller = new AbortController();
  let timer;
  const timeout = new Promise((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new AuditError('timeout')); }, ms); });
  try {
    return await Promise.race([task(controller.signal), timeout]);
  } finally {
    clearTimeout(timer);
  }
}

const REDIRECTS = new Set([301, 302, 303, 307, 308]);

async function readCapped(res, maxBytes, charset, signal) {
  if (!res.body || maxBytes <= 0) {
    if (res.body) await res.body.cancel().catch(() => {});
    return { text: '', bytes: 0, truncated: false };
  }
  const reader = res.body.getReader();
  // On timeout, cancel through the reader: the stream is locked to it.
  if (signal) signal.addEventListener('abort', () => { reader.cancel().catch(() => {}); }, { once: true });
  const chunks = [];
  let bytes = 0;
  let truncated = false;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    const room = maxBytes - bytes;
    if (value.byteLength > room) {
      chunks.push(value.subarray(0, room));
      bytes += room;
      truncated = true;
      await reader.cancel().catch(() => {});
      break;
    }
    chunks.push(value);
    bytes += value.byteLength;
  }
  const all = new Uint8Array(bytes);
  let offset = 0;
  chunks.forEach(c => { all.set(c, offset); offset += c.byteLength; });
  let decoder;
  try { decoder = new TextDecoder(charset || 'utf-8'); } catch (e) { decoder = new TextDecoder('utf-8'); }
  return { text: decoder.decode(all), bytes, truncated };
}

/*
 * GET a URL safely. Follows up to limits.redirects hops, validating each one.
 * options: accept (header), maxBytes, types (allowed content-type prefixes; others are not read), redirects
 * Returns { url, status, chain, headers, text, bytes, truncated, typeOk, ms }.
 */
export async function safeFetch(ctx, startUrl, { accept = '*/*', maxBytes = 0, types = null, redirects = ctx.limits.redirects } = {}) {
  let url = validateUrl(startUrl);
  const chain = [];
  const begun = ctx.now();
  for (let hop = 0; ; hop += 1) {
    try {
      await ctx.checkHost(url.hostname);
    } catch (error) {
      if (hop > 0 && error.code === 'blocked_destination') throw new AuditError('blocked_redirect', { chain });
      throw error;
    }
    // One timer covers the request and reading the body, and aborts both.
    const ms = Math.min(ctx.limits.timeoutMs, ctx.remaining());
    if (ms <= 0) throw new AuditError('timeout');
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; controller.abort(); }, ms);
    const fail = error => {
      if (error instanceof AuditError) return error;
      return new AuditError(timedOut ? 'timeout' : 'unreachable');
    };
    let res;
    let body;
    let typeOk = true;
    try {
      const abort = new Promise((_, reject) => controller.signal.addEventListener('abort', () => reject(new AuditError('timeout')), { once: true }));
      res = await Promise.race([ctx.request(url.href, {
        method: 'GET',
        redirect: 'manual',
        headers: { 'user-agent': USER_AGENT, accept, 'accept-language': 'en' },
        signal: controller.signal
      }), abort]);
      const location = res.headers.get('location');
      if (REDIRECTS.has(res.status) && location) {
        if (res.body) res.body.cancel().catch(() => {});
        let next;
        try { next = new URL(location, url); } catch (e) { throw new AuditError('bad_redirect', { chain }); }
        chain.push({ url: url.href, status: res.status, location: next.href.slice(0, 2048) });
        ctx.log.push({ url: url.href, status: res.status });
        if (hop + 1 > redirects) throw new AuditError('too_many_redirects', { chain });
        try { url = validateUrl(next); } catch (e) { throw new AuditError(e.code === 'blocked_destination' ? 'blocked_redirect' : 'bad_redirect', { chain }); }
        continue;
      }
      const type = (res.headers.get('content-type') || '').toLowerCase();
      typeOk = !types || types.some(t => type.startsWith(t));
      const charset = (/charset=["']?([\w-]+)/.exec(type) || [])[1];
      body = await Promise.race([readCapped(res, typeOk ? maxBytes : 0, charset, controller.signal), abort]);
    } catch (error) {
      if (res && res.body) res.body.cancel().catch(() => {});
      throw fail(error);
    } finally {
      clearTimeout(timer);
    }
    ctx.log.push({ url: url.href, status: res.status });
    const headers = {};
    ['content-type', 'x-robots-tag', 'content-length', 'last-modified'].forEach(h => { const v = res.headers.get(h); if (v != null) headers[h] = v.slice(0, 500); });
    return { url: url.href, status: res.status, chain, headers, text: body.text, bytes: body.bytes, truncated: body.truncated, typeOk, ms: ctx.now() - begun };
  }
}
