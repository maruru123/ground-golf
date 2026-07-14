import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { isAdminAuthed } from "@/lib/auth";

const createSchema = z.object({
  name: z.string().trim().min(1, "大会名は必須です").max(100),
  heldDate: z.string().optional().nullable(),
  venue: z.string().max(100).optional().nullable(),
  hioPoints: z.number().int().min(-20).max(20).optional(),
  maxStrokes: z.number().int().min(1).max(20).optional(),
  maxPerGroup: z.number().int().min(1).max(20).optional(),
});

export async function GET() {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const tournaments = await prisma.tournament.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { participants: true, groups: true } },
    },
  });
  return NextResponse.json({ tournaments });
}

export async function POST(req: Request) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "入力が不正です" },
      { status: 400 }
    );
  }
  const { name, heldDate, venue, hioPoints, maxStrokes, maxPerGroup } =
    parsed.data;
  const tournament = await prisma.tournament.create({
    data: {
      name,
      venue: venue || null,
      heldDate: heldDate ? new Date(heldDate) : null,
      // 未指定ならスキーマ既定(-3/5/8)が適用される
      ...(hioPoints !== undefined ? { hioPoints } : {}),
      ...(maxStrokes !== undefined ? { maxStrokes } : {}),
      ...(maxPerGroup !== undefined ? { maxPerGroup } : {}),
    },
  });
  return NextResponse.json({ tournament }, { status: 201 });
}
