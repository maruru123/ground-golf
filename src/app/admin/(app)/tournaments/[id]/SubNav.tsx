"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { seg: "", label: "設定" },
  { seg: "participants", label: "参加者" },
  { seg: "pairing", label: "ペアリング" },
  { seg: "scores", label: "スコア" },
  { seg: "ranking", label: "順位・表彰" },
  { seg: "analysis", label: "分析" },
];

export default function SubNav({ id }: { id: string }) {
  const pathname = usePathname();
  const base = `/admin/tournaments/${id}`;
  return (
    <nav className="flex gap-1 overflow-x-auto border-b border-slate-200 -mx-1 px-1">
      {tabs.map((t) => {
        const href = t.seg ? `${base}/${t.seg}` : base;
        const active =
          t.seg === ""
            ? pathname === base
            : pathname === href || pathname.startsWith(href + "/");
        return (
          <Link
            key={t.seg}
            href={href}
            className={`tap whitespace-nowrap px-4 py-2 text-sm font-medium border-b-2 -mb-px transition ${
              active
                ? "border-brand-500 text-brand-600"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
