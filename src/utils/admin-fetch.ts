import { resolveRouteConfig } from '../config';

let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;

/**
 * @deprecated Auth is now handled via httpOnly cookies. Returns empty headers.
 */
export function getAuthHeaders(): Record<string, string> {
  return {};
}

/**
 * @deprecated Auth is now handled via httpOnly cookies.
 */
export async function refreshAccessToken(): Promise<boolean> {
  return tryRefreshCookie();
}

async function tryRefreshCookie(): Promise<boolean> {
  try {
    // refresh 엔드포인트는 §5 config boundary 에서 해석된다 (consumer
    // override 가능; 미설정 시 레거시 기본 경로 — spec.md §4.1 C2 / B5).
    const { refreshEndpoint } = resolveRouteConfig();
    const res = await fetch(refreshEndpoint, {
      method: 'POST',
      credentials: 'same-origin',
    });

    if (!res.ok) return false;

    const data = await res.json();
    return data.success === true;
  } catch {
    return false;
  }
}

async function tryRefresh(): Promise<boolean> {
  if (isRefreshing && refreshPromise) {
    return refreshPromise;
  }

  isRefreshing = true;
  refreshPromise = tryRefreshCookie().finally(() => {
    isRefreshing = false;
    refreshPromise = null;
  });

  return refreshPromise;
}

export async function adminFetch(
  url: string,
  options: RequestInit = {},
): Promise<Response> {
  const res = await fetch(url, {
    ...options,
    credentials: 'same-origin',
  });

  if (res.status === 401 && typeof window !== 'undefined') {
    const refreshed = await tryRefresh();

    if (refreshed) {
      return fetch(url, { ...options, credentials: 'same-origin' });
    }

    // login 페이지 경로도 §5 config boundary 에서 해석된다.
    const { loginPath } = resolveRouteConfig();
    window.location.href = loginPath;
  }

  return res;
}
