/* Analytics: page views, and the conversion events that show whether the site produces enquiries.
 *
 * 1. Cloudflare Web Analytics (cookie-free page views). Paste the site token from the
 *    Cloudflare dashboard (Web Analytics > Add a site > manual JS snippet) into TOKEN.
 *    It is a public site identifier, not a secret. While TOKEN is empty, nothing loads.
 *
 * 2. Google Analytics 4 (optional, off by default). Paste a GA4 measurement ID
 *    (G-XXXXXXX) into GA4_ID to send page views and the events below to GA4.
 *    GA4 sets cookies: before turning it on, update /privacy (and add a consent banner
 *    if you serve visitors in the UK/EU). While GA4_ID is empty, Google is never contacted.
 *
 * Conversion events, always pushed to window.dataLayer (so a tag manager can pick them
 * up later) and sent to GA4 when it is on:
 *   generate_lead      an enquiry form submission that Web3Forms accepted
 *   whatsapp_click     a click on any wa.me link
 *   cta_click          a click on an element with data-track (consultation and audit CTAs)
 *   ai_referral        a visit referred by an AI assistant (chatgpt.com, perplexity.ai, ...)
 * Events never include names, emails, phone numbers or message text.
 *
 * Neither tool loads on a page opened from a scanner report link (#r=...), so report
 * contents can never reach a third party.
 */
(() => {
  const TOKEN = '';
  const GA4_ID = '';
  const nav = window.performance && performance.getEntriesByType ? performance.getEntriesByType('navigation')[0] : null;
  if (/#r=/.test(location.href) || (nav && /#r=/.test(nav.name))) return;

  if (TOKEN) {
    const script = document.createElement('script');
    script.defer = true;
    script.src = 'https://static.cloudflareinsights.com/beacon.min.js';
    script.setAttribute('data-cf-beacon', JSON.stringify({ token: TOKEN, spa: false }));
    document.head.appendChild(script);
  }

  window.dataLayer = window.dataLayer || [];
  if (/^G-[A-Z0-9]+$/.test(GA4_ID)) {
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    window.gtag('config', GA4_ID);
    const ga = document.createElement('script');
    ga.async = true;
    ga.src = `https://www.googletagmanager.com/gtag/js?id=${GA4_ID}`;
    document.head.appendChild(ga);
  }

  const page = location.pathname.replace(/\.html$/, '') || '/';
  const track = (name, params) => {
    const data = Object.assign({ page }, params);
    window.dataLayer.push(Object.assign({ event: name }, data));
    if (typeof window.gtag === 'function' && GA4_ID) window.gtag('event', name, data);
  };
  window.BWTrack = track;

  document.addEventListener('click', event => {
    const link = event.target.closest && event.target.closest('a, button');
    if (!link) return;
    if (link.href && /^https:\/\/wa\.me\//.test(link.href)) track('whatsapp_click', { location: link.id || link.className || 'link' });
    else if (link.dataset && link.dataset.track) track('cta_click', { cta: link.dataset.track, href: link.getAttribute('href') || '' });
  }, true);

  document.addEventListener('bw:enquiry-sent', event => {
    const d = event.detail || {};
    track('generate_lead', { project_type: d.projectType || '', form_page: d.page || '' });
  });

  const AI = /(^|\.)(chatgpt\.com|chat\.openai\.com|perplexity\.ai|gemini\.google\.com|copilot\.microsoft\.com|claude\.ai|you\.com)$/;
  try {
    const ref = document.referrer ? new URL(document.referrer).hostname : '';
    const utm = new URLSearchParams(location.search).get('utm_source') || '';
    if (AI.test(ref) || AI.test(utm)) track('ai_referral', { source: AI.test(ref) ? ref : utm });
  } catch (e) { /* malformed referrer */ }
})();
