#!/usr/bin/env node
/*
 * Live checks for the production site, run by hand after a deploy or a
 * Cloudflare settings change:
 *
 *   node scripts/check-production.mjs                 # https://buildwisegroup.dev
 *   node scripts/check-production.mjs --base https://example.pages.dev
 *   node scripts/check-production.mjs --audit         # also run one real audit
 *
 * Every http:// address must answer 301 with the same host, path and query on
 * https://. The https:// pages must answer 200, and the audit API must answer
 * 405 to GET (it only accepts POST). Redirects are not followed, so the status
 * printed is the one the server sent. Exits 1 if any check fails.
 */

export const PATHS = ['/', '/scan', '/website-audit', '/scan?utm_source=check&ref=a%20b'];

export function plan(base) {
  const site = new URL(base);
  const https = `https://${site.host}`;
  const http = `http://${site.host}`;
  return [
    ...PATHS.map(p => ({ name: `HTTP ${p} redirects`, url: `${http}${p}`, status: 301, location: `${https}${p}` })),
    ...PATHS.slice(0, 3).map(p => ({ name: `HTTPS ${p} loads`, url: `${https}${p}`, status: 200 })),
    { name: 'Audit API refuses GET', url: `${https}/api/website-audit`, status: 405 }
  ];
}

export async function runCheck(fetchImpl, check) {
  let res;
  try {
    res = await fetchImpl(check.url, { method: check.method || 'GET', redirect: 'manual', headers: check.headers, body: check.body });
  } catch (error) {
    return { ...check, ok: false, got: `request failed (${error.message})` };
  }
  const location = res.headers.get('location') || '';
  let ok = res.status === check.status;
  if (ok && check.location) ok = location === check.location;
  if (ok && check.expectJson) {
    const data = await res.json().catch(() => null);
    ok = Boolean(data && check.expectJson(data));
  }
  return { ...check, ok, got: location ? `${res.status} -> ${location}` : String(res.status) };
}

export function auditCheck(base) {
  const site = new URL(base);
  return {
    name: 'One real audit of the site itself',
    url: `https://${site.host}/api/website-audit`,
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: `https://${site.host}` },
    body: JSON.stringify({ url: `https://${site.host}/` }),
    status: 200,
    expectJson: data => Boolean(data.report && Array.isArray(data.report.confirmed))
  };
}

export async function runAll(fetchImpl, base, { audit = false } = {}) {
  const checks = plan(base);
  if (audit) checks.push(auditCheck(base));
  const results = [];
  for (const check of checks) results.push(await runCheck(fetchImpl, check));
  return results;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const at = args.indexOf('--base');
  const base = at >= 0 ? args[at + 1] : 'https://buildwisegroup.dev';
  const results = await runAll(fetch, base, { audit: args.includes('--audit') });
  console.log(`Checked ${new Date().toISOString()}`);
  for (const r of results) {
    const want = r.location ? `${r.status} -> ${r.location}` : String(r.status);
    console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.method || 'GET'} ${r.url}\n      expected ${want}, got ${r.got}`);
  }
  process.exitCode = results.every(r => r.ok) ? 0 : 1;
}
