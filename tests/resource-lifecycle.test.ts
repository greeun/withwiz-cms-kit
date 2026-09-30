import { vi, beforeEach, afterEach } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative, resolve } from 'path';

/**
 * CMS-LC — 외부 자원 주입과 일관된 초기화 수명주기 (spec.md §4.2 / §4.3).
 *
 * db·jwt·storage·rate-limit 네 자원이 모두 §5 설정 경계로 주입되고,
 * 환경변수는 설정 경계 모듈에서만 읽으며, import 만으로는 실패하지 않는다.
 */

const SRC = resolve(__dirname, '../src');
const ADAPTER_KEY = '__withwiz_rateLimitAdapter__';
const SECRET = 'x'.repeat(40);

const ENV_KEYS = [
  'JWT_SECRET',
  'JWT_EXPIRES_IN',
  'JWT_REFRESH_TOKEN_EXPIRES_IN',
  'R2_ACCOUNT_ID',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'R2_BUCKET_NAME',
  'R2_PUBLIC_URL',
] as const;

const mockSend = vi.fn().mockResolvedValue({});
const mockS3ClientCtor = vi.fn();

vi.mock('@aws-sdk/client-s3', () => {
  class S3Client {
    send = mockSend;
    constructor(args: unknown) {
      mockS3ClientCtor(args);
    }
  }
  class PutObjectCommand {
    constructor(public args: unknown) {}
  }
  class DeleteObjectCommand {
    constructor(public args: unknown) {}
  }
  return { S3Client, PutObjectCommand, DeleteObjectCommand };
});

let saved: Record<string, string | undefined>;
let savedRateLimit: string | undefined;

beforeEach(async () => {
  vi.resetModules();
  mockSend.mockClear();
  mockS3ClientCtor.mockClear();
  saved = {};
  for (const k of ENV_KEYS) {
    saved[k] = process.env[k];
    delete process.env[k];
  }
  savedRateLimit = process.env.RATE_LIMIT_ENABLED;
  delete (globalThis as Record<string, unknown>)[ADAPTER_KEY];
  const { resetCmsConfig } = await import('@withwiz/cms-kit/config');
  resetCmsConfig();
});

afterEach(async () => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
  if (savedRateLimit === undefined) delete process.env.RATE_LIMIT_ENABLED;
  else process.env.RATE_LIMIT_ENABLED = savedRateLimit;
  delete (globalThis as Record<string, unknown>)[ADAPTER_KEY];
  const { resetCmsConfig } = await import('@withwiz/cms-kit/config');
  resetCmsConfig();
  vi.doUnmock('@withwiz/toolkit/core/auth/jwt');
});

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return sourceFiles(p);
    return /\.(ts|tsx)$/.test(name) ? [p] : [];
  });
}

/** 주석을 뺀 코드에서 NODE_ENV 이외의 `process.env` 읽기가 있는지 */
function readsNonNodeEnv(code: string): boolean {
  const stripped = code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const reads = stripped.match(/process\.env(\.[A-Za-z_]\w*|\[[^\]]*\])?/g) ?? [];
  return reads.some((r) => r !== 'process.env.NODE_ENV');
}

describe('env boundary (CMS-LC)', () => {
  it('CMS-LC-01: process.env 는 설정 경계 모듈(src/config/index.ts)에서만 읽는다 (AC-4.2.4)', () => {
    const offenders = sourceFiles(SRC)
      .filter((f) => readsNonNodeEnv(readFileSync(f, 'utf-8')))
      .map((f) => relative(SRC, f));
    expect(offenders).toEqual(['config/index.ts']);
  });

  it('CMS-LC-02: JWT 비밀·만료를 env 없이 주입하면 JWTManager 가 그 값으로 만들어진다 (AC-4.2.1)', async () => {
    const ctor = vi.fn();
    vi.doMock('@withwiz/toolkit/core/auth/jwt', () => ({
      JWTManager: class {
        constructor(config: unknown) {
          ctor(config);
        }
      },
    }));
    const { setCmsConfig } = await import('@withwiz/cms-kit/config');
    setCmsConfig({ jwt: { secret: SECRET, accessTokenExpiry: '15m', refreshTokenExpiry: '30d' } });
    const { getJWTManager } = await import('@withwiz/cms-kit/utils/jwt');
    getJWTManager();
    expect(ctor).toHaveBeenCalledWith(
      expect.objectContaining({
        secret: SECRET,
        accessTokenExpiry: '15m',
        refreshTokenExpiry: '30d',
        algorithm: 'HS256',
      }),
    );
  });

  it('CMS-LC-03: storage endpoint·publicBaseUrl 를 주입하면 Cloudflare 도메인을 만들지 않는다 (AC-4.2.2)', async () => {
    const { setCmsConfig } = await import('@withwiz/cms-kit/config');
    setCmsConfig({
      storage: {
        publicBaseUrl: 'https://media.example.com',
        r2: {
          endpoint: 'https://s3.example.com',
          accessKeyId: 'k',
          secretAccessKey: 's',
          bucketName: 'b',
        },
      },
    });
    const { uploadToR2, isR2Enabled } = await import('@withwiz/cms-kit/utils/r2-storage');
    expect(isR2Enabled()).toBe(true);
    const r = await uploadToR2('posts/a.jpg', Buffer.from('x'), 'image/jpeg');
    const ctorArgs = mockS3ClientCtor.mock.calls[0][0] as { endpoint: string; region: string; forcePathStyle?: boolean };
    const endpoint = ctorArgs.endpoint;
    expect(endpoint).toBe('https://s3.example.com');
    expect(ctorArgs.region).toBe('auto');
    expect(ctorArgs.forcePathStyle).toBe(true);
    expect(r.url).toBe('https://media.example.com/posts/a.jpg');
    expect(`${endpoint} ${r.url}`).not.toMatch(/r2\.dev|r2\.cloudflarestorage\.com/);
  });

  it('CMS-LC-07: region 을 주입하면 그 값으로 서명하고, 비밀 키가 바뀌면 클라이언트를 다시 만든다', async () => {
    const { setCmsConfig } = await import('@withwiz/cms-kit/config');
    const r2 = { endpoint: 'https://s3.example.com', region: 'ap-northeast-2', accessKeyId: 'k', secretAccessKey: 's1', bucketName: 'b' };
    setCmsConfig({ storage: { r2 } });
    const { uploadToR2 } = await import('@withwiz/cms-kit/utils/r2-storage');
    await uploadToR2('posts/a.jpg', Buffer.from('x'), 'image/jpeg');
    await uploadToR2('posts/b.jpg', Buffer.from('x'), 'image/jpeg');
    expect(mockS3ClientCtor).toHaveBeenCalledTimes(1);
    expect((mockS3ClientCtor.mock.calls[0][0] as { region: string }).region).toBe('ap-northeast-2');

    setCmsConfig({ storage: { r2: { ...r2, secretAccessKey: 's2' } } });
    await uploadToR2('posts/c.jpg', Buffer.from('x'), 'image/jpeg');
    expect(mockS3ClientCtor).toHaveBeenCalledTimes(2);
  });

  it('CMS-LC-04: endpoint 만 주입하면 공개 URL 은 path-style 로 만들고, 본문 키 추출도 같은 base 를 인정한다', async () => {
    const { setCmsConfig } = await import('@withwiz/cms-kit/config');
    setCmsConfig({
      storage: {
        inlineKeyPrefixes: ['posts/'],
        r2: { endpoint: 'https://s3.example.com/', accessKeyId: 'k', secretAccessKey: 's', bucketName: 'b' },
      },
    });
    const { uploadToR2 } = await import('@withwiz/cms-kit/utils/r2-storage');
    const r = await uploadToR2('posts/a.jpg', Buffer.from('x'), 'image/jpeg');
    expect(r.url).toBe('https://s3.example.com/b/posts/a.jpg');

    const { extractR2KeysFromHtml } = await import('@withwiz/cms-kit/utils/r2-helpers');
    expect(extractR2KeysFromHtml(`<img src="${r.url}">`)).toEqual(['posts/a.jpg']);
    expect(extractR2KeysFromHtml('<img src="https://b.r2.dev/posts/a.jpg">')).toEqual([]);
  });

  it('CMS-LC-05: legacy env 만 설정하면 이전 동작 그대로다 (AC-4.2.3)', async () => {
    process.env.R2_ACCOUNT_ID = 'acct';
    process.env.R2_ACCESS_KEY_ID = 'k';
    process.env.R2_SECRET_ACCESS_KEY = 's';
    process.env.R2_BUCKET_NAME = 'bucket';
    const { uploadToR2 } = await import('@withwiz/cms-kit/utils/r2-storage');
    const r = await uploadToR2('news/a.jpg', Buffer.from('x'), 'image/jpeg');
    const ctorArgs = mockS3ClientCtor.mock.calls[0][0] as { endpoint: string; region: string; forcePathStyle?: boolean };
    expect(ctorArgs.endpoint).toBe('https://acct.r2.cloudflarestorage.com');
    expect(ctorArgs.region).toBe('auto');
    expect(ctorArgs.forcePathStyle).toBeUndefined();
    expect(r.url).toBe('https://bucket.r2.dev/news/a.jpg');
  });

  it('CMS-LC-06: rate-limit 활성화는 주입값과 legacy env 둘 다로 제어된다 (AC-4.2.5)', async () => {
    const { setCmsConfig, resolveRateLimitEnabled } = await import('@withwiz/cms-kit/config');
    setCmsConfig({ rateLimit: { identityExtractor: () => 'id' } });

    process.env.RATE_LIMIT_ENABLED = 'false';
    expect(resolveRateLimitEnabled()).toBe(false);
    delete process.env.RATE_LIMIT_ENABLED;
    expect(resolveRateLimitEnabled()).toBe(true);

    process.env.RATE_LIMIT_ENABLED = 'false';
    setCmsConfig({ rateLimit: { enabled: true } });
    expect(resolveRateLimitEnabled()).toBe(true);
    setCmsConfig({ rateLimit: { enabled: false } });
    delete process.env.RATE_LIMIT_ENABLED;
    expect(resolveRateLimitEnabled()).toBe(false);
  });
});

describe('init lifecycle (CMS-LC)', () => {
  it('CMS-LC-10: 문서화된 경로 @withwiz/cms-kit/infrastructure 에서 setPrismaClient 를 쓸 수 있다 (AC-4.3.1, I6)', async () => {
    const infra = await import('@withwiz/cms-kit/infrastructure');
    const client = { post: { count: () => 3 } };
    infra.setPrismaClient(client);
    expect(infra.getPrisma()).toBe(client);
    expect((infra.prisma as typeof client).post.count()).toBe(3);
  });

  it('CMS-LC-11: storage 미설정 상태의 업로드·삭제는 namespaced 에러로 즉시 실패한다 (AC-4.3.3)', async () => {
    const { uploadToR2, deleteFromR2, isR2Enabled } = await import('@withwiz/cms-kit/utils/r2-storage');
    expect(isR2Enabled()).toBe(false);
    await expect(uploadToR2('a/b.jpg', Buffer.from('x'), 'image/jpeg')).rejects.toThrow(
      /@withwiz\/cms-kit: R2 credentials are missing/,
    );
    await expect(deleteFromR2('a/b.jpg')).rejects.toThrow(/@withwiz\/cms-kit:/);
    expect(mockS3ClientCtor).not.toHaveBeenCalled();
  });

  it('CMS-LC-12: 네 자원을 모두 주입하면 경고 없이 초기화되고 동작한다 (AC-4.3.4)', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const { setCmsConfig } = await import('@withwiz/cms-kit/config');
      const limiter = {
        check: async () => ({ success: true, remaining: 1, resetIn: 0 }),
        config: { limit: 1 },
      };
      setCmsConfig({
        brand: { brandLabel: 'Site', navItems: [] },
        jwt: { secret: SECRET },
        storage: {
          publicBaseUrl: 'https://media.example.com',
          r2: { accountId: 'a', accessKeyId: 'k', secretAccessKey: 's', bucketName: 'b' },
        },
        rateLimit: {
          identityExtractor: () => 'id',
          rateLimiters: { api: limiter, auth: limiter, admin: limiter },
        },
      });
      const infra = await import('@withwiz/cms-kit/infrastructure');
      infra.setPrismaClient({ ok: true });
      expect(infra.getPrisma()).toEqual({ ok: true });

      const { getJWTManager } = await import('@withwiz/cms-kit/utils/jwt');
      const jwt = getJWTManager();
      const token = await jwt.createAccessToken({ id: 'u1', email: 'u@example.com', role: 'admin' } as never);
      expect(typeof token).toBe('string');

      const { uploadToR2 } = await import('@withwiz/cms-kit/utils/r2-storage');
      await uploadToR2('posts/a.jpg', Buffer.from('x'), 'image/jpeg');
      expect(mockSend).toHaveBeenCalledTimes(1);

      infra.ensureRateLimitAdapter();
      const adapter = (globalThis as Record<string, unknown>)[ADAPTER_KEY] as {
        rateLimiters: Record<string, unknown>;
        isEnabled: () => Promise<boolean>;
      };
      expect(adapter.rateLimiters.api).toBe(limiter);

      const { resolveBrandConfig } = await import('@withwiz/cms-kit/config');
      resolveBrandConfig();
      expect(warn).not.toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
  });

  it('CMS-LC-14: 다른 번들 범위(모듈 인스턴스)에서 주입한 설정이 보인다 (instrumentation → route)', async () => {
    const instrumentation = await import('@withwiz/cms-kit/config');
    instrumentation.setCmsConfig({ storage: { publicBaseUrl: 'https://media.example.com' } });

    vi.resetModules();
    const route = await import('@withwiz/cms-kit/config');
    expect(route).not.toBe(instrumentation);
    expect(route.resolveStorageConfig().publicBaseUrl).toBe('https://media.example.com');
    expect(route.getCmsConfigVersion()).toBe(instrumentation.getCmsConfigVersion());
  });

  it('CMS-LC-15: 모듈이 다시 로드되어도 같은 미설정 경고를 반복하지 않는다', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      (await import('@withwiz/cms-kit/config')).resolveBrandConfig();
      vi.resetModules();
      (await import('@withwiz/cms-kit/config')).resolveBrandConfig();
      expect(warn).toHaveBeenCalledTimes(1);
    } finally {
      warn.mockRestore();
    }
  });

  it('CMS-LC-13: package.json 의 모든 JS subpath 는 설정·env 없이 import 해도 throw 하지 않는다 (AC-4.3.7)', async () => {
    const pkg = JSON.parse(readFileSync(resolve(__dirname, '../package.json'), 'utf-8')) as {
      exports: Record<string, unknown>;
    };
    const subpaths = Object.keys(pkg.exports).filter((k) => !k.endsWith('.css'));
    expect(subpaths.length).toBeGreaterThan(10);
    for (const sub of subpaths) {
      vi.resetModules();
      const spec = sub === '.' ? '@withwiz/cms-kit' : `@withwiz/cms-kit/${sub.slice(2)}`;
      await expect(import(/* @vite-ignore */ spec), spec).resolves.toBeTruthy();
    }
  });
});
