import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { guardAdmin } from "@/lib/api";
import { computeStandings } from "@/lib/standings";

const createSchema = z.object({
  kind: z.enum(["rank", "hio", "manual"]),
  name: z.string().trim().max(60).optional(),
  participantIds: z.array(z.string()).optional(),
  note: z.string().max(60).optional(),
});

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
    if (!name) name = "総合上位3位";
    const standings = await computeStandings(id);
    winners = standings
      .filter((s) => s.eligible && s.rank != null && s.rank <= 3)
      .map((s) => ({ participantId: s.participantId, note: `${s.rank}位` }));
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
