/*
 * Website audit: a basic sitemap check. It recognises a urlset or a sitemap
 * index, counts <loc> entries and checks that they are absolute http(s) URLs
 * on the site's own host. It does not validate against the XML schema or
 * fetch child sitemaps.
 */
export function parseSitemap(text, siteHost) {
  const src = String(text).replace(/^﻿/, '').trimStart();
  const head = src.slice(0, 2000).toLowerCase();
  if (head.startsWith('<!doctype html') || head.startsWith('<html')) return { kind: 'html', count: 0 };
  const root = /<(urlset|sitemapindex)\b/i.exec(src.slice(0, 5000));
  if (!root) return { kind: /^</.test(src) ? 'unknown-xml' : 'not-xml', count: 0 };
  const kind = root[1].toLowerCase();
  const closed = new RegExp(`</${kind}\\s*>`, 'i').test(src.slice(-2000));
  let count = 0;
  let invalid = 0;
  let offHost = 0;
  const samples = [];
  let i = 0;
  for (;;) {
    const start = src.indexOf('<loc>', i);
    if (start === -1) break;
    const end = src.indexOf('</loc>', start);
    if (end === -1) break;
    const value = src.slice(start + 5, Math.min(end, start + 5 + 2100)).trim().replace(/&amp;/g, '&');
    count += 1;
    let url = null;
    try { url = new URL(value); } catch (e) { url = null; }
    if (!url || !/^https?:$/.test(url.protocol)) { invalid += 1; if (samples.length < 3) samples.push(value.slice(0, 200)); }
    else if (siteHost && url.hostname.replace(/^www\./, '') !== siteHost.replace(/^www\./, '')) offHost += 1;
    i = end + 6;
  }
  return { kind, count, invalid, offHost, closed, invalidSamples: samples };
}
