import { redirect } from "next/navigation";
import Link from "next/link";
import { isAdminAuthed } from "@/lib/auth";
import LogoutButton from "./LogoutButton";

export default async function AdminAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!(await isAdminAuthed())) {
    redirect("/admin/login");
  }
  return (
    <div className="flex-1 flex flex-col">
      <header className="bg-brand-600 text-white shadow no-print">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/admin" className="font-bold text-lg">
            グラウンドゴルフ管理システム
          </Link>
          <LogoutButton />
        </div>
      </header>
      <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6">
        {children}
      </main>
    </div>
  );
}
