import { vi, beforeEach } from 'vitest';

describe('Prisma 서비스 플로우 통합 테스트', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('PMS-PSF-01: setPrismaClient 후 서비스 모듈에서 동일 인스턴스 접근', async () => {
    const { setPrismaClient, getPrisma } = await import(
      '@withwiz/pms/infrastructure/prisma'
    );

    const mockClient = {
      user: { findMany: vi.fn().mockResolvedValue([{ id: '1' }]) },
      post: { create: vi.fn() },
    };

    setPrismaClient(mockClient);
    const client = getPrisma();
    expect(client).toBe(mockClient);
    expect(client.user).toBe(mockClient.user);
  });

  it('PMS-PSF-02: Proxy가 설정된 클라이언트로 메서드 호출 위임', async () => {
    const { setPrismaClient, prisma } = await import(
      '@withwiz/pms/infrastructure/prisma'
    );

    const mockFindMany = vi.fn().mockResolvedValue([{ id: '1', name: 'Test' }]);
    const mockClient = { user: { findMany: mockFindMany } };

    setPrismaClient(mockClient);

    const result = await prisma.user.findMany();
    expect(mockFindMany).toHaveBeenCalled();
    expect(result).toEqual([{ id: '1', name: 'Test' }]);
  });

  it('PMS-PSF-03: 여러 번 setPrismaClient → 마지막 클라이언트 사용', async () => {
    const { setPrismaClient, getPrisma, prisma } = await import(
      '@withwiz/pms/infrastructure/prisma'
    );

    const first = { version: 1, user: { findMany: vi.fn() } };
    const second = { version: 2, user: { findMany: vi.fn() } };

    setPrismaClient(first);
    expect(getPrisma()).toBe(first);

    setPrismaClient(second);
    expect(getPrisma()).toBe(second);
    expect(prisma.version).toBe(2);
  });

  it('PMS-PSF-04: 초기화 전 prisma proxy 접근 → Error throw', async () => {
    const { prisma } = await import('@withwiz/pms/infrastructure/prisma');
    expect(() => prisma.user).toThrow('Prisma client not initialized');
  });

  it('PMS-PSF-05: Proxy를 통한 다양한 모델 접근', async () => {
    const { setPrismaClient, prisma } = await import(
      '@withwiz/pms/infrastructure/prisma'
    );

    const mockClient = {
      user: { count: vi.fn().mockResolvedValue(42) },
      post: { findFirst: vi.fn().mockResolvedValue({ id: 'p1' }) },
      gallery: { deleteMany: vi.fn().mockResolvedValue({ count: 5 }) },
    };

    setPrismaClient(mockClient);

    expect(await prisma.user.count()).toBe(42);
    expect(await prisma.post.findFirst()).toEqual({ id: 'p1' });
    expect(await prisma.gallery.deleteMany()).toEqual({ count: 5 });
  });
});
