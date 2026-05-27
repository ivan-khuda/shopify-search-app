import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const BARREL_ROOT = join(process.cwd(), 'lib/chat-ui');
const FORBIDDEN_IN_BARREL = [
  /from\s+['"]@shopify\//,
  /window\.shopify/,
  /window\.Shopify/,
  /\bshopify\.idToken\b/,
];

function* walkTs(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const s = statSync(full);
    if (s.isDirectory()) {
      if (full.endsWith('/adapters')) continue; // D-04 exemption — runtime Shopify code only lives in adapters/
      if (full.endsWith('/__tests__')) continue; // tests don't ship in the storefront bundle
      yield* walkTs(full);
    } else if (/\.tsx?$/.test(name)) {
      yield full;
    }
  }
}

describe('lib/chat-ui barrel — Shopify SDK isolation (SHR-01)', () => {
  it('contains zero @shopify/* imports outside adapters/', () => {
    const offenders: string[] = [];
    for (const file of walkTs(BARREL_ROOT)) {
      const src = readFileSync(file, 'utf8');
      for (const pattern of FORBIDDEN_IN_BARREL) {
        if (pattern.test(src)) offenders.push(`${file} — matched ${pattern}`);
      }
    }
    expect(offenders, offenders.join('\n')).toEqual([]);
  });

  it('barrel index.ts does NOT re-export concrete adapters (type-only re-export from ./adapters/types is permitted)', () => {
    const src = readFileSync(join(BARREL_ROOT, 'index.ts'), 'utf8');
    // D-04: type-only re-export from './adapters/types' is permitted because TypeScript erases type-only imports at compile time, so no runtime adapter code reaches the storefront bundle. Concrete adapter re-exports (./adapters/embedded, ./adapters/storefront, etc.) remain forbidden.
    expect(src).not.toMatch(/from\s+['"]\.\/adapters\/(?!types['"])/);
  });
});
