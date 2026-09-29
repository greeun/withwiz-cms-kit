import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * CMS-ESM — 순수 Node ESM 에서 import 되는 서브패스 범위 (TC-SM-006).
 *
 * `next` 패키지에는 `exports` 맵이 없어, 확장자 없는 `next/server`·`next/link`·
 * `next/navigation`·`next/dynamic` 지정자를 순수 Node ESM 로더(번들러 없이
 * `node` 로 직접 import)가 해석하지 못한다 (`ERR_MODULE_NOT_FOUND`). Next.js
 * 번들러는 이 지정자를 런타임(edge·node)별 구현으로 연결하므로 확장자를 붙이지
 * 않고 그대로 둔다. `@withwiz/toolkit/next/*` 도 같은 이유로 순수 Node 에서
 * 불러오지 못한다. 컴포넌트가 import 하는 CSS 파일도 Node 로더가 해석하지
 * 못한다 (`ERR_UNKNOWN_FILE_EXTENSION`).
 *
 * 대신 Next.js 앱 안에서만 쓰는 서브패스(아래 NEXT_APP_ONLY)를 뺀 나머지는
 * 순수 Node ESM 에서 import 되어야 한다. 이 테스트는 그 경계가 깨지는 것(예:
 * 유틸 모듈이 `next/server` 를 끌어옴)을 막는다. vitest 는 자체 해석기와
 * `@withwiz/cms-kit/*` → `src` alias 를 쓰므로, 별도 `node` 프로세스에서 패키지
 * 자기 이름으로 dist 를 import 한다.
 *
 * - CMS-ESM-01: NEXT_APP_ONLY 밖의 모든 JS 서브패스가 순수 Node ESM 에서 import 된다.
 * - CMS-ESM-02: NEXT_APP_ONLY 의 서브패스는 실제로 순수 Node ESM 에서 실패한다
 *   (목록이 실제보다 넓어지지 않게 한다. 실패하지 않게 되면 목록에서 빼고 문서를 고친다).
 *
 * 전제: dist 가 최신이어야 한다. `dist/` 가 없으면 `npm run build` 를 먼저 실행한다.
 * src 를 바꾼 뒤에는 `npm run build` 를 다시 실행하고 이 테스트를 돌린다.
 */

const PKG_ROOT = resolve(__dirname, '../..');
const PKG_NAME = '@withwiz/cms-kit';

/** Next.js 앱 안에서만 쓰는 서브패스의 접두사 (API 라우트 미들웨어 래퍼). */
const NEXT_APP_ONLY_PREFIXES = ['./infrastructure/middleware'];

/**
 * 접두사 규칙으로 묶을 수 없는 Next.js 앱 전용 서브패스와 이유.
 * 배럴과 개별 모듈이 같은 디렉터리에 섞여 있어(`./utils` 아래 순수 유틸과
 * `api-helpers`, `./components` 아래 JsonLd 와 AdminShell) 접두사로 제외하면
 * 순수 Node 에서 import 되어야 할 서브패스까지 검사에서 빠지므로 명시 목록을 쓴다.
 */
const NEXT_APP_ONLY: Record<string, string> = {
  '.': '모든 배럴을 다시 내보낸다 (아래 배럴의 실패 원인을 모두 포함)',
  './components': 'AdminShell(next/link·next/navigation·next/dynamic)과 ToggleSwitch·ImageDropUpload 의 CSS import 를 포함한다',
  './components/AdminShell': 'next/link·next/navigation·next/dynamic 을 import 한다',
  './components/ToggleSwitch': 'toggle-switch.css 를 import 한다 (Next.js 번들러가 CSS 를 처리한다)',
  './infrastructure': 'middleware/wrappers 를 다시 내보낸다 (@withwiz/toolkit/next/middleware → next/server)',
  './utils': 'api-response·api-helpers 를 다시 내보낸다 (next/server)',
  './utils/api-helpers': 'NextResponse 로 검증 실패 응답을 만든다 (next/server)',
};

function isNextAppOnly(subpath: string): boolean {
  return (
    subpath in NEXT_APP_ONLY ||
    NEXT_APP_ONLY_PREFIXES.some((prefix) => subpath === prefix || subpath.startsWith(prefix + '/'))
  );
}

/** `exports` 의 JS 서브패스 (CSS·와일드카드·package.json 제외). */
function jsSubpaths(): string[] {
  const { exports } = JSON.parse(readFileSync(resolve(PKG_ROOT, 'package.json'), 'utf8')) as {
    exports: Record<string, unknown>;
  };
  return Object.keys(exports).filter(
    (key) => key !== './package.json' && !key.includes('*') && !key.endsWith('.css'),
  );
}

function toSpecifier(subpath: string): string {
  return subpath === '.' ? PKG_NAME : `${PKG_NAME}${subpath.slice(1)}`;
}

/** 별도 node 프로세스에서 각 지정자를 import 하고, 실패한 지정자와 오류 코드를 돌려준다. */
function importInPureNode(specifiers: string[]): Record<string, string> {
  const script = `
    const failures = {};
    for (const specifier of ${JSON.stringify(specifiers)}) {
      try { await import(specifier); }
      catch (error) { failures[specifier] = error.code ?? error.message; }
    }
    process.stdout.write('\\n' + JSON.stringify(failures));
  `;
  const output = execFileSync(process.execPath, ['--input-type=module', '-e', script], {
    cwd: PKG_ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  return JSON.parse(output.trim().split('\n').pop()!) as Record<string, string>;
}

beforeAll(() => {
  if (!existsSync(resolve(PKG_ROOT, 'dist/index.mjs'))) {
    execFileSync('npm', ['run', 'build'], { cwd: PKG_ROOT, stdio: 'ignore' });
  }
}, 120_000);

describe('순수 Node ESM 소비 범위 (CMS-ESM)', () => {
  it('CMS-ESM-01: Next.js 앱 전용이 아닌 모든 서브패스를 Next.js 없이 import 할 수 있다', () => {
    const subpaths = jsSubpaths().filter((key) => !isNextAppOnly(key));

    expect(subpaths.length).toBeGreaterThanOrEqual(22);
    expect(importInPureNode(subpaths.map(toSpecifier))).toEqual({});
  });

  it('CMS-ESM-02: Next.js 앱 전용 목록의 서브패스는 exports 에 있고 순수 Node ESM 에서 실패한다', () => {
    const all = jsSubpaths();
    const excluded = all.filter(isNextAppOnly);

    expect(Object.keys(NEXT_APP_ONLY).filter((key) => !all.includes(key))).toEqual([]);
    expect(excluded.length).toBeGreaterThan(0);

    const failures = importInPureNode(excluded.map(toSpecifier));
    const nowImportable = excluded.map(toSpecifier).filter((specifier) => !(specifier in failures));
    expect(nowImportable).toEqual([]);
  });
});
