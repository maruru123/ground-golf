import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { guardAdmin } from "@/lib/api";

const MAX_PARTICIPANTS = 144;

const createSchema = z.object({
  name: z.string().trim().min(1, "氏名は必須です").max(50),
  term: z.number().int().min(0).max(999).nullable().optional(),
  gender: z.enum(["male", "female", "other"]).nullable().optional(),
  status: z.enum(["playing", "absent", "withdrawn"]).optional(),
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

  const count = await prisma.participant.count({ where: { tournamentId: id } });
  if (count >= MAX_PARTICIPANTS) {
    return NextResponse.json(
      { error: `参加者は最大${MAX_PARTICIPANTS}名までです` },
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
  const { name, term, gender, status } = parsed.data;
  const participant = await prisma.participant.create({
    data: {
      tournamentId: id,
      name,
      term: term ?? null,
      gender: gender ?? null,
      status: status ?? "playing",
    },
  });
  return NextResponse.json({ participant }, { status: 201 });
}
