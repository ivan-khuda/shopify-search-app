/**
 * RED scaffold for STR-03 — shopify.app.toml [app_proxy] block verification.
 * Uses regex-based string check (no TOML parser dependency required).
 *
 * Tests will PASS once Wave 3 adds the [app_proxy] block to shopify.app.toml.
 * These currently FAIL because shopify.app.toml has no [app_proxy] section.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const TOML_PATH = resolve(__dirname, '../shopify.app.toml');

describe('shopify.app.toml — STR-03 [app_proxy] block', () => {
  it('shopify.app.toml file exists', () => {
    // This should always pass as the file already exists
    expect(() => readFileSync(TOML_PATH, 'utf-8')).not.toThrow();
  });

  it('contains [app_proxy] section header', () => {
    const content = readFileSync(TOML_PATH, 'utf-8');
    // Regex check — no TOML parser needed (acceptance criteria explicitly allows this)
    expect(content).toMatch(/\[app_proxy\]/);
  });

  it('[app_proxy] section has url = "..." field', () => {
    const content = readFileSync(TOML_PATH, 'utf-8');
    // Find the [app_proxy] block and verify url field
    expect(content).toMatch(/\[app_proxy\][^[]*url\s*=/s);
  });

  it('[app_proxy] section has subpath = "smartdiscovery" (STR-03)', () => {
    const content = readFileSync(TOML_PATH, 'utf-8');
    // subpath must be exactly "smartdiscovery" per STR-03
    expect(content).toMatch(/\[app_proxy\][^[]*subpath\s*=\s*"smartdiscovery"/s);
  });

  it('[app_proxy] section has prefix = "apps" (STR-03)', () => {
    const content = readFileSync(TOML_PATH, 'utf-8');
    // prefix must be exactly "apps" per STR-03
    // This makes storefront URLs: /apps/smartdiscovery/*
    expect(content).toMatch(/\[app_proxy\][^[]*prefix\s*=\s*"apps"/s);
  });

  it('storefront proxy path resolves to /apps/smartdiscovery/* (combined subpath + prefix check)', () => {
    const content = readFileSync(TOML_PATH, 'utf-8');
    // Both subpath=smartdiscovery and prefix=apps must exist in the [app_proxy] block
    // The combined path /apps/smartdiscovery/ is derived from prefix + subpath
    const hasSubpath = /\[app_proxy\][^[]*subpath\s*=\s*"smartdiscovery"/s.test(content);
    const hasPrefix = /\[app_proxy\][^[]*prefix\s*=\s*"apps"/s.test(content);
    expect(hasSubpath && hasPrefix).toBe(true);
  });
});
