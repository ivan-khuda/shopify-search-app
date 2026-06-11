import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import EmbeddedLayout from '../layout';

const APP_BRIDGE_SRC = 'https://cdn.shopify.com/shopifycloud/app-bridge.js';

describe('EmbeddedLayout', () => {
  it('renders App Bridge as a plain synchronous script tag', () => {
    const { container } = render(<EmbeddedLayout>{null}</EmbeddedLayout>);

    const script = container.querySelector<HTMLScriptElement>(
      `script[src="${APP_BRIDGE_SRC}"]`,
    );

    // App Bridge aborts if loaded via async, defer, type=module, or dynamic
    // injection (which is how next/script beforeInteractive loads in App Router)
    expect(script).not.toBeNull();
    expect(script!.hasAttribute('async')).toBe(false);
    expect(script!.hasAttribute('defer')).toBe(false);
    expect(script!.getAttribute('type')).not.toBe('module');
  });

  it('renders App Bridge before the Polaris script', () => {
    const { container } = render(<EmbeddedLayout>{null}</EmbeddedLayout>);

    const scripts = Array.from(container.querySelectorAll('script[src]'));
    const appBridgeIndex = scripts.findIndex((s) =>
      s.getAttribute('src')!.includes('app-bridge.js'),
    );
    const polarisIndex = scripts.findIndex((s) =>
      s.getAttribute('src')!.includes('polaris.js'),
    );

    expect(appBridgeIndex).toBeGreaterThanOrEqual(0);
    expect(polarisIndex).toBeGreaterThanOrEqual(0);
    expect(appBridgeIndex).toBeLessThan(polarisIndex);
  });
});
