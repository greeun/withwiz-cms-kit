"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import dynamic from "next/dynamic";

const Toaster = dynamic(
  () => import("sonner").then((m) => m.Toaster),
  { ssr: false }
);
import { adminFetch } from "../utils/admin-fetch";
import {
  resolveBrandConfig,
  resolveRouteConfig,
  type PmsNavItem,
} from "../config";

interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  role: string;
}

/**
 * AdminShell props (spec.md §4.1 / Sprint 1 C1/C2).
 *
 * brand/nav/route 는 더 이상 하드코딩되지 않는다. 우선순위:
 * props > §5 config boundary (`setPmsConfig`) > 안전 중립 기본값
 * (빈 nav + 1회 `@withwiz/pms:` warn, route 는 레거시 기본 경로).
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
  navItems?: PmsNavItem[];
  /** 로그인 페이지 경로 (라우트 가드/리다이렉트). */
  loginPath?: string;
  /** "현재 사용자" 엔드포인트. */
  meEndpoint?: string;
  /** 로그아웃 엔드포인트. */
  logoutEndpoint?: string;
}

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
  const router = useRouter();
  const routerRef = useRef(router);
  routerRef.current = router;

  // props > §5 config boundary > safe default. The single
  // @withwiz/pms-namespaced warn-once fires ONLY when neither props NOR §5
  // config supply brand/nav (props are a valid injection — suppress warn).
  const brandSuppliedViaProps =
    brandLabel !== undefined || navItems !== undefined;
  const brandCfg = resolveBrandConfig(brandSuppliedViaProps);
  const routeCfg = resolveRouteConfig();
  const resolvedBrandLabel =
    brandLabel ?? brandCfg.brandLabel ?? null;
  const resolvedBrandHref = brandHref ?? brandCfg.brandHref;
  const resolvedAdminHref = adminHref ?? brandCfg.adminHref;
  const resolvedNav: PmsNavItem[] = navItems ?? brandCfg.navItems;
  const resolvedLoginPath = loginPath ?? routeCfg.loginPath;
  const resolvedMeEndpoint = meEndpoint ?? routeCfg.meEndpoint;
  const resolvedLogoutEndpoint = logoutEndpoint ?? routeCfg.logoutEndpoint;

  const [checking, setChecking] = useState(true);
  const [user, setUser] = useState<AdminUser | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("admin_sidebar_collapsed") === "true";
    }
    return false;
  });

  const DEFAULT_WIDTH = 200;
  const MIN_WIDTH = 200;
  const MAX_WIDTH = 400;

  const [sidebarWidth, setSidebarWidth] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("admin_sidebar_width");
      return saved ? Number(saved) : DEFAULT_WIDTH;
    }
    return DEFAULT_WIDTH;
  });
  const isResizing = useRef(false);
  const widthRef = useRef(sidebarWidth);
  const [dragging, setDragging] = useState(false);

  const isLoginPage = pathname === resolvedLoginPath;

  useEffect(() => {
    if (isLoginPage) {
      setChecking(false);
      return;
    }

    let cancelled = false;

    async function checkAuth() {
      try {
        const res = await adminFetch(resolvedMeEndpoint);
        if (cancelled) return;

        if (!res.ok) {
          routerRef.current.replace(resolvedLoginPath);
          return;
        }

        const data = await res.json();
        if (data.success && data.data?.user) {
          const u = data.data.user as AdminUser;
          setUser((prev) =>
            prev?.email === u.email && prev?.id === u.id ? prev : u
          );
        }
      } catch {
        if (!cancelled) {
          routerRef.current.replace(resolvedLoginPath);
          return;
        }
      }

      setChecking(false);
    }

    checkAuth();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoginPage]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing.current) return;
    const newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, e.clientX));
    widthRef.current = newWidth;
    setSidebarWidth(newWidth);
  }, []);

  const handleMouseUp = useCallback(() => {
    if (!isResizing.current) return;
    isResizing.current = false;
    setDragging(false);
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
    localStorage.setItem("admin_sidebar_width", String(widthRef.current));
    document.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("mouseup", handleMouseUp);
  }, [handleMouseMove]);

  if (isLoginPage) {
    return <>{children}</>;
  }

  if (checking) {
    return <div className="admin-auth-loading">인증 확인 중...</div>;
  }

  async function handleLogout() {
    await fetch(resolvedLogoutEndpoint, { method: "POST", credentials: "same-origin" });
    router.replace(resolvedLoginPath);
  }

  function toggleSidebar() {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("admin_sidebar_collapsed", String(next));
      return next;
    });
  }

  function startResize(e: React.MouseEvent) {
    e.preventDefault();
    isResizing.current = true;
    setDragging(true);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
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
            <div className="admin-sidebar-logo">
              {resolvedBrandLabel && (
                <a href={resolvedBrandHref} className="admin-logo-home" title="사이트 보기" target="_blank" rel="noopener noreferrer">{resolvedBrandLabel}</a>
              )}
              <Link href={resolvedAdminHref} className="admin-logo-admin">Admin</Link>
            </div>
          )}
          <button
            className="admin-sidebar-toggle"
            onClick={() => {
              if (mobileOpen) {
                setMobileOpen(false);
              } else {
                toggleSidebar();
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
        <nav className="admin-sidebar-nav">
          {resolvedNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="admin-sidebar-link"
              title={item.label}
              onClick={() => setMobileOpen(false)}
            >
              {collapsed ? item.glyph : item.label}
            </Link>
          ))}
        </nav>
        <div className="admin-sidebar-footer">
          <button className="admin-sidebar-logout" onClick={handleLogout} title="로그아웃">
            {collapsed ? "✕" : "로그아웃"}
          </button>
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
