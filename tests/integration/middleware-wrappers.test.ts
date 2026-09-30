import { vi, beforeEach } from 'vitest';

const ADAPTER_KEY = '__withwiz_rateLimitAdapter__';

type Limiter = {
  check: (id: string) => Promise<{ success: boolean; remaining: number; resetIn: number }>;
  config: { limit: number };
};

/**
 * 실제 wrappers 모듈이 설치하는 in-memory limiter 를 꺼낸다 (spec.md §0.2:
 * 로직을 테스트 안에서 재구현하지 않고 모듈의 주입 경계를 거친다).
 */
async function builtinLimiter(limit: number, windowMs: number): Promise<Limiter> {
  vi.resetModules();
  delete (globalThis as Record<string, unknown>)[ADAPTER_KEY];
  const { setCmsConfig, resetCmsConfig } = await import('@withwiz/cms-kit/config');
  resetCmsConfig();
  setCmsConfig({ rateLimit: { limits: { api: { limit, windowMs } } } });
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  try {
    const { ensureRateLimitAdapter } = await import(
      '@withwiz/cms-kit/infrastructure/middleware/wrappers'
    );
    ensureRateLimitAdapter();
  } finally {
    warn.mockRestore();
  }
  const adapter = (globalThis as Record<string, unknown>)[ADAPTER_KEY] as {
    rateLimiters: Record<string, Limiter>;
  };
  return adapter.rateLimiters.api;
}

describe('createInMemoryLimiter 동작 테스트', () => {
  // wrappers.ts 가 설치하는 실제 in-memory limiter 를 설정 경계로 만들어 검증한다.
  const createInMemoryLimiter = builtinLimiter;

  it('CMS-MW-01: 제한 내 요청 허용', async () => {
    const limiter = await createInMemoryLimiter(3, 60_000);
    const r1 = await limiter.check('user-1');
    expect(r1.success).toBe(true);
    expect(r1.remaining).toBe(2);
  });

  it('CMS-MW-02: 제한 초과 요청 차단', async () => {
    const limiter = await createInMemoryLimiter(2, 60_000);
    await limiter.check('user-1'); // 1
    await limiter.check('user-1'); // 2
    const r3 = await limiter.check('user-1'); // 3 (초과)
    expect(r3.success).toBe(false);
    expect(r3.remaining).toBe(0);
  });

  it('CMS-MW-03: 윈도우 만료 후 리셋', async () => {
    const limiter = await createInMemoryLimiter(1, 100); // 100ms 윈도우
    await limiter.check('user-1'); // 1
    const r2 = await limiter.check('user-1'); // 2 (초과)
    expect(r2.success).toBe(false);

    // 윈도우 만료 대기
    await new Promise((resolve) => setTimeout(resolve, 150));
    const r3 = await limiter.check('user-1'); // 리셋 후 1
    expect(r3.success).toBe(true);
    expect(r3.remaining).toBe(0);
  });

  it('CMS-MW-04: 서로 다른 식별자는 독립 카운팅', async () => {
    const limiter = await createInMemoryLimiter(1, 60_000);
    const r1 = await limiter.check('user-1');
    const r2 = await limiter.check('user-2');
    expect(r1.success).toBe(true);
    expect(r2.success).toBe(true);

    const r3 = await limiter.check('user-1'); // 초과
    expect(r3.success).toBe(false);
    const r4 = await limiter.check('user-2'); // 초과
    expect(r4.success).toBe(false);
  });

  it('CMS-MW-05: config.limit 값 확인', async () => {
    const limiter = await createInMemoryLimiter(120, 60_000);
    expect(limiter.config.limit).toBe(120);
  });
});

describe('withPublicApi/withAdminApi 래퍼 타입 호환', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('CMS-MW-06: wrappers 모듈이 withPublicApi, withAdminApi를 export', async () => {
    // toolkit 의존성 mock
    vi.doMock('@withwiz/toolkit/next/middleware/wrappers', () => ({
      withPublicApi: vi.fn((handler: any) => handler),
      withAdminApi: vi.fn((handler: any) => handler),
      withAuthApi: vi.fn((handler: any) => handler),
      withCustomApi: vi.fn((handler: any) => handler),
    }));

    vi.doMock('@withwiz/toolkit/next/middleware/rate-limit', () => ({
      setRateLimitAdapter: vi.fn(),
    }));

    const mod = await import('@withwiz/cms-kit/infrastructure/middleware/wrappers');
    expect(typeof mod.withPublicApi).toBe('function');
    expect(typeof mod.withAdminApi).toBe('function');
    expect(typeof mod.withAuthApi).toBe('function');
  });
});
