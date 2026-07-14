import { prisma } from "./prisma";
import {
  summarizeScores,
  rankParticipants,
  DEFAULT_RULE,
  type ScoreSummary,
  type ScoreRule,
} from "./scoring";

export interface Standing {
  participantId: string;
  name: string;
  term: number | null;
  age: number | null;
  gender: string | null;
  status: string;
  groupNo: number | null;
  summary: ScoreSummary;
  rank: number | null;
  eligible: boolean;
}

/** 大会の順位表データを算出（暫定・正式ともにこのデータから表示）。 */
export async function computeStandings(tournamentId: string): Promise<Standing[]> {
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: { hioPoints: true, maxStrokes: true, holeCount: true },
  });
  const rule: ScoreRule = tournament
    ? { hioPoints: tournament.hioPoints, maxStrokes: tournament.maxStrokes }
    : DEFAULT_RULE;
  const holeCount = tournament?.holeCount ?? 18;

  const participants = await prisma.participant.findMany({
    where: { tournamentId },
    include: {
      scores: { select: { holeNo: true, strokes: true } },
      group: { select: { groupNo: true } },
    },
  });

  const withSummary = participants.map((p) => {
    const map = new Map<number, number | null>();
    for (const s of p.scores) map.set(s.holeNo, s.strokes);
    const summary = summarizeScores(map, rule, holeCount);
    return { p, summary };
  });

  const ranked = rankParticipants(
    withSummary.map(({ p, summary }) => ({
      id: p.id,
      total: summary.total,
      complete: summary.complete,
      status: p.status,
    }))
  );
  const rankById = new Map(ranked.map((r) => [r.id, r]));

  const standings: Standing[] = withSummary.map(({ p, summary }) => {
    const r = rankById.get(p.id)!;
    return {
      participantId: p.id,
      name: p.name,
      term: p.term,
      age: p.age,
      gender: p.gender,
      status: p.status,
      groupNo: p.group?.groupNo ?? null,
      summary,
      rank: r.rank,
      eligible: r.eligible,
    };
  });

  // 表示順: 正式対象を順位昇順、その後に対象外（未完了・欠席・棄権）を名前順
  standings.sort((a, b) => {
    if (a.eligible && b.eligible) {
      if (a.rank !== b.rank) return (a.rank ?? 0) - (b.rank ?? 0);
      return a.name.localeCompare(b.name, "ja");
    }
    if (a.eligible) return -1;
    if (b.eligible) return 1;
    return a.name.localeCompare(b.name, "ja");
  });

  return standings;
}
