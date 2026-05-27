/*
 * SmartDiscovery AI loader — Phase 6 (D-13/D-15).
 *
 * Paints FAB synchronously on theme load; lazy-loads the main React bundle
 * on first click. Vanilla JS only — no TypeScript, no React, no library
 * imports. Stays well under the 100KB Liquid asset cap (Pitfall 8).
 *
 * Bundle URL is resolved at click time via /apps/smartdiscovery/_meta/bundle-url
 * — the App Proxy boundary owns app-host knowledge so the loader does not
 * need to know the app's external host at deploy time.
 */
(function () {
  var root = document.querySelector('smartdiscovery-app');
  if (!root) return;

  var accent = root.dataset.accent || '#008060';
  var position = root.dataset.fabPosition || 'bottom_right';
  var shop = root.dataset.shop;
  var customerId = root.dataset.customerId || null;
  var loaded = false;

  var fab = document.createElement('button');
  fab.className = 'sd-fab sd-fab--' + position;
  fab.style.setProperty('--sd-accent', accent);
  fab.setAttribute('type', 'button');
  fab.setAttribute('aria-label', 'Open SmartDiscovery AI chat');
  fab.setAttribute('aria-expanded', 'false');
  fab.setAttribute('aria-controls', 'sd-drawer');
  fab.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.582a.5.5 0 0 1 0 .962L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/></svg>';
  root.appendChild(fab);

  fab.addEventListener('click', function () {
    // STR-07 / Pitfall 5: check designMode at CLICK time, not at mount.
    if (window.Shopify && window.Shopify.designMode === true) return;

    if (loaded) {
      if (window.smartdiscovery && typeof window.smartdiscovery.toggle === 'function') {
        window.smartdiscovery.toggle();
      }
      return;
    }
    loaded = true;
    document.body.classList.add('sd-skeleton-open');

    fetch('/apps/smartdiscovery/_meta/bundle-url', { method: 'GET', cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(function (m) { return import(m.bundle); })
      .then(function () {
        if (window.smartdiscovery && typeof window.smartdiscovery.mount === 'function') {
          window.smartdiscovery.mount({
            shop: shop,
            customerId: customerId,
            accent: accent,
            position: position
          });
        }
      })
      .catch(function () {
        document.body.classList.remove('sd-skeleton-open');
        loaded = false;
      });
  });
})();
