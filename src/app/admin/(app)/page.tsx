import Link from "next/link";
import { prisma } from "@/lib/prisma";
import {
  TOURNAMENT_STATUS_LABELS,
  TOURNAMENT_STATUS_STYLES,
} from "@/lib/labels";
import NewTournamentForm from "./NewTournamentForm";

export const dynamic = "force-dynamic";

function formatDate(d: Date | null): string {
  if (!d) return "日付未設定";
  return new Date(d).toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default async function AdminDashboard() {
  const tournaments = await prisma.tournament.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { participants: true, groups: true } } },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-bold text-slate-800">大会一覧</h1>
        <NewTournamentForm />
      </div>

      {tournaments.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-10 text-center text-slate-500">
          まだ大会がありません。「新しい大会を作成」から始めましょう。
        </div>
      ) : (
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {tournaments.map((t) => (
            <li key={t.id}>
              <Link
                href={`/admin/tournaments/${t.id}`}
                className="block bg-white rounded-2xl border border-slate-200 p-5 hover:border-brand-400 hover:shadow-sm transition"
              >
                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-bold text-lg text-slate-800">{t.name}</h2>
                  <span
                    className={`text-xs font-semibold px-2 py-1 rounded-full whitespace-nowrap ${
                      TOURNAMENT_STATUS_STYLES[t.status] ?? ""
                    }`}
                  >
                    {TOURNAMENT_STATUS_LABELS[t.status] ?? t.status}
                  </span>
                </div>
                <p className="text-sm text-slate-500 mt-1">
                  {formatDate(t.heldDate)}
                  {t.venue ? `／${t.venue}` : ""}
                </p>
                <p className="text-sm text-slate-600 mt-3">
                  参加者 {t._count.participants} 名／{t._count.groups} 組
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
