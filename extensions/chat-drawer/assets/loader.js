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
  fab.setAttribute('aria-haspopup', 'dialog');
  fab.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.582a.5.5 0 0 1 0 .962L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/></svg>';
  root.appendChild(fab);

  // Drawer-redesign: restyle the synchronously-painted FAB to the merchant's
  // configured variant (prototype storefront.jsx FAB, 278–325). The accent
  // from the settings bundle overrides the dataset accent; 'circle' keeps the
  // initial paint (no-op). The shop name is appended as a TEXT node — dataset
  // values are entity-decoded, so concatenating it into innerHTML would
  // reintroduce markup.
  function restyleFab(data) {
    if (data.drawerAccent) {
      fab.style.setProperty('--sd-accent', data.drawerAccent);
    }
    if (data.fabStyle === 'pill') {
      fab.classList.add('sd-fab--pill');
      fab.innerHTML =
        '<span class="sd-fab__dot">' +
        '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<path d="M12 3l1.8 4.5L18 9.3l-4.2 1.8L12 15.5l-1.8-4.4L6 9.3l4.2-1.8z"/>' +
        '</svg>' +
        '</span>';
      fab.appendChild(
        document.createTextNode('Ask ' + (root.dataset.shopName || 'us'))
      );
    } else if (data.fabStyle === 'labeled') {
      fab.classList.add('sd-fab--labeled');
      fab.innerHTML =
        '<span class="sd-fab__icon">' +
        '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<circle cx="11" cy="11" r="6.5"/><path d="M15 15l5 5"/>' +
        '<path d="M11 8l1 2 2 1-2 1-1 2-1-2-2-1 2-1z" fill="#fff"/>' +
        '</svg>' +
        '</span>' +
        '<span class="sd-fab__label">' +
        '<span class="sd-fab__kicker">Powered by AI</span>' +
        '<span class="sd-fab__title">Find anything</span>' +
        '</span>';
    }
  }

  // Settings-redesign: honor the merchant kill-switch (drawerEnabled) and the
  // Theme Editor preview toggle (editorPreviewVisible) BEFORE the bundle ever
  // loads. Non-blocking — the FAB paints synchronously first; if the lookup
  // fails the FAB stays (fail-open, matches the drawer's tolerant decoding).
  fetch('/apps/smartdiscovery/_meta/appearance', { method: 'GET', cache: 'no-store' })
    .then(function (r) {
      if (!r.ok) throw new Error('appearance request failed: ' + r.status);
      return r.json();
    })
    .then(function (data) {
      var inEditor = window.Shopify && window.Shopify.designMode === true;
      if (
        data.drawerEnabled === false ||
        (inEditor && data.editorPreviewVisible === false)
      ) {
        fab.remove();
        return;
      }
      restyleFab(data);
    })
    .catch(function () {
      // Fail-open: keep the FAB when the appearance lookup fails.
    });

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
      .then(function (r) {
        // WR-04: surface non-2xx (429/500) responses to the .catch instead
        // of letting them die as a JSON parse error.
        if (!r.ok) throw new Error('bundle-url request failed: ' + r.status);
        return r.json();
      })
      .then(function (m) {
        // CR-01 defense: require an absolute URL. new URL() throws on a
        // relative/scheme-less value, routing it to the .catch below instead
        // of letting import() resolve it against the shop's domain.
        return import(new URL(m.bundle).href);
      })
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
