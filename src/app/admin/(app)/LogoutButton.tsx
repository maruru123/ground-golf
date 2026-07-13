"use client";

import { useRouter } from "next/navigation";

export default function LogoutButton() {
  const router = useRouter();
  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.replace("/admin/login");
    router.refresh();
  }
  return (
    <button
      onClick={logout}
      className="tap text-sm bg-white/15 hover:bg-white/25 rounded-lg px-3 py-1.5 transition"
    >
      ログアウト
    </button>
  );
}
