import { vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * CMS-ASB — AdminShell 동작과 책임 분리 (spec.md §4.7 DoD-26).
 *
 * AdminShell 을 인증 확인·사이드바 레이아웃·로고·내비게이션·로그아웃 단위로
 * 나눈 뒤에도 렌더링 동작이 같음을 확인한다. 동작 테스트(CMS-ASB-01~09)는
 * 분해 전 구현에서도 같은 결과를 낸다. CMS-ASB-10 은 분해하면서 추가한 정리
 * 동작(드래그 중 언마운트)을 검증한다.
 */

const { replaceMock, adminFetchMock, pathnameRef } = vi.hoisted(() => ({
  replaceMock: vi.fn(),
  adminFetchMock: vi.fn(),
  pathnameRef: { current: '/admin/posts' as string | null },
}));

vi.mock('next/navigation', () => ({
  usePathname: () => pathnameRef.current,
  useRouter: () => ({ replace: replaceMock, push: vi.fn() }),
}));

vi.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, children, ...rest }: any) => (
    <a href={typeof href === 'string' ? href : '#'} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock('next/dynamic', () => ({
  __esModule: true,
  default: () => () => null,
}));

vi.mock('@withwiz/cms-kit/utils/admin-fetch', () => ({
  adminFetch: adminFetchMock,
}));

import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import AdminShell from '@withwiz/cms-kit/components/AdminShell';
import { resetCmsConfig } from '@withwiz/cms-kit/config';

const NAV = [
  { label: '글', href: '/admin/posts', glyph: 'P' },
  { label: '설정', href: '/admin/settings', glyph: 'S' },
];

function authed() {
  adminFetchMock.mockResolvedValue({
    ok: true,
    json: async () => ({
      success: true,
      data: { user: { id: '1', email: 'admin@example.com', name: 'A', role: 'admin' } },
    }),
  });
}

async function renderShell(props: Partial<React.ComponentProps<typeof AdminShell>> = {}) {
  const utils = render(
    <AdminShell brandLabel="Site" navItems={NAV} {...props}>
      <p>content</p>
    </AdminShell>,
  );
  await waitFor(() => expect(utils.container.querySelector('.admin-layout')).not.toBeNull());
  return utils;
}

const fetchMock = vi.fn();

beforeEach(() => {
  resetCmsConfig();
  localStorage.clear();
  pathnameRef.current = '/admin/posts';
  adminFetchMock.mockReset();
  replaceMock.mockReset();
  fetchMock.mockReset().mockResolvedValue({ ok: true });
  vi.stubGlobal('fetch', fetchMock);
  authed();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  document.body.style.cursor = '';
  document.body.style.userSelect = '';
});

describe('AdminShell behavior (CMS-ASB)', () => {
  it('CMS-ASB-01: 확인 전에는 로딩 표시, 확인 후 사용자 이메일과 본문을 보인다', async () => {
    const { container } = render(
      <AdminShell brandLabel="Site" navItems={NAV}>
        <p>content</p>
      </AdminShell>,
    );
    expect(container.querySelector('.admin-auth-loading')?.textContent).toBe('인증 확인 중...');
    await waitFor(() => expect(screen.getByText('admin@example.com')).toBeTruthy());
    expect(screen.getByText('content')).toBeTruthy();
    expect(adminFetchMock).toHaveBeenCalledWith('/api/admin/auth/me');
  });

  it('CMS-ASB-02: 인증 실패(401)면 로그인 경로로 보낸다', async () => {
    adminFetchMock.mockResolvedValue({ ok: false, json: async () => ({}) });
    render(<AdminShell loginPath="/signin" navItems={NAV}><p>x</p></AdminShell>);
    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith('/signin'));
  });

  it('CMS-ASB-03: 인증 요청이 예외를 던져도 로그인 경로로 보낸다', async () => {
    adminFetchMock.mockRejectedValue(new Error('network'));
    render(<AdminShell navItems={NAV}><p>x</p></AdminShell>);
    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith('/admin/login'));
  });

  it('CMS-ASB-04: 로그인 페이지에서는 인증 확인 없이 본문만 렌더링한다', async () => {
    pathnameRef.current = '/admin/login';
    const { container } = render(<AdminShell navItems={NAV}><p>login form</p></AdminShell>);
    expect(screen.getByText('login form')).toBeTruthy();
    expect(container.querySelector('.admin-layout')).toBeNull();
    expect(adminFetchMock).not.toHaveBeenCalled();
  });

  it('CMS-ASB-05: 로그아웃은 엔드포인트에 POST 한 뒤 로그인 경로로 이동한다', async () => {
    await renderShell({ logoutEndpoint: '/api/bye', loginPath: '/signin' });
    await act(async () => {
      fireEvent.click(screen.getByTitle('로그아웃'));
    });
    expect(fetchMock).toHaveBeenCalledWith('/api/bye', { method: 'POST', credentials: 'same-origin' });
    expect(replaceMock).toHaveBeenCalledWith('/signin');
  });

  it('CMS-ASB-06: 접기 버튼은 접힘 상태를 바꾸고 localStorage 에 저장한다', async () => {
    const { container } = await renderShell();
    const layout = container.querySelector('.admin-layout')!;
    expect(layout.classList.contains('admin-sidebar-collapsed')).toBe(false);
    expect(container.querySelector('.admin-sidebar-logo')).not.toBeNull();

    fireEvent.click(screen.getByTitle('메뉴 접기'));
    expect(layout.classList.contains('admin-sidebar-collapsed')).toBe(true);
    expect(localStorage.getItem('admin_sidebar_collapsed')).toBe('true');
    expect(container.querySelector('.admin-sidebar-logo')).toBeNull();
    expect(container.querySelector('.admin-sidebar-user')).toBeNull();
    expect(Array.from(container.querySelectorAll('.admin-sidebar-nav a')).map((a) => a.textContent)).toEqual([
      'P',
      'S',
    ]);
    expect(screen.getByTitle('로그아웃').textContent).toBe('✕');
  });

  it('CMS-ASB-07: 저장된 접힘 상태와 너비로 시작한다', async () => {
    localStorage.setItem('admin_sidebar_width', '320');
    const { container } = await renderShell();
    expect((container.querySelector('.admin-sidebar') as HTMLElement).style.width).toBe('320px');
    expect((container.querySelector('.admin-main') as HTMLElement).style.marginLeft).toBe('320px');
    cleanup();

    localStorage.setItem('admin_sidebar_collapsed', 'true');
    const second = await renderShell();
    expect(second.container.querySelector('.admin-layout')!.classList.contains('admin-sidebar-collapsed')).toBe(true);
    expect((second.container.querySelector('.admin-sidebar') as HTMLElement).style.width).toBe('');
  });

  it('CMS-ASB-08: 너비 조절은 200~400px 로 제한하고 놓을 때 저장한다', async () => {
    const { container } = await renderShell();
    const layout = container.querySelector('.admin-layout')!;
    fireEvent.mouseDown(container.querySelector('.admin-sidebar-resize')!);
    expect(layout.classList.contains('admin-resizing')).toBe(true);
    expect(document.body.style.cursor).toBe('col-resize');

    act(() => {
      document.dispatchEvent(new MouseEvent('mousemove', { clientX: 999 }));
    });
    expect((container.querySelector('.admin-sidebar') as HTMLElement).style.width).toBe('400px');
    act(() => {
      document.dispatchEvent(new MouseEvent('mousemove', { clientX: 50 }));
    });
    expect((container.querySelector('.admin-sidebar') as HTMLElement).style.width).toBe('200px');
    act(() => {
      document.dispatchEvent(new MouseEvent('mousemove', { clientX: 260 }));
      document.dispatchEvent(new MouseEvent('mouseup'));
    });
    expect(localStorage.getItem('admin_sidebar_width')).toBe('260');
    expect(layout.classList.contains('admin-resizing')).toBe(false);
    expect(document.body.style.cursor).toBe('');

    act(() => {
      document.dispatchEvent(new MouseEvent('mousemove', { clientX: 380 }));
    });
    expect((container.querySelector('.admin-sidebar') as HTMLElement).style.width).toBe('260px');
  });

  it('CMS-ASB-09: 모바일 메뉴는 열기 버튼·오버레이·링크 클릭으로 열리고 닫힌다', async () => {
    const { container } = await renderShell();
    const layout = container.querySelector('.admin-layout')!;
    fireEvent.click(screen.getByLabelText('메뉴 열기'));
    expect(layout.classList.contains('admin-sidebar-mobile-open')).toBe(true);
    expect(container.querySelector('.admin-sidebar-toggle')!.textContent).toBe('✕');

    fireEvent.click(container.querySelector('.admin-sidebar-overlay')!);
    expect(layout.classList.contains('admin-sidebar-mobile-open')).toBe(false);

    fireEvent.click(screen.getByLabelText('메뉴 열기'));
    fireEvent.click(screen.getByText('설정'));
    expect(layout.classList.contains('admin-sidebar-mobile-open')).toBe(false);

    fireEvent.click(screen.getByLabelText('메뉴 열기'));
    fireEvent.click(container.querySelector('.admin-sidebar-toggle')!);
    expect(layout.classList.contains('admin-sidebar-mobile-open')).toBe(false);
    expect(layout.classList.contains('admin-sidebar-collapsed')).toBe(false);
  });
});

describe('AdminShell resize cleanup (CMS-ASB)', () => {
  it('CMS-ASB-10: 드래그 중 언마운트하면 문서 리스너와 커서 스타일을 정리한다', async () => {
    const removeSpy = vi.spyOn(document, 'removeEventListener');
    const { container, unmount } = await renderShell();
    fireEvent.mouseDown(container.querySelector('.admin-sidebar-resize')!);
    expect(document.body.style.cursor).toBe('col-resize');

    unmount();
    expect(document.body.style.cursor).toBe('');
    expect(document.body.style.userSelect).toBe('');
    const removed = removeSpy.mock.calls.map((c) => c[0]);
    expect(removed).toEqual(expect.arrayContaining(['mousemove', 'mouseup']));
    removeSpy.mockRestore();
  });
});

describe('AdminShell decomposition (CMS-ASB)', () => {
  it('CMS-ASB-20: AdminShell 본문은 인증·저장소·드래그·로그아웃 구현을 직접 갖지 않는다', () => {
    const src = readFileSync(resolve(__dirname, '../src/components/AdminShell.tsx'), 'utf-8');
    for (const marker of ['adminFetch', 'localStorage', 'addEventListener', 'fetch(', 'useEffect', 'useState']) {
      expect(src, marker).not.toContain(marker);
    }
    for (const unit of ['useAdminAuthGate', 'useSidebarLayout', 'AdminSidebarBrand', 'AdminSidebarNav', 'AdminLogoutButton']) {
      expect(src, unit).toContain(unit);
    }
  });
});
