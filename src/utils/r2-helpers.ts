import { deleteFromR2 } from './r2-storage';
import { IMAGE_VARIANT_SIZES, type VariantSize } from './image-variant-utils';
import { logError } from '@withwiz/toolkit/core/logger/logger';
import {
  resolveR2CredentialsConfig,
  resolveR2PublicUrl,
  resolveStorageConfig,
  warnOnceMissingConfig,
} from '../config';

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
 *    권장하는 `@withwiz/cms-kit:` warn 을 1회 발행한다.
 *
 * 호스트 검증(보안): 절대 URL 은 *우리 스토리지의 공개 origin* 으로 시작할
 * 때만 key 로 인정한다. 인정되는 base 는 `storage.publicBaseUrl`, legacy
 * `R2_PUBLIC_URL`, 그리고 자격 증명에서 유도한 `https://<bucket>.r2.dev`
 * 이다. 다른 호스트를 가리키는 `<img src="https://attacker/news/x.jpg">` 는
 * 경로가 그럴듯해도 수집하지 않는다 — 그렇지 않으면 편집 권한자가 본문에
 * 외부 이미지를 넣는 것만으로 다른 글의 객체를 버킷에서 지울 수 있다.
 * 상대 경로(`/news/x.jpg`, `news/x.jpg`)는 같은 origin 으로 간주한다.
 * base 비교는 경계(`base` 자체 또는 `base/…`)를 지켜, `https://cdn.example`
 * 설정이 `https://cdn.example.evil/…` 에 매칭되지 않도록 한다.
 */

const IMG_SRC_REGEX = /<img[^>]+src=["']([^"']+)["']/gi;

const VARIANT_SUFFIXES = Object.keys(IMAGE_VARIANT_SIZES) as VariantSize[];

/** 스킴이 있는 절대 URL(또는 `//host/...` 프로토콜 상대 URL)인지. */
function isAbsoluteUrl(src: string): boolean {
  return /^[a-z][a-z0-9+.-]*:/i.test(src) || src.startsWith('//');
}

/** 경로 문자열을 leading-slash 와 query/fragment 없는 key 로 정규화. */
function normalizePath(path: string): string | null {
  const p = path.replace(/^\/+/, '').split(/[?#]/)[0];
  return p.length > 0 ? p : null;
}

/** 허용된 base 목록 (trailing slash 제거, 빈 값 제외, 중복 제거). */
function resolveAllowedBases(configuredBase: string | null): string[] {
  const bases = new Set<string>();
  const add = (b: string | null | undefined) => {
    if (typeof b === 'string' && b.trim().length > 0) {
      bases.add(b.trim().replace(/\/+$/, ''));
    }
  };
  add(configuredBase);
  add(resolveR2PublicUrl());
  const { bucketName } = resolveR2CredentialsConfig();
  if (bucketName) add(`https://${bucketName}.r2.dev`);
  return Array.from(bases);
}

/**
 * src 가 허용된 base 중 하나에 *경계를 지켜* 속하면 base 이후 경로를,
 * 아니면 null 을 돌려준다.
 */
function stripAllowedBase(src: string, bases: readonly string[]): string | null {
  for (const base of bases) {
    if (src === base) return null; // base 자체는 key 가 아님
    if (src.startsWith(base + '/') || src.startsWith(base + '?') || src.startsWith(base + '#')) {
      return normalizePath(src.slice(base.length));
    }
  }
  return null;
}

/** 한 src 가 설정된 규칙에 따라 수집 대상 key 인지 판별하고 key 를 반환. */
function srcToKey(
  src: string,
  rule: { inlineKeyPrefixes: readonly string[] | null; publicBaseUrl: string | null },
  bases: readonly string[],
): string | null {
  let path: string | null;
  if (isAbsoluteUrl(src)) {
    // 절대 URL: 우리 스토리지 origin 일 때만 인정. 외부 호스트는 무시한다.
    path = stripAllowedBase(src, bases);
  } else {
    // 상대 경로: 같은 origin 으로 간주.
    path = normalizePath(src);
  }
  if (!path) return null;
  const key = path;

  if (rule.inlineKeyPrefixes) {
    const top = key.split('/')[0] + '/';
    const matches = rule.inlineKeyPrefixes.some((p) => {
      const norm = p.endsWith('/') ? p : p + '/';
      return top === norm || key.startsWith(norm);
    });
    return matches ? key : null;
  }

  // publicBaseUrl 설정 또는 unconfigured 기본: 폴더 무관하게 수집 (no silent
  // orphaning). 호스트 검증은 위에서 이미 끝났다.
  return key;
}

export function extractR2KeysFromHtml(...htmlContents: (string | null)[]): string[] {
  const rule = resolveStorageConfig();
  const bases = resolveAllowedBases(rule.publicBaseUrl);
  if (!rule.inlineKeyPrefixes && !rule.publicBaseUrl) {
    warnOnceMissingConfig(
      'storage.inlinePrefix',
      'storage inline-image key prefix/publicBaseUrl is not configured. ' +
        'Collecting ALL inline <img> paths to avoid silently orphaning ' +
        'non-default-prefix objects. Inject `setCmsConfig({ storage: { ' +
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
      const key = srcToKey(match[1], rule, bases);
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
