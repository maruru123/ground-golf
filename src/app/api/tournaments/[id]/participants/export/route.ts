import Papa from "papaparse";
import { prisma } from "@/lib/prisma";
import { guardAdmin } from "@/lib/api";
import { GENDER_LABELS, PARTICIPANT_STATUS_LABELS } from "@/lib/labels";

export async function GET(
  _req: Request,
  ctx: RouteContext<"/api/tournaments/[id]/participants/export">
) {
  const denied = await guardAdmin();
  if (denied) return denied;
  const { id } = await ctx.params;

  const participants = await prisma.participant.findMany({
    where: { tournamentId: id },
    orderBy: [{ term: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
    include: { group: { select: { groupNo: true } } },
  });

  const rows = participants.map((p) => ({
    参加者ID: p.id,
    名前: p.name,
    期: p.term ?? "",
    性別: p.gender ? GENDER_LABELS[p.gender] ?? "" : "",
    組番号: p.group?.groupNo ?? "",
    状態: PARTICIPANT_STATUS_LABELS[p.status] ?? "",
  }));

  const csv = Papa.unparse(
    {
      fields: ["参加者ID", "名前", "期", "性別", "組番号", "状態"],
      data: rows.map((r) => [
        r.参加者ID,
        r.名前,
        r.期,
        r.性別,
        r.組番号,
        r.状態,
      ]),
    },
    { quotes: false }
  );

  // Excelでの文字化け回避のためBOM付きUTF-8
  const bom = "﻿";
  return new Response(bom + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="participants_${id}.csv"`,
    },
  });
}
