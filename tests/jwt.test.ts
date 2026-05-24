import { vi, beforeEach } from 'vitest';

class MockJWTManager {
  config: any;
  constructor(config: any, _logger: any) {
    this.config = config;
    MockJWTManager.calls.push(config);
  }
  static calls: any[] = [];
  verify = vi.fn();
  sign = vi.fn();
}

vi.mock('@withwiz/toolkit/core/auth/jwt', () => ({
  JWTManager: MockJWTManager,
}));

vi.mock('@withwiz/toolkit/core/logger/logger', () => ({
  logInfo: vi.fn(),
  logError: vi.fn(),
}));

// A 32-char strong secret (exactly the documented min-length boundary).
const STRONG_SECRET_32 = 'a'.repeat(32);
const WEAK_SECRET_31 = 'a'.repeat(31);

describe('jwt 싱글턴', () => {
  beforeEach(async () => {
    vi.resetModules();
    MockJWTManager.calls = [];
    process.env.JWT_SECRET = STRONG_SECRET_32;
    delete process.env.JWT_EXPIRES_IN;
    delete process.env.JWT_REFRESH_TOKEN_EXPIRES_IN;
    const { resetPmsConfig } = await import('@withwiz/pms/config');
    resetPmsConfig();
  });

  afterEach(async () => {
    delete process.env.JWT_SECRET;
    const { resetPmsConfig } = await import('@withwiz/pms/config');
    resetPmsConfig();
  });

  it('PMS-JWT-01: 동일 인스턴스 반환 (싱글턴)', async () => {
    const { getJWTManager } = await import('@withwiz/pms/utils/jwt');
    const first = getJWTManager();
    const second = getJWTManager();
    expect(first).toBe(second);
  });

  it('PMS-JWT-02: 환경변수 기본값 적용', async () => {
    const { getJWTManager } = await import('@withwiz/pms/utils/jwt');
    getJWTManager();
    expect(MockJWTManager.calls).toHaveLength(1);
    expect(MockJWTManager.calls[0]).toMatchObject({
      secret: STRONG_SECRET_32,
      accessTokenExpiry: '2h',
      refreshTokenExpiry: '7d',
      algorithm: 'HS256',
    });
  });

  it('PMS-JWT-03: 비밀 누락/취약 → fail-fast (네임스페이스), 강한 비밀 → 동작 (revised §4.6/§4.3)', async () => {
    // (a) missing secret (no inject AND no process.env.JWT_SECRET) → throws a
    //     @withwiz/pms-namespaced Error; NO manager constructed with
    //     secret === undefined.
    delete process.env.JWT_SECRET;
    {
      const { getJWTManager } = await import('@withwiz/pms/utils/jwt');
      expect(() => getJWTManager()).toThrowError(/@withwiz\/pms/);
      const constructedUndefined = MockJWTManager.calls.some(
        (c) => c.secret === undefined,
      );
      expect(constructedUndefined).toBe(false);
      expect(MockJWTManager.calls).toHaveLength(0);
    }

    // (b) boundary: a 31-char secret is rejected (namespaced throw) while a
    //     32-char secret is accepted (constructs, no throw).
    vi.resetModules();
    MockJWTManager.calls = [];
    {
      const { resetPmsConfig, setPmsConfig } = await import('@withwiz/pms/config');
      resetPmsConfig();
      setPmsConfig({ jwt: { secret: WEAK_SECRET_31 } });
      const { getJWTManager } = await import('@withwiz/pms/utils/jwt');
      expect(() => getJWTManager()).toThrowError(/@withwiz\/pms/);
      expect(MockJWTManager.calls).toHaveLength(0);
    }
    vi.resetModules();
    MockJWTManager.calls = [];
    {
      const { resetPmsConfig, setPmsConfig } = await import('@withwiz/pms/config');
      resetPmsConfig();
      setPmsConfig({ jwt: { secret: STRONG_SECRET_32 } });
      const { getJWTManager } = await import('@withwiz/pms/utils/jwt');
      const mgr = getJWTManager();
      expect(mgr).toBeDefined();
      expect(MockJWTManager.calls).toHaveLength(1);
      expect(MockJWTManager.calls[0].secret).toBe(STRONG_SECRET_32);
    }

    // (c) a strong injected secret AND a strong legacy process.env.JWT_SECRET
    //     each construct successfully.
    vi.resetModules();
    MockJWTManager.calls = [];
    {
      const { resetPmsConfig } = await import('@withwiz/pms/config');
      resetPmsConfig();
      process.env.JWT_SECRET = STRONG_SECRET_32;
      const { getJWTManager } = await import('@withwiz/pms/utils/jwt');
      const mgr = getJWTManager();
      expect(mgr).toBeDefined();
      expect(MockJWTManager.calls[0].secret).toBe(STRONG_SECRET_32);
      delete process.env.JWT_SECRET;
    }

    // (d) failure is at point-of-use, NOT import time: importing the module
    //     with no secret must NOT throw; only calling getJWTManager() throws.
    vi.resetModules();
    MockJWTManager.calls = [];
    {
      delete process.env.JWT_SECRET;
      const { resetPmsConfig } = await import('@withwiz/pms/config');
      resetPmsConfig();
      const mod = await import('@withwiz/pms/utils/jwt'); // import must NOT throw
      expect(typeof mod.getJWTManager).toBe('function');
      expect(() => mod.getJWTManager()).toThrowError(/@withwiz\/pms/);
    }
  });
});
