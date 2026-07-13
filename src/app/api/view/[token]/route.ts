import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { secretEquals } from "@/lib/auth";
import { rateLimit, clientIp, tooManyRequests } from "@/lib/rateLimit";
import { computeStandings } from "@/lib/standings";

export async function POST(
  req: Request,
  ctx: RouteContext<"/api/view/[token]">
) {
  const rl = rateLimit(`view:${clientIp(req)}`, 30, 60_000);
  if (!rl.ok) return tooManyRequests(rl.retryAfter);

  const { token } = await ctx.params;
  const body = (await req.json().catch(() => null)) as {
    password?: string;
  } | null;

  const tournament = await prisma.tournament.findUnique({
    where: { viewToken: token },
    select: { id: true, name: true, viewEnabled: true, viewPassword: true },
  });
  if (!tournament || !tournament.viewEnabled) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  if (tournament.viewPassword && !secretEquals(body?.password, tournament.viewPassword)) {
    return NextResponse.json({ error: "パスワードが違います" }, { status: 401 });
  }

  const standings = await computeStandings(tournament.id);
  const rows = standings.map((s) => ({
    name: s.name,
    term: s.term,
    rank: s.rank,
    eligible: s.eligible,
    out: s.summary.out,
    in: s.summary.in,
    total: s.summary.total,
    hioCount: s.summary.hioCount,
    complete: s.summary.complete,
    status: s.status,
    entered: s.summary.enteredHoles,
  }));

  return NextResponse.json({ tournamentName: tournament.name, rows });
}
