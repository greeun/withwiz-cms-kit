import Link from "next/link";

/** 사이드바 상단 로고: 사이트 홈(새 창) 링크와 관리자 홈 링크. */
export function AdminSidebarBrand({
  brandLabel,
  brandHref,
  adminHref,
}: {
  brandLabel: string | null;
  brandHref: string;
  adminHref: string;
}) {
  return (
    <div className="admin-sidebar-logo">
      {brandLabel && (
        <a href={brandHref} className="admin-logo-home" title="사이트 보기" target="_blank" rel="noopener noreferrer">{brandLabel}</a>
      )}
      <Link href={adminHref} className="admin-logo-admin">Admin</Link>
    </div>
  );
}
