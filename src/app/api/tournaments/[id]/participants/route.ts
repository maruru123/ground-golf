import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { guardAdmin } from "@/lib/api";
import { maxGroupsFor } from "@/lib/tournamentLimits";

const DEFAULT_PER_GROUP = 8;

const createSchema = z.object({
  name: z.string().trim().min(1, "氏名は必須です").max(50),
  kana: z.string().trim().max(50).nullable().optional(),
  term: z.number().int().min(0).max(999).nullable().optional(),
  age: z.number().int().min(0).max(150).nullable().optional(),
  gender: z.enum(["male", "female", "other"]).nullable().optional(),
  status: z.enum(["playing", "absent", "withdrawn", "disqualified"]).optional(),
  note: z.string().max(200).nullable().optional(),
});

export async function GET(
  _req: Request,
  ctx: RouteContext<"/api/tournaments/[id]/participants">
) {
  const denied = await guardAdmin();
  if (denied) return denied;
  const { id } = await ctx.params;
  const participants = await prisma.participant.findMany({
    where: { tournamentId: id },
    orderBy: [{ term: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
    include: { group: { select: { id: true, groupNo: true, name: true } } },
  });
  return NextResponse.json({ participants });
}

export async function POST(
  req: Request,
  ctx: RouteContext<"/api/tournaments/[id]/participants">
) {
  const denied = await guardAdmin();
  if (denied) return denied;
  const { id } = await ctx.params;

  const tournament = await prisma.tournament.findUnique({
    where: { id },
    select: { maxPerGroup: true, startMethod: true, holesPerRound: true },
  });
  const maxParticipants =
    maxGroupsFor(tournament?.startMethod ?? "shotgun", tournament?.holesPerRound ?? 18) *
    (tournament?.maxPerGroup ?? DEFAULT_PER_GROUP);
  const count = await prisma.participant.count({ where: { tournamentId: id } });
  if (count >= maxParticipants) {
    return NextResponse.json(
      { error: `参加者は最大${maxParticipants}名までです` },
      { status: 400 }
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "入力が不正です" },
      { status: 400 }
    );
  }
  const { name, kana, term, age, gender, status, note } = parsed.data;
  const participant = await prisma.participant.create({
    data: {
      tournamentId: id,
      name,
      kana: kana || null, // 任意入力。空欄は未設定として扱う
      term: term ?? null,
      age: age ?? null,
      gender: gender ?? null,
      status: status ?? "playing",
      note: note ?? null,
    },
  });
  return NextResponse.json({ participant }, { status: 201 });
}
