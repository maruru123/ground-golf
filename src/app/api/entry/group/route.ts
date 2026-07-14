import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { secretEquals } from "@/lib/auth";
import { rateLimit, clientIp, tooManyRequests } from "@/lib/rateLimit";

// 組を選択し、メンバーと現在のスコアを返す（合言葉+任意PINで保護）
export async function POST(req: Request) {
  const rl = rateLimit(`entry:${clientIp(req)}`, 20, 60_000);
  if (!rl.ok) return tooManyRequests(rl.retryAfter);

  const body = (await req.json().catch(() => null)) as {
    passcode?: string;
    groupId?: string;
    pin?: string;
  } | null;
  const passcode = body?.passcode?.trim();
  const groupId = body?.groupId;
  const pin = body?.pin?.trim();

  if (!passcode || !groupId) {
    return NextResponse.json({ error: "情報が不足しています" }, { status: 400 });
  }

  const group = await prisma.group.findUnique({
    where: { id: groupId },
    include: {
      tournament: {
        select: {
          scorePasscode: true,
          name: true,
          status: true,
          hioPoints: true,
          maxStrokes: true,
        },
      },
      participants: {
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        include: { scores: { select: { holeNo: true, strokes: true } } },
      },
    },
  });

  if (!group || !secretEquals(passcode, group.tournament.scorePasscode)) {
    return NextResponse.json({ error: "合言葉が違います" }, { status: 401 });
  }
  // 開催中(active)以外は受付しない（合言葉が漏れても準備中/終了の大会には入れない）
  if (group.tournament.status !== "active") {
    return NextResponse.json(
      { error: "現在は開催中ではありません（開催中のみ入場できます）" },
      { status: 403 }
    );
  }
  if (group.pin && !secretEquals(pin, group.pin)) {
    return NextResponse.json({ error: "組のPINが違います" }, { status: 401 });
  }

  return NextResponse.json({
    tournamentName: group.tournament.name,
    status: group.tournament.status,
    rule: {
      hioPoints: group.tournament.hioPoints,
      maxStrokes: group.tournament.maxStrokes,
    },
    group: {
      id: group.id,
      groupNo: group.groupNo,
      name: group.name,
      startHole: group.startHole,
    },
    members: group.participants.map((p) => ({
      id: p.id,
      name: p.name,
      scores: Object.fromEntries(p.scores.map((s) => [s.holeNo, s.strokes])),
    })),
  });
}
