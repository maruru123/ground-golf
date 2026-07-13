import { prisma } from "@/lib/prisma";
import PairingEditor from "./PairingEditor";

export const dynamic = "force-dynamic";

export default async function PairingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [groups, participants] = await Promise.all([
    prisma.group.findMany({
      where: { tournamentId: id },
      orderBy: { groupNo: "asc" },
      select: { groupNo: true, name: true, startHole: true },
    }),
    prisma.participant.findMany({
      where: { tournamentId: id },
      orderBy: [{ term: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        term: true,
        group: { select: { groupNo: true } },
      },
    }),
  ]);

  const parts = participants.map((p) => ({
    id: p.id,
    name: p.name,
    term: p.term,
    groupNo: p.group?.groupNo ?? null,
  }));

  const signature = JSON.stringify({
    g: groups,
    a: parts.map((p) => [p.id, p.groupNo]),
  });

  return (
    <PairingEditor
      key={signature}
      tournamentId={id}
      initialGroups={groups.map((g) => ({
        groupNo: g.groupNo,
        name: g.name ?? "",
        startHole: g.startHole,
      }))}
      participants={parts}
    />
  );
}
