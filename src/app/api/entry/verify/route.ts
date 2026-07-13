import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { rateLimit, clientIp, tooManyRequests } from "@/lib/rateLimit";

// 合言葉を検証し、大会と組の一覧を返す（公開エンドポイント）
export async function POST(req: Request) {
  const rl = rateLimit(`entry:${clientIp(req)}`, 20, 60_000);
  if (!rl.ok) return tooManyRequests(rl.retryAfter);

  const body = (await req.json().catch(() => null)) as {
    passcode?: string;
  } | null;
  const passcode = body?.passcode?.trim();
  if (!passcode) {
    return NextResponse.json({ error: "合言葉を入力してください" }, { status: 400 });
  }

  const tournament = await prisma.tournament.findFirst({
    where: { scorePasscode: passcode },
    include: {
      groups: {
        orderBy: { groupNo: "asc" },
        include: { _count: { select: { participants: true } } },
      },
    },
  });

  if (!tournament) {
    return NextResponse.json({ error: "合言葉が違います" }, { status: 401 });
  }

  return NextResponse.json({
    tournament: {
      id: tournament.id,
      name: tournament.name,
      status: tournament.status,
    },
    groups: tournament.groups.map((g) => ({
      id: g.id,
      groupNo: g.groupNo,
      name: g.name,
      startHole: g.startHole,
      hasPin: !!g.pin,
      memberCount: g._count.participants,
    })),
  });
}
