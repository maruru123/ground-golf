import { prisma } from "@/lib/prisma";
import { computeStandings } from "@/lib/standings";
import RankingView from "./RankingView";

export const dynamic = "force-dynamic";

export default async function RankingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [standings, awards] = await Promise.all([
    computeStandings(id),
    prisma.award.findMany({
      where: { tournamentId: id },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      include: {
        winners: {
          include: {
            participant: { select: { id: true, name: true, term: true } },
          },
        },
      },
    }),
  ]);

  return (
    <RankingView
      tournamentId={id}
      standings={standings}
      awards={awards.map((a) => ({
        id: a.id,
        name: a.name,
        kind: a.kind,
        winners: a.winners.map((w) => ({
          name: w.participant.name,
          term: w.participant.term,
          note: w.note,
        })),
      }))}
    />
  );
}
