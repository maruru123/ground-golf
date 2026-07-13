import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { computeStandings } from "@/lib/standings";
import RankingTableRO from "./RankingTableRO";
import PasswordGate from "./PasswordGate";

export const dynamic = "force-dynamic";

export default async function ViewPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const tournament = await prisma.tournament.findUnique({
    where: { viewToken: token },
    select: { id: true, name: true, viewEnabled: true, viewPassword: true },
  });
  if (!tournament || !tournament.viewEnabled) notFound();

  if (tournament.viewPassword) {
    return <PasswordGate token={token} />;
  }

  const standings = await computeStandings(tournament.id);
  const rows = standings.map((s) => ({
    name: s.name,
    term: s.term,
    rank: s.rank,
    eligible: s.eligible,
    out: s.summary.out,
    in: s.summary.in,
    total: s.summary.total,
    hioCount: s.summary.hioCount,
    complete: s.summary.complete,
    status: s.status,
    entered: s.summary.enteredHoles,
  }));

  return (
    <main className="flex-1 p-4 max-w-2xl mx-auto w-full space-y-4">
      <h1 className="text-xl font-bold text-slate-800">
        {tournament.name} 順位表
      </h1>
      <RankingTableRO rows={rows} />
    </main>
  );
}
