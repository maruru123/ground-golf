import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import SettingsForm from "./SettingsForm";

export const dynamic = "force-dynamic";

export default async function TournamentSettingsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const t = await prisma.tournament.findUnique({ where: { id } });
  if (!t) notFound();

  return (
    <SettingsForm
      tournament={{
        id: t.id,
        name: t.name,
        heldDate: t.heldDate
          ? new Date(t.heldDate).toISOString().slice(0, 10)
          : "",
        venue: t.venue ?? "",
        status: t.status,
        startMethod: t.startMethod,
        hioPoints: t.hioPoints,
        maxStrokes: t.maxStrokes,
        maxPerGroup: t.maxPerGroup,
        scorePasscode: t.scorePasscode ?? "",
        viewEnabled: t.viewEnabled,
        viewToken: t.viewToken ?? "",
        viewPassword: t.viewPassword ?? "",
      }}
    />
  );
}
