import { vi } from 'vitest';

vi.mock('next/server', () => {
  return {
    NextResponse: class MockNextResponse {
      body: unknown;
      status: number;
      constructor(body: unknown, init?: { status?: number }) {
        this.body = body;
        this.status = init?.status ?? 200;
      }
      static json(data: unknown, init?: { status?: number }) {
        return { _data: data, status: init?.status ?? 200 };
      }
    },
  };
});

import { NextApiResponse } from '@withwiz/cms-kit/utils/api-response';

describe('NextApiResponse', () => {
  it('CMS-AR-01: success - status 200, data 포함', () => {
    const res = NextApiResponse.success({ id: 1 }) as any;
    expect(res.status).toBe(200);
    expect(res._data.success).toBe(true);
    expect(res._data.data).toEqual({ id: 1 });
  });

  it('CMS-AR-02: success - 커스텀 status', () => {
    const res = NextApiResponse.success({ id: 1 }, 202) as any;
    expect(res.status).toBe(202);
  });

  it('CMS-AR-03: created - status 201', () => {
    const res = NextApiResponse.created({ id: 1 }) as any;
    expect(res.status).toBe(201);
    expect(res._data.success).toBe(true);
  });

  it('CMS-AR-04: noContent - status 204', () => {
    const res = NextApiResponse.noContent() as any;
    expect(res.status).toBe(204);
  });

  it('CMS-AR-05: error - status + message', () => {
    const res = NextApiResponse.error('Bad input', 422) as any;
    expect(res.status).toBe(422);
    expect(res._data.success).toBe(false);
    expect(res._data.error.message).toBe('Bad input');
  });

  it('CMS-AR-06: error - code 포함', () => {
    const res = NextApiResponse.error('Oops', 400, 'VALIDATION') as any;
    expect(res._data.error.code).toBe('VALIDATION');
  });

  it('CMS-AR-07: notFound - status 404', () => {
    const res = NextApiResponse.notFound() as any;
    expect(res.status).toBe(404);
    expect(res._data.error.code).toBe('NOT_FOUND');
  });

  it('CMS-AR-08: unauthorized - status 401', () => {
    const res = NextApiResponse.unauthorized() as any;
    expect(res.status).toBe(401);
    expect(res._data.error.code).toBe('UNAUTHORIZED');
  });

  it('CMS-AR-09: forbidden - status 403', () => {
    const res = NextApiResponse.forbidden() as any;
    expect(res.status).toBe(403);
    expect(res._data.error.code).toBe('FORBIDDEN');
  });

  it('CMS-AR-10: serverError - status 500', () => {
    const res = NextApiResponse.serverError() as any;
    expect(res.status).toBe(500);
    expect(res._data.error.code).toBe('INTERNAL_SERVER_ERROR');
  });

  it('CMS-AR-11: paginated - totalPages 계산', () => {
    const res = NextApiResponse.paginated([1, 2], 1, 2, 5) as any;
    expect(res._data.data.pagination.totalPages).toBe(3);
  });

  it('CMS-AR-12: paginated - hasMore 경계값', () => {
    // page=3 of 3 → hasMore=false
    const res = NextApiResponse.paginated([1], 3, 2, 5) as any;
    expect(res._data.data.pagination.hasMore).toBe(false);
    // page=2 of 3 → hasMore=true
    const res2 = NextApiResponse.paginated([1, 2], 2, 2, 5) as any;
    expect(res2._data.data.pagination.hasMore).toBe(true);
  });

  it('CMS-AR-13: paginated - dataKey 커스텀', () => {
    const res = NextApiResponse.paginated([{ id: 1 }], 1, 10, 1, 'posts') as any;
    expect(res._data.data.posts).toBeDefined();
    expect(res._data.data.posts).toEqual([{ id: 1 }]);
  });
});
