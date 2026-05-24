import { vi, beforeEach } from 'vitest';

const { replaceMock, adminFetchMock } = vi.hoisted(() => ({
  replaceMock: vi.fn(),
  adminFetchMock: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  usePathname: () => '/some/admin/page',
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

vi.mock('@withwiz/pms/utils/admin-fetch', () => ({
  adminFetch: adminFetchMock,
}));

import { render, screen, waitFor } from '@testing-library/react';
import AdminShell from '@withwiz/pms/components/AdminShell';
import { resetPmsConfig, setPmsConfig } from '@withwiz/pms/config';

const OLD_NAV = [
  'Performances',
  'Repertoires',
  'Artists',
  'Gallery',
  'Dashboard',
];

describe('AdminShell consumer config (PMS-ASC / §4.1 C1/C2)', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    resetPmsConfig();
    adminFetchMock.mockReset();
    replaceMock.mockReset();
    // authenticated: /me returns ok so the shell body (not the loading
    // state) renders.
    adminFetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: { user: { id: '1', email: 'a@b.c', name: 'A', role: 'admin' } },
      }),
    });
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
    resetPmsConfig();
  });

  it('PMS-ASC-01: injected brand + nav rendered exactly; no old hardcoded ones', async () => {
    const { container } = render(
      <AdminShell
        brandLabel="ACME Corp"
        navItems={[
          { label: 'Home', href: '/x/home', glyph: 'H' },
          { label: 'Reports', href: '/x/reports', glyph: 'R' },
        ]}
      >
        <div>child</div>
      </AdminShell>,
    );

    await waitFor(() =>
      expect(container.querySelector('.admin-sidebar-nav')).not.toBeNull(),
    );

    expect(screen.getByText('ACME Corp')).toBeTruthy();
    expect(screen.getByText('Home')).toBeTruthy();
    expect(screen.getByText('Reports')).toBeTruthy();
    const hrefs = Array.from(
      container.querySelectorAll('.admin-sidebar-nav a'),
    ).map((a) => a.getAttribute('href'));
    expect(hrefs).toEqual(['/x/home', '/x/reports']);

    const html = container.innerHTML;
    expect(html).not.toContain('DTS BALLET');
    for (const old of OLD_NAV) {
      expect(html).not.toContain(old);
    }
  });

  it('PMS-ASC-02: brand/nav via §5 setPmsConfig (no props)', async () => {
    setPmsConfig({
      brand: {
        brandLabel: 'Configured Brand',
        navItems: [{ label: 'Only', href: '/only', glyph: 'O' }],
      },
    });
    const { container } = render(
      <AdminShell>
        <div>c</div>
      </AdminShell>,
    );
    await waitFor(() =>
      expect(container.querySelector('.admin-sidebar-nav')).not.toBeNull(),
    );
    expect(screen.getByText('Configured Brand')).toBeTruthy();
    expect(screen.getByText('Only')).toBeTruthy();
    expect(container.innerHTML).not.toContain('DTS BALLET');
  });

  it('PMS-ASC-03: unconfigured = safe neutral render + exactly one namespaced warn', async () => {
    const { container } = render(
      <AdminShell>
        <div>safe-child</div>
      </AdminShell>,
    );
    await waitFor(() =>
      expect(container.querySelector('.admin-sidebar-nav')).not.toBeNull(),
    );

    // (a) safe neutral: no crash, no DTS BALLET, none of the old nav items.
    const html = container.innerHTML;
    expect(html).not.toContain('DTS BALLET');
    for (const old of OLD_NAV) {
      expect(html).not.toContain(old);
    }
    // empty nav list, no nav links rendered.
    expect(container.querySelectorAll('.admin-sidebar-nav a').length).toBe(0);

    // (b) exactly one @withwiz/pms-namespaced warn naming the missing config.
    expect(warnSpy).toHaveBeenCalledTimes(1);
    const msg = String(warnSpy.mock.calls[0][0]);
    expect(msg).toContain('@withwiz/pms');
    expect(msg.toLowerCase()).toMatch(/nav|navigation|brand/);
  });
});
