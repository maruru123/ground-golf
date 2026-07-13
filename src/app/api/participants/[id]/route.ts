import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { guardAdmin } from "@/lib/api";

const updateSchema = z.object({
  name: z.string().trim().min(1).max(50).optional(),
  term: z.number().int().min(0).max(999).nullable().optional(),
  gender: z.enum(["male", "female", "other"]).nullable().optional(),
  status: z.enum(["playing", "absent", "withdrawn", "disqualified"]).optional(),
  note: z.string().max(200).nullable().optional(),
});

export async function PUT(
  req: Request,
  ctx: RouteContext<"/api/participants/[id]">
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
  if (d.term !== undefined) data.term = d.term;
  if (d.gender !== undefined) data.gender = d.gender;
  if (d.status !== undefined) data.status = d.status;
  if (d.note !== undefined) data.note = d.note;

  try {
    const participant = await prisma.participant.update({
      where: { id },
      data,
    });
    return NextResponse.json({ participant });
  } catch {
    return NextResponse.json({ error: "更新に失敗しました" }, { status: 400 });
  }
}

export async function DELETE(
  _req: Request,
  ctx: RouteContext<"/api/participants/[id]">
) {
  const denied = await guardAdmin();
  if (denied) return denied;
  const { id } = await ctx.params;
  try {
    await prisma.participant.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "削除に失敗しました" }, { status: 400 });
  }
}
