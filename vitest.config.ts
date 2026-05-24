import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

// Sprint 0: self-contained local Vitest runner for @withwiz/pms.
//
// Mirrors the sibling ../withwiz-blog-core self-contained pattern (local
// vitest.config.ts + `test` script + vitest devDependency), adapted to the
// PMS node/jsdom split (`pms` / `pms-dom`) documented in docs/testing.md.
//
// Behavior-neutral: adds ONLY a runner. No src/** runtime change, no existing
// tests/** file changed (the existing tests/setup.ts is used as-is).
//
// - globals: true is MANDATORY. Every existing PMS test file relies on the
//   GLOBAL describe/it/expect/beforeEach (some import nothing from vitest;
//   the rest import only vi/beforeEach but still call bare globals).
// - Prefix alias maps `@withwiz/pms/<anySubpath>` -> `src/<anySubpath>` and
//   the bare `@withwiz/pms` -> `src/index`, because the existing tests import
//   ~28 distinct DEEP subpaths, not just the 9 package.json `exports` barrels.
//   The existing test files' import style is NOT changed (spec.md §6/§0.1).
// - Two projects exactly matching docs/testing.md:
//     pms     -> environment: node,  tests/**/*.test.{ts,tsx} excl *.dom.test.*
//     pms-dom -> environment: jsdom, tests/**/*.dom.test.{ts,tsx}
//   (docs/testing.md literally writes the `pms` include as *.test.ts; the
//   observable file->project mapping is identical because the only .tsx test
//   files are *.dom.test.tsx, which route to pms-dom. The doc's project
//   names/environments/exclusions are preserved exactly.)
// - setupFiles runs the NEW harness-owned env-setup.ts (supplies
//   RATE_LIMIT_ENABLED='false' per docs/testing.md §"공통 셋업" without
//   editing the byte-identity-protected tests/setup.ts) BEFORE the existing
//   tests/setup.ts (which sets NODE_ENV and mocks next/cache).

const pmsAlias = [
  // Deep subpath: @withwiz/pms/utils/html-sanitizer -> src/utils/html-sanitizer
  {
    find: /^@withwiz\/pms\/(.*)$/,
    replacement: path.resolve(__dirname, 'src') + '/$1',
  },
  // Bare specifier: @withwiz/pms -> src/index
  {
    find: /^@withwiz\/pms$/,
    replacement: path.resolve(__dirname, 'src/index.ts'),
  },
];

const setupFiles = [
  './tests-harness/env-setup.ts',
  './tests/setup.ts',
];

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: pmsAlias,
  },
  test: {
    globals: true,
    projects: [
      {
        plugins: [react()],
        resolve: { alias: pmsAlias },
        test: {
          name: 'pms',
          globals: true,
          environment: 'node',
          setupFiles,
          include: ['tests/**/*.test.{ts,tsx}'],
          exclude: ['**/*.dom.test.*', '**/node_modules/**'],
        },
      },
      {
        plugins: [react()],
        resolve: { alias: pmsAlias },
        test: {
          name: 'pms-dom',
          globals: true,
          environment: 'jsdom',
          setupFiles,
          include: ['tests/**/*.dom.test.{ts,tsx}'],
          exclude: ['**/node_modules/**'],
        },
      },
    ],
  },
});
