import { vi, beforeEach } from 'vitest';

const { pathnameState, adminFetchMock } = vi.hoisted(() => ({
  pathnameState: { current: '/admin' as string | null },
  adminFetchMock: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  usePathname: () => pathnameState.current,
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
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

import { render, waitFor } from '@testing-library/react';
import AdminShell from '@withwiz/cms-kit/components/AdminShell';
import { resetCmsConfig } from '@withwiz/cms-kit/config';
import type { CmsNavItem } from '@withwiz/cms-kit/config';

const NAV: CmsNavItem[] = [
  { label: 'Dashboard', href: '/admin', glyph: 'D' },
  { label: 'News', href: '/admin/news', glyph: 'N' },
  { label: 'Gallery', href: '/admin/gallery', glyph: 'G' },
];

async function renderShell(pathname: string | null, navItems = NAV) {
  pathnameState.current = pathname;
  const { container } = render(
    <AdminShell brandLabel="Brand" navItems={navItems}>
      <div>child</div>
    </AdminShell>,
  );
  await waitFor(() =>
    expect(container.querySelector('.admin-sidebar-nav')).not.toBeNull(),
  );
  return Array.from(
    container.querySelectorAll<HTMLAnchorElement>('.admin-sidebar-nav a'),
  );
}

/** 현재 페이지로 표시된 링크의 href 목록 (aria-current 또는 active 중 하나라도 있으면 포함). */
function markedHrefs(links: HTMLAnchorElement[]) {
  return links
    .filter((a) => a.hasAttribute('aria-current') || a.classList.contains('active'))
    .map((a) => a.getAttribute('href'));
}

function expectCurrent(link: HTMLAnchorElement) {
  expect(link.getAttribute('aria-current')).toBe('page');
  expect(link.className).toBe('admin-sidebar-link active');
}

function expectNotCurrent(link: HTMLAnchorElement) {
  expect(link.hasAttribute('aria-current')).toBe(false);
  expect(link.className).toBe('admin-sidebar-link');
}

describe('AdminShell sidebar current page (CMS-ASC-CUR / WCAG 현재 위치)', () => {
  beforeEach(() => {
    resetCmsConfig();
    localStorage.clear();
    adminFetchMock.mockReset();
    adminFetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: { user: { id: '1', email: 'a@b.c', name: 'A', role: 'admin' } },
      }),
    });
  });

  afterEach(() => {
    localStorage.clear();
    resetCmsConfig();
  });

  it('CMS-ASC-CUR-01: 경로가 href 와 같으면 그 링크에 aria-current="page" 와 active 를 설정한다', async () => {
    const links = await renderShell('/admin/gallery');
    const [dashboard, news, gallery] = links;

    expectCurrent(gallery);
    expectNotCurrent(dashboard);
    expectNotCurrent(news);
  });

  it('CMS-ASC-CUR-02: 하위 경로(/admin/news/abc/edit)에서는 상위 href 링크가 현재 페이지다', async () => {
    const links = await renderShell('/admin/news/abc/edit');

    expect(markedHrefs(links)).toEqual(['/admin/news']);
    expectCurrent(links[1]);
  });

  it('CMS-ASC-CUR-03: 경로 경계를 지킨다 (/admin/newsletter 는 /admin/news 가 아니다)', async () => {
    const links = await renderShell('/admin/newsletter', [
      { label: 'News', href: '/admin/news', glyph: 'N' },
      { label: 'Gallery', href: '/admin/gallery', glyph: 'G' },
    ]);

    expect(markedHrefs(links)).toEqual([]);
    for (const link of links) expectNotCurrent(link);
  });

  it('CMS-ASC-CUR-04: 여러 링크가 일치하면 가장 긴 href 하나만 현재 페이지로 표시한다', async () => {
    const links = await renderShell('/admin/news');

    expect(markedHrefs(links)).toEqual(['/admin/news']);
    expectCurrent(links[1]);
    expectNotCurrent(links[0]);
  });

  it('CMS-ASC-CUR-05: 경계 밖 하위 경로에서는 더 짧은 일치 링크(/admin)가 현재 페이지다', async () => {
    const links = await renderShell('/admin/newsletter');

    expect(markedHrefs(links)).toEqual(['/admin']);
    expectCurrent(links[0]);
  });

  it('CMS-ASC-CUR-06: 사이드바가 접힌 상태에서도 같은 속성을 유지한다', async () => {
    localStorage.setItem('admin_sidebar_collapsed', 'true');
    const links = await renderShell('/admin/news/abc/edit');

    // 접힌 상태임을 확인한다: 라벨 대신 glyph 를 렌더링한다.
    expect(links.map((a) => a.textContent)).toEqual(['D', 'N', 'G']);
    expect(markedHrefs(links)).toEqual(['/admin/news']);
    expectCurrent(links[1]);
    expectNotCurrent(links[0]);
    expectNotCurrent(links[2]);
  });

  it('CMS-ASC-CUR-07: usePathname 이 null 이면 어떤 링크도 현재 페이지로 표시하지 않는다', async () => {
    const links = await renderShell(null);

    expect(links).toHaveLength(3);
    expect(markedHrefs(links)).toEqual([]);
    for (const link of links) expectNotCurrent(link);
  });
});
