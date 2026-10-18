/* Cloudflare Web Analytics: cookie-free page-view counts for the homepage and the scanner.
 *
 * Paste the site token from the Cloudflare dashboard (Web Analytics > Add a site >
 * manual JS snippet) into TOKEN. It is a public site identifier, not a secret.
 * While TOKEN is empty, nothing loads.
 *
 * Cloudflare Web Analytics only counts page views. It never receives scanner answers,
 * notes or report contents: the scanner keeps answers out of the address bar, and the
 * beacon is not loaded at all on a page that was opened from a report link (#r=...).
 */
(() => {
  const TOKEN = '';
  if (!TOKEN) return;
  const nav = window.performance && performance.getEntriesByType ? performance.getEntriesByType('navigation')[0] : null;
  if (/#r=/.test(location.href) || (nav && /#r=/.test(nav.name))) return;
  const script = document.createElement('script');
  script.defer = true;
  script.src = 'https://static.cloudflareinsights.com/beacon.min.js';
  script.setAttribute('data-cf-beacon', JSON.stringify({ token: TOKEN, spa: false }));
  document.head.appendChild(script);
})();
