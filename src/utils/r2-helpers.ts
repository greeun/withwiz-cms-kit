import { deleteFromR2 } from './r2-storage';
import { IMAGE_VARIANT_SIZES, type VariantSize } from './image-variant-utils';
import { logError } from '@withwiz/toolkit/core/logger/logger';
import { resolveStorageConfig, warnOnceMissingConfig } from '../config';

/**
 * inline `<img>` 에서 R2/storage key 를 추출한다 (spec.md §4.1 C3 /
 * orphan-bug fix).
 *
 * 더 이상 `news/` prefix 만 매칭하지 않는다. prefix 규칙은 §5 config
 * boundary 를 통해 주입된다:
 *
 *  - `storage.publicBaseUrl` 설정 시: 그 base/origin 으로 시작하는 모든
 *    `<img src>` 의 path 가 폴더 무관하게 key 로 수집된다.
 *  - `storage.inlineKeyPrefixes` 설정 시: path 의 최상위 세그먼트가 목록에
 *    있는 key 만 수집된다 (예: `['news/', 'performances/', 'artists/']`).
 *  - 미설정(unconfigured) 기본값: 어떤 prefix 도 *silently drop 하지 않는다*.
 *    하드코딩 `news/`-only regex 와 달리 모든 inline 이미지의 host 이후
 *    path 를 수집한다 (orphan 방지). 정밀 cleanup 을 위해 prefix/base 설정을
 *    권장하는 `@withwiz/pms:` warn 을 1회 발행한다.
 */

const IMG_SRC_REGEX = /<img[^>]+src=["']([^"']+)["']/gi;

const VARIANT_SUFFIXES = Object.keys(IMAGE_VARIANT_SIZES) as VariantSize[];

/** URL/문자열에서 scheme+host 를 제거한 path(leading-slash 없음)를 얻는다. */
function toRelativePath(src: string): string | null {
  let path: string;
  try {
    // 절대 URL: origin 제거
    const u = new URL(src);
    path = u.pathname;
  } catch {
    // 상대 경로: 그대로
    path = src;
  }
  path = path.replace(/^\/+/, '').split(/[?#]/)[0];
  return path.length > 0 ? path : null;
}

/** 한 src 가 설정된 규칙에 따라 수집 대상 key 인지 판별하고 key 를 반환. */
function srcToKey(
  src: string,
  rule: { inlineKeyPrefixes: readonly string[] | null; publicBaseUrl: string | null },
): string | null {
  if (rule.publicBaseUrl) {
    const base = rule.publicBaseUrl.replace(/\/+$/, '');
    if (!src.startsWith(base + '/') && !src.startsWith(base)) return null;
    const after = src.slice(base.length).replace(/^\/+/, '').split(/[?#]/)[0];
    return after.length > 0 ? after : null;
  }

  const path = toRelativePath(src);
  if (!path) return null;

  if (rule.inlineKeyPrefixes) {
    const top = path.split('/')[0] + '/';
    const matches = rule.inlineKeyPrefixes.some((p) => {
      const norm = p.endsWith('/') ? p : p + '/';
      return top === norm || path.startsWith(norm);
    });
    return matches ? path : null;
  }

  // unconfigured default: collect every plausible inline storage key (no
  // silent orphaning). A path with at least one segment qualifies.
  return path;
}

export function extractR2KeysFromHtml(...htmlContents: (string | null)[]): string[] {
  const rule = resolveStorageConfig();
  if (!rule.inlineKeyPrefixes && !rule.publicBaseUrl) {
    warnOnceMissingConfig(
      'storage.inlinePrefix',
      'storage inline-image key prefix/publicBaseUrl is not configured. ' +
        'Collecting ALL inline <img> paths to avoid silently orphaning ' +
        'non-default-prefix objects. Inject `setPmsConfig({ storage: { ' +
        'inlineKeyPrefixes } })` or `{ storage: { publicBaseUrl } }` for ' +
        'precise R2 cleanup.',
    );
  }

  const keys: string[] = [];
  for (const html of htmlContents) {
    if (!html) continue;
    const regex = new RegExp(IMG_SRC_REGEX.source, IMG_SRC_REGEX.flags);
    let match: RegExpExecArray | null;
    while ((match = regex.exec(html)) !== null) {
      const key = srcToKey(match[1], rule);
      if (key) keys.push(key);
    }
  }
  return keys;
}

export function getVariantKeys(key: string): string[] {
  const baseKey = key.replace(/\.[^.]+$/, '');
  return VARIANT_SUFFIXES.map((suffix) => `${baseKey}-${suffix}.webp`);
}

export function collectR2Keys(primaryKey: string | null, ...htmlContents: (string | null)[]): string[] {
  const keys: string[] = [];
  if (primaryKey) {
    keys.push(primaryKey);
    keys.push(...getVariantKeys(primaryKey));
  }
  const inlineKeys = extractR2KeysFromHtml(...htmlContents);
  for (const ik of inlineKeys) {
    keys.push(ik);
    keys.push(...getVariantKeys(ik));
  }
  return [...new Set(keys)];
}

export { getVariantUrl } from './image-variant-utils';

export async function deleteR2Keys(keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  await Promise.allSettled(
    keys.map((key) =>
      deleteFromR2(key).catch((err) =>
        logError(`Failed to delete ${key} from R2`, { error: err instanceof Error ? err.message : err }),
      ),
    ),
  );
}
