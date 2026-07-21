# Vitest Prisma Client Resolution Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the full vitest suite pass by fixing `@prisma/client` module resolution in vitest, and correct the test/build commands documented in CLAUDE.md.

**Architecture:** Prisma 7 generates its client to the custom path `app/generated/prisma` (see `prisma/schema.prisma` generator block). The npm package `@shopify/shopify-app-session-storage-prisma` internally does `require('@prisma/client')`, which resolves to `node_modules/@prisma/client/default.js` → `.prisma/client/default`, which does not exist with a custom output path. Next.js already solves this with a webpack/turbopack alias pointing `@prisma/client` at the re-export shim `lib/prisma-npm-reexport.ts`. Vitest has no such alias, so any test that transitively imports `lib/shopify/session-storage.ts` fails at suite load. The fix mirrors the Next.js alias in `vitest.config.ts` — plus `test.server.deps.inline` for the Shopify package, because vitest externalizes `node_modules` CJS dependencies by default and resolve aliases only apply to modules processed by the Vite pipeline.

**Tech Stack:** Vitest 4.1.5, Prisma 7.3.0 (`prisma-client` generator, custom output), `@shopify/shopify-app-session-storage-prisma` 8.0.1, bun.

---

## File Structure

- Modify: `vitest.config.ts` — add `@prisma/client` alias + `server.deps.inline` entry. Only config change; no source files touched.
- Modify: `CLAUDE.md` — correct `bun test` → `bun run test` and `bun build` → `bun run build` (bare `bun test` and `bun build` invoke bun's *built-in* test runner/bundler, not the package.json scripts; the native test runner runs without jsdom or vitest config and produces ~180 bogus failures).
- No new files. No production code changes.

**Pre-existing context an engineer needs:**

- `lib/prisma-npm-reexport.ts` already exists and re-exports the generated client:
  ```ts
  export * from "../app/generated/prisma/client";
  ```
- `next.config.ts` already aliases `@prisma/client` to that shim for webpack AND turbopack. The vitest change mirrors this — do not invent a different mechanism.
- The generated client must exist on disk before tests run: `bunx prisma generate` (idempotent, fast). It outputs to `app/generated/prisma/`, which is gitignored.
- The failing suite is `app/api/auth/__tests__/route.test.ts`. It fails at **import time** (suite-load error, "0 test" collected), not at assertion time. Error signature:
  ```
  Error: Cannot find module '.prisma/client/default'
  Require stack:
  - node_modules/@prisma/client/default.js
  - node_modules/@shopify/shopify-app-session-storage-prisma/dist/cjs/prisma.js
  ```

---

### Task 1: Fix `@prisma/client` resolution in vitest.config.ts

**Files:**
- Modify: `vitest.config.ts` (whole file is 24 lines; full replacement below)
- Test: `app/api/auth/__tests__/route.test.ts` (existing — no edits; it is the reproduction)

- [ ] **Step 1: Ensure the generated Prisma client exists**

Run: `bunx prisma generate`
Expected output (paths may vary slightly):
```
✔ Generated Prisma Client (7.3.0) to ./app/generated/prisma
```

- [ ] **Step 2: Run the failing suite to confirm the failure mode**

Run: `bunx vitest run app/api/auth/__tests__/route.test.ts`
Expected: FAIL at suite load — `Error: Cannot find module '.prisma/client/default'`, `Tests  no tests`.

If this PASSES before any change, stop: the environment differs from the plan's assumptions — re-diagnose before editing config.

- [ ] **Step 3: Replace vitest.config.ts with the aliased config**

Full new content of `vitest.config.ts`:

```ts
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

const rootDir = fileURLToPath(new URL('./', import.meta.url));

export default defineConfig({
  root: rootDir,
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: [
      '**/*.{test,spec}.?(c|m)[jt]s?(x)',
      '**/*.integration-test.?(c|m)[jt]s?(x)',
    ],
    server: {
      deps: {
        // This CJS package does require('@prisma/client') internally. Vitest
        // externalizes node_modules deps by default, and resolve.alias only
        // applies inside the Vite pipeline — inline it so the alias below
        // rewrites its internal require.
        inline: ['@shopify/shopify-app-session-storage-prisma'],
      },
    },
  },
  resolve: {
    alias: {
      // Mirrors next.config.ts: Prisma 7 generates the client to
      // app/generated/prisma, so @prisma/client must resolve to the
      // re-export shim instead of the stub npm package.
      '@prisma/client': fileURLToPath(
        new URL('./lib/prisma-npm-reexport.ts', import.meta.url),
      ),
      '@': rootDir,
    },
  },
});
```

Notes for the implementer:
- Keep `'@prisma/client'` BEFORE `'@'` in the alias object. (Vite string aliases match exact-or-prefix-plus-slash, so `'@'` cannot shadow `'@prisma/client'` anyway, but explicit ordering keeps intent obvious.)
- Do NOT alias `'.prisma/client/default'` directly — that's the *symptom* path inside the stub package; aliasing `@prisma/client` stops resolution before it ever reaches the stub.

- [ ] **Step 4: Run the previously failing suite — expect PASS**

Run: `bunx vitest run app/api/auth/__tests__/route.test.ts`
Expected: PASS — suite collects and runs its tests (it has multiple `describe` blocks for `/api/auth`, callback, and online callback routes), 0 failures.

If it now fails with a *different* module-resolution error mentioning `@prisma/client/edge` or similar subpath: add that subpath as its own alias entry pointing at the same shim, re-run. Do not silence with mocks.

- [ ] **Step 5: Run the full suite — expect zero failed suites**

Run: `bun run test`
Expected:
```
Test Files  62 passed | 1 skipped (63)
Tests       46x passed | 5 skipped
```
Exit code 0. (Exact test count may drift a few tests as the auth suite now actually runs; the invariant is `0 failed`.)

- [ ] **Step 6: Commit**

```bash
git add vitest.config.ts
git commit -m "fix: alias @prisma/client in vitest so session-storage suite loads

Prisma 7 generates the client to app/generated/prisma; the
@shopify/shopify-app-session-storage-prisma CJS dist requires
@prisma/client, which resolved to the stub package and crashed at
suite load. Mirror the next.config.ts alias in vitest and inline the
package so the alias applies to its internal require."
```

---

### Task 2: Correct test/build commands in CLAUDE.md

**Files:**
- Modify: `CLAUDE.md` (Commands section, lines 7-12)

Background for the implementer: `bun test` and `bun build` are bun *built-in subcommands* (native test runner / bundler) that shadow package.json scripts. `bun dev` and `bun lint` are not built-ins, so bun falls through to the scripts and they work as documented. Running bare `bun test` here executes ~231 tests under bun's native runner without jsdom or vitest.config.ts and reports ~180 spurious failures.

- [ ] **Step 1: Apply the edit**

In `CLAUDE.md`, replace this block:

```bash
bun dev          # Start Next.js dev server
bun run build    # Production build (bare `bun build` invokes bun's native bundler, not Next)
bun lint         # ESLint
bun run test     # Run all tests (vitest) — bare `bun test` runs bun's native test runner and fails
```

with:

```bash
bun dev          # Start Next.js dev server
bun run build    # Production build (bare `bun build` invokes bun's native bundler, not Next)
bun lint         # ESLint
bun run test     # Run all tests (vitest) — bare `bun test` runs bun's native test runner and fails
```

- [ ] **Step 2: Verify no other stale `bun test` references remain**

Run: `grep -rn --include='*.md' -E '(^|[^a-z])bun (test|build)([^s-]|$)' CLAUDE.md README.md docs/ .planning/codebase/ 2>/dev/null`
Expected: zero hits outside historical phase artifacts (`.planning/phases/`, `.planning/milestones/` are archives — leave them). Fix any hit in living docs (CLAUDE.md, README, docs/) the same way as Step 1.

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: use bun run test/build in CLAUDE.md commands

Bare 'bun test' and 'bun build' invoke bun built-ins (native test
runner / bundler) instead of the package.json scripts."
```

---

## Self-Review

- **Spec coverage:** Two findings from the test-suite run → two tasks. (1) suite-load failure → Task 1; (2) wrong documented command → Task 2. No gaps.
- **Placeholder scan:** All steps carry complete code/commands/expected output. The single conditional branch (Step 4 alternate subpath alias) states the exact action to take.
- **Type consistency:** Only config + docs; the one symbol referenced across tasks (`lib/prisma-npm-reexport.ts`) exists and is quoted verbatim from disk.
