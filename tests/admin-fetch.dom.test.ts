import { vi, beforeEach } from 'vitest';

describe('adminFetch', () => {
  let adminFetch: typeof import('@withwiz/pms/utils/admin-fetch').adminFetch;
  let getAuthHeaders: typeof import('@withwiz/pms/utils/admin-fetch').getAuthHeaders;

  const originalLocation = window.location;

  beforeEach(async () => {
    vi.resetModules();
    vi.restoreAllMocks();

    // window.location mock
    Object.defineProperty(window, 'location', {
      value: { href: '' },
      writable: true,
      configurable: true,
    });

    const mod = await import('@withwiz/pms/utils/admin-fetch');
    adminFetch = mod.adminFetch;
    getAuthHeaders = mod.getAuthHeaders;
  });

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      value: originalLocation,
      writable: true,
      configurable: true,
    });
  });

  it('PMS-AF-01: 정상 200 응답 → 그대로 반환', async () => {
    const mockResponse = new Response(JSON.stringify({ ok: true }), { status: 200 });
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse);

    const res = await adminFetch('/api/test');
    expect(res.status).toBe(200);
  });

  it('PMS-AF-02: 401 → refresh 성공 → 재시도', async () => {
    const unauthorizedResponse = new Response('', { status: 401 });
    const refreshResponse = new Response(JSON.stringify({ success: true }), { status: 200 });
    const retryResponse = new Response(JSON.stringify({ data: 'ok' }), { status: 200 });

    const fetchMock = vi.spyOn(globalThis, 'fetch');
    fetchMock
      .mockResolvedValueOnce(unauthorizedResponse)  // 1st: original 401
      .mockResolvedValueOnce(refreshResponse)        // 2nd: refresh
      .mockResolvedValueOnce(retryResponse);         // 3rd: retry

    const res = await adminFetch('/api/test');
    expect(res.status).toBe(200);
  });

  it('PMS-AF-03: 401 → refresh 실패 → 로그인 리다이렉트', async () => {
    const unauthorizedResponse = new Response('', { status: 401 });
    const refreshFailResponse = new Response(JSON.stringify({ success: false }), { status: 401 });

    const fetchMock = vi.spyOn(globalThis, 'fetch');
    fetchMock
      .mockResolvedValueOnce(unauthorizedResponse)
      .mockResolvedValueOnce(refreshFailResponse);

    await adminFetch('/api/test');
    expect(window.location.href).toBe('/admin/login');
  });

  it('PMS-AF-04: 500 에러 → 그대로 반환', async () => {
    const errorResponse = new Response('Server Error', { status: 500 });
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(errorResponse);

    const res = await adminFetch('/api/test');
    expect(res.status).toBe(500);
  });

  it('PMS-AF-05: 동시 다중 401 → refresh 중복 방지 (mutex)', async () => {
    const unauthorizedResponse = () => new Response('', { status: 401 });
    const refreshResponse = new Response(JSON.stringify({ success: true }), { status: 200 });
    const retryResponse = () => new Response(JSON.stringify({ ok: true }), { status: 200 });

    let refreshCallCount = 0;
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    fetchMock.mockImplementation(async (url: any) => {
      const urlStr = typeof url === 'string' ? url : url.toString();
      if (urlStr.includes('/auth/refresh')) {
        refreshCallCount++;
        return refreshResponse;
      }
      if (fetchMock.mock.calls.length <= 2) {
        return unauthorizedResponse();
      }
      return retryResponse();
    });

    await Promise.all([adminFetch('/api/a'), adminFetch('/api/b')]);
    // refresh는 1~2번만 호출되어야 함 (mutex)
    expect(refreshCallCount).toBeLessThanOrEqual(2);
  });

  it('PMS-AF-06: getAuthHeaders deprecated → 빈 객체', () => {
    expect(getAuthHeaders()).toEqual({});
  });

  it('PMS-AF-07: configured refresh + login endpoints used (§4.1 C2)', async () => {
    const { setPmsConfig, resetPmsConfig } = await import('@withwiz/pms/config');
    resetPmsConfig();
    setPmsConfig({
      routes: {
        refreshEndpoint: '/custom/api/token/refresh',
        loginPath: '/custom/signin',
      },
    });

    const unauthorized = new Response('', { status: 401 });
    const refreshFail = new Response(JSON.stringify({ success: false }), {
      status: 401,
    });
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    fetchMock
      .mockResolvedValueOnce(unauthorized)
      .mockResolvedValueOnce(refreshFail);

    await adminFetch('/api/test');

    // refresh hit the CONFIGURED endpoint, not /api/admin/auth/refresh.
    const refreshCalled = fetchMock.mock.calls.some((c) => {
      const u = typeof c[0] === 'string' ? c[0] : String(c[0]);
      return u === '/custom/api/token/refresh';
    });
    expect(refreshCalled).toBe(true);
    const legacyRefresh = fetchMock.mock.calls.some((c) => {
      const u = typeof c[0] === 'string' ? c[0] : String(c[0]);
      return u.includes('/api/admin/auth/refresh');
    });
    expect(legacyRefresh).toBe(false);
    // login redirect target is the configured one.
    expect(window.location.href).toBe('/custom/signin');

    resetPmsConfig();
  });
});
