import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { guardAdmin } from "@/lib/api";
import { randomPasscode, randomToken } from "@/lib/tokens";

/** 他大会と重複しない合言葉を生成 */
async function generateUniquePasscode(excludeId: string): Promise<string> {
  for (let i = 0; i < 20; i++) {
    const code = randomPasscode();
    const dup = await prisma.tournament.findFirst({
      where: { scorePasscode: code, id: { not: excludeId } },
      select: { id: true },
    });
    if (!dup) return code;
  }
  return randomPasscode(); // 事実上到達しない保険
}

const updateSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  heldDate: z.string().nullable().optional(),
  venue: z.string().max(100).nullable().optional(),
  status: z.enum(["draft", "active", "closed"]).optional(),
  startMethod: z.enum(["shotgun", "sequential"]).optional(),
  holeCount: z.number().int().min(1).max(72).optional(),
  hioPoints: z.number().int().min(-20).max(20).optional(),
  maxStrokes: z.number().int().min(1).max(20).optional(),
  maxPerGroup: z.number().int().min(1).max(20).optional(),
  scorePasscode: z.string().max(40).nullable().optional(),
  regeneratePasscode: z.boolean().optional(),
  viewEnabled: z.boolean().optional(),
  viewPassword: z.string().max(40).nullable().optional(),
  regenerateViewToken: z.boolean().optional(),
});

export async function GET(
  _req: Request,
  ctx: RouteContext<"/api/tournaments/[id]">
) {
  const denied = await guardAdmin();
  if (denied) return denied;
  const { id } = await ctx.params;
  const tournament = await prisma.tournament.findUnique({
    where: { id },
    include: { _count: { select: { participants: true, groups: true } } },
  });
  if (!tournament) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json({ tournament });
}

export async function PUT(
  req: Request,
  ctx: RouteContext<"/api/tournaments/[id]">
) {
  const denied = await guardAdmin();
  if (denied) return denied;
  const { id } = await ctx.params;

  const body = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "入力が不正です" },
      { status: 400 }
    );
  }
  const d = parsed.data;

  const data: Record<string, unknown> = {};
  if (d.name !== undefined) data.name = d.name;
  if (d.heldDate !== undefined)
    data.heldDate = d.heldDate ? new Date(d.heldDate) : null;
  if (d.venue !== undefined) data.venue = d.venue || null;
  if (d.status !== undefined) data.status = d.status;
  if (d.startMethod !== undefined) data.startMethod = d.startMethod;
  if (d.holeCount !== undefined) data.holeCount = d.holeCount;
  if (d.hioPoints !== undefined) data.hioPoints = d.hioPoints;
  if (d.maxStrokes !== undefined) data.maxStrokes = d.maxStrokes;
  if (d.maxPerGroup !== undefined) data.maxPerGroup = d.maxPerGroup;

  // 合言葉：発行/設定時に他大会との重複を防ぐ（入力側の正規化に合わせ大文字・空白除去）
  if (d.regeneratePasscode) {
    data.scorePasscode = await generateUniquePasscode(id);
  } else if (d.scorePasscode !== undefined) {
    const code = d.scorePasscode
      ? d.scorePasscode.replace(/\s/g, "").toUpperCase()
      : null;
    if (code) {
      const dup = await prisma.tournament.findFirst({
        where: { scorePasscode: code, id: { not: id } },
        select: { id: true },
      });
      if (dup) {
        return NextResponse.json(
          { error: "この合言葉は他の大会で使用中です。別の合言葉にしてください" },
          { status: 409 }
        );
      }
    }
    data.scorePasscode = code;
  }

  if (d.viewEnabled !== undefined) {
    data.viewEnabled = d.viewEnabled;
    // 初回ON時にトークン未発行なら発行
    if (d.viewEnabled) {
      const current = await prisma.tournament.findUnique({
        where: { id },
        select: { viewToken: true },
      });
      if (!current?.viewToken) data.viewToken = randomToken();
    }
  }
  if (d.regenerateViewToken) data.viewToken = randomToken();
  if (d.viewPassword !== undefined) data.viewPassword = d.viewPassword || null;

  try {
    const tournament = await prisma.tournament.update({ where: { id }, data });
    return NextResponse.json({ tournament });
  } catch {
    return NextResponse.json({ error: "更新に失敗しました" }, { status: 400 });
  }
}

export async function DELETE(
  _req: Request,
  ctx: RouteContext<"/api/tournaments/[id]">
) {
  const denied = await guardAdmin();
  if (denied) return denied;
  const { id } = await ctx.params;
  try {
    await prisma.tournament.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "削除に失敗しました" }, { status: 400 });
  }
}
