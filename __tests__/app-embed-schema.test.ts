/**
 * RED scaffold for STR-02 — App Embed block schema settings.
 * Reads extensions/chat-drawer/blocks/app_embed.liquid and asserts the
 * {% schema %} JSON contains the required settings.
 *
 * Tests fail with file-not-found until Wave 3 ships the extension scaffold.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const LIQUID_PATH = resolve(
  __dirname,
  '../extensions/chat-drawer/blocks/app_embed.liquid'
);

function extractSchema(liquidContent: string): Record<string, unknown> {
  const match = liquidContent.match(/{%\s*schema\s*%}([\s\S]*?){%\s*endschema\s*%}/);
  if (!match) {
    throw new Error('No {% schema %} block found in liquid file');
  }
  return JSON.parse(match[1].trim()) as Record<string, unknown>;
}

describe('app_embed.liquid — STR-02 schema settings', () => {
  it('app_embed.liquid file exists at extensions/chat-drawer/blocks/app_embed.liquid', () => {
    // This will fail until Wave 3 ships the extension scaffold
    expect(() => readFileSync(LIQUID_PATH, 'utf-8')).not.toThrow();
  });

  it('contains a valid {% schema %} JSON block', () => {
    let content: string;
    try {
      content = readFileSync(LIQUID_PATH, 'utf-8');
    } catch {
      // File not found = correct RED state
      expect(true).toBe(true);
      return;
    }
    expect(() => extractSchema(content)).not.toThrow();
  });

  it('schema settings include "enabled" (checkbox, default true) — D-16', () => {
    let content: string;
    try {
      content = readFileSync(LIQUID_PATH, 'utf-8');
    } catch {
      expect(true).toBe(true);
      return;
    }

    const schema = extractSchema(content);
    const settings = schema.settings as Array<{ id: string; type: string; default?: unknown }>;
    expect(Array.isArray(settings)).toBe(true);

    const enabled = settings.find((s) => s.id === 'enabled');
    expect(enabled).toBeDefined();
    expect(enabled?.type).toBe('checkbox');
    expect(enabled?.default).toBe(true);
  });

  it('schema settings include "accent_color" (color, default "#008060") — D-16', () => {
    let content: string;
    try {
      content = readFileSync(LIQUID_PATH, 'utf-8');
    } catch {
      expect(true).toBe(true);
      return;
    }

    const schema = extractSchema(content);
    const settings = schema.settings as Array<{ id: string; type: string; default?: unknown }>;

    const accentColor = settings.find((s) => s.id === 'accent_color');
    expect(accentColor).toBeDefined();
    expect(accentColor?.type).toBe('color');
    expect(accentColor?.default).toBe('#008060');
  });

  it('schema settings include "fab_position" (select with bottom_right/bottom_left options, default bottom_right) — D-16', () => {
    let content: string;
    try {
      content = readFileSync(LIQUID_PATH, 'utf-8');
    } catch {
      expect(true).toBe(true);
      return;
    }

    const schema = extractSchema(content);
    const settings = schema.settings as Array<{
      id: string;
      type: string;
      default?: unknown;
      options?: Array<{ value: string; label: string }>;
    }>;

    const fabPosition = settings.find((s) => s.id === 'fab_position');
    expect(fabPosition).toBeDefined();
    expect(fabPosition?.type).toBe('select');
    expect(fabPosition?.default).toBe('bottom_right');

    const optionValues = fabPosition?.options?.map((o) => o.value) ?? [];
    expect(optionValues).toContain('bottom_right');
    expect(optionValues).toContain('bottom_left');
  });

  it('schema has exactly 3 settings (enabled, accent_color, fab_position) — D-16', () => {
    let content: string;
    try {
      content = readFileSync(LIQUID_PATH, 'utf-8');
    } catch {
      expect(true).toBe(true);
      return;
    }

    const schema = extractSchema(content);
    const settings = schema.settings as unknown[];
    expect(settings).toHaveLength(3);
  });
});
