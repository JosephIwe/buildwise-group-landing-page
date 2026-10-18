/*
 * Website audit: reads facts out of an HTML document.
 *
 * A single linear pass over the markup (no regular expressions that can
 * backtrack across the document, no DOM, no script execution), so a hostile
 * page cannot make it slow. Only what the audit reports on is collected, and
 * every collected string is length-capped.
 */

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', hellip: '…', copy: '©', reg: '®', trade: '™' };
export function decodeEntities(text) {
  return text.replace(/&(#x[0-9a-f]{1,6}|#\d{1,7}|[a-z]{2,8});/gi, (m, e) => {
    if (e[0] === '#') {
      const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return code > 0 && code < 0x110000 && !(code >= 0xd800 && code <= 0xdfff) ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[e.toLowerCase()] || m;
  });
}

const squash = (text, max) => decodeEntities(text).replace(/\s+/g, ' ').trim().slice(0, max);

function parseAttrs(source) {
  const attrs = {};
  const re = /([^\s"'<>\/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let m;
  let n = 0;
  while ((m = re.exec(source)) && n < 60) {
    const name = m[1].toLowerCase();
    if (!(name in attrs)) attrs[name] = decodeEntities(m[2] ?? m[3] ?? m[4] ?? '').slice(0, 2048);
    n += 1;
  }
  return attrs;
}

const RAW_TEXT = new Set(['script', 'style', 'textarea', 'title', 'noscript', 'template', 'svg', 'iframe', 'xmp']);
const HEADINGS = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6']);
const CAP = { title: 300, heading: 200, headings: 60, links: 400, text: 600, jsonLd: 10, jsonLdBytes: 100000, meta: 40, words: 5000 };
// Tags whose attributes are read; for every other tag only a cheap substring test runs.
const ATTR_TAGS = new Set(['html', 'meta', 'link', 'a', 'base', 'script']);
const TAG_NAME = /[a-zA-Z][a-zA-Z0-9:-]*/y;
// The rest of a tag up to ">", skipping quoted values. Each alternative starts with a different
// character, so this cannot backtrack. An unclosed quote stops it at the quote.
const TAG_REST = /[^>"']*(?:(?:"[^"]*"|'[^']*')[^>"']*)*/y;
const WORD = /[^\s<>]+/g;

export function extractHtml(html, pageUrl) {
  const src = String(html);
  const lower = src.toLowerCase();
  const len = src.length;
  const base = new URL(pageUrl);
  const facts = {
    lang: '', titles: [], metas: [], links: [], canonical: [], headings: [], anchors: [], jsonLd: [],
    scripts: 0, externalScripts: 0, microdata: false, rdfa: false, words: 0, textSample: '', baseHref: '', bodyFound: false
  };
  const open = []; // headings and links currently collecting text
  let inHead = false;
  let words = 0;
  let sample = '';

  const addText = raw => {
    if (!raw) return;
    for (const cap of open) if (cap.text.length < CAP.heading) cap.text += decodeEntities(raw);
    if (!inHead && words < CAP.words) {
      const count = (raw.match(WORD) || []).length;
      words += count;
      if (sample.length < CAP.text && count) sample += ` ${decodeEntities(raw.slice(0, CAP.text))}`;
    }
  };

  let i = 0;
  while (i < len) {
    const lt = src.indexOf('<', i);
    if (lt === -1) { addText(src.slice(i)); break; }
    if (lt > i) addText(src.slice(i, lt));
    if (src.startsWith('<!--', lt)) {
      const end = src.indexOf('-->', lt + 4);
      i = end === -1 ? len : end + 3;
      continue;
    }
    let j = lt + 1;
    const closing = src[j] === '/';
    if (closing) j += 1;
    const nameStart = j;
    TAG_NAME.lastIndex = j;
    if (TAG_NAME.test(src)) j = TAG_NAME.lastIndex;
    if (j === nameStart) {
      if (src[lt + 1] === '!' || src[lt + 1] === '?') {
        const end = src.indexOf('>', lt);
        i = end === -1 ? len : end + 1;
      } else {
        addText('<');
        i = lt + 1;
      }
      continue;
    }
    const name = lower.slice(nameStart, j);
    // Find the end of the tag, skipping quoted attribute values.
    TAG_REST.lastIndex = j;
    TAG_REST.test(src);
    let k = TAG_REST.lastIndex;
    if (k < len && src[k] !== '>') {
      // An unclosed quote: like browsers' recovery, end the tag at the next ">".
      const gt = src.indexOf('>', k);
      k = gt === -1 ? len : gt;
    }
    const attrSource = src.slice(j, Math.min(k, j + 8000));
    i = k + 1;

    if (closing) {
      if (name === 'head') inHead = false;
      if (HEADINGS.has(name) || name === 'a') {
        for (let n = open.length - 1; n >= 0; n -= 1) {
          if (open[n].tag === name) {
            const [cap] = open.splice(n, 1);
            cap.done(squash(cap.text, CAP.heading));
            break;
          }
        }
      }
      continue;
    }

    const attrs = ATTR_TAGS.has(name) ? parseAttrs(attrSource) : {};
    if (!facts.microdata && attrSource.includes('itemscope')) facts.microdata = true;
    if (!facts.rdfa && (attrSource.includes('typeof=') || attrSource.includes('vocab='))) facts.rdfa = true;

    if (name === 'html' && !facts.lang) facts.lang = (attrs.lang || '').slice(0, 35);
    else if (name === 'head') inHead = true;
    else if (name === 'body') { inHead = false; facts.bodyFound = true; }
    else if (name === 'base' && attrs.href && !facts.baseHref) facts.baseHref = attrs.href;
    else if (name === 'meta' && facts.metas.length < CAP.meta) facts.metas.push(attrs);
    else if (name === 'link' && facts.links.length < CAP.meta) {
      facts.links.push(attrs);
      if ((attrs.rel || '').toLowerCase().split(/\s+/).includes('canonical')) facts.canonical.push(attrs.href || '');
    } else if (HEADINGS.has(name)) {
      if (facts.headings.length < CAP.headings) {
        const entry = { level: Number(name[1]), text: '' };
        facts.headings.push(entry);
        open.push({ tag: name, text: '', done: t => { entry.text = t; } });
      }
    } else if (name === 'a' && attrs.href != null) {
      if (facts.anchors.length < CAP.links) {
        const entry = { href: attrs.href, rel: (attrs.rel || '').toLowerCase(), text: '' };
        facts.anchors.push(entry);
        open.push({ tag: 'a', text: '', done: t => { entry.text = t; } });
      }
    }

    // Raw-text elements: skip straight to the closing tag.
    if (RAW_TEXT.has(name) && src[k - 1] !== '/') {
      const end = lower.indexOf(`</${name}`, i);
      const content = src.slice(i, end === -1 ? len : end);
      if (name === 'title' && facts.titles.length < 5) facts.titles.push(squash(content, CAP.title));
      if (name === 'script') {
        facts.scripts += 1;
        if (attrs.src) facts.externalScripts += 1;
        if ((attrs.type || '').toLowerCase().trim() === 'application/ld+json' && facts.jsonLd.length < CAP.jsonLd) facts.jsonLd.push(content.slice(0, CAP.jsonLdBytes));
      }
      if (end === -1) { i = len; break; }
      const close = lower.indexOf('>', end);
      i = close === -1 ? len : close + 1;
    }
  }
  open.forEach(cap => cap.done(squash(cap.text, CAP.heading)));

  facts.words = words;
  facts.textSample = squash(sample, CAP.text);
  let resolveBase = base;
  if (facts.baseHref) { try { resolveBase = new URL(facts.baseHref, base); } catch (e) { /* ignore a bad <base> */ } }
  facts.resolve = href => { try { return new URL(href, resolveBase); } catch (e) { return null; } };
  return facts;
}

/* Names and values of the meta tags that matter to the audit. */
export function metaValues(facts, key, value) {
  return facts.metas.filter(m => (m[key] || '').toLowerCase() === value).map(m => (m.content || '').trim());
}

/* Parses JSON-LD blocks; returns each block's types or the parse error. */
export function readJsonLd(blocks) {
  return blocks.map(raw => {
    let data;
    try { data = JSON.parse(raw.trim()); } catch (e) { return { ok: false, error: 'Not valid JSON', snippet: raw.trim().replace(/\s+/g, ' ').slice(0, 120) }; }
    const types = new Set();
    const nodes = [];
    const walk = (node, depth) => {
      if (!node || typeof node !== 'object' || depth > 6 || nodes.length > 200) return;
      if (Array.isArray(node)) { node.forEach(n => walk(n, depth + 1)); return; }
      nodes.push(node);
      const t = node['@type'];
      (Array.isArray(t) ? t : [t]).forEach(x => { if (typeof x === 'string') types.add(x.replace(/^https?:\/\/schema\.org\//, '').slice(0, 60)); });
      Object.keys(node).forEach(k => { if (k !== '@context') walk(node[k], depth + 1); });
    };
    walk(data, 0);
    return { ok: true, types: [...types], nodes };
  });
}
