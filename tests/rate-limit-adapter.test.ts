import { vi, beforeEach, afterEach } from 'vitest';

/**
 * CMS-RLA — rate-limit 어댑터 주입 경계 (spec.md §4.3 AC-4.3.5, §4.5 AC-4.5.5).
 *
 * 어댑터는 import 시점이 아니라 첫 요청 시점에 설치되고, 소비자가 주입한
 * limiter/한도를 쓰며, 소비자가 toolkit 에 직접 설치한 어댑터를 덮어쓰지 않는다.
 */

const ADAPTER_KEY = '__withwiz_rateLimitAdapter__';

type Adapter = {
  rateLimiters: Record<string, { check: (id: string) => Promise<unknown>; config: { limit: number } }>;
  extractClientIp: (headers: Headers) => string;
  isEnabled?: () => Promise<boolean>;
};

function currentAdapter(): Adapter | undefined {
  return (globalThis as Record<string, unknown>)[ADAPTER_KEY] as Adapter | undefined;
}

let warnSpy: ReturnType<typeof vi.spyOn>;

beforeEach(async () => {
  vi.resetModules();
  delete (globalThis as Record<string, unknown>)[ADAPTER_KEY];
  const { resetCmsConfig } = await import('@withwiz/cms-kit/config');
  resetCmsConfig();
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  warnSpy.mockRestore();
  delete (globalThis as Record<string, unknown>)[ADAPTER_KEY];
});

function fakeLimiter(limit: number) {
  return {
    check: vi.fn(async () => ({ success: true, remaining: limit, resetIn: 0 })),
    config: { limit },
  };
}

describe('rate-limit adapter lifecycle (CMS-RLA)', () => {
  it('CMS-RLA-01: import 만으로는 어댑터를 설치하지 않는다', async () => {
    await import('@withwiz/cms-kit/infrastructure/middleware/wrappers');
    await import('@withwiz/cms-kit/infrastructure');
    expect(currentAdapter()).toBeUndefined();
  });

  it('CMS-RLA-02: 래퍼가 만든 핸들러의 첫 요청에서 설치한다', async () => {
    const { withPublicApi } = await import('@withwiz/cms-kit/infrastructure/middleware/wrappers');
    const { NextResponse, NextRequest } = await import('next/server');
    const route = withPublicApi(async () => NextResponse.json({ ok: true }));
    expect(currentAdapter()).toBeUndefined();

    const res = await route(new NextRequest('http://localhost/api/x'));
    expect(res.status).toBe(200);
    expect(Object.keys(currentAdapter()!.rateLimiters).sort()).toEqual(['admin', 'api', 'auth']);
  });

  it('CMS-RLA-03: 기본 한도는 api 120 / auth 10 / admin 200', async () => {
    const { ensureRateLimitAdapter } = await import('@withwiz/cms-kit/infrastructure');
    ensureRateLimitAdapter();
    const l = currentAdapter()!.rateLimiters;
    expect([l.api.config.limit, l.auth.config.limit, l.admin.config.limit]).toEqual([120, 10, 200]);
  });

  it('CMS-RLA-04: 주입한 한도와 limiter 를 사용한다 (in-memory 기본값으로 덮지 않음)', async () => {
    const { setCmsConfig } = await import('@withwiz/cms-kit/config');
    const shared = fakeLimiter(999);
    setCmsConfig({
      rateLimit: {
        limits: { auth: { limit: 3, windowMs: 1_000 } },
        rateLimiters: { api: shared, upload: fakeLimiter(5) },
      },
    });
    const { ensureRateLimitAdapter } = await import('@withwiz/cms-kit/infrastructure');
    ensureRateLimitAdapter();
    const l = currentAdapter()!.rateLimiters;
    expect(l.api).toBe(shared);
    expect(l.upload.config.limit).toBe(5);
    expect(l.auth.config.limit).toBe(3);
    expect(l.admin.config.limit).toBe(200);
  });

  it('CMS-RLA-05: 주입한 identity 추출기를 어댑터가 사용한다', async () => {
    const { setCmsConfig } = await import('@withwiz/cms-kit/config');
    setCmsConfig({ rateLimit: { identityExtractor: () => 'client-42' } });
    const { ensureRateLimitAdapter } = await import('@withwiz/cms-kit/infrastructure');
    ensureRateLimitAdapter();
    expect(currentAdapter()!.extractClientIp(new Headers())).toBe('client-42');
  });

  it('CMS-RLA-06: 소비자가 toolkit 에 직접 설치한 어댑터를 덮어쓰지 않고 1회 경고한다', async () => {
    const { setRateLimitAdapter } = await import('@withwiz/toolkit/next/middleware/rate-limit');
    const mine = { rateLimiters: { api: fakeLimiter(1) }, extractClientIp: () => 'x' };
    setRateLimitAdapter(mine);

    const { ensureRateLimitAdapter } = await import('@withwiz/cms-kit/infrastructure');
    ensureRateLimitAdapter();
    ensureRateLimitAdapter();
    expect(currentAdapter()).toBe(mine);
    const msgs = warnSpy.mock.calls.map((c) => String(c[0])).filter((m) => m.includes('already installed'));
    expect(msgs).toHaveLength(1);
    expect(msgs[0]).toContain('@withwiz/cms-kit');
  });

  it('CMS-RLA-07: manageAdapter:false 면 설치하지 않는다', async () => {
    const { setCmsConfig } = await import('@withwiz/cms-kit/config');
    setCmsConfig({ rateLimit: { manageAdapter: false } });
    const { ensureRateLimitAdapter } = await import('@withwiz/cms-kit/infrastructure');
    ensureRateLimitAdapter();
    expect(currentAdapter()).toBeUndefined();
  });

  it('CMS-RLA-08: 설정이 바뀌면 다음 요청에서 다시 설치하고, 같으면 그대로 둔다', async () => {
    const { setCmsConfig } = await import('@withwiz/cms-kit/config');
    const { ensureRateLimitAdapter } = await import('@withwiz/cms-kit/infrastructure');
    ensureRateLimitAdapter();
    const first = currentAdapter();
    ensureRateLimitAdapter();
    expect(currentAdapter()).toBe(first);

    setCmsConfig({ rateLimit: { limits: { api: { limit: 7, windowMs: 1_000 } } } });
    ensureRateLimitAdapter();
    expect(currentAdapter()).not.toBe(first);
    expect(currentAdapter()!.rateLimiters.api.config.limit).toBe(7);
  });

  it('CMS-RLA-09: 모듈이 다시 로드되어도(HMR) 이전 cms-kit 어댑터는 외부 어댑터로 보지 않는다', async () => {
    const first = await import('@withwiz/cms-kit/infrastructure');
    first.ensureRateLimitAdapter();
    const before = currentAdapter();

    vi.resetModules();
    const second = await import('@withwiz/cms-kit/infrastructure');
    second.ensureRateLimitAdapter();
    expect(currentAdapter()).not.toBe(before);
    expect(warnSpy.mock.calls.some((c) => String(c[0]).includes('already installed'))).toBe(false);
  });

  it('CMS-RLA-10: in-memory 기본값은 다중 인스턴스 한계를 1회 경고한다', async () => {
    const { ensureRateLimitAdapter } = await import('@withwiz/cms-kit/infrastructure');
    ensureRateLimitAdapter();
    ensureRateLimitAdapter();
    const msgs = warnSpy.mock.calls.map((c) => String(c[0])).filter((m) => m.includes('rateLimiters'));
    expect(msgs).toHaveLength(1);
    expect(msgs[0]).toMatch(/per process/);
  });

  it('CMS-RLA-11: 모든 종류를 주입하면 in-memory 경고가 없다', async () => {
    const { setCmsConfig } = await import('@withwiz/cms-kit/config');
    setCmsConfig({
      rateLimit: { rateLimiters: { api: fakeLimiter(1), auth: fakeLimiter(1), admin: fakeLimiter(1) } },
    });
    const { ensureRateLimitAdapter } = await import('@withwiz/cms-kit/infrastructure');
    ensureRateLimitAdapter();
    expect(warnSpy.mock.calls.some((c) => String(c[0]).includes('rateLimiters'))).toBe(false);
  });
});
