import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * CMS-TY — 공개 타입 계약 (spec.md §4.7 AC-4.7.8).
 *
 * tests/fixtures/types 의 픽스처를 빌드된 `.d.ts` 로 타입 검사한다. 픽스처는
 * `@ts-expect-error` 로 "타입 오류여야 하는 코드"도 적어 두므로, 공개 타입이
 * 다시 `any` 가 되면 그 지시문이 쓸모없어져 검사가 실패한다.
 *
 * - prisma: 모듈 보강으로 등록한 클라이언트 타입이 `prisma`/`getPrisma()` 에 반영된다.
 * - prisma: `getPrisma<T>()` 로 호출 지점에서 타입을 지정할 수 있다.
 * - wrappers: `TApiHandler` 가 아닌 값을 받지 않고 route handler 를 돌려준다.
 *
 * 전제: dist 가 최신이어야 한다 (`npm run build`).
 */

const PKG_ROOT = resolve(__dirname, '../..');
const hasDist = existsSync(resolve(PKG_ROOT, 'dist/infrastructure/prisma.d.ts'));

describe.skipIf(!hasDist)('public type contracts (CMS-TY)', () => {
  it('CMS-TY-01: 타입 픽스처가 빌드된 선언 파일로 타입 검사를 통과한다', () => {
    const tsc = resolve(PKG_ROOT, 'node_modules/typescript/bin/tsc');
    let output = '';
    try {
      execFileSync(process.execPath, [tsc, '-p', 'tests/fixtures/types/tsconfig.json'], {
        cwd: PKG_ROOT,
        encoding: 'utf-8',
        stdio: 'pipe',
      });
    } catch (e) {
      output = String((e as { stdout?: string }).stdout ?? e);
    }
    expect(output).toBe('');
  }, 60_000);
});
