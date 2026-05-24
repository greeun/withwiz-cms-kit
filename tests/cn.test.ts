import { cn } from '@withwiz/pms/utils/cn';

describe('cn 유틸리티', () => {
  it('PMS-CN-01: 단순 클래스 병합', () => {
    expect(cn('a', 'b')).toBe('a b');
  });

  it('PMS-CN-02: 조건부 클래스', () => {
    expect(cn('a', false && 'b', 'c')).toBe('a c');
  });

  it('PMS-CN-03: Tailwind 충돌 해소', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4');
  });

  it('PMS-CN-04: 빈 입력', () => {
    expect(cn()).toBe('');
  });

  it('PMS-CN-05: undefined/null 무시', () => {
    expect(cn('a', undefined, null, 'b')).toBe('a b');
  });

  it('PMS-CN-06: 객체 문법', () => {
    expect(cn({ 'text-red': true, hidden: false })).toBe('text-red');
  });
});
