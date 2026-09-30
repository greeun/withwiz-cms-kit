import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { adminFetch } from "../../utils/admin-fetch";

/** "현재 사용자" 엔드포인트가 돌려주는 관리자 정보 */
export interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  role: string;
}

/**
 * 관리자 인증 확인. 로그인 페이지가 아니면 마운트 시 "현재 사용자"
 * 엔드포인트를 확인하고, 실패하면 로그인 페이지로 보낸다.
 *
 * @returns checking: 확인이 끝나기 전 true. user: 확인된 사용자(없으면 null).
 */
export function useAdminAuthGate({
  isLoginPage,
  meEndpoint,
  loginPath,
}: {
  isLoginPage: boolean;
  meEndpoint: string;
  loginPath: string;
}): { checking: boolean; user: AdminUser | null } {
  const router = useRouter();
  const routerRef = useRef(router);
  routerRef.current = router;

  const [checking, setChecking] = useState(true);
  const [user, setUser] = useState<AdminUser | null>(null);

  useEffect(() => {
    if (isLoginPage) {
      setChecking(false);
      return;
    }

    let cancelled = false;

    async function checkAuth() {
      try {
        const res = await adminFetch(meEndpoint);
        if (cancelled) return;

        if (!res.ok) {
          routerRef.current.replace(loginPath);
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
          routerRef.current.replace(loginPath);
          return;
        }
      }

      setChecking(false);
    }

    checkAuth();
    return () => { cancelled = true; };
  // 인증 확인은 로그인 페이지 여부가 바뀔 때만 다시 한다 (엔드포인트 값 변경으로 재요청하지 않음).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoginPage]);

  return { checking, user };
}
