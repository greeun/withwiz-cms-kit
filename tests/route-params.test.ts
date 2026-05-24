import { getRouteParam } from '@withwiz/pms/utils/route-params';

describe('getRouteParam', () => {
  it('PMS-RP-01: Promise params → key 추출', async () => {
    const props = { params: Promise.resolve({ id: 'abc-123' }) };
    const result = await getRouteParam(props, 'id');
    expect(result).toBe('abc-123');
  });

  it('PMS-RP-02: 일반 객체 params (Promise.resolve 래핑) → key 추출', async () => {
    const props = { params: Promise.resolve({ slug: 'hello-world' }) };
    const result = await getRouteParam(props, 'slug');
    expect(result).toBe('hello-world');
  });

  it('PMS-RP-03: 존재하지 않는 key → undefined', async () => {
    const props = { params: Promise.resolve({ id: 'abc' }) };
    const result = await getRouteParam(props, 'nonexistent' as any);
    expect(result).toBeUndefined();
  });
});
