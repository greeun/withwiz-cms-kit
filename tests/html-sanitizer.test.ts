import { sanitizeHtmlContent } from '@withwiz/pms/utils/html-sanitizer';

describe('sanitizeHtmlContent', () => {
  it('PMS-H-01: null → null 반환', () => {
    expect(sanitizeHtmlContent(null)).toBeNull();
  });

  it('PMS-H-02: undefined → falsy 반환', () => {
    expect(sanitizeHtmlContent(undefined)).toBeFalsy();
  });

  it('PMS-H-03: 빈 문자열 → falsy 반환', () => {
    expect(sanitizeHtmlContent('')).toBeFalsy();
  });

  it('PMS-H-04: 안전한 HTML 보존', () => {
    const safe = '<p>Hello <strong>World</strong></p>';
    expect(sanitizeHtmlContent(safe)).toBe(safe);
  });

  it('PMS-H-05: img 태그 보존', () => {
    const html = '<img src="https://example.com/image.jpg" alt="photo">';
    expect(sanitizeHtmlContent(html)).toBe(html);
  });

  it('PMS-H-06: script 태그+내용 제거', () => {
    const html = '<p>Hello</p><script>alert("xss")</script><p>World</p>';
    const result = sanitizeHtmlContent(html)!;
    expect(result).not.toContain('<script');
    expect(result).not.toContain('alert');
    expect(result).toContain('<p>Hello</p>');
    expect(result).toContain('<p>World</p>');
  });

  it('PMS-H-07: style 태그+내용 제거', () => {
    const html = '<style>body{display:none}</style><p>Content</p>';
    const result = sanitizeHtmlContent(html)!;
    expect(result).not.toContain('<style');
    expect(result).not.toContain('display:none');
    expect(result).toContain('<p>Content</p>');
  });

  it('PMS-H-08: 비신뢰 iframe 제거', () => {
    const html = '<iframe src="https://evil.com/hack"></iframe>';
    const result = sanitizeHtmlContent(html)!;
    expect(result).not.toContain('<iframe');
  });

  it('PMS-H-09: YouTube iframe 보존', () => {
    const html = '<iframe src="https://www.youtube.com/embed/abc123"></iframe>';
    expect(sanitizeHtmlContent(html)).toContain('youtube.com');
  });

  it('PMS-H-10: Vimeo iframe 보존', () => {
    const html = '<iframe src="https://player.vimeo.com/video/123"></iframe>';
    expect(sanitizeHtmlContent(html)).toContain('vimeo.com');
  });

  it('PMS-H-11: onclick 이벤트 핸들러 제거', () => {
    const html = '<a href="#" onclick="alert(1)">Click</a>';
    const result = sanitizeHtmlContent(html)!;
    expect(result).not.toContain('onclick');
  });

  it('PMS-H-12: onerror 이벤트 핸들러 제거', () => {
    const html = '<img src="x" onerror="alert(1)">';
    const result = sanitizeHtmlContent(html)!;
    expect(result).not.toContain('onerror');
  });

  it('PMS-H-13: javascript: 프로토콜 무력화', () => {
    const html = '<a href="javascript:alert(1)">Link</a>';
    const result = sanitizeHtmlContent(html)!;
    expect(result).not.toContain('javascript:');
  });

  it('PMS-H-14: data:text/html 무력화', () => {
    const html = '<a href="data:text/html,<script>alert(1)</script>">Link</a>';
    const result = sanitizeHtmlContent(html)!;
    expect(result).not.toMatch(/href\s*=\s*["']data:text/);
  });

  it('PMS-H-15: data:image 보존', () => {
    const html = '<img src="data:image/png;base64,iVBOR...">';
    const result = sanitizeHtmlContent(html)!;
    expect(result).toContain('data:image/png');
  });

  it('PMS-H-16: object 태그 제거', () => {
    const html = '<object data="evil.swf"></object>';
    const result = sanitizeHtmlContent(html)!;
    expect(result).not.toContain('<object');
  });

  it('PMS-H-17: embed 태그 제거', () => {
    const html = '<embed src="evil.swf">';
    const result = sanitizeHtmlContent(html)!;
    expect(result).not.toContain('<embed');
  });

  it('PMS-H-18: form+input 태그 제거', () => {
    const html = '<form action="/steal"><input type="text" name="cc"></form>';
    const result = sanitizeHtmlContent(html)!;
    expect(result).not.toContain('<form');
    expect(result).not.toContain('<input');
  });

  it('PMS-H-19: 복합 XSS 시나리오', () => {
    const html = '<div onclick="steal()"><script>evil()</script><img src="ok.jpg" onerror="hack()"><p>Safe</p></div>';
    const result = sanitizeHtmlContent(html)!;
    expect(result).not.toContain('<script');
    expect(result).not.toContain('onclick');
    expect(result).not.toContain('onerror');
    expect(result).toContain('<p>Safe</p>');
    expect(result).toContain('ok.jpg');
  });

  it('PMS-H-20: applet 태그 제거', () => {
    const html = '<applet code="Evil.class"></applet>';
    const result = sanitizeHtmlContent(html)!;
    expect(result).not.toContain('<applet');
  });
});
