import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { guardAdmin } from "@/lib/api";
import { randomPasscode, randomToken } from "@/lib/tokens";

const updateSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  heldDate: z.string().nullable().optional(),
  venue: z.string().max(100).nullable().optional(),
  status: z.enum(["draft", "active", "closed"]).optional(),
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

  if (d.regeneratePasscode) data.scorePasscode = randomPasscode();
  else if (d.scorePasscode !== undefined)
    data.scorePasscode = d.scorePasscode || null;

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
