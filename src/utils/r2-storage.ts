import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { logError, logInfo } from '@withwiz/toolkit/core/logger/logger';
import { namespacedError } from '../config';

/**
 * storage object key 를 검증/정규화한다 (spec.md §4.6 / Sprint 1 S5).
 *
 * caller/user 파생 key 가 의도된 namespace 를 탈출(path traversal /
 * absolute / prefix-escape)하지 못하도록 한다. 위험 key 는 `@withwiz/pms:`
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

function getClient(): S3Client {
  if (!client) {
    client = new S3Client({
      region: 'auto',
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      },
    });
  }
  return client;
}

export function isR2Enabled(): boolean {
  return !!(
    process.env.R2_ACCOUNT_ID &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY &&
    process.env.R2_BUCKET_NAME
  );
}

export async function uploadToR2(
  key: string,
  buffer: Buffer,
  contentType: string,
): Promise<{ url: string; key: string; size: number }> {
  const safeKey = sanitizeStorageKey(key);
  const s3 = getClient();
  const bucket = process.env.R2_BUCKET_NAME!;

  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: safeKey,
      Body: buffer,
      ContentType: contentType,
    }),
  );

  const publicUrl = process.env.R2_PUBLIC_URL
    ? `${process.env.R2_PUBLIC_URL}/${safeKey}`
    : `https://${bucket}.r2.dev/${safeKey}`;

  return { url: publicUrl, key: safeKey, size: buffer.length };
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

    await Promise.all(
      imageVariants.map(async (v) => {
        try {
          await uploadToR2(v.key, v.buffer, v.contentType);
          const publicUrl = process.env.R2_PUBLIC_URL
            ? `${process.env.R2_PUBLIC_URL}/${v.key}`
            : `https://${process.env.R2_BUCKET_NAME}.r2.dev/${v.key}`;
          variants[v.size] = publicUrl;
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
  await s3.send(
    new DeleteObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME!,
      Key: safeKey,
    }),
  );
}
