#!/usr/bin/env python3
"""Read-only production verification for buildwisegroup.dev. Prints evidence; changes nothing."""
import json, re, sys, urllib.request, urllib.error, ssl
from html.parser import HTMLParser
SITE = 'https://buildwisegroup.dev'
UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36 buildwise-verify'
fails = []
def get(url, ua=UA, method='GET'):
    req = urllib.request.Request(url, headers={'User-Agent': ua}, method=method)
    class NoRedir(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, *a, **k): return None
    op = urllib.request.build_opener(NoRedir)
    try:
        r = op.open(req, timeout=30)
        return r.status, dict((k.lower(), v) for k, v in r.headers.items()), r.read().decode('utf-8', 'replace')
    except urllib.error.HTTPError as e:
        return e.code, dict((k.lower(), v) for k, v in e.headers.items()), e.read().decode('utf-8', 'replace')
    except Exception as e:
        return 0, {}, repr(e)
def check(cond, msg):
    print(('PASS ' if cond else 'FAIL ') + msg)
    if not cond: fails.append(msg)

print('== 1. robots.txt ==')
s, h, robots = get(SITE + '/robots.txt')
print('status', s, 'content-type', h.get('content-type'), 'x-robots-tag', h.get('x-robots-tag'))
print('----- live robots.txt -----'); print(robots); print('----- end -----')
check(s == 200, 'robots.txt returns 200')
def group(ua):
    m = re.search(r'(?im)^User-agent:\s*' + re.escape(ua) + r'\s*$\n((?:(?!User-agent).*\n?)*)', robots)
    return m.group(1) if m else None
g = group('OAI-SearchBot'); print('OAI-SearchBot group:', repr(g))
check(g is not None and re.search(r'(?im)^Allow:\s*/\s*$', g) and not re.search(r'(?im)^Disallow:\s*/\s*$', g), 'OAI-SearchBot allowed in robots.txt')
g = group('GPTBot'); print('GPTBot group:', repr(g))
check(g is not None and re.search(r'(?im)^Disallow:\s*/\s*$', g), 'GPTBot disallowed (Cloudflare managed block present)')
check('Sitemap: https://buildwisegroup.dev/sitemap.xml' in robots, 'sitemap declared')

print('\n== 2. sitemap URLs ==')
s, h, sm = get(SITE + '/sitemap.xml')
locs = re.findall(r'<loc>([^<]+)</loc>', sm)
print('sitemap status', s, 'locs', len(locs))
check(s == 200 and len(locs) == 17, 'sitemap.xml 200 with 17 URLs')
class P(HTMLParser):
    def __init__(s): super().__init__(); s.hrefs=[]; s.canon=None; s.robots=None; s.title=''; s._t=False; s.ld=[]; s._ld=False; s.desc=None
    def handle_starttag(s, t, a):
        a=dict(a)
        if t=='a' and a.get('href'): s.hrefs.append(a['href'])
        if t=='link' and a.get('rel')=='canonical': s.canon=a.get('href')
        if t=='meta' and a.get('name')=='robots': s.robots=a.get('content')
        if t=='meta' and a.get('name')=='description': s.desc=a.get('content')
        if t=='title': s._t=True
        if t=='script' and a.get('type')=='application/ld+json': s._ld=True; s.ld.append('')
    def handle_endtag(s, t):
        if t=='title': s._t=False
        if t=='script': s._ld=False
    def handle_data(s, d):
        if s._t: s.title+=d
        if s._ld: s.ld[-1]+=d
pages = {}
for u in locs:
    s, h, body = get(u)
    p = P(); p.feed(body); pages[u] = p
    ld_ok = True; types = []
    for blk in p.ld:
        try:
            j = json.loads(blk); g = j.get('@graph', [j]); types += [x.get('@type') for x in g]
        except Exception as e: ld_ok = False
    print(f"{s} {u} | xrt={h.get('x-robots-tag')} | canonical={p.canon} | meta-robots={p.robots} | title={p.title.strip()[:60]!r} | desc={'yes' if p.desc else 'NO'} | jsonld={'ok' if ld_ok else 'INVALID'} {types}")
    check(s == 200, f'{u} returns 200')
    check(p.canon == u, f'{u} canonical is self')
    check(not h.get('x-robots-tag') and not (p.robots and 'noindex' in p.robots), f'{u} has no noindex')
    check(ld_ok, f'{u} JSON-LD parses')

print('\n== 3. guides and internal links ==')
guides = [SITE + '/insights/whatsapp-ai-automation-nigeria', SITE + '/insights/choose-ai-automation-company-nigeria']
for g in guides:
    path = g.replace(SITE, '')
    inbound = [u for u, p in pages.items() if path in p.hrefs]
    print(path, 'linked from', inbound)
    check(len(inbound) >= 2, f'{path} linked internally from sitemap pages')
internal = sorted({h.split('#')[0] for p in pages.values() for h in p.hrefs if h.startswith('/') and not h.startswith('//')} - {''})
print('unique internal paths:', len(internal))
for path in internal:
    s, h, _ = get(SITE + path, method='GET')
    ok = s in (200, 301, 308)
    print(s, path)
    check(ok, f'internal link {path} resolves')

print('\n== 4. crawler user agents (spoofed UA from GitHub runner; not proof of OpenAI IPs) ==')
for name, ua in [('OAI-SearchBot', 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; OAI-SearchBot/1.3; +https://openai.com/searchbot'),
                 ('ChatGPT-User', 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; ChatGPT-User/1.0; +https://openai.com/bot'),
                 ('GPTBot', 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; GPTBot/1.2; +https://openai.com/gptbot')]:
    for path in ['/', '/ai-agents', '/insights/choose-ai-automation-company-nigeria']:
        s, h, b = get(SITE + path, ua=ua)
        print(f'{name:14} {path:50} {s} server={h.get("server")} cf-mitigated={h.get("cf-mitigated")}')

print('\n== 5. duplicate hosts ==')
for u in ['https://buildwise-group.pages.dev/', 'https://buildwise-group.pages.dev/ai-agents', 'https://www.buildwisegroup.dev/', 'http://buildwisegroup.dev/']:
    s, h, _ = get(u)
    print(u, s, 'x-robots-tag=', h.get('x-robots-tag'), 'location=', h.get('location'))
s, h, _ = get('https://buildwise-group.pages.dev/')
check('noindex' in (h.get('x-robots-tag') or ''), 'buildwise-group.pages.dev sends X-Robots-Tag noindex')
s, h, _ = get(SITE + '/')
check('noindex' not in (h.get('x-robots-tag') or ''), 'buildwisegroup.dev homepage has no X-Robots-Tag noindex')

print('\n== 6. other files ==')
for path in ['/llms.txt', '/404-check-nonexistent', '/README.md', '/.well-known/security.txt']:
    s, h, _ = get(SITE + path)
    print(path, s, 'x-robots-tag=', h.get('x-robots-tag'))
s,_,_ = get(SITE + '/404-check-nonexistent'); check(s == 404, 'unknown path returns real 404')

print('\n== SUMMARY ==')
print('failures:', len(fails))
for f in fails: print('  -', f)
