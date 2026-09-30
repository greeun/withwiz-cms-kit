import { vi, beforeEach, afterEach } from 'vitest';

/**
 * CMS-IB — 서버/클라이언트 import 경계 (spec.md §4.4 AC-4.4.1 / AC-4.4.2).
 *
 * 한쪽 전용 의존성을 "poison"(로드되면 throw 하는 모듈)으로 바꿔 둔 상태에서
 * 반대쪽 표면을 import 한다. import 가 성공하면 poison 모듈이 전이적으로
 * 로드되지 않았다는 뜻이다. 대조군으로 넓은 `./utils` 배럴은 poison 에 걸려
 * 실패해야 한다 (poison 이 실제로 동작함을 증명).
 */

const SERVER_ONLY = [
  '@aws-sdk/client-s3',
  'sharp',
  'next/server',
  '@withwiz/toolkit/core/auth/jwt',
  '@withwiz/toolkit/next/middleware/wrappers',
  '@withwiz/cms-kit/infrastructure/prisma',
];

const BROWSER_ONLY = [
  '@withwiz/cms-kit/utils/admin-fetch',
  '@withwiz/cms-kit/utils/image-resize',
  'react',
  'react-dom',
  'next/navigation',
  'next/link',
  'next/dynamic',
];

function poison(ids: readonly string[]) {
  for (const id of ids) {
    vi.doMock(id, () => {
      throw new Error(`POISON: ${id} was loaded`);
    });
  }
}

/** import 가 poison 모듈 때문에 실패했는지 (vitest 는 factory 에러를 감싸 cause 에 둔다) */
async function expectPoisoned(load: () => Promise<unknown>) {
  let err: unknown = null;
  try {
    await load();
  } catch (e) {
    err = e;
  }
  expect(err, 'import should fail on a poisoned module').not.toBeNull();
  const text = [String(err), String((err as { cause?: unknown }).cause ?? '')].join(' ');
  expect(text).toMatch(/POISON/);
}

function unpoison(ids: readonly string[]) {
  for (const id of ids) vi.doUnmock(id);
}

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  unpoison(SERVER_ONLY);
  unpoison(BROWSER_ONLY);
  vi.resetModules();
});

describe('client surface does not load server-only deps (CMS-IB)', () => {
  beforeEach(() => poison(SERVER_ONLY));

  it('CMS-IB-01: ./utils/client', async () => {
    const mod = await import('@withwiz/cms-kit/utils/client');
    expect(typeof mod.adminFetch).toBe('function');
    expect(typeof mod.resizeImageIfNeeded).toBe('function');
    expect(typeof mod.cn).toBe('function');
  });

  it('CMS-IB-02: ./hooks 와 hook 개별 진입점', async () => {
    await expect(import('@withwiz/cms-kit/hooks')).resolves.toBeTruthy();
    await expect(import('@withwiz/cms-kit/hooks/useImageDropZone')).resolves.toBeTruthy();
    await expect(import('@withwiz/cms-kit/hooks/useScrollReveal')).resolves.toBeTruthy();
  });

  it('CMS-IB-03: ./components 와 component 개별 진입점', async () => {
    await expect(import('@withwiz/cms-kit/components')).resolves.toBeTruthy();
    for (const c of ['AdminShell', 'AdminManagerBase', 'AdminManagerConfig', 'JsonLd', 'ToggleSwitch']) {
      vi.resetModules();
      await expect(import(/* @vite-ignore */ `@withwiz/cms-kit/components/${c}`)).resolves.toBeTruthy();
    }
  });

  it('CMS-IB-04: ./config 와 ./validators', async () => {
    await expect(import('@withwiz/cms-kit/config/public')).resolves.toBeTruthy();
    await expect(import('@withwiz/cms-kit/validators')).resolves.toBeTruthy();
  });

  it('CMS-IB-05 (대조군): 넓은 ./utils 배럴은 서버 전용 의존성을 로드한다', async () => {
    await expectPoisoned(() => import('@withwiz/cms-kit/utils'));
  });
});

describe('server surface does not load browser-only code (CMS-IB)', () => {
  beforeEach(() => poison(BROWSER_ONLY));

  it('CMS-IB-10: 테스트 환경에 브라우저 전역이 없다', () => {
    expect(typeof window).toBe('undefined');
    expect(typeof document).toBe('undefined');
  });

  it('CMS-IB-11: ./utils/server', async () => {
    const mod = await import('@withwiz/cms-kit/utils/server');
    expect(typeof mod.uploadToR2).toBe('function');
    expect(typeof mod.getJWTManager).toBe('function');
    expect(typeof mod.setCmsConfig).toBe('function');
  });

  it('CMS-IB-12: ./infrastructure, ./infrastructure/middleware, ./services', async () => {
    await expect(import('@withwiz/cms-kit/infrastructure')).resolves.toBeTruthy();
    await expect(import('@withwiz/cms-kit/infrastructure/middleware')).resolves.toBeTruthy();
    await expect(import('@withwiz/cms-kit/services')).resolves.toBeTruthy();
  });

  it('CMS-IB-13: ./types, ./validators, ./config', async () => {
    await expect(import('@withwiz/cms-kit/types')).resolves.toBeTruthy();
    await expect(import('@withwiz/cms-kit/validators')).resolves.toBeTruthy();
    await expect(import('@withwiz/cms-kit/config/public')).resolves.toBeTruthy();
  });

  it('CMS-IB-14 (대조군): 넓은 ./utils 배럴은 브라우저 전용 모듈을 로드한다', async () => {
    await expectPoisoned(() => import('@withwiz/cms-kit/utils'));
  });
});

describe('split surfaces cover the legacy ./utils names (CMS-IB)', () => {
  it('CMS-IB-20: ./utils 의 모든 이름은 ./utils/client 또는 ./utils/server 에 있다', async () => {
    const all = await import('@withwiz/cms-kit/utils');
    const client = await import('@withwiz/cms-kit/utils/client');
    const server = await import('@withwiz/cms-kit/utils/server');
    const split = new Set([...Object.keys(client), ...Object.keys(server)]);
    const missing = Object.keys(all).filter((n) => !split.has(n));
    expect(missing).toEqual([]);
    for (const n of Object.keys(client)) {
      expect((client as Record<string, unknown>)[n], n).toBe((all as Record<string, unknown>)[n]);
    }
    for (const n of Object.keys(server)) {
      expect((server as Record<string, unknown>)[n], n).toBe((all as Record<string, unknown>)[n]);
    }
  });
});
