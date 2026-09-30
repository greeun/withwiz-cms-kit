import { useCallback, useEffect, useRef, useState } from "react";

const COLLAPSED_KEY = "admin_sidebar_collapsed";
const WIDTH_KEY = "admin_sidebar_width";
const DEFAULT_WIDTH = 200;
const MIN_WIDTH = 200;
const MAX_WIDTH = 400;

/**
 * 사이드바 레이아웃 상태: 접기(localStorage 유지), 모바일 열림, 드래그 너비
 * 조절(200~400px, localStorage 유지).
 */
export function useSidebarLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem(COLLAPSED_KEY) === "true";
    }
    return false;
  });
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(WIDTH_KEY);
      return saved ? Number(saved) : DEFAULT_WIDTH;
    }
    return DEFAULT_WIDTH;
  });
  const isResizing = useRef(false);
  const widthRef = useRef(sidebarWidth);
  const [dragging, setDragging] = useState(false);

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
    localStorage.setItem(WIDTH_KEY, String(widthRef.current));
    document.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("mouseup", handleMouseUp);
  }, [handleMouseMove]);

  // 드래그 도중 언마운트되면 문서에 남은 리스너와 커서 스타일을 정리한다.
  useEffect(() => {
    return () => {
      if (!isResizing.current) return;
      isResizing.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(COLLAPSED_KEY, String(next));
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

  return {
    collapsed,
    toggleCollapsed,
    mobileOpen,
    setMobileOpen,
    sidebarWidth,
    dragging,
    startResize,
  };
}
