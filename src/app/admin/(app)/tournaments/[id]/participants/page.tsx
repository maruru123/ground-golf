import { prisma } from "@/lib/prisma";
import ParticipantsManager from "./ParticipantsManager";

export const dynamic = "force-dynamic";

export default async function ParticipantsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const participants = await prisma.participant.findMany({
    where: { tournamentId: id },
    orderBy: [{ term: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
    include: { group: { select: { groupNo: true } } },
  });

  return (
    <ParticipantsManager
      tournamentId={id}
      initial={participants.map((p) => ({
        id: p.id,
        name: p.name,
        term: p.term,
        gender: p.gender,
        status: p.status,
        groupNo: p.group?.groupNo ?? null,
      }))}
    />
  );
}
