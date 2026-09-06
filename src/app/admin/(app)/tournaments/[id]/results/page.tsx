import { prisma } from "@/lib/prisma";
import { computeStandings } from "@/lib/standings";
import ResultsTable from "./ResultsTable";

export const dynamic = "force-dynamic";

export default async function ResultsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [tournament, standings, scores] = await Promise.all([
    prisma.tournament.findUnique({
      where: { id },
      select: { name: true, holeCount: true, holesPerRound: true },
    }),
    // 順位・合計は順位表と同じ計算を使う
    computeStandings(id),
    prisma.score.findMany({
      where: { participant: { tournamentId: id } },
      select: { participantId: true, holeNo: true, strokes: true },
    }),
  ]);

  // 参加者ごとに ホール番号 -> 打数 のマップを作る
  const byParticipant = new Map<string, Record<string, number | null>>();
  for (const s of scores) {
    const m = byParticipant.get(s.participantId) ?? {};
    m[s.holeNo] = s.strokes;
    byParticipant.set(s.participantId, m);
  }

  return (
    <ResultsTable
      tournamentName={tournament?.name ?? ""}
      holeCount={tournament?.holeCount ?? 18}
      holesPerRound={tournament?.holesPerRound ?? tournament?.holeCount ?? 18}
      rows={standings.map((s) => ({
        participantId: s.participantId,
        name: s.name,
        term: s.term,
        groupNo: s.groupNo,
        status: s.status,
        rank: s.rank,
        eligible: s.eligible,
        total: s.summary.total,
        enteredHoles: s.summary.enteredHoles,
        complete: s.summary.complete,
        hioCount: s.summary.hioCount,
        scores: byParticipant.get(s.participantId) ?? {},
      }))}
    />
  );
}
