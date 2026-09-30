import { useRouter } from "next/navigation";

/** 로그아웃 엔드포인트를 POST 로 요청한 뒤 로그인 페이지로 이동하는 버튼. */
export function AdminLogoutButton({
  logoutEndpoint,
  loginPath,
  collapsed,
}: {
  logoutEndpoint: string;
  loginPath: string;
  collapsed: boolean;
}) {
  const router = useRouter();

  async function handleLogout() {
    await fetch(logoutEndpoint, { method: "POST", credentials: "same-origin" });
    router.replace(loginPath);
  }

  return (
    <button className="admin-sidebar-logout" onClick={handleLogout} title="로그아웃">
      {collapsed ? "✕" : "로그아웃"}
    </button>
  );
}
