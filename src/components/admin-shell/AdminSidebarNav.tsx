import Link from "next/link";
import type { CmsNavItem } from "../../config";

/**
 * 현재 페이지에 해당하는 nav href: 경로가 href 와 같거나 `href/` 로 시작하는
 * 항목 중 가장 긴 href 하나. 경로 경계를 지켜 /admin/newsletter 는 /admin/news 가 아니다.
 */
export function findCurrentNavHref(
  pathname: string | null,
  items: readonly CmsNavItem[],
): string | null {
  if (!pathname) return null;
  return items.reduce<string | null>((best, item) => {
    const matches = pathname === item.href || pathname.startsWith(`${item.href}/`);
    return matches && (best === null || item.href.length > best.length)
      ? item.href
      : best;
  }, null);
}

/** 사이드바 nav 링크 목록. 접힌 상태에서는 라벨 대신 글리프를 보인다. */
export function AdminSidebarNav({
  items,
  pathname,
  collapsed,
  onNavigate,
}: {
  items: readonly CmsNavItem[];
  pathname: string | null;
  collapsed: boolean;
  onNavigate: () => void;
}) {
  const currentNavHref = findCurrentNavHref(pathname, items);
  return (
    <nav className="admin-sidebar-nav">
      {items.map((item) => {
        const isCurrent = item.href === currentNavHref;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`admin-sidebar-link${isCurrent ? " active" : ""}`}
            aria-current={isCurrent ? "page" : undefined}
            title={item.label}
            onClick={onNavigate}
          >
            {collapsed ? item.glyph : item.label}
          </Link>
        );
      })}
    </nav>
  );
}
