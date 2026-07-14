import { prisma } from "@/lib/prisma";
import { maxGroupsFor } from "@/lib/tournamentLimits";
import ParticipantsManager from "./ParticipantsManager";

export const dynamic = "force-dynamic";

export default async function ParticipantsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const tournament = await prisma.tournament.findUnique({
    where: { id },
    select: { maxPerGroup: true, startMethod: true },
  });
  const maxTotal =
    maxGroupsFor(tournament?.startMethod ?? "shotgun") *
    (tournament?.maxPerGroup ?? 8);
  const participants = await prisma.participant.findMany({
    where: { tournamentId: id },
    orderBy: [{ term: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
    include: { group: { select: { groupNo: true } } },
  });

  return (
    <ParticipantsManager
      tournamentId={id}
      maxTotal={maxTotal}
      initial={participants.map((p) => ({
        id: p.id,
        name: p.name,
        term: p.term,
        gender: p.gender,
        status: p.status,
        note: p.note,
        groupNo: p.group?.groupNo ?? null,
      }))}
    />
  );
}
