/* Official BuildWise Group social profiles, in one place.
 *
 * The footer on every page shows a profile only once its `url` is filled in here
 * with the founder-confirmed address of the official account. While `url` is
 * empty nothing is shown, so there are never placeholder or broken links.
 *
 * To add or verify a profile:
 *   1. Put the full https:// address of the official profile in `url`.
 *   2. Add the same address to "sameAs" in the Organization block of index.html.
 *   3. For X, also add <meta name="twitter:site" content="@handle"> to index.html.
 *   4. Run the tests in tests/: they fail until steps 1 to 3 agree.
 * A new channel needs an entry below, its host names and an icon in ICONS.
 */
(() => {
  const PROFILES = [
    // Confirmed by the founder on 30 October 2026.
    { id: 'instagram', label: 'Instagram', url: 'https://www.instagram.com/buildwisehq/', hosts: ['instagram.com', 'www.instagram.com'] },
    // Confirmed by the founder on 30 October 2026.
    { id: 'x', label: 'X (formerly Twitter)', url: 'https://x.com/buildwisex', hosts: ['x.com', 'www.x.com', 'twitter.com', 'www.twitter.com'] }
  ];

  const ICONS = {
    instagram: '<rect x="3.2" y="3.2" width="17.6" height="17.6" rx="5" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="12" cy="12" r="4.1" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="17.3" cy="6.7" r="1.1" fill="currentColor"/>',
    x: '<path d="M17.8 3h3.1l-6.8 7.7 8 10.3h-6.3l-4.9-6.4L5.3 21H2.2l7.2-8.3L1.8 3h6.4l4.4 5.9Zm-1.1 16.2h1.7L7.4 4.7H5.6Z" fill="currentColor"/>',
    linkedin: '<path d="M4.6 9.2h3.2V20H4.6ZM6.2 4a1.9 1.9 0 1 1 0 3.8 1.9 1.9 0 0 1 0-3.8Zm3.6 5.2h3.1v1.5c.4-.8 1.5-1.7 3.1-1.7 3.3 0 3.9 2.2 3.9 5V20h-3.2v-5.3c0-1.3 0-2.9-1.8-2.9s-2 1.4-2 2.8V20H9.8Z" fill="currentColor"/>',
    youtube: '<path d="M21.2 7.6a2.6 2.6 0 0 0-1.8-1.8C17.8 5.4 12 5.4 12 5.4s-5.8 0-7.4.4a2.6 2.6 0 0 0-1.8 1.8C2.4 9.2 2.4 12 2.4 12s0 2.8.4 4.4a2.6 2.6 0 0 0 1.8 1.8c1.6.4 7.4.4 7.4.4s5.8 0 7.4-.4a2.6 2.6 0 0 0 1.8-1.8c.4-1.6.4-4.4.4-4.4s0-2.8-.4-4.4ZM10.1 15V9l5 3Z" fill="currentColor"/>'
  };

  // A profile is shown only with a real https address on one of its own hosts.
  const verified = profile => {
    if (!profile.url || !ICONS[profile.id]) return false;
    try {
      const url = new URL(profile.url);
      return url.protocol === 'https:' && profile.hosts.includes(url.hostname) && url.pathname.length > 1;
    } catch (e) {
      return false;
    }
  };

  const live = PROFILES.filter(verified);
  window.BUILDWISE_SOCIAL = live.map(({ id, label, url }) => ({ id, label, url }));

  const render = () => {
    document.querySelectorAll('[data-social-links]').forEach(list => {
      list.textContent = '';
      live.forEach(profile => {
        const item = document.createElement('li');
        const link = document.createElement('a');
        link.href = profile.url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer me';
        link.className = 'social-link';
        link.setAttribute('aria-label', `BuildWise Group on ${profile.label} (opens in a new tab)`);
        link.innerHTML = `<svg class="social-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${ICONS[profile.id]}</svg>`;
        item.appendChild(link);
        list.appendChild(item);
      });
      list.hidden = live.length === 0;
    });
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', render);
  else render();
})();
