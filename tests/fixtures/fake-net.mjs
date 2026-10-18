/* A fake network for the website audit tests: no real requests are made. */
export function fakeNet(routes, { dns = {}, defaultIp = '93.184.215.14' } = {}) {
  const requests = [];
  const lookups = [];
  const fetch = async (url, init = {}) => {
    requests.push({ url, method: init.method || 'GET', headers: init.headers || {} });
    const route = routes[url];
    if (!route) return new Response('not found', { status: 404, headers: { 'content-type': 'text/plain' } });
    if (typeof route === 'function') return route(url, init);
    const headers = new Headers(route.headers || {});
    if (route.type) headers.set('content-type', route.type);
    if (route.location) headers.set('location', route.location);
    return new Response(route.body ?? '', { status: route.status || 200, headers });
  };
  const resolve = async host => {
    lookups.push(host);
    const ips = dns[host];
    if (ips instanceof Error) throw ips;
    return ips === undefined ? [defaultIp] : ips;
  };
  return { fetch, resolve, requests, lookups };
}

export const page = ({ head = '', body = '' } = {}) => `<!doctype html><html lang="en"><head><meta charset="utf-8">${head}</head><body>${body}</body></html>`;

export const goodHead = `<title>Acme Plumbing | Emergency plumbers in Leeds</title>
<meta name="description" content="Acme Plumbing fixes leaks, boilers and blocked drains across Leeds, with same-day emergency call-outs and fixed prices.">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="canonical" href="https://acme.example.com/">
<meta property="og:title" content="Acme Plumbing"><meta property="og:image" content="https://acme.example.com/og.jpg">
<script type="application/ld+json">{"@context":"https://schema.org","@type":"Plumber","name":"Acme Plumbing","url":"https://acme.example.com/","telephone":"+44 113 000 0000"}</script>`;

export const goodBody = `<header><a href="/">Home</a><a href="/services">Services</a><a href="/about">About</a><a href="/contact">Contact</a></header>
<main><h1>Emergency plumbers in Leeds</h1><p>${'We repair leaks, service boilers and clear blocked drains for homes and small businesses across Leeds. '.repeat(6)}</p>
<h2>Services</h2><p>Boiler servicing, leak repair and drain clearance with fixed prices.</p></main>
<footer><a href="mailto:hello@acme.example.com">Email us</a> <a href="tel:+441130000000">Call</a></footer>`;

export function goodSite(origin = 'https://acme.example.com', overrides = {}) {
  return {
    [`${origin}/`]: { type: 'text/html; charset=utf-8', body: page({ head: goodHead, body: goodBody }) },
    [`${origin.replace('https:', 'http:')}/`]: { status: 301, location: `${origin}/` },
    [`${origin}/robots.txt`]: { type: 'text/plain', body: `User-agent: *\nAllow: /\n\nSitemap: ${origin}/sitemap.xml\n` },
    [`${origin}/sitemap.xml`]: { type: 'application/xml', body: `<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${origin}/</loc></url><url><loc>${origin}/services</loc></url></urlset>` },
    [`${origin}/services`]: { type: 'text/html', body: page() },
    [`${origin}/about`]: { type: 'text/html', body: page() },
    [`${origin}/contact`]: { type: 'text/html', body: page() },
    ...overrides
  };
}
