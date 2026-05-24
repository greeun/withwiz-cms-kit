import { toLocalDatetime, formatDateTime, formatDate } from '@withwiz/pms/utils/date';

describe('toLocalDatetime', () => {
  it('PMS-D-01: ISO 문자열을 datetime-local 형식으로 변환한다', () => {
    const d = new Date(2025, 2, 15, 14, 30);
    expect(toLocalDatetime(d.toISOString())).toBe('2025-03-15T14:30');
  });

  it('PMS-D-02: null → 빈 문자열', () => {
    expect(toLocalDatetime(null)).toBe('');
  });

  it('PMS-D-03: 무효 날짜 → 빈 문자열', () => {
    expect(toLocalDatetime('invalid')).toBe('');
  });

  it('PMS-D-04: 빈 문자열 → 빈 문자열', () => {
    expect(toLocalDatetime('')).toBe('');
  });

  it('PMS-D-05: 월/일을 0-padding 처리한다', () => {
    const d = new Date(2025, 0, 5, 9, 5);
    expect(toLocalDatetime(d.toISOString())).toBe('2025-01-05T09:05');
  });
});

describe('formatDateTime', () => {
  it('PMS-D-06: ISO → YYYY.MM.DD HH:MM 형식', () => {
    const d = new Date(2025, 11, 25, 18, 0);
    expect(formatDateTime(d.toISOString())).toBe('2025.12.25 18:00');
  });

  it('PMS-D-07: null → 대시(-)', () => {
    expect(formatDateTime(null)).toBe('-');
  });

  it('PMS-D-08: 무효 날짜 → 대시(-)', () => {
    expect(formatDateTime('not-a-date')).toBe('-');
  });
});

describe('formatDate', () => {
  it('PMS-D-09: ISO → YYYY.MM.DD 형식', () => {
    const d = new Date(2025, 5, 15);
    expect(formatDate(d.toISOString())).toBe('2025.06.15');
  });

  it('PMS-D-10: null → 대시(-)', () => {
    expect(formatDate(null)).toBe('-');
  });
});
