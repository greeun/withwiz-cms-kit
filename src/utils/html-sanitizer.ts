/**
 * 서버사이드 HTML 새니타이저 (spec.md §4.6 / Sprint 1 S1).
 *
 * 위험한 요소(script, iframe, object 등)와 이벤트 핸들러 속성을 제거하면서
 * 블록 에디터가 사용하는 안전한 HTML 구조를 보존한다.
 *
 * - 1차(기본): `isomorphic-dompurify` (실제 jsdom+DOMPurify DOM/parser
 *   allowlist 새니타이저 — 손수 만든 regex 가 아님). 동적으로 로드한다.
 * - fallback: regex 기반 새니타이저는 *방어 심층(defense-in-depth)* 으로만
 *   남겨둔다 (optional dep 미설치 시). 더 이상 1차 경로가 아니다.
 * - `createSanitizer(config)` 로 신뢰 iframe origin 을 주입할 수 있다.
 *
 * `sanitizeHtmlContent` 는 하위 호환을 위해 기본 안전 설정으로 동작한다
 * (I1 — 동일 이름, 동일 `string|null|undefined → string|null` 시그니처).
 * 기본 신뢰 iframe origin 은 §5 config boundary 를 통해 consumer 가
 * override 할 수 있고, 미설정 시 현재 YouTube/Vimeo 집합이 그대로 쓰인다
 * (unconfigured 동작 불변 — I3 보호).
 *
 * `../../withwiz-blog-core/src/utils/html-sanitizer.ts` 와 *메커니즘 동일*
 * (`createSanitizer` factory + `tryLoadDomPurify()` 동적 require +
 * `uponSanitizeElement` iframe-origin hook + regex defense-in-depth fallback).
 */

import { resolveTrustedIframeOrigins } from '../config';

// ── 정규식 패턴 (defense-in-depth fallback 전용) ──

/** 항상 제거할 태그 (내용 포함) */
const STRIP_TAGS_WITH_CONTENT =
  /(<\s*\/?\s*(script|object|embed|applet|form|input|textarea|select|button)\b[^>]*>)/gi;

/** 신뢰되지 않는 iframe 매칭 */
const UNTRUSTED_IFRAME = /<\s*iframe\b[^>]*>[\s\S]*?<\s*\/\s*iframe\s*>/gi;

/** script/style 태그 사이 콘텐츠 */
const STRIP_TAG_CONTENT = /<\s*(script|style)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi;

/** 이벤트 핸들러 속성 (onclick, onerror, onload 등) */
const EVENT_HANDLER_ATTRS = /\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*)/gi;

/** 위험한 URL 프로토콜 (href/src 속성 내) */
const DANGEROUS_PROTOCOL =
  /(href|src|action)\s*=\s*["']\s*(javascript|vbscript|data\s*:(?!image\/))[^"']*["']/gi;

// ── 설정 인터페이스 ──

/** 새니타이저 설정 */
export interface SanitizerConfig {
  /**
   * 신뢰할 수 있는 iframe origin 목록 (prefix 매칭).
   * 미지정 시 §5 config boundary 의 기본값(YouTube/Vimeo) 사용.
   */
  trustedIframeOrigins?: readonly string[];
  /** DOMPurify 사용 시 허용할 태그 화이트리스트. */
  allowedTags?: string[];
  /** DOMPurify 사용 시 허용할 속성 화이트리스트. */
  allowedAttributes?: Record<string, string[]>;
}

// ── DOMPurify 동적 로딩 (선택적 / 실제 사용되는 1차 경로) ──

type DOMPurifyLike = {
  sanitize: (dirty: string, options?: Record<string, unknown>) => string;
};

let cachedDomPurify: DOMPurifyLike | null | undefined;

/**
 * 선택적 의존성 `isomorphic-dompurify` (실제 DOM allowlist 새니타이저) 를
 * 동기적으로 로드한다. 설치되지 않았거나 로드 실패 시에만 null 을 반환하고,
 * 호출자는 regex defense-in-depth fallback 을 쓴다.
 */
function tryLoadDomPurify(): DOMPurifyLike | null {
  if (cachedDomPurify !== undefined) return cachedDomPurify;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('isomorphic-dompurify') as unknown;
    const candidate =
      (mod as { default?: DOMPurifyLike }).default ?? (mod as DOMPurifyLike);
    if (candidate && typeof candidate.sanitize === 'function') {
      cachedDomPurify = candidate;
      return candidate;
    }
  } catch {
    // 모듈 미설치 — regex fallback 사용
  }
  cachedDomPurify = null;
  return null;
}

// ── 정규식 기반 새니타이저 (defense-in-depth fallback) ──

function regexSanitize(html: string, trustedOrigins: readonly string[]): string {
  let result = html;

  // 1. script/style 태그 사이 콘텐츠 제거
  result = result.replace(STRIP_TAG_CONTENT, '');

  // 2. 위험한 태그 제거
  result = result.replace(STRIP_TAGS_WITH_CONTENT, '');

  // 2b. 신뢰되지 않는 iframe 제거 (신뢰 origin 유지)
  result = result.replace(UNTRUSTED_IFRAME, (match) => {
    const srcMatch = match.match(/\bsrc\s*=\s*["']([^"']+)["']/i);
    if (srcMatch) {
      const src = srcMatch[1].trim();
      if (trustedOrigins.some((origin) => src.startsWith(origin))) {
        return match;
      }
    }
    return '';
  });

  // 3. 이벤트 핸들러 속성 제거
  result = result.replace(EVENT_HANDLER_ATTRS, '');

  // 4. 위험한 URL 프로토콜 무력화
  result = result.replace(DANGEROUS_PROTOCOL, '$1=""');

  return result;
}

// ── DOMPurify 기반 새니타이저 (1차 경로) ──

function dompurifySanitize(
  html: string,
  purify: DOMPurifyLike,
  trustedOrigins: readonly string[],
  config: SanitizerConfig,
): string {
  const options: Record<string, unknown> = {
    // iframe 은 hook 에서 origin 검증 후 허용
    ADD_TAGS: ['iframe'],
    ADD_ATTR: ['allowfullscreen', 'frameborder', 'allow'],
    FORBID_TAGS: [
      'script',
      'object',
      'embed',
      'applet',
      'form',
      'input',
      'textarea',
      'select',
      'button',
      'style',
    ],
    FORBID_ATTR: [
      'onerror',
      'onload',
      'onclick',
      'onmouseover',
      'onfocus',
      'onblur',
    ],
  };

  if (config.allowedTags) options.ALLOWED_TAGS = config.allowedTags;
  if (config.allowedAttributes) {
    const flat = new Set<string>();
    for (const attrs of Object.values(config.allowedAttributes)) {
      for (const a of attrs) flat.add(a);
    }
    options.ALLOWED_ATTR = Array.from(flat);
  }

  const purifyWithHook = purify as DOMPurifyLike & {
    addHook?: (hook: string, cb: (node: Element) => void) => void;
    removeHook?: (hook: string) => void;
  };
  if (typeof purifyWithHook.addHook === 'function') {
    purifyWithHook.addHook('uponSanitizeElement', (node) => {
      if (node.nodeName && node.nodeName.toLowerCase() === 'iframe') {
        const src = (node as Element).getAttribute?.('src') ?? '';
        const trusted = trustedOrigins.some((origin) =>
          src.startsWith(origin),
        );
        if (!trusted) {
          (node as Element).remove?.();
        }
      }
    });
  }
  try {
    return purify.sanitize(html, options);
  } finally {
    if (typeof purifyWithHook.removeHook === 'function') {
      purifyWithHook.removeHook('uponSanitizeElement');
    }
  }
}

// ── Public API ──

/**
 * 새니타이저 팩토리.
 *
 * DOMPurify(isomorphic-dompurify) 가 설치되어 있으면 그것을 *1차* 로 사용하고,
 * 없을 때만 regex defense-in-depth fallback 으로 동작한다.
 *
 * @example
 * const sanitize = createSanitizer({
 *   trustedIframeOrigins: ['https://www.youtube.com/', 'https://www.loom.com/'],
 * });
 * const safe = sanitize(userHtml);
 */
export function createSanitizer(
  config: SanitizerConfig = {},
): (html: string | null | undefined) => string | null {
  return function sanitize(html: string | null | undefined): string | null {
    if (!html) return html as string | null;
    // 신뢰 origin 은 point-of-use 에서 §5 boundary 를 통해 해석한다
    // (lazy — import 시점에 config 가 없어도 throw 하지 않음).
    const trustedOrigins =
      config.trustedIframeOrigins ?? resolveTrustedIframeOrigins();
    const purify = tryLoadDomPurify();
    if (purify) {
      return dompurifySanitize(html, purify, trustedOrigins, config);
    }
    return regexSanitize(html, trustedOrigins);
  };
}

/**
 * 리치 HTML 콘텐츠에서 위험한 요소와 속성을 제거한다.
 * 기본 안전 설정으로 동작한다 (하위 호환, I1). 호스트별 신뢰 origin 확장은
 * `createSanitizer({ trustedIframeOrigins: [...] })` 또는 §5
 * `setPmsConfig({ sanitizer: { trustedIframeOrigins } })` 로 한다.
 */
export function sanitizeHtmlContent(
  html: string | null | undefined,
): string | null {
  return defaultSanitize(html);
}

/** 모듈 로드 시점에 1회 만들어지는 기본 새니타이저 (실행은 lazy). */
const defaultSanitize = createSanitizer();
