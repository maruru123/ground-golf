import Papa from "papaparse";
import { prisma } from "@/lib/prisma";
import { guardAdmin } from "@/lib/api";
import { computeStandings } from "@/lib/standings";
import { PARTICIPANT_STATUS_LABELS } from "@/lib/labels";

export async function GET(
  _req: Request,
  ctx: RouteContext<"/api/tournaments/[id]/export/results">
) {
  const denied = await guardAdmin();
  if (denied) return denied;
  const { id } = await ctx.params;

  const [standings, awards] = await Promise.all([
    computeStandings(id),
    prisma.award.findMany({
      where: { tournamentId: id },
      include: { winners: { select: { participantId: true, note: true } } },
    }),
  ]);

  // 参加者ごとの受賞名をまとめる
  const awardsByP = new Map<string, string[]>();
  for (const a of awards) {
    for (const w of a.winners) {
      const list = awardsByP.get(w.participantId) ?? [];
      list.push(a.name + (w.note ? `(${w.note})` : ""));
      awardsByP.set(w.participantId, list);
    }
  }

  const fields = [
    "順位",
    "氏名",
    "期",
    "OUT",
    "IN",
    "合計",
    "HIO回数",
    "状態",
    "受賞",
  ];
  const data = standings.map((s) => [
    s.eligible && s.rank != null ? s.rank : "",
    s.name,
    s.term ?? "",
    s.summary.enteredHoles > 0 ? s.summary.out : "",
    s.summary.enteredHoles > 0 ? s.summary.in : "",
    s.summary.enteredHoles > 0 ? s.summary.total : "",
    s.summary.hioCount,
    PARTICIPANT_STATUS_LABELS[s.status] ?? s.status,
    (awardsByP.get(s.participantId) ?? []).join(" / "),
  ]);

  const csv = Papa.unparse({ fields, data });
  const bom = "﻿";
  return new Response(bom + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="results_${id}.csv"`,
    },
  });
}
