import type { S3Client } from '@aws-sdk/client-s3';
import { logError } from '@withwiz/toolkit/core/logger/logger';
import {
  namespacedError,
  resolveR2CredentialsConfig,
  resolveR2PublicUrl,
  resolveStorageBackend,
  type CmsStorageBackend,
} from '../config';
import type { VariantSize } from './image-variant-utils';
import { stripPathExtension } from './variant-path';

type S3Module = typeof import('@aws-sdk/client-s3');

/**
 * `@aws-sdk/client-s3` 는 기본 R2/S3 백엔드를 실제로 쓸 때만 불러온다.
 * 저장소 백엔드를 주입한 소비자는 이 의존성을 설치하지 않아도 된다 (spec.md §4.5).
 */
let s3ModulePromise: Promise<S3Module> | null = null;
function loadS3(): Promise<S3Module> {
  s3ModulePromise ??= import('@aws-sdk/client-s3').catch((err: unknown) => {
    s3ModulePromise = null;
    throw namespacedError(
      '`@aws-sdk/client-s3` could not be loaded. Install it to use the default ' +
        'R2/S3 storage, or inject `setCmsConfig({ storage: { backend } })`. ' +
        `(${err instanceof Error ? err.message : String(err)})`,
    );
  });
  return s3ModulePromise;
}

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

interface ResolvedR2Credentials {
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  /** 주입한 endpoint, 없으면 accountId 로 만든 Cloudflare R2 endpoint */
  endpoint: string;
  /** endpoint 를 직접 주입했는지 (공개 URL fallback 결정에 쓴다) */
  customEndpoint: boolean;
}

function requireR2Credentials(): ResolvedR2Credentials {
  const c = resolveR2CredentialsConfig();
  const missing: string[] = [];
  // endpoint 를 주입하면 Cloudflare endpoint 를 만들 필요가 없어 accountId 도 필요 없다.
  if (!c.accountId && !c.endpoint) missing.push('accountId (or endpoint)');
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
  return {
    accessKeyId: c.accessKeyId as string,
    secretAccessKey: c.secretAccessKey as string,
    bucketName: c.bucketName as string,
    endpoint: c.endpoint ?? `https://${c.accountId}.r2.cloudflarestorage.com`,
    customEndpoint: c.endpoint !== null,
  };
}

async function getClient(): Promise<{ s3: S3Client; mod: S3Module }> {
  const c = requireR2Credentials();
  const mod = await loadS3();
  const snapshot = `${c.endpoint}|${c.accessKeyId}`;
  if (!client || clientSnapshot !== snapshot) {
    client = new mod.S3Client({
      region: 'auto',
      endpoint: c.endpoint,
      credentials: {
        accessKeyId: c.accessKeyId,
        secretAccessKey: c.secretAccessKey,
      },
    });
    clientSnapshot = snapshot;
  }
  return { s3: client, mod };
}

/** 업로드·삭제가 가능한 상태인지 (백엔드 주입 또는 R2 자격 증명 완비). */
export function isR2Enabled(): boolean {
  if (resolveStorageBackend()) return true;
  const c = resolveR2CredentialsConfig();
  return !!(
    (c.accountId || c.endpoint) &&
    c.accessKeyId &&
    c.secretAccessKey &&
    c.bucketName
  );
}

/**
 * 업로드한 객체의 공개 URL.
 * 우선순위: `storage.publicBaseUrl` / `R2_PUBLIC_URL` > (endpoint 주입 시)
 * S3 path-style `<endpoint>/<bucket>/<key>` > Cloudflare 기본 `<bucket>.r2.dev`.
 */
function buildPublicUrl(key: string, creds: ResolvedR2Credentials): string {
  const base = resolveR2PublicUrl();
  if (base) return `${base}/${key}`;
  if (creds.customEndpoint) {
    return `${creds.endpoint.replace(/\/+$/, '')}/${creds.bucketName}/${key}`;
  }
  return `https://${creds.bucketName}.r2.dev/${key}`;
}

/** 주입된 백엔드로 만든 공개 URL. publicUrl 도 publicBaseUrl 도 없으면 실패한다. */
function backendPublicUrl(backend: CmsStorageBackend, key: string): string {
  if (typeof backend.publicUrl === 'function') return backend.publicUrl(key);
  const base = resolveR2PublicUrl();
  if (base) return `${base}/${key}`;
  throw namespacedError(
    'the injected storage backend has no publicUrl(key) and storage.publicBaseUrl ' +
      'is not configured, so the uploaded object has no public URL. Provide one of them.',
  );
}

export async function uploadToR2(
  key: string,
  buffer: Buffer,
  contentType: string,
): Promise<{ url: string; key: string; size: number }> {
  const safeKey = sanitizeStorageKey(key);

  const backend = resolveStorageBackend();
  if (backend) {
    const url = backendPublicUrl(backend, safeKey);
    await backend.put(safeKey, buffer, contentType);
    return { url, key: safeKey, size: buffer.length };
  }

  const { s3, mod } = await getClient();
  const creds = requireR2Credentials();

  await s3.send(
    new mod.PutObjectCommand({
      Bucket: creds.bucketName,
      Key: safeKey,
      Body: buffer,
      ContentType: contentType,
    }),
  );

  return { url: buildPublicUrl(safeKey, creds), key: safeKey, size: buffer.length };
}

export interface ImageVariantUrls {
  lg?: string;
  md?: string;
  sm?: string;
  thumb?: string;
}

/**
 * 변형 이미지 처리 결과.
 *  - `complete`: 만든 변형을 모두 올렸다.
 *  - `partial`: 일부 변형 업로드가 실패했다 (`failedVariants` 에 크기 목록).
 *  - `failed`: 변형 생성이 실패했거나, 만든 변형을 하나도 올리지 못했다.
 *  - `skipped`: 만들 변형이 없다 (GIF 등). 실패가 아니다.
 * 원본 업로드가 실패하면 결과를 돌려주지 않고 예외를 던진다.
 */
export type VariantUploadStatus = 'complete' | 'partial' | 'failed' | 'skipped';

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
  /** 변형 처리 결과. `complete`/`skipped` 가 아니면 일부 변형이 없다. */
  variantStatus: VariantUploadStatus;
  /** 업로드에 실패한 변형 크기 */
  failedVariants: VariantSize[];
}> {
  const { generateImageVariants } = await import('./image-variants');

  const original = await uploadToR2(originalKey, originalBuffer, originalContentType);

  // 확장자는 마지막 세그먼트에서만 지운다 (getVariantKeys 와 같은 규칙).
  const baseKey = stripPathExtension(originalKey);

  const variants: ImageVariantUrls = {};
  const variantKeys: string[] = [];
  const failedVariants: VariantSize[] = [];
  let variantStatus: VariantUploadStatus;

  try {
    const imageVariants = await generateImageVariants(originalBuffer, baseKey, originalContentType);

    await Promise.all(
      imageVariants.map(async (v) => {
        try {
          const uploaded = await uploadToR2(v.key, v.buffer, v.contentType);
          variants[v.size] = uploaded.url;
          variantKeys.push(uploaded.key);
        } catch (err) {
          failedVariants.push(v.size);
          logError(`[image-variant] Failed to upload variant ${v.key}`, {
            error: err instanceof Error ? err.message : err,
            originalKey,
            size: v.size,
          });
        }
      }),
    );

    if (imageVariants.length === 0) {
      variantStatus = 'skipped';
    } else if (failedVariants.length === 0) {
      variantStatus = 'complete';
    } else if (variantKeys.length > 0) {
      variantStatus = 'partial';
    } else {
      variantStatus = 'failed';
      logError(`[image-variant] No variants uploaded for ${originalKey}`);
    }
  } catch (err) {
    variantStatus = 'failed';
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
    variantStatus,
    failedVariants,
  };
}

export async function deleteFromR2(key: string): Promise<void> {
  const safeKey = sanitizeStorageKey(key);

  const backend = resolveStorageBackend();
  if (backend) {
    await backend.delete(safeKey);
    return;
  }

  const { s3, mod } = await getClient();
  const { bucketName: bucket } = requireR2Credentials();
  await s3.send(
    new mod.DeleteObjectCommand({
      Bucket: bucket,
      Key: safeKey,
    }),
  );
}
