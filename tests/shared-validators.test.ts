import { slugSchema, optionalUrlSchema } from '@withwiz/pms/validators/shared';

describe('slugSchema', () => {
  it('PMS-SV-01: 유효 slug 통과', () => {
    expect(slugSchema.safeParse('hello-world').success).toBe(true);
    expect(slugSchema.safeParse('abc123').success).toBe(true);
    expect(slugSchema.safeParse('a').success).toBe(true);
  });

  it('PMS-SV-02: 대문자 실패', () => {
    expect(slugSchema.safeParse('Hello').success).toBe(false);
  });

  it('PMS-SV-03: 공백 실패', () => {
    expect(slugSchema.safeParse('hello world').success).toBe(false);
  });

  it('PMS-SV-04: 빈 문자열 실패', () => {
    expect(slugSchema.safeParse('').success).toBe(false);
  });

  it('PMS-SV-05: 200자 초과 실패', () => {
    const longSlug = 'a'.repeat(201);
    expect(slugSchema.safeParse(longSlug).success).toBe(false);
  });

  it('PMS-SV-12: 하이픈만 실패', () => {
    expect(slugSchema.safeParse('-').success).toBe(false);
    expect(slugSchema.safeParse('--').success).toBe(false);
  });
});

describe('optionalUrlSchema', () => {
  it('PMS-SV-06: 유효 URL 통과', () => {
    expect(optionalUrlSchema.safeParse('https://example.com').success).toBe(true);
  });

  it('PMS-SV-07: 빈 문자열 통과', () => {
    expect(optionalUrlSchema.safeParse('').success).toBe(true);
  });

  it('PMS-SV-08: undefined 통과', () => {
    expect(optionalUrlSchema.safeParse(undefined).success).toBe(true);
  });

  it('PMS-SV-09: file:// 차단', () => {
    expect(optionalUrlSchema.safeParse('file:///etc/passwd').success).toBe(false);
  });

  it('PMS-SV-10: javascript: 차단', () => {
    expect(optionalUrlSchema.safeParse('javascript:alert(1)').success).toBe(false);
  });

  it('PMS-SV-11: data: 차단', () => {
    expect(optionalUrlSchema.safeParse('data:text/html,<h1>hi</h1>').success).toBe(false);
  });
});
