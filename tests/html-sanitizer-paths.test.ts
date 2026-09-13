import { JSDOM } from 'jsdom';
import { vi } from 'vitest';
import DOMPurify from 'isomorphic-dompurify';
import { createSanitizer } from '@withwiz/cms-kit/utils/html-sanitizer';
import type { DOMPurifyLike } from '@withwiz/cms-kit/utils/html-sanitizer';

/**
 * CMS-HSP — DOMPurify 경로와 정규식 경로를 같은 명세로 검증한다.
 *
 * Next.js 16 Turbopack 서버 번들에서는 ESM 빌드의 `require` shim 이 항상
 * 예외를 던지므로 `tryLoadDomPurify()` 가 실패하고 정규식 경로가 실제 운영
 * 경로가 된다. vitest 에서는 require 가 동작해 DOMPurify 경로만 검증되던
 * 문제를 막기 위해, `purify` 주입으로 두 경로를 각각 고정해 같은 케이스를
 * 돌린다.
 *
 * 판정은 출력 문자열 검색이 아니라 jsdom 으로 다시 파싱한 DOM 의 속성 이름과
 * URL 값을 본다 (브라우저가 실제로 만드는 속성 기준).
 */

const TRUSTED_IFRAME_PREFIXES = [
  'https://www.youtube.com/',
  'https://youtube.com/',
  'https://www.youtube-nocookie.com/',
  'https://player.vimeo.com/',
];

const URL_ATTRS = new Set(['href', 'src', 'action', 'formaction', 'xlink:href']);

const PATHS: ReadonlyArray<{ name: string; purify: DOMPurifyLike | null }> = [
  { name: 'DOMPurify 경로', purify: DOMPurify as unknown as DOMPurifyLike },
  { name: '정규식 경로', purify: null },
];

function parseBody(out: string): Document {
  const dom = new JSDOM(`<!DOCTYPE html><html><head></head><body>${out}</body></html>`);
  return dom.window.document;
}

function allElements(doc: Document): Element[] {
  return Array.from(doc.querySelectorAll('*'));
}

function attrNames(doc: Document): string[] {
  return allElements(doc).flatMap((el) =>
    Array.from(el.attributes).map((a) => a.name.toLowerCase()),
  );
}

/** 브라우저 URL 파서 기준으로 위험 프로토콜인지 판정한다. */
function isDangerousUrl(value: string): boolean {
  let href: string;
  try {
    href = new URL(value, 'https://base.example/').href.toLowerCase();
  } catch {
    return false;
  }
  if (href.startsWith('javascript:') || href.startsWith('vbscript:')) return true;
  return href.startsWith('data:') && !href.startsWith('data:image/');
}

/** 출력 DOM 에 실행 가능한 요소·속성이 남아 있지 않은지 확인한다. */
function expectInert(out: string | null): Document {
  expect(typeof out).toBe('string');
  const doc = parseBody(out as string);

  const names = attrNames(doc);
  expect(names.filter((n) => n.startsWith('on'))).toEqual([]);
  expect(names).not.toContain('srcdoc');

  const dangerous: string[] = [];
  for (const el of allElements(doc)) {
    for (const attr of Array.from(el.attributes)) {
      if (URL_ATTRS.has(attr.name.toLowerCase()) && isDangerousUrl(attr.value)) {
        dangerous.push(`${el.nodeName}[${attr.name}=${attr.value}]`);
      }
    }
  }
  expect(dangerous).toEqual([]);

  expect(doc.querySelectorAll('script, object, embed, applet').length).toBe(0);

  const untrustedIframes = Array.from(doc.querySelectorAll('iframe'))
    .map((f) => f.getAttribute('src') ?? '')
    .filter((src) => !TRUSTED_IFRAME_PREFIXES.some((p) => src.startsWith(p)));
  expect(untrustedIframes).toEqual([]);

  return doc;
}

/** 블록 에디터 serializer 와 같은 방식(btoa(encodeURIComponent(JSON))) 으로 인코딩한다. */
function encodePayload(data: unknown): string {
  return btoa(encodeURIComponent(JSON.stringify(data)));
}

const PAYLOAD = encodePayload({
  blocks: [
    { type: 'paragraph', text: '댄스시어터샤하르 <b>"정기공연"</b> & 안내 > 예매' },
    { type: 'image', src: 'https://cdn.example.com/a.jpg', caption: "it's /on=1" },
  ],
  version: 2,
});

describe('createSanitizer purify 주입 (CMS-HSP-INJ)', () => {
  it('CMS-HSP-INJ-01: 객체를 넘기면 그 인스턴스의 sanitize 를 쓴다', () => {
    const sanitize = vi.fn(() => '<p>injected</p>');
    const out = createSanitizer({ purify: { sanitize } })('<p>x</p>');
    expect(sanitize).toHaveBeenCalledTimes(1);
    expect(out).toBe('<p>injected</p>');
  });

  it('CMS-HSP-INJ-02: null 이면 동적 로딩한 DOMPurify 를 쓰지 않는다 (정규식 경로 강제)', () => {
    const spy = vi.spyOn(DOMPurify, 'sanitize');
    try {
      const out = createSanitizer({ purify: null })('<p>x</p>');
      expect(spy).not.toHaveBeenCalled();
      expect(out).toBe('<p>x</p>');
    } finally {
      spy.mockRestore();
    }
  });

  it('CMS-HSP-INJ-03: 지정하지 않으면 기존처럼 동적 로딩한 DOMPurify 를 쓴다', () => {
    const spy = vi.spyOn(DOMPurify, 'sanitize');
    try {
      createSanitizer({})('<p>x</p>');
      createSanitizer({ purify: undefined })('<p>y</p>');
      expect(spy).toHaveBeenCalledTimes(2);
    } finally {
      spy.mockRestore();
    }
  });

  it('CMS-HSP-INJ-04: 빈 입력은 주입한 인스턴스에 넘기지 않는다', () => {
    const sanitize = vi.fn(() => '<!---->');
    const sanitizeFn = createSanitizer({ purify: { sanitize } });
    expect(sanitizeFn('')).toBe('');
    expect(sanitizeFn(null)).toBeNull();
    expect(sanitizeFn(undefined)).toBeUndefined();
    expect(sanitize).not.toHaveBeenCalled();
  });
});

describe.each(PATHS)('html-sanitizer $name (CMS-HSP)', ({ purify }) => {
  const sanitize = createSanitizer({ purify });

  describe('우회 입력 차단', () => {
    it.each([
      ['BYP-01 slash 뒤 이벤트 속성', '<img src="x"/onerror="alert(1)">'],
      ['BYP-02 태그 이름 뒤 slash 이벤트 속성', '<svg/onload=alert(1)>'],
      ['BYP-03 따옴표 바로 뒤 이벤트 속성', '<a href="https://x.com/"onmouseover="alert(1)">x</a>'],
      ['BYP-04 16진수 엔티티 javascript:', '<a href="jav&#x61;script:alert(1)">x</a>'],
      ['BYP-05a 닫는 태그 없는 비신뢰 iframe', '<p>a</p><iframe src="https://evil.example/x">'],
      ['BYP-05b self-closing 비신뢰 iframe', '<p>a</p><iframe src="https://evil.example/x"/>'],
    ])('CMS-HSP-%s', (_label, input) => {
      expectInert(sanitize(input));
    });

    it('CMS-HSP-BYP-05c: 비신뢰 iframe 을 지워도 앞 문단은 남는다', () => {
      const doc = expectInert(sanitize('<p>a</p><iframe src="https://evil.example/x">'));
      expect(doc.querySelector('p')?.textContent).toBe('a');
    });

    it.each([
      ['EVT-01 연속된 이벤트 속성', '<img src="x"onerror="a()"onload="b()">'],
      ['EVT-02 작은따옴표 뒤 이벤트 속성', "<img src='x'onerror='alert(1)'>"],
      ['EVT-03 slash 연속', '<svg/onload=alert(1)/onfocus=alert(2)>'],
      ['EVT-04 개행 구분자', '<img src="x"\nonerror="alert(1)">'],
      ['URL-01 10진수 엔티티 세미콜론 없음', '<a href="&#0000106avascript:alert(1)">x</a>'],
      ['URL-02 &colon;', '<a href="javascript&colon;alert(1)">x</a>'],
      ['URL-03 &Tab;', '<a href="java&Tab;script:alert(1)">x</a>'],
      ['URL-04 &NewLine;', '<a href="java&NewLine;script:alert(1)">x</a>'],
      ['URL-05 앞쪽 제어문자', '<a href="&#1;&#32;javascript:alert(1)">x</a>'],
      ['URL-06 따옴표 없는 값', '<a href=javascript:alert(1)>x</a>'],
      ['URL-07 vbscript:', '<a href="vbscript:msgbox(1)">x</a>'],
      ['URL-08 data:text/html', '<a href="data:text/html;base64,PHNjcmlwdD4=">x</a>'],
      ['URL-09 xlink:href', '<svg><a xlink:href="javascript:alert(1)"><text>x</text></a></svg>'],
      ['URL-10 action', '<p><a action="jav&#x09;ascript:alert(1)">x</a></p>'],
      ['IFR-01 신뢰 iframe 의 srcdoc', '<iframe src="https://www.youtube.com/embed/a" srcdoc="&lt;script&gt;alert(1)&lt;/script&gt;"></iframe>'],
      ['IFR-02 신뢰 iframe 뒤 비신뢰 iframe', '<iframe src="https://www.youtube.com/embed/a"></iframe><iframe src="https://evil.example/x">'],
      ['TAG-01 제거 후 새로 생기는 script', '<scr<object>ipt>alert(1)</scr<object>ipt>'],
      ['HBP-01 대소문자 섞은 script', '<ScRiPt >alert(1)</ScRiPt>'],
      ['HBP-03 이중 꺾쇠 script', '<<script>alert(1)//<</script>'],
      ['HBP-05 탭 엔티티로 쪼갠 javascript:', '<a href="jav&#x09;ascript:alert(1)">x</a>'],
      ['HBP-10 data:text/html img', '<img src="data:text/html,<script>alert(1)</script>">'],
      // 태그 경계: 따옴표로 감싼 값 안의 > 는 태그 끝이 아니다
      ['TAG-03 큰따옴표 값 안 > 뒤 이벤트 속성', '<img title="a>b" onerror="alert(1)">'],
      ['TAG-04 작은따옴표 값 안 > 뒤 javascript href', `<a title='x>y' href="javascript:alert(1)">x</a>`],
      // HTML 공백이 아닌 NBSP 뒤 따옴표는 따옴표 값이 아니다
      ['TAG-05 NBSP 뒤 따옴표', '<a x=\xa0"a b onclick=alert(1) c">x</a>'],
      ['END-01 끝 태그 속성값으로 가린 태그', `</p x="<img title='"><img src=1 onerror=alert(1)>'>`],
      ['IFR-03 따옴표 값 안에 가린 신뢰 src', `<iframe x=" src='https://www.youtube.com/embed/a' >" src="https://evil.example/x"></iframe>`],
      // raw text 요소·주석·CDATA 는 브라우저가 텍스트로 끝을 정한다
      ['RAW-01 title 내용으로 가린 태그', '<title><a title="</title><img src=x onerror=alert(1)>"></title>'],
      ['RAW-02 신뢰 iframe 내용으로 가린 태그', '<iframe src="https://www.youtube.com/embed/a"><a title="</iframe><img src=x onerror=alert(1)>"></iframe>'],
      ['CMT-01 주석 안 따옴표로 가린 태그', '<!-- <a title=" --><img src=x onerror=alert(1)><!-- " -->'],
      ['CMT-02 비정상 종료 주석 <!-->', '<!--><img src=x onerror=alert(1)>-->'],
      ['CMT-03 비정상 종료 주석 <!--->', '<!---><img src=x onerror=alert(1)>-->'],
      ['CMT-04 --!> 로 끝나는 주석', '<!-- x --!><img src=x onerror=alert(1)>-->'],
      ['CDATA-01 SVG CDATA 로 가린 태그', '<svg><![CDATA[><a title="]]><img src=x onerror=alert(1)><b title=">]]></svg>'],
    ])('CMS-HSP-%s', (_label, input) => {
      expectInert(sanitize(input));
    });

    it('CMS-HSP-TAG-02: 중첩 깊이와 관계없이 제거-재생성 입력이 script 를 남기지 않는다', () => {
      let open = 'script';
      for (let depth = 1; depth <= 40; depth++) {
        const mid = Math.floor(open.length / 2);
        open = `${open.slice(0, mid)}<object>${open.slice(mid)}`;
        expectInert(sanitize(`<${open}>alert(1)</script>`));
      }
    });
  });

  describe('태그 밖 텍스트 보존', () => {
    it('CMS-HSP-TXT-01: 속성처럼 보이는 본문 텍스트를 바꾸지 않는다', () => {
      const text = '설정값 "online=true" 와 "one=1", 예시 href="javascript:void(0)" 문구';
      const html = `<p>${text}</p>`;
      const out = sanitize(html);
      expect(parseBody(out as string).body.textContent).toBe(text);
      expect(out).toBe(html);
    });

    it('CMS-HSP-TXT-02: 태그 안에서 지운 속성과 같은 문구가 본문에 있어도 본문은 그대로다', () => {
      const out = sanitize('<p onclick="x()">onclick="x()" 와 srcdoc="y" 설명</p>');
      const doc = expectInert(out);
      expect(doc.body.textContent).toBe('onclick="x()" 와 srcdoc="y" 설명');
    });
  });

  describe('데이터 주석 보존', () => {
    it.each([
      ['abe-blocks', `<!-- abe-blocks:${PAYLOAD} -->`],
      ['abe-blocks (공백 없음)', `<!--abe-blocks:${PAYLOAD}-->`],
      ['pme-data', `<!-- pme-data:${PAYLOAD} -->`],
      ['pme-data (공백 없음)', `<!--pme-data:${PAYLOAD}-->`],
      ['rme-data', `<!-- rme-data:${PAYLOAD} -->`],
      ['rme-data (공백 없음)', `<!--rme-data:${PAYLOAD}-->`],
      ['nbe-cta-start/end', '<!-- nbe-cta-start --><div class="nbe-cta"><p>문의</p></div><!-- nbe-cta-end -->'],
      ['nbe-cta-start/end (공백 없음)', '<!--nbe-cta-start--><div class="nbe-cta"><p>문의</p></div><!--nbe-cta-end-->'],
    ])('CMS-HSP-CMT %s: 원문 그대로', (_label, comment) => {
      // 문서 맨 앞(FORCE_BODY 필요)과 본문 사이 두 위치에서 확인한다.
      const leading = `${comment}\n<p>본문</p>`;
      expect(sanitize(leading)).toBe(leading);
      const middle = `<h2>제목</h2>\n${comment}\n<p>본문</p>`;
      expect(sanitize(middle)).toBe(middle);
    });

    it('CMS-HSP-CMT-DOC: 데이터 주석 4종이 섞인 실제 형태의 본문이 바이트 그대로 보존된다', () => {
      const html =
        `<!-- pme-data:${PAYLOAD} -->\n` +
        '<h2 class="pme-title">정기공연</h2>\n' +
        '<p style="text-align: center;">본문 <strong>강조</strong></p>\n' +
        `<!-- abe-blocks:${PAYLOAD} -->\n` +
        `<!-- rme-data:${PAYLOAD} -->\n` +
        '<!-- nbe-cta-start --><div class="nbe-cta"><p>단체관람 문의</p>' +
        '<a href="https://example.com/contact" target="_blank" rel="noopener noreferrer">문의하기</a>' +
        '</div><!-- nbe-cta-end -->\n' +
        `<!-- nbe-cta:${PAYLOAD} -->`;
      expect(sanitize(html)).toBe(html);
    });
  });

  describe('안전한 표현 유지', () => {
    it('CMS-HSP-KEEP-01: class, style, target="_blank", 신뢰 YouTube iframe 을 유지한다', () => {
      const html =
        '<p class="lead" style="color: red;">본문</p>' +
        '<a href="https://example.com/" target="_blank" rel="noopener noreferrer">링크</a>' +
        '<iframe src="https://www.youtube.com/embed/abc123" width="560" height="315" ' +
        'frameborder="0" allow="accelerometer; autoplay" allowfullscreen></iframe>';
      const doc = expectInert(sanitize(html));

      const p = doc.querySelector('p');
      expect(p?.getAttribute('class')).toBe('lead');
      expect(p?.getAttribute('style')).toBe('color: red;');

      const a = doc.querySelector('a');
      expect(a?.getAttribute('href')).toBe('https://example.com/');
      expect(a?.getAttribute('target')).toBe('_blank');

      const iframe = doc.querySelector('iframe');
      expect(iframe?.getAttribute('src')).toBe('https://www.youtube.com/embed/abc123');
      expect(iframe?.hasAttribute('allowfullscreen')).toBe(true);
      expect(iframe?.getAttribute('frameborder')).toBe('0');
      expect(iframe?.getAttribute('allow')).toBe('accelerometer; autoplay');
    });

    it('CMS-HSP-KEEP-02: data:image 는 위험 프로토콜로 보지 않는다', () => {
      const doc = expectInert(sanitize('<img src="data:image/png;base64,iVBORw0KGgo=" alt="x">'));
      expect(doc.querySelector('img')?.getAttribute('src')).toBe('data:image/png;base64,iVBORw0KGgo=');
    });

    it('CMS-HSP-KEEP-03: 엔티티가 들어간 안전한 URL 은 그대로 둔다', () => {
      const html = '<a href="https://example.com/?a=1&amp;b=2">x</a>';
      expect(sanitize(html)).toBe(html);
    });
  });

  describe('빈 입력', () => {
    it('CMS-HSP-EMPTY-01: 빈 문자열·null·undefined 를 그대로 돌려준다', () => {
      expect(sanitize('')).toBe('');
      expect(sanitize(null)).toBeNull();
      expect(sanitize(undefined)).toBeUndefined();
    });
  });
});
