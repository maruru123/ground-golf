import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { guardAdmin } from "@/lib/api";
import { computeStandings, type Standing } from "@/lib/standings";
import { rankParticipants } from "@/lib/scoring";
import { GENDER_LABELS } from "@/lib/labels";

const createSchema = z.object({
  kind: z.enum(["rank", "hio", "manual"]),
  category: z.enum(["overall", "term", "gender"]).optional(), // rank の部門
  name: z.string().trim().max(60).optional(),
  participantIds: z.array(z.string()).optional(),
  note: z.string().max(60).optional(),
});

const GENDER_ORDER: Record<string, number> = { male: 0, female: 1, other: 2 };

/** 部門（期別 or 男女別）ごとに上位3位を選出。部門値なし(null)は対象外。 */
function categoryTop3(
  standings: Standing[],
  by: "term" | "gender"
): { participantId: string; note: string | null }[] {
  const groups = new Map<string, Standing[]>();
  for (const s of standings) {
    const key = by === "term" ? (s.term != null ? String(s.term) : null) : s.gender;
    if (key == null) continue;
    const arr = groups.get(key);
    if (arr) arr.push(s);
    else groups.set(key, [s]);
  }

  const rows: {
    participantId: string;
    note: string;
    catSort: number;
    rank: number;
  }[] = [];
  for (const [key, members] of groups) {
    const ranked = rankParticipants(
      members.map((m) => ({
        id: m.participantId,
        total: m.summary.total,
        complete: m.summary.complete,
        status: m.status,
      }))
    );
    const rankById = new Map(ranked.map((r) => [r.id, r]));
    for (const m of members) {
      const r = rankById.get(m.participantId)!;
      if (r.eligible && r.rank != null && r.rank <= 3) {
        const label = by === "term" ? `${key}期` : GENDER_LABELS[key] ?? key;
        rows.push({
          participantId: m.participantId,
          note: `${label} ${r.rank}位`,
          catSort: by === "term" ? Number(key) : GENDER_ORDER[key] ?? 9,
          rank: r.rank,
        });
      }
    }
  }
  rows.sort((a, b) => a.catSort - b.catSort || a.rank - b.rank);
  return rows.map(({ participantId, note }) => ({ participantId, note }));
}

export async function GET(
  _req: Request,
  ctx: RouteContext<"/api/tournaments/[id]/awards">
) {
  const denied = await guardAdmin();
  if (denied) return denied;
  const { id } = await ctx.params;
  const awards = await prisma.award.findMany({
    where: { tournamentId: id },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: {
      winners: {
        include: {
          participant: { select: { id: true, name: true, term: true } },
        },
      },
    },
  });
  return NextResponse.json({ awards });
}

export async function POST(
  req: Request,
  ctx: RouteContext<"/api/tournaments/[id]/awards">
) {
  const denied = await guardAdmin();
  if (denied) return denied;
  const { id } = await ctx.params;

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "入力が不正です" },
      { status: 400 }
    );
  }
  const { kind } = parsed.data;

  let name = parsed.data.name ?? "";
  let winners: { participantId: string; note: string | null }[] = [];

  if (kind === "rank") {
    const category = parsed.data.category ?? "overall";
    const standings = await computeStandings(id);
    if (category === "term") {
      if (!name) name = "期別 上位3位";
      winners = categoryTop3(standings, "term");
    } else if (category === "gender") {
      if (!name) name = "男女別 上位3位";
      winners = categoryTop3(standings, "gender");
    } else {
      if (!name) name = "総合 上位3位";
      winners = standings
        .filter((s) => s.eligible && s.rank != null && s.rank <= 3)
        .map((s) => ({ participantId: s.participantId, note: `${s.rank}位` }));
    }
  } else if (kind === "hio") {
    if (!name) name = "ホールインワン賞";
    const standings = await computeStandings(id);
    winners = standings
      .filter((s) => s.summary.hioCount > 0)
      .map((s) => ({
        participantId: s.participantId,
        note: `${s.summary.hioCount}回`,
      }));
  } else {
    // manual
    if (!name) {
      return NextResponse.json({ error: "賞名を入力してください" }, { status: 400 });
    }
    // 重複IDを除外
    const ids = Array.from(new Set(parsed.data.participantIds ?? []));
    if (ids.length === 0) {
      return NextResponse.json(
        { error: "受賞者を1名以上選択してください" },
        { status: 400 }
      );
    }
    // この大会に所属する参加者のみ許可
    const valid = await prisma.participant.findMany({
      where: { tournamentId: id, id: { in: ids } },
      select: { id: true },
    });
    if (valid.length !== ids.length) {
      return NextResponse.json(
        { error: "この大会に存在しない参加者が含まれています" },
        { status: 400 }
      );
    }
    winners = ids.map((pid) => ({
      participantId: pid,
      note: parsed.data.note ?? null,
    }));
  }

  const award = await prisma.award.create({
    data: {
      tournamentId: id,
      name,
      kind,
      winners: {
        create: winners.map((w) => ({
          participantId: w.participantId,
          note: w.note,
        })),
      },
    },
    include: {
      winners: {
        include: {
          participant: { select: { id: true, name: true, term: true } },
        },
      },
    },
  });

  return NextResponse.json({ award }, { status: 201 });
}
