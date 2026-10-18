/*
 * Website audit: runs the requests and gathers facts for checks.mjs.
 *
 * Requests made, in order: the page (following its redirects), then in
 * parallel robots.txt and the http:// version of the site, then the sitemap,
 * then up to five internal links. Everything is read-only GET. Anything that
 * fails or runs out of budget is recorded as "not checked", never guessed.
 */
import { AuditError, createContext, parseTarget, safeFetch } from './net.mjs';
import { extractHtml } from './html.mjs';
import { parseRobots } from './robots.mjs';
import { parseSitemap } from './sitemap.mjs';
import { buildReport } from './checks.mjs';

const HTML_TYPES = ['text/html', 'application/xhtml+xml'];

/* Fetch something optional: failures become a state, not an exception. */
async function optional(ctx, url, options) {
  try {
    return { state: 'fetched', res: await safeFetch(ctx, url, options) };
  } catch (error) {
    if (!(error instanceof AuditError)) return { state: 'unreachable' };
    const map = { budget: 'skipped', timeout: 'timeout', blocked_destination: 'blocked', blocked_redirect: 'blocked', too_many_redirects: 'redirects', bad_redirect: 'redirects' };
    return { state: map[error.code] || 'unreachable' };
  }
}

export async function runAudit(input, deps) {
  const target = parseTarget(input);
  const ctx = createContext(deps);
  const auditedAt = new Date(ctx.now()).toISOString();

  const page = await safeFetch(ctx, target, { accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.5', maxBytes: ctx.limits.htmlBytes, types: HTML_TYPES });
  if (!page.typeOk && page.status < 400) throw new AuditError('not_html');
  const final = new URL(page.url);
  const html = page.typeOk && page.text ? extractHtml(page.text, page.url) : null;

  // robots.txt, and whether the http:// version of the page redirects to its https:// version
  // (or, for an http site, whether https works). The same path and query are requested.
  const robotsUrl = `${final.origin}/robots.txt`;
  const other = `${final.protocol === 'https:' ? 'http' : 'https'}://${final.host}${final.pathname}${final.search}`;
  const [robotsFetch, otherFetch] = await Promise.all([
    optional(ctx, robotsUrl, { accept: 'text/plain,*/*;q=0.5', maxBytes: ctx.limits.robotsBytes, redirects: 3 }),
    optional(ctx, other, { accept: 'text/html', maxBytes: 0, redirects: 3 })
  ]);

  const robots = { url: robotsUrl, state: robotsFetch.state };
  if (robotsFetch.res) {
    const r = robotsFetch.res;
    robots.status = r.status;
    robots.finalUrl = r.url;
    robots.truncated = r.truncated;
    if (r.status >= 500) robots.state = 'server-error';
    else if (r.status >= 400) robots.state = 'missing';
    else if (r.status >= 300) robots.state = 'redirects';
    else if (/^\s*<(!doctype html|html)/i.test(r.text) || /text\/html/i.test(r.headers['content-type'] || '')) robots.state = 'html';
    else { robots.state = 'ok'; robots.parsed = parseRobots(r.text); }
  }

  const scheme = { url: other, finalProtocol: final.protocol, state: otherFetch.state };
  if (otherFetch.res) {
    scheme.status = otherFetch.res.status;
    scheme.finalUrl = otherFetch.res.url;
    scheme.chain = otherFetch.res.chain;
    scheme.state = 'fetched';
  }

  // Sitemap: the first one robots.txt lists, otherwise /sitemap.xml.
  const listed = robots.parsed ? robots.parsed.sitemaps : [];
  const sitemapUrl = listed.length ? listed[0].url : `${final.origin}/sitemap.xml`;
  const sitemap = { url: sitemapUrl, source: listed.length ? 'robots' : 'default', listedCount: listed.length };
  if (/\.gz($|\?)/i.test(sitemapUrl)) sitemap.state = 'compressed';
  else {
    const s = await optional(ctx, sitemapUrl, { accept: 'application/xml,text/xml;q=0.9,*/*;q=0.5', maxBytes: ctx.limits.sitemapBytes, redirects: 3 });
    sitemap.state = s.state;
    if (s.res) {
      sitemap.status = s.res.status;
      sitemap.truncated = s.res.truncated;
      if (s.res.status >= 400) sitemap.state = 'missing';
      else if (s.res.status >= 300) sitemap.state = 'redirects';
      else { sitemap.state = 'ok'; sitemap.parsed = parseSitemap(s.res.text, final.hostname); }
    }
  }

  // Up to five internal links, in page order.
  const links = { internal: 0, external: 0, checked: [] };
  if (html) {
    const seen = new Set([final.href]);
    const candidates = [];
    html.anchors.forEach(a => {
      const u = html.resolve(a.href);
      if (!u || !/^https?:$/.test(u.protocol)) return;
      u.hash = '';
      if (u.hostname !== final.hostname) { links.external += 1; return; }
      links.internal += 1;
      if (!seen.has(u.href)) { seen.add(u.href); candidates.push(u.href); }
    });
    links.unique = candidates.length;
    const pick = candidates.slice(0, ctx.limits.linkChecks);
    for (let i = 0; i < pick.length; i += 3) {
      const batch = await Promise.all(pick.slice(i, i + 3).map(async url => {
        const r = await optional(ctx, url, { accept: 'text/html,*/*;q=0.5', maxBytes: 0, redirects: 2 });
        return { url, state: r.state, status: r.res ? r.res.status : null, finalUrl: r.res ? r.res.url : null };
      }));
      links.checked.push(...batch);
    }
  }

  return buildReport({ input: String(input).trim().slice(0, 300), target: target.href, auditedAt, page, html, robots, scheme, sitemap, links, log: ctx.log.slice(0, 40), limits: ctx.limits, selfHost: deps.selfHost || '' });
}
