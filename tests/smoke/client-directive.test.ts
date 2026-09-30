import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

/**
 * CMS-UC — 빌드 산출물의 "use client" 지시문과 클라이언트 진입점의 의존 범위
 * (spec.md §4.4 AC-4.4.4).
 *
 * - CMS-UC-01: 클라이언트 진입점(tsup CLIENT_ENTRIES)은 ESM·CJS 모두 "use client" 로 시작한다.
 * - CMS-UC-02: 서버 전용 진입점과 루트 배럴은 "use client" 로 시작하지 않는다.
 *   루트 `.` 는 서버·클라이언트 이름을 함께 내보내는 호환 배럴이며 클라이언트
 *   경계가 아니다 (docs/architecture.md "런타임·플랫폼 분류").
 * - CMS-UC-03: 클라이언트 진입점과 `./utils/client` 에서 도달하는 모든 청크가 서버
 *   전용 모듈을 import 하지 않는다.
 *
 * 전제: dist 가 최신이어야 한다 (`npm run build`).
 */

const DIST = resolve(__dirname, '../../dist');

const CLIENT_ENTRIES = [
  'components/index',
  'hooks/index',
  'components/AdminManagerBase',
  'components/AdminShell',
  'components/JsonLd',
  'components/ResizableImage',
  'components/ToggleSwitch',
  'hooks/useImageDropZone',
  'hooks/useScrollReveal',
];

const SERVER_ENTRIES = [
  'index',
  'utils/server',
  'utils/index',
  'utils/jwt',
  'utils/r2-storage',
  'utils/r2-helpers',
  'utils/image-variants',
  'utils/api-helpers',
  'infrastructure/index',
  'infrastructure/prisma',
  'infrastructure/middleware/index',
  'infrastructure/middleware/wrappers',
  'services/index',
  'config/index',
];

/** 클라이언트 번들에 들어가면 안 되는 모듈 지정자 */
const SERVER_ONLY = [
  /^@aws-sdk\//,
  /^sharp$/,
  /^next\/server$/,
  /^@prisma\//,
  /^@withwiz\/toolkit\/core\/auth/,
  /^@withwiz\/toolkit\/next\//,
];

const IMPORT_RE = /(?:import|export)\s*(?:[^'"]*?\sfrom\s*)?["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)/g;

/** ESM 산출물에서 도달 가능한 모든 외부 지정자를 모은다 (상대 청크는 따라간다). */
function reachableExternals(entryFile: string): Set<string> {
  const seen = new Set<string>();
  const externals = new Set<string>();
  const stack = [entryFile];
  while (stack.length > 0) {
    const file = stack.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    const code = readFileSync(file, 'utf-8');
    for (const m of code.matchAll(IMPORT_RE)) {
      const spec = m[1] ?? m[2];
      if (spec.startsWith('.')) {
        if (spec.endsWith('.css')) continue;
        stack.push(resolve(dirname(file), spec));
      } else {
        externals.add(spec);
      }
    }
  }
  return externals;
}

const hasDist = existsSync(join(DIST, 'index.mjs'));

describe.skipIf(!hasDist)('built "use client" boundary (CMS-UC)', () => {
  it('CMS-UC-01: 클라이언트 진입점은 "use client" 로 시작한다', () => {
    for (const entry of CLIENT_ENTRIES) {
      for (const ext of ['.mjs', '.js']) {
        const head = readFileSync(join(DIST, entry + ext), 'utf-8').slice(0, 20);
        expect(head, entry + ext).toMatch(/^"use client"/);
      }
    }
  });

  it('CMS-UC-02: 서버 전용 진입점과 루트 배럴은 "use client" 로 시작하지 않는다', () => {
    for (const entry of SERVER_ENTRIES) {
      for (const ext of ['.mjs', '.js']) {
        const head = readFileSync(join(DIST, entry + ext), 'utf-8').slice(0, 20);
        expect(head, entry + ext).not.toMatch(/^["']use client["']/);
      }
    }
  });

  it('CMS-UC-03: 클라이언트 진입점과 ./utils/client 는 서버 전용 모듈에 도달하지 않는다', () => {
    for (const entry of [...CLIENT_ENTRIES, 'utils/client']) {
      const bad = [...reachableExternals(join(DIST, entry + '.mjs'))].filter((s) =>
        SERVER_ONLY.some((re) => re.test(s)),
      );
      expect(bad, entry).toEqual([]);
    }
  });

  it('CMS-UC-04 (대조군): 서버 진입점에서는 서버 전용 모듈에 도달한다', () => {
    const ext = [...reachableExternals(join(DIST, 'utils/server.mjs'))];
    expect(ext.some((s) => /^@aws-sdk\//.test(s))).toBe(true);
    expect(ext).toContain('next/server');
  });
});
