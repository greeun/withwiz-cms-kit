"use client";

import { usePathname } from "next/navigation";
import dynamic from "next/dynamic";

const Toaster = dynamic(
  () => import("sonner").then((m) => m.Toaster),
  { ssr: false }
);
import {
  resolveBrandConfig,
  resolveRouteConfig,
  type CmsNavItem,
} from "../config";
import { useAdminAuthGate } from "./admin-shell/useAdminAuthGate";
import { useSidebarLayout } from "./admin-shell/useSidebarLayout";
import { AdminSidebarBrand } from "./admin-shell/AdminSidebarBrand";
import { AdminSidebarNav } from "./admin-shell/AdminSidebarNav";
import { AdminLogoutButton } from "./admin-shell/AdminLogoutButton";

/**
 * AdminShell props (spec.md §4.1 / Sprint 1 C1/C2).
 *
 * brand/nav/route 는 더 이상 하드코딩되지 않는다. 우선순위:
 * props > §5 config boundary (`setCmsConfig`) > 안전 중립 기본값
 * (빈 nav + 1회 `@withwiz/cms-kit:` warn, route 는 레거시 기본 경로).
 */
export interface AdminShellProps {
  children: React.ReactNode;
  /** 브랜드 라벨 (사이드바 홈 링크 텍스트). 미지정 시 §5 config. */
  brandLabel?: string;
  /** 브랜드 홈 링크 href. */
  brandHref?: string;
  /** admin 링크 href. */
  adminHref?: string;
  /** 순서 있는 nav 항목 목록 (label/href/glyph). */
  navItems?: CmsNavItem[];
  /** 로그인 페이지 경로 (라우트 가드/리다이렉트). */
  loginPath?: string;
  /** "현재 사용자" 엔드포인트. */
  meEndpoint?: string;
  /** 로그아웃 엔드포인트. */
  logoutEndpoint?: string;
}

/**
 * 관리자 레이아웃. 책임은 하위 단위로 나뉜다 (spec.md §4.7):
 *  - 인증 확인: `useAdminAuthGate`
 *  - 사이드바 접기·모바일 열림·너비 조절: `useSidebarLayout`
 *  - 로고: `AdminSidebarBrand`, 내비게이션: `AdminSidebarNav`, 로그아웃: `AdminLogoutButton`
 * 이 컴포넌트는 설정을 해석하고(props > §5 config > 기본값) 단위들을 배치한다.
 */
export default function AdminShell({
  children,
  brandLabel,
  brandHref,
  adminHref,
  navItems,
  loginPath,
  meEndpoint,
  logoutEndpoint,
}: AdminShellProps) {
  const pathname = usePathname();

  // props > §5 config boundary > safe default. The single
  // @withwiz/cms-kit-namespaced warn-once fires ONLY when neither props NOR §5
  // config supply brand/nav (props are a valid injection — suppress warn).
  const brandSuppliedViaProps =
    brandLabel !== undefined || navItems !== undefined;
  const brandCfg = resolveBrandConfig(brandSuppliedViaProps);
  const routeCfg = resolveRouteConfig();
  const resolvedBrandLabel =
    brandLabel ?? brandCfg.brandLabel ?? null;
  const resolvedBrandHref = brandHref ?? brandCfg.brandHref;
  const resolvedAdminHref = adminHref ?? brandCfg.adminHref;
  const resolvedNav: CmsNavItem[] = navItems ?? brandCfg.navItems;
  const resolvedLoginPath = loginPath ?? routeCfg.loginPath;
  const resolvedMeEndpoint = meEndpoint ?? routeCfg.meEndpoint;
  const resolvedLogoutEndpoint = logoutEndpoint ?? routeCfg.logoutEndpoint;

  const isLoginPage = pathname === resolvedLoginPath;

  const { checking, user } = useAdminAuthGate({
    isLoginPage,
    meEndpoint: resolvedMeEndpoint,
    loginPath: resolvedLoginPath,
  });
  const {
    collapsed,
    toggleCollapsed,
    mobileOpen,
    setMobileOpen,
    sidebarWidth,
    dragging,
    startResize,
  } = useSidebarLayout();

  if (isLoginPage) {
    return <>{children}</>;
  }

  if (checking) {
    return <div className="admin-auth-loading">인증 확인 중...</div>;
  }

  return (
    <div className={`admin-layout${collapsed ? " admin-sidebar-collapsed" : ""}${dragging ? " admin-resizing" : ""}${mobileOpen ? " admin-sidebar-mobile-open" : ""}`}>
      <button
        className="admin-mobile-toggle"
        onClick={() => setMobileOpen(true)}
        aria-label="메뉴 열기"
      >
        ☰
      </button>
      {mobileOpen && (
        <div className="admin-sidebar-overlay" onClick={() => setMobileOpen(false)} />
      )}
      <aside
        className="admin-sidebar"
        style={!collapsed ? { width: sidebarWidth } : undefined}
      >
        <div className="admin-sidebar-header">
          {!collapsed && (
            <AdminSidebarBrand
              brandLabel={resolvedBrandLabel}
              brandHref={resolvedBrandHref}
              adminHref={resolvedAdminHref}
            />
          )}
          <button
            className="admin-sidebar-toggle"
            onClick={() => {
              if (mobileOpen) {
                setMobileOpen(false);
              } else {
                toggleCollapsed();
              }
            }}
            title={collapsed ? "메뉴 펼치기" : "메뉴 접기"}
          >
            {mobileOpen ? "✕" : collapsed ? "›" : "‹"}
          </button>
        </div>
        {!collapsed && user && (
          <div className="admin-sidebar-user">{user.email}</div>
        )}
        <AdminSidebarNav
          items={resolvedNav}
          pathname={pathname}
          collapsed={collapsed}
          onNavigate={() => setMobileOpen(false)}
        />
        <div className="admin-sidebar-footer">
          <AdminLogoutButton
            logoutEndpoint={resolvedLogoutEndpoint}
            loginPath={resolvedLoginPath}
            collapsed={collapsed}
          />
        </div>
        {!collapsed && (
          <div
            className="admin-sidebar-resize"
            onMouseDown={startResize}
          />
        )}
      </aside>
      <main
        className="admin-main"
        style={!collapsed ? { marginLeft: sidebarWidth, width: `calc(100vw - ${sidebarWidth}px)` } : undefined}
      >{children}</main>
      <Toaster position="top-center" richColors closeButton duration={3000} />
    </div>
  );
}
