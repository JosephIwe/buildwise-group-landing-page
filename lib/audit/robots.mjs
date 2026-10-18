/*
 * Website audit: robots.txt parsing and matching, following RFC 9309.
 *
 * - Lines are "key: value"; "#" starts a comment. Consecutive user-agent lines
 *   share one group. Rules before the first user-agent line belong to no group.
 * - A crawler obeys every group naming its product token (case-insensitive,
 *   combined), otherwise the "*" group, otherwise nothing is disallowed.
 * - The longest matching rule wins; when an allow and a disallow rule are the
 *   same length, allow wins. "*" matches any characters and a trailing "$"
 *   anchors the end. An empty Disallow matches nothing.
 * Matching uses a linear wildcard matcher, not regular expressions, so a
 * hostile pattern cannot make it slow.
 */

export function parseRobots(text) {
  const groups = [];
  const sitemaps = [];
  let current = null;
  let lastWasAgent = false;
  let invalid = 0;
  let orphanRules = 0;
  const invalidSamples = [];
  const bad = (number, rawLine) => { invalid += 1; if (invalidSamples.length < 3) invalidSamples.push({ line: number, text: rawLine.trim().slice(0, 120) }); };
  const lines = String(text).replace(/^﻿/, '').split(/\r\n|\r|\n/);
  lines.slice(0, 20000).forEach((rawLine, index) => {
    const line = rawLine.replace(/#.*$/, '').trim();
    if (!line) return;
    const colon = line.indexOf(':');
    const number = index + 1;
    if (colon < 1) { bad(number, rawLine); return; }
    const key = line.slice(0, colon).trim().toLowerCase();
    const value = line.slice(colon + 1).trim().slice(0, 2048);
    if (key === 'user-agent') {
      if (!lastWasAgent || !current) {
        current = { agents: [], rules: [], line: number };
        groups.push(current);
      }
      current.agents.push({ name: value.toLowerCase(), raw: value.slice(0, 200), line: number });
      lastWasAgent = true;
      return;
    }
    lastWasAgent = false;
    if (key === 'allow' || key === 'disallow') {
      if (!current) { orphanRules += 1; return; }
      current.rules.push({ type: key, path: value, line: number });
    } else if (key === 'sitemap') {
      if (value) sitemaps.push({ url: value, line: number });
    } else if (!['crawl-delay', 'host', 'clean-param', 'request-rate', 'visit-time', 'noindex', 'content-signal'].includes(key)) {
      bad(number, rawLine);
    }
  });
  return { groups, sitemaps, invalid, invalidSamples, orphanRules };
}

/* Does the robots.txt path pattern match the path? Linear-time wildcard matching. */
export function patternMatches(pattern, path) {
  let p = pattern;
  let anchored = false;
  if (p.endsWith('$')) { anchored = true; p = p.slice(0, -1); }
  let pi = 0;
  let si = 0;
  let star = -1;
  let mark = 0;
  while (si < path.length) {
    if (pi < p.length && p[pi] === '*') { star = pi; mark = si; pi += 1; continue; }
    if (pi < p.length && p[pi] === path[si]) { pi += 1; si += 1; continue; }
    if (pi === p.length && !anchored) return true; // prefix match: the rest of the path is free
    if (star !== -1) { pi = star + 1; mark += 1; si = mark; continue; }
    return false;
  }
  while (pi < p.length && p[pi] === '*') pi += 1;
  return pi === p.length;
}

/* Normalises percent-encoding so /caf%C3%A9 and /café compare equal. */
function normalisePath(path) {
  try { return encodeURI(decodeURI(path)); } catch (e) { return path; }
}

/* Which rules apply to a crawler token, and is the path allowed? */
export function checkAccess(robots, token, path) {
  const name = token.toLowerCase();
  let groups = robots.groups.filter(g => g.agents.some(a => a.name === name));
  let matchedBy = 'specific';
  if (!groups.length) {
    groups = robots.groups.filter(g => g.agents.some(a => a.name === '*'));
    matchedBy = groups.length ? 'wildcard' : 'none';
  }
  const target = normalisePath(path || '/');
  let best = null;
  groups.forEach(g => g.rules.forEach(rule => {
    if (!rule.path) return; // an empty rule matches nothing
    const pattern = normalisePath(rule.path);
    if (!patternMatches(pattern, target)) return;
    if (!best || pattern.length > best.length || (pattern.length === best.length && rule.type === 'allow' && best.rule.type !== 'allow')) {
      best = { rule, length: pattern.length };
    }
  }));
  const agentLine = groups.length ? groups[0].agents.find(a => a.name === (matchedBy === 'specific' ? name : '*')) : null;
  return {
    allowed: !best || best.rule.type === 'allow',
    matchedBy,
    group: agentLine ? { agent: agentLine.raw, line: agentLine.line } : null,
    rule: best ? { type: best.rule.type, path: best.rule.path, line: best.rule.line } : null
  };
}

/* A short description of the directive that decided access, for the report. */
export function describeAccess(access) {
  if (access.matchedBy === 'none') return 'No group applies, so nothing is disallowed';
  const group = `User-agent: ${access.group.agent} (line ${access.group.line})`;
  if (!access.rule) return `${group}, no matching rule, so allowed`;
  const directive = `${access.rule.type === 'allow' ? 'Allow' : 'Disallow'}: ${access.rule.path}`;
  return `${group}, ${directive} (line ${access.rule.line})`;
}
