import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  TOURNAMENT_STATUS_LABELS,
  TOURNAMENT_STATUS_STYLES,
} from "@/lib/labels";
import SubNav from "./SubNav";

export default async function TournamentLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const tournament = await prisma.tournament.findUnique({
    where: { id },
    select: { id: true, name: true, status: true },
  });
  if (!tournament) notFound();

  return (
    <div className="space-y-4">
      <div className="no-print">
        <Link
          href="/admin"
          className="text-sm text-slate-500 hover:text-slate-700"
        >
          ← 大会一覧
        </Link>
        <div className="flex items-center gap-3 mt-1 flex-wrap">
          <h1 className="text-xl font-bold text-slate-800">{tournament.name}</h1>
          <span
            className={`text-xs font-semibold px-2 py-1 rounded-full ${
              TOURNAMENT_STATUS_STYLES[tournament.status] ?? ""
            }`}
          >
            {TOURNAMENT_STATUS_LABELS[tournament.status] ?? tournament.status}
          </span>
        </div>
      </div>
      <div className="no-print">
        <SubNav id={id} />
      </div>
      <div>{children}</div>
    </div>
  );
}
