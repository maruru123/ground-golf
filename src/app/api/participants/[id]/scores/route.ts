import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { isAdminAuthed, secretEquals } from "@/lib/auth";
import { withDbRetry } from "@/lib/dbRetry";

const schema = z.object({
  holeNo: z.number().int().min(1).max(99), // 実際の上限は大会のホール数で検証
  strokes: z.number().int().min(1).max(20).nullable(),
  passcode: z.string().optional(),
  pin: z.string().optional(),
});

export async function PUT(
  req: Request,
  ctx: RouteContext<"/api/participants/[id]/scores">
) {
  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "入力が不正です" },
      { status: 400 }
    );
  }
  const { holeNo, strokes, passcode, pin } = parsed.data;

  const participant = await withDbRetry(() =>
    prisma.participant.findUnique({
      where: { id },
      include: {
        tournament: {
          select: {
            status: true,
            scorePasscode: true,
            holeCount: true,
            maxStrokes: true,
          },
        },
        group: { select: { pin: true } },
      },
    })
  );
  if (!participant) {
    return NextResponse.json({ error: "参加者が見つかりません" }, { status: 404 });
  }
  if (holeNo > participant.tournament.holeCount) {
    return NextResponse.json(
      { error: `ホール番号が範囲外です（1〜${participant.tournament.holeCount}）` },
      { status: 400 }
    );
  }

  const admin = await isAdminAuthed();
  if (!admin) {
    if (participant.tournament.status !== "active") {
      return NextResponse.json(
        { error: "現在この大会はスコア入力できません" },
        { status: 403 }
      );
    }
    if (!secretEquals(passcode, participant.tournament.scorePasscode)) {
      return NextResponse.json({ error: "合言葉が違います" }, { status: 401 });
    }
    if (participant.group?.pin && !secretEquals(pin, participant.group.pin)) {
      return NextResponse.json({ error: "組のPINが違います" }, { status: 401 });
    }
  }

  // 上限打数を超える打数は上限打数に丸めて保存する（保存値と集計値を一致させる）
  const saved =
    strokes == null
      ? null
      : Math.min(strokes, participant.tournament.maxStrokes);

  if (saved == null) {
    await withDbRetry(() =>
      prisma.score.deleteMany({
        where: { participantId: id, holeNo },
      })
    );
  } else {
    await withDbRetry(() =>
      prisma.score.upsert({
        where: { participantId_holeNo: { participantId: id, holeNo } },
        create: { participantId: id, holeNo, strokes: saved },
        update: { strokes: saved },
      })
    );
  }

  // 呼び出し側が表示を実際の保存値に揃えられるよう返す
  return NextResponse.json({ ok: true, strokes: saved });
}
