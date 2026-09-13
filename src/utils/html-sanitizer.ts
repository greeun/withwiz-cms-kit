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
 *   단, 번들러가 `require` 를 항상 실패하는 stub 으로 바꾸는 환경(Next.js
 *   Turbopack 서버 번들 등)에서는 동적 로딩이 실패해 이 경로로 동작하므로,
 *   호스트는 `createSanitizer({ purify: DOMPurify })` 로 인스턴스를 주입한다.
 * - `createSanitizer(config)` 로 신뢰 iframe origin 과 DOMPurify 인스턴스를
 *   주입할 수 있다 (`purify: null` 은 정규식 경로 강제).
 * - 두 경로 모두 블록 에디터 데이터 주석(`<!-- abe-blocks:... -->` 등)을
 *   원문 그대로 보존한다.
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

/** script/style 태그 사이 콘텐츠 */
const STRIP_TAG_CONTENT = /<\s*(script|style)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi;

// 아래 패턴은 HTML 토크나이저 규칙을 따른다. 속성 정리는 태그 마크업 안에서만
// 하므로, 태그·주석·텍스트의 경계가 브라우저와 어긋나면 속성이 따옴표 값 안에
// 숨는다. 그래서 공백은 `\s` 가 아니라 HTML 공백(tab, LF, FF, CR, space)만 인정한다.
const HTML_WS = '[\\t\\n\\f\\r ]';
const ATTR_NAME = '(?:=[^\\t\\n\\f\\r />=]*|[^\\t\\n\\f\\r />=]+)';
const ATTR_VALUE = `(?:"[^"]*"|'[^']*'|[^\\t\\n\\f\\r >]*)`;

/**
 * 마크업 토큰을 왼쪽부터 브라우저와 같은 규칙으로 끊는다.
 * 1 주석(`<!-->`·`<!--->` 비정상 종료와 `--!>` 포함), 2 CDATA 시작,
 * 3 bogus 주석(`<!x`, `<?x`, `</1`), 4 끝 태그 표시 `/`, 5 태그 이름,
 * 6 속성 영역, 7 닫는 `>`(입력 끝이면 빈 문자열).
 * 따옴표로 감싼 속성값 안의 `>` 는 태그 끝으로 보지 않는다.
 */
const MARKUP = new RegExp(
  [
    '(<!--(?:-?>|[\\s\\S]*?(?:--!?>|$)))',
    '(<!\\[CDATA\\[)',
    '(<[!?][^>]*>?|<\\/(?![a-zA-Z])[^>]*>?)',
    `<(\\/?)([a-zA-Z][^\\t\\n\\f\\r />]*)((?:[\\t\\n\\f\\r /]+|${ATTR_NAME}(?:${HTML_WS}*=${HTML_WS}*${ATTR_VALUE})?)*)(>?)`,
  ].join('|'),
  'g',
);

/** 속성 영역 안의 속성 하나 (1 이름, 2 값 원문 — 값이 없으면 undefined) */
const ATTR_TOKEN = new RegExp(
  `(${ATTR_NAME})(?:${HTML_WS}*=${HTML_WS}*(${ATTR_VALUE}))?`,
  'g',
);

/** 값을 위험 프로토콜로 판정할 URL 속성 */
const URL_ATTR_NAMES: ReadonlySet<string> = new Set([
  'href',
  'src',
  'action',
  'formaction',
  'xlink:href',
]);

/**
 * 브라우저가 내용을 마크업이 아닌 텍스트로 읽는 요소와 그 끝 태그 패턴.
 * `plaintext` 는 입력 끝까지 텍스트다.
 */
const RAW_TEXT_END = new Map<string, RegExp | null>();
for (const name of ['iframe', 'noembed', 'noframes', 'noscript', 'script', 'style', 'textarea', 'title', 'xmp']) {
  RAW_TEXT_END.set(name, new RegExp(`</${name}[\\t\\n\\f\\r />]`, 'gi'));
}
RAW_TEXT_END.set('plaintext', null);

/** 흔한 이름 엔티티 (URL 판정용 최소 집합) */
const NAMED_ENTITIES: Readonly<Record<string, string>> = {
  colon: ':',
  tab: '\t',
  newline: '\n',
  nbsp: '\u00a0',
  amp: '&',
  quot: '"',
  apos: "'",
  lt: '<',
  gt: '>',
  sol: '/',
  lpar: '(',
  rpar: ')',
};

/**
 * 한 번의 정리에서 변화가 없을 때까지 반복하는 최대 횟수. 제거가 새 위험
 * 구조를 만드는 입력(`<scr<object>ipt>`)을 잡기 위해 반복하며, 이 횟수 안에
 * 수렴하지 않는 입력은 태그를 모두 무력화한다(fail-closed).
 */
const MAX_REGEX_PASSES = 16;

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
  /**
   * 사용할 DOMPurify 인스턴스.
   * - 객체: 동적 로딩 대신 이 인스턴스를 쓴다.
   * - `null`: 정규식 경로를 강제한다.
   * - 미지정(`undefined`): `isomorphic-dompurify` 동적 로딩을 시도한다.
   */
  purify?: DOMPurifyLike | null;
}

// ── DOMPurify 동적 로딩 (선택적 / 실제 사용되는 1차 경로) ──

/** 새니타이저가 요구하는 DOMPurify 최소 인터페이스. */
export type DOMPurifyLike = {
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

/** 숫자·16진수 엔티티와 흔한 이름 엔티티를 한 번만 디코딩한다. */
function decodeEntities(value: string): string {
  return value.replace(
    /&(?:#x([0-9a-f]+)|#(\d+)|([a-z]+));?/gi,
    (match, hex: string | undefined, dec: string | undefined, name: string | undefined) => {
      if (hex !== undefined || dec !== undefined) {
        const codePoint = hex !== undefined ? parseInt(hex, 16) : parseInt(dec as string, 10);
        return codePoint > 0 && codePoint <= 0x10ffff
          ? String.fromCodePoint(codePoint)
          : '\uFFFD';
      }
      return NAMED_ENTITIES[(name as string).toLowerCase()] ?? match;
    },
  );
}

/**
 * URL 속성 값이 위험 프로토콜인지 판정한다. 엔티티를 디코딩하고 공백·제어문자를
 * 모두 제거한 뒤 본다. `data:image/` 는 기존 정책대로 허용한다.
 */
function isDangerousUrl(rawValue: string): boolean {
  const normalized = decodeEntities(rawValue)
    .replace(/[\s\u0000-\u001f\u007f-\u009f]/g, '')
    .toLowerCase();
  if (normalized.startsWith('javascript:') || normalized.startsWith('vbscript:')) {
    return true;
  }
  return normalized.startsWith('data:') && !normalized.startsWith('data:image/');
}

/** 태그·속성 이름은 브라우저처럼 ASCII 대문자만 소문자로 바꿔 비교한다. */
function asciiLower(value: string): string {
  return value.replace(/[A-Z]+/g, (s) => s.toLowerCase());
}

/** 따옴표로 감싼 속성값이면 따옴표를 벗긴다. */
function unquote(value: string): string {
  const quote = value[0];
  return value.length >= 2 && (quote === '"' || quote === "'") && value.endsWith(quote)
    ? value.slice(1, -1)
    : value;
}

/**
 * iframe 의 첫 src 속성값(브라우저는 중복 속성 중 첫 값을 쓴다)이 신뢰 origin 으로
 * 시작하는지 본다. URL 파서처럼 앞뒤 C0 제어문자·공백과 tab/개행을 지운 뒤 비교한다.
 */
function isTrustedIframeSrc(
  rawSrc: string | undefined,
  trustedOrigins: readonly string[],
): boolean {
  if (rawSrc === undefined) return false;
  const src = decodeEntities(rawSrc)
    .replace(/^[\x00-\x20]+|[\x00-\x20]+$/g, '')
    .replace(/[\t\n\r]/g, '');
  return trustedOrigins.some((origin) => src.startsWith(origin));
}

/**
 * 태그의 속성 영역에서 이벤트(`on*`)·`srcdoc` 속성을 지우고 위험 URL 값을 비운다.
 * 바꿀 것이 없으면 원문을 그대로 돌려준다. 첫 src 속성값 원문도 함께 돌려준다.
 */
function sanitizeAttributes(rawBody: string): { body: string; firstSrc: string | undefined } {
  const attrToken = new RegExp(ATTR_TOKEN.source, 'g');
  let body = '';
  let last = 0;
  let firstSrc: string | undefined;
  let m: RegExpExecArray | null;
  while ((m = attrToken.exec(rawBody)) !== null) {
    const [whole, rawName, rawValue] = m;
    const name = asciiLower(rawName);
    const value = rawValue === undefined ? undefined : unquote(rawValue);
    body += rawBody.slice(last, m.index);
    last = attrToken.lastIndex;
    if (name === 'src' && firstSrc === undefined) firstSrc = value ?? '';
    if (name.startsWith('on') || name === 'srcdoc') continue;
    if (value !== undefined && URL_ATTR_NAMES.has(name) && isDangerousUrl(value)) {
      body += `${rawName}=""`;
      continue;
    }
    body += whole;
  }
  return { body: body + rawBody.slice(last), firstSrc };
}

/**
 * raw text 요소의 끝 태그 위치를 찾는다 (없으면 -1). 왼쪽부터 훑으므로 이름별로
 * 마지막 결과를 기억해 같은 입력을 반복해서 끝까지 찾지 않는다.
 */
function findRawTextEnd(
  html: string,
  from: number,
  name: string,
  cache: Map<string, number>,
): number {
  const pattern = RAW_TEXT_END.get(name);
  if (!pattern) return -1;
  const cached = cache.get(name);
  if (cached !== undefined && (cached === -1 || cached >= from)) return cached;
  pattern.lastIndex = from;
  const found = pattern.exec(html);
  const index = found ? found.index : -1;
  cache.set(name, index);
  return index;
}

/**
 * 마크업을 토큰 단위로 훑어 태그 안에서만 속성을 정리한다. 주석·bogus 주석과
 * 태그 밖 텍스트는 원문 그대로 둔다.
 * - 비신뢰 iframe: 닫는 태그가 있으면 내용과 닫는 태그까지, 없으면 여는 태그만 제거.
 * - raw text 요소(title, 신뢰 iframe 등): 내용의 `<` 를 이스케이프해, 내용 안에
 *   따옴표 값으로 태그를 숨겨 끝 태그 뒤로 넘기는 입력을 막는다.
 * - CDATA 시작(`<![CDATA[`): SVG/MathML 안에서만 `]]>` 까지 텍스트가 되어 경계가
 *   달라지므로 텍스트로 바꾼다.
 */
function sanitizeMarkup(html: string, trustedOrigins: readonly string[]): string {
  const markup = new RegExp(MARKUP.source, 'g');
  const endCache = new Map<string, number>();
  let out = '';
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = markup.exec(html)) !== null) {
    const [token, , cdata, , slash, rawName, rawBody, close] = m;
    out += html.slice(last, m.index);
    last = markup.lastIndex;

    if (rawName === undefined) {
      out += cdata !== undefined ? `&lt;${token.slice(1)}` : token;
      continue;
    }

    const name = asciiLower(rawName);
    const isStartTag = slash === '';
    const { body, firstSrc } = sanitizeAttributes(rawBody);

    if (isStartTag && name === 'iframe' && !isTrustedIframeSrc(firstSrc, trustedOrigins)) {
      const end = close === '>' ? findRawTextEnd(html, last, name, endCache) : -1;
      if (end !== -1) {
        markup.lastIndex = end;
        last = markup.exec(html) ? markup.lastIndex : html.length;
        markup.lastIndex = last;
      }
      continue;
    }

    out += `<${slash}${rawName}${body}${close}`;

    if (isStartTag && close === '>' && RAW_TEXT_END.has(name)) {
      const end = findRawTextEnd(html, last, name, endCache);
      const stop = end === -1 ? html.length : end;
      out += html.slice(last, stop).replace(/</g, '&lt;');
      last = stop;
      markup.lastIndex = stop;
    }
  }
  return out + html.slice(last);
}

function regexSanitizePass(html: string, trustedOrigins: readonly string[]): string {
  let result = html;

  // 1. script/style 태그 사이 콘텐츠 제거
  result = result.replace(STRIP_TAG_CONTENT, '');

  // 2. 위험한 태그 제거
  result = result.replace(STRIP_TAGS_WITH_CONTENT, '');

  // 3. 태그 단위 정리: 이벤트·srcdoc 속성 제거, 위험 URL 무력화(엔티티 디코딩 후
  //    판정), 비신뢰 iframe 제거. 태그 밖 텍스트와 주석은 바꾸지 않는다.
  return sanitizeMarkup(result, trustedOrigins);
}

function regexSanitize(html: string, trustedOrigins: readonly string[]): string {
  let current = html;
  for (let pass = 0; pass < MAX_REGEX_PASSES; pass++) {
    const next = regexSanitizePass(current, trustedOrigins);
    if (next === current) return next;
    current = next;
  }
  // 수렴하지 않는 입력은 태그를 모두 텍스트로 만든다 (fail-closed).
  return current.replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ── DOMPurify 기반 새니타이저 (1차 경로) ──

function dompurifySanitize(
  html: string,
  purify: DOMPurifyLike,
  trustedOrigins: readonly string[],
  config: SanitizerConfig,
): string {
  const options: Record<string, unknown> = {
    // iframe 은 hook 에서 origin 검증 후 허용.
    // `#comment` 는 블록 에디터 데이터 주석(`<!-- abe-blocks:... -->` 등) 보존용.
    ADD_TAGS: ['iframe', '#comment'],
    ADD_ATTR: ['allowfullscreen', 'frameborder', 'allow', 'target'],
    // 본문 맨 앞의 주석이 <body> 밖으로 밀려나 사라지지 않도록 한다.
    // (빈 입력은 `<!---->` 가 되므로 createSanitizer 에서 미리 걸러낸다.)
    FORCE_BODY: true,
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

  ensureIframeHook(purify);
  // sanitize 는 동기이므로 호출 동안만 활성 origin 을 노출한다.
  activeTrustedOrigins = trustedOrigins;
  try {
    return purify.sanitize(html, options);
  } finally {
    activeTrustedOrigins = null;
  }
}

type DOMPurifyWithHooks = DOMPurifyLike & {
  addHook?: (hook: string, cb: (node: Element) => void) => void;
};

/**
 * 현재 sanitize 호출이 신뢰하는 iframe origin. 호출 밖(null)에서는 훅이
 * 아무것도 하지 않는다 — consumer 가 같은 DOMPurify 인스턴스를 직접 쓸 때
 * 우리 정책이 끼어들지 않도록.
 */
let activeTrustedOrigins: readonly string[] | null = null;

/** 인스턴스별로 훅을 1회만 등록했는지 추적. */
const hookedInstances = new WeakSet<object>();

/**
 * iframe origin 검증 훅을 인스턴스당 한 번만 등록한다.
 *
 * 이전 구현은 호출마다 addHook/removeHook 을 반복했는데, DOMPurify 의
 * `removeHook('uponSanitizeElement')` 는 *같은 종류의 훅을 모두* 제거하므로
 * consumer 가 공유 인스턴스에 등록한 훅까지 지워 버렸다. 이제 우리 훅은
 * 한 번 등록된 뒤 그대로 남고, consumer 훅도 건드리지 않는다.
 */
function ensureIframeHook(purify: DOMPurifyLike): void {
  const p = purify as DOMPurifyWithHooks;
  if (typeof p.addHook !== 'function') return;
  if (hookedInstances.has(p)) return;
  hookedInstances.add(p);
  p.addHook('uponSanitizeElement', (node) => {
    const origins = activeTrustedOrigins;
    if (!origins) return;
    if (node.nodeName && node.nodeName.toLowerCase() === 'iframe') {
      const src = (node as Element).getAttribute?.('src') ?? '';
      const trusted = origins.some((origin) => src.startsWith(origin));
      if (!trusted) {
        (node as Element).remove?.();
      }
    }
  });
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
    const purify =
      config.purify === undefined ? tryLoadDomPurify() : config.purify;
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
 * `setCmsConfig({ sanitizer: { trustedIframeOrigins } })` 로 한다.
 */
export function sanitizeHtmlContent(
  html: string | null | undefined,
): string | null {
  return defaultSanitize(html);
}

/** 모듈 로드 시점에 1회 만들어지는 기본 새니타이저 (실행은 lazy). */
const defaultSanitize = createSanitizer();
