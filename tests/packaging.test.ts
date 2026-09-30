import { vi, afterEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * CMS-PKG — 의존성 선언 (spec.md §4.5 AC-4.5.2 / AC-4.5.3, §4.7 AC-4.7.7).
 *
 * - tiptap 은 `ResizableImage` 만 쓰므로 optional peer 로 선언한다.
 * - tiptap 이 없어도 tiptap 을 쓰지 않는 서브패스는 모두 import 된다.
 * - peer 하한은 실제로 테스트하는 devDependencies 버전과 같은 major
 *   (0.x 는 같은 minor) 에서 시작한다.
 */

type Pkg = {
  dependencies?: Record<string, string>;
  peerDependencies: Record<string, string>;
  peerDependenciesMeta: Record<string, { optional?: boolean }>;
  devDependencies: Record<string, string>;
  exports: Record<string, unknown>;
};

const pkg = JSON.parse(readFileSync(resolve(__dirname, '../package.json'), 'utf-8')) as Pkg;

const TIPTAP = ['@tiptap/core', '@tiptap/react'];

/** tiptap 을 import 경로에 두는 서브패스 */
const TIPTAP_SUBPATHS = ['.', './components', './components/ResizableImage'];

/** `>=1.2.3`, `^1.2.3`, `>=1` 형식에서 하한 [major, minor] 를 읽는다. */
function floor(range: string): [number, number] {
  const m = /^(?:>=|\^|~)?\s*(\d+)(?:\.(\d+))?/.exec(range.trim());
  if (!m) throw new Error(`unsupported range: ${range}`);
  return [Number(m[1]), Number(m[2] ?? 0)];
}

afterEach(() => {
  for (const id of TIPTAP) vi.doUnmock(id);
  vi.resetModules();
});

describe('dependency declarations (CMS-PKG)', () => {
  it('CMS-PKG-01: tiptap 은 dependencies 가 아니라 optional peerDependencies 다', () => {
    for (const name of TIPTAP) {
      expect(pkg.dependencies?.[name], name).toBeUndefined();
      expect(pkg.peerDependencies[name], name).toBeDefined();
      expect(pkg.peerDependenciesMeta[name]?.optional, name).toBe(true);
      expect(pkg.devDependencies[name], name).toBeDefined();
    }
  });

  it('CMS-PKG-02: dependencies 가 없다 (모든 런타임 의존성은 peer 로 선언한다)', () => {
    expect(Object.keys(pkg.dependencies ?? {})).toEqual([]);
  });

  it('CMS-PKG-03: peer 하한과 테스트 버전(devDependencies)이 어긋나지 않는다', () => {
    const mismatches: string[] = [];
    for (const [name, peerRange] of Object.entries(pkg.peerDependencies)) {
      const devRange = pkg.devDependencies[name];
      expect(devRange, `${name} must be tested (devDependencies)`).toBeDefined();
      const [pMajor, pMinor] = floor(peerRange);
      const [dMajor, dMinor] = floor(devRange);
      const same = pMajor === dMajor && (pMajor !== 0 || pMinor === dMinor);
      if (!same) mismatches.push(`${name}: peer ${peerRange} vs dev ${devRange}`);
    }
    expect(mismatches).toEqual([]);
  });

  it('CMS-PKG-04: react·next·zod 의 peer 하한은 19·16·4 다', () => {
    expect(floor(pkg.peerDependencies.react)[0]).toBe(19);
    expect(floor(pkg.peerDependencies.next)[0]).toBe(16);
    expect(floor(pkg.peerDependencies.zod)[0]).toBe(4);
    expect(floor(pkg.devDependencies['@types/react'])[0]).toBe(19);
  });
});

describe('tiptap absent (CMS-PKG)', () => {
  function poisonTiptap() {
    for (const id of TIPTAP) {
      vi.doMock(id, () => {
        throw new Error(`POISON: ${id} is not installed`);
      });
    }
  }

  it('CMS-PKG-10: tiptap 이 없어도 tiptap 을 쓰지 않는 서브패스는 모두 import 된다', async () => {
    const subpaths = Object.keys(pkg.exports).filter(
      (k) => !k.endsWith('.css') && !TIPTAP_SUBPATHS.includes(k),
    );
    expect(subpaths.length).toBeGreaterThan(20);
    for (const sub of subpaths) {
      vi.resetModules();
      poisonTiptap();
      const spec = `@withwiz/cms-kit/${sub.slice(2)}`;
      await expect(import(/* @vite-ignore */ spec), spec).resolves.toBeTruthy();
    }
  });

  it('CMS-PKG-11 (대조군): tiptap 을 쓰는 서브패스는 tiptap 이 없으면 import 되지 않는다', async () => {
    for (const sub of TIPTAP_SUBPATHS) {
      vi.resetModules();
      poisonTiptap();
      const spec = sub === '.' ? '@withwiz/cms-kit' : `@withwiz/cms-kit/${sub.slice(2)}`;
      let err: unknown = null;
      try {
        await import(/* @vite-ignore */ spec);
      } catch (e) {
        err = e;
      }
      const text = [String(err), String((err as { cause?: unknown } | null)?.cause ?? '')].join(' ');
      expect(text, spec).toMatch(/@tiptap\/(core|react)/);
    }
  });
});
