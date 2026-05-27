/**
 * RED scaffold for STR-01 — extension scaffold file existence.
 * Pure fs.existsSync assertions. All fail until Wave 3 ships the extension scaffold.
 */
import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(__dirname, '..');

describe('extensions/chat-drawer/ scaffold — STR-01', () => {
  it('extensions/chat-drawer/shopify.extension.toml exists', () => {
    expect(existsSync(resolve(ROOT, 'extensions/chat-drawer/shopify.extension.toml'))).toBe(true);
  });

  it('extensions/chat-drawer/blocks/app_embed.liquid exists', () => {
    expect(existsSync(resolve(ROOT, 'extensions/chat-drawer/blocks/app_embed.liquid'))).toBe(true);
  });

  it('extensions/chat-drawer/assets/loader.js exists', () => {
    expect(existsSync(resolve(ROOT, 'extensions/chat-drawer/assets/loader.js'))).toBe(true);
  });

  it('extensions/chat-drawer/assets/loader.css exists', () => {
    expect(existsSync(resolve(ROOT, 'extensions/chat-drawer/assets/loader.css'))).toBe(true);
  });

  it('extensions/chat-drawer/src/entry.tsx exists', () => {
    expect(existsSync(resolve(ROOT, 'extensions/chat-drawer/src/entry.tsx'))).toBe(true);
  });
});
