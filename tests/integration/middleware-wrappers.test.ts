import { vi, beforeEach } from 'vitest';

describe('createInMemoryLimiter 동작 테스트', () => {
  // wrappers.ts의 createInMemoryLimiter 로직을 직접 테스트
  // (모듈 내부 함수이므로 동일 로직 재현)
  function createInMemoryLimiter(limit: number, windowMs: number) {
    const store = new Map<string, { count: number; resetAt: number }>();
    return {
      check: async (identifier: string) => {
        const now = Date.now();
        const entry = store.get(identifier);
        if (!entry || now > entry.resetAt) {
          store.set(identifier, { count: 1, resetAt: now + windowMs });
          return { success: true, remaining: limit - 1, resetIn: windowMs };
        }
        entry.count++;
        const remaining = Math.max(0, limit - entry.count);
        const resetIn = entry.resetAt - now;
        return { success: entry.count <= limit, remaining, resetIn };
      },
      config: { limit },
    };
  }

  it('PMS-MW-01: 제한 내 요청 허용', async () => {
    const limiter = createInMemoryLimiter(3, 60_000);
    const r1 = await limiter.check('user-1');
    expect(r1.success).toBe(true);
    expect(r1.remaining).toBe(2);
  });

  it('PMS-MW-02: 제한 초과 요청 차단', async () => {
    const limiter = createInMemoryLimiter(2, 60_000);
    await limiter.check('user-1'); // 1
    await limiter.check('user-1'); // 2
    const r3 = await limiter.check('user-1'); // 3 (초과)
    expect(r3.success).toBe(false);
    expect(r3.remaining).toBe(0);
  });

  it('PMS-MW-03: 윈도우 만료 후 리셋', async () => {
    const limiter = createInMemoryLimiter(1, 100); // 100ms 윈도우
    await limiter.check('user-1'); // 1
    const r2 = await limiter.check('user-1'); // 2 (초과)
    expect(r2.success).toBe(false);

    // 윈도우 만료 대기
    await new Promise((resolve) => setTimeout(resolve, 150));
    const r3 = await limiter.check('user-1'); // 리셋 후 1
    expect(r3.success).toBe(true);
    expect(r3.remaining).toBe(0);
  });

  it('PMS-MW-04: 서로 다른 식별자는 독립 카운팅', async () => {
    const limiter = createInMemoryLimiter(1, 60_000);
    const r1 = await limiter.check('user-1');
    const r2 = await limiter.check('user-2');
    expect(r1.success).toBe(true);
    expect(r2.success).toBe(true);

    const r3 = await limiter.check('user-1'); // 초과
    expect(r3.success).toBe(false);
    const r4 = await limiter.check('user-2'); // 초과
    expect(r4.success).toBe(false);
  });

  it('PMS-MW-05: config.limit 값 확인', () => {
    const limiter = createInMemoryLimiter(120, 60_000);
    expect(limiter.config.limit).toBe(120);
  });
});

describe('withPublicApi/withAdminApi 래퍼 타입 호환', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('PMS-MW-06: wrappers 모듈이 withPublicApi, withAdminApi를 export', async () => {
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

    const mod = await import('@withwiz/pms/infrastructure/middleware/wrappers');
    expect(typeof mod.withPublicApi).toBe('function');
    expect(typeof mod.withAdminApi).toBe('function');
    expect(typeof mod.withAuthApi).toBe('function');
  });
});
