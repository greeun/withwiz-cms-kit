import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

// Sprint 0: self-contained local Vitest runner for @withwiz/cms-kit.
//
// Mirrors the sibling ../withwiz-blog-core self-contained pattern (local
// vitest.config.ts + `test` script + vitest devDependency), adapted to the
// CMS-kit node/jsdom split (`cms-kit` / `cms-kit-dom`) documented in docs/testing.md.
//
// Behavior-neutral: adds ONLY a runner. No src/** runtime change.
//
// - globals: true is MANDATORY. Every existing test file relies on the
//   GLOBAL describe/it/expect/beforeEach (some import nothing from vitest;
//   the rest import only vi/beforeEach but still call bare globals).
// - Prefix alias maps `@withwiz/cms-kit/<anySubpath>` -> `src/<anySubpath>` and
//   the bare `@withwiz/cms-kit` -> `src/index`, because the existing tests import
//   ~28 distinct DEEP subpaths, not just the 9 package.json `exports` barrels.
//   The existing test files' import style is NOT changed (spec.md §6/§0.1).
// - Two projects exactly matching docs/testing.md:
//     cms-kit -> environment: node,  tests/**/*.test.{ts,tsx} excl *.dom.test.*
//     cms-kit-dom -> environment: jsdom, tests/**/*.dom.test.{ts,tsx}
//   (docs/testing.md literally writes the `cms-kit` include as *.test.ts; the
//   observable file->project mapping is identical because the only .tsx test
//   files are *.dom.test.tsx, which route to cms-kit-dom. The doc's project
//   names/environments/exclusions are preserved exactly.)
// - setupFiles 는 추적 대상인 tests/setup.ts 하나만 지정한다. 이 파일이
//   NODE_ENV, RATE_LIMIT_ENABLED='false' 기본값(docs/testing.md "공통 셋업"),
//   next/cache mock 을 설정한다. gitignore 대상 파일을 셋업으로 지정하면 새로
//   받은 체크아웃에서 모든 테스트 파일이 로드에 실패한다 (TC-SM-005,
//   tests/fresh-checkout.test.ts 가 회귀를 막는다).

const cmsKitAlias = [
  // Deep subpath: @withwiz/cms-kit/utils/html-sanitizer -> src/utils/html-sanitizer
  {
    find: /^@withwiz\/cms-kit\/(.*)$/,
    replacement: path.resolve(__dirname, 'src') + '/$1',
  },
  // Bare specifier: @withwiz/cms-kit -> src/index
  {
    find: /^@withwiz\/cms-kit$/,
    replacement: path.resolve(__dirname, 'src/index.ts'),
  },
];

// @withwiz/toolkit 의 ESM 청크는 `next/server` 를 확장자 없이 import 한다.
// next 는 exports 맵이 없어 Node ESM 로더가 `next/server.js` 로 해석하지
// 못하므로, toolkit 을 Vite 파이프라인에서 인라인 변환해 해석시킨다.
const inlineToolkit = { deps: { inline: [/@withwiz\/toolkit/] } };

const setupFiles = ['./tests/setup.ts'];

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: cmsKitAlias,
  },
  test: {
    globals: true,
    projects: [
      {
        plugins: [react()],
        resolve: { alias: cmsKitAlias },
        test: {
          name: 'cms-kit',
          globals: true,
          environment: 'node',
          server: inlineToolkit,
          setupFiles,
          include: ['tests/**/*.test.{ts,tsx}'],
          exclude: ['**/*.dom.test.*', '**/node_modules/**'],
        },
      },
      {
        plugins: [react()],
        resolve: { alias: cmsKitAlias },
        test: {
          name: 'cms-kit-dom',
          globals: true,
          environment: 'jsdom',
          server: inlineToolkit,
          setupFiles,
          include: ['tests/**/*.dom.test.{ts,tsx}'],
          exclude: ['**/node_modules/**'],
        },
      },
    ],
  },
});
