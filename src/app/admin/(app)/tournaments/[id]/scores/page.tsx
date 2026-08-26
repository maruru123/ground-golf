import { prisma } from "@/lib/prisma";
import ScoreMonitor from "./ScoreMonitor";

export const dynamic = "force-dynamic";

export default async function ScoresPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const tournament = await prisma.tournament.findUnique({
    where: { id },
    select: {
      hioPoints: true,
      maxStrokes: true,
      holeCount: true,
      holesPerRound: true,
    },
  });
  const rule = {
    hioPoints: tournament?.hioPoints ?? -3,
    maxStrokes: tournament?.maxStrokes ?? 5,
  };
  const holeCount = tournament?.holeCount ?? 18;
  const holesPerRound = tournament?.holesPerRound ?? holeCount;
  const groups = await prisma.group.findMany({
    where: { tournamentId: id },
    orderBy: { groupNo: "asc" },
    include: {
      participants: {
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        include: { scores: { select: { holeNo: true, strokes: true } } },
      },
    },
  });

  const toMembers = (
    ps: {
      id: string;
      name: string;
      term: number | null;
      scores: { holeNo: number; strokes: number | null }[];
    }[]
  ) =>
    ps.map((p) => ({
      id: p.id,
      name: p.name,
      term: p.term,
      scores: Object.fromEntries(p.scores.map((s) => [s.holeNo, s.strokes])),
    }));

  return (
    <ScoreMonitor
      tournamentId={id}
      rule={rule}
      holeCount={holeCount}
      holesPerRound={holesPerRound}
      groups={groups.map((g) => ({
        groupNo: g.groupNo,
        name: g.name,
        startHole: g.startHole,
        members: toMembers(g.participants),
      }))}
    />
  );
}
