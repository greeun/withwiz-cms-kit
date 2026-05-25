import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { logError, logInfo } from '@withwiz/toolkit/core/logger/logger';
import {
  namespacedError,
  resolveR2CredentialsConfig,
  resolveR2PublicUrl,
} from '../config';

/**
 * storage object key 를 검증/정규화한다 (spec.md §4.6 / Sprint 1 S5).
 *
 * caller/user 파생 key 가 의도된 namespace 를 탈출(path traversal /
 * absolute / prefix-escape)하지 못하도록 한다. 위험 key 는 `@withwiz/cms-kit:`
 * 네임스페이스 에러로 즉시 거부한다. 양성(benign) key 는 *바이트 동일하게*
 * 통과시킨다 (blanket reject 아님 — 정규화로 인한 mangling 없음).
 *
 * 거부 규칙:
 *  - 빈 값 / 비문자열
 *  - 선행 `/` (절대/leading-slash: `/absolute`, `/news/x.jpg`)
 *  - 백슬래시 포함 (`\` — 윈도우식 절대/우회)
 *  - 제어문자 (codepoint < 0x20)
 *  - `.` / `..` path 세그먼트 (`../`, `a/../../b`, `news/../../secret`)
 */
export function sanitizeStorageKey(key: string): string {
  if (typeof key !== 'string' || key.length === 0) {
    throw namespacedError(
      `storage key is empty or not a string; refusing to send to storage.`,
    );
  }
  if (key.startsWith('/')) {
    throw namespacedError(
      `storage key "${key}" is absolute / leading-slash; it could escape the ` +
        `intended namespace. Use a relative key (e.g. "news/x.jpg").`,
    );
  }
  if (key.includes('\\')) {
    throw namespacedError(
      `storage key "${key}" contains a backslash; refusing (namespace-escape risk).`,
    );
  }
  for (let i = 0; i < key.length; i++) {
    if (key.charCodeAt(i) < 0x20) {
      throw namespacedError(
        `storage key contains control characters; refusing (namespace-escape risk).`,
      );
    }
  }
  const segments = key.split('/');
  if (segments.some((seg) => seg === '..' || seg === '.')) {
    throw namespacedError(
      `storage key "${key}" contains a path-traversal segment ("." / ".."); ` +
        `it could escape the intended namespace.`,
    );
  }
  // benign key: byte-identical passthrough.
  return key;
}

let client: S3Client | null = null;
// 자격증명/엔드포인트가 바뀌면 캐시된 S3Client 를 무효화하기 위한 스냅샷.
// 같은 프로세스 내에서 `setCmsConfig` 가 재호출되거나 R2_* env 가 바뀐 경우
// 다음 호출에서 새 클라이언트가 만들어진다.
let clientSnapshot: string | null = null;

function requireR2Credentials(): {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
} {
  const c = resolveR2CredentialsConfig();
  const missing: string[] = [];
  if (!c.accountId) missing.push('accountId');
  if (!c.accessKeyId) missing.push('accessKeyId');
  if (!c.secretAccessKey) missing.push('secretAccessKey');
  if (!c.bucketName) missing.push('bucketName');
  if (missing.length > 0) {
    throw namespacedError(
      `R2 credentials are missing: ${missing.join(', ')}. ` +
        'Inject `setCmsConfig({ storage: { r2: { accountId, accessKeyId, secretAccessKey, bucketName } } })` ' +
        'or set the legacy R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY / R2_BUCKET_NAME ' +
        'environment variables. There is no safe default for storage credentials.',
    );
  }
  return c as {
    accountId: string;
    accessKeyId: string;
    secretAccessKey: string;
    bucketName: string;
  };
}

function getClient(): S3Client {
  const c = requireR2Credentials();
  const snapshot = `${c.accountId}|${c.accessKeyId}`;
  if (!client || clientSnapshot !== snapshot) {
    client = new S3Client({
      region: 'auto',
      endpoint: `https://${c.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: c.accessKeyId,
        secretAccessKey: c.secretAccessKey,
      },
    });
    clientSnapshot = snapshot;
  }
  return client;
}

export function isR2Enabled(): boolean {
  const c = resolveR2CredentialsConfig();
  return !!(c.accountId && c.accessKeyId && c.secretAccessKey && c.bucketName);
}

function buildPublicUrl(key: string, bucket: string): string {
  const base = resolveR2PublicUrl();
  return base ? `${base}/${key}` : `https://${bucket}.r2.dev/${key}`;
}

export async function uploadToR2(
  key: string,
  buffer: Buffer,
  contentType: string,
): Promise<{ url: string; key: string; size: number }> {
  const safeKey = sanitizeStorageKey(key);
  const s3 = getClient();
  const { bucketName: bucket } = requireR2Credentials();

  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: safeKey,
      Body: buffer,
      ContentType: contentType,
    }),
  );

  return { url: buildPublicUrl(safeKey, bucket), key: safeKey, size: buffer.length };
}

export interface ImageVariantUrls {
  lg?: string;
  md?: string;
  sm?: string;
  thumb?: string;
}

export async function uploadImageWithVariants(
  originalKey: string,
  originalBuffer: Buffer,
  originalContentType: string,
): Promise<{
  url: string;
  key: string;
  size: number;
  variants: ImageVariantUrls;
  variantKeys: string[];
}> {
  const { generateImageVariants } = await import('./image-variants');

  const original = await uploadToR2(originalKey, originalBuffer, originalContentType);

  const baseKey = originalKey.replace(/\.[^.]+$/, '');

  const variants: ImageVariantUrls = {};
  const variantKeys: string[] = [];

  try {
    const imageVariants = await generateImageVariants(originalBuffer, baseKey, originalContentType);
    const { bucketName: bucket } = requireR2Credentials();

    await Promise.all(
      imageVariants.map(async (v) => {
        try {
          await uploadToR2(v.key, v.buffer, v.contentType);
          variants[v.size] = buildPublicUrl(v.key, bucket);
          variantKeys.push(v.key);
        } catch (err) {
          logError(`[image-variant] Failed to upload variant ${v.key}`, {
            error: err instanceof Error ? err.message : err,
            originalKey,
            size: v.size,
          });
        }
      }),
    );

    if (variantKeys.length === 0) {
      logError(`[image-variant] No variants generated for ${originalKey}`);
    }
  } catch (err) {
    logError(`[image-variant] Failed to generate variants for ${originalKey}`, {
      error: err instanceof Error ? err.message : err,
    });
  }

  return {
    url: original.url,
    key: original.key,
    size: original.size,
    variants,
    variantKeys,
  };
}

export async function deleteFromR2(key: string): Promise<void> {
  const safeKey = sanitizeStorageKey(key);
  const s3 = getClient();
  const { bucketName: bucket } = requireR2Credentials();
  await s3.send(
    new DeleteObjectCommand({
      Bucket: bucket,
      Key: safeKey,
    }),
  );
}
