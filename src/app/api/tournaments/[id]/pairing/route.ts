import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { guardAdmin } from "@/lib/api";

const MAX_PER_GROUP = 8;
const MAX_GROUPS = 18; // ショットガン: 18ホール = 最大18組

const saveSchema = z.object({
  groups: z
    .array(
      z.object({
        groupNo: z.number().int().min(1),
        name: z.string().max(50).nullable().optional(),
        startHole: z.number().int().min(1).max(18),
        pin: z.string().max(20).nullable().optional(),
      })
    )
    .max(18, "組は最大18組までです"),
  assignments: z.record(z.string(), z.number().int().nullable()),
});

type SaveInput = z.infer<typeof saveSchema>;

/** 期ごとに最大8名でまとめる（期の境界で必ず組を分ける） */
function chunkByTerm(
  participants: { id: string; term: number | null }[]
): string[][] {
  const chunks: string[][] = [];
  let current: string[] = [];
  let currentTerm: number | null | undefined = undefined;
  for (const p of participants) {
    const termChanged = current.length > 0 && p.term !== currentTerm;
    if (current.length >= MAX_PER_GROUP || termChanged) {
      chunks.push(current);
      current = [];
    }
    if (current.length === 0) currentTerm = p.term;
    current.push(p.id);
  }
  if (current.length > 0) chunks.push(current);
  return chunks;
}

/** 期の境界を無視して先頭から8名ずつ詰める（18組以内を保証） */
function chunkSequential(ids: string[]): string[][] {
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += MAX_PER_GROUP) {
    chunks.push(ids.slice(i, i + MAX_PER_GROUP));
  }
  return chunks;
}

async function applyPairing(
  tournamentId: string,
  input: SaveInput
): Promise<{ ok: true } | { error: string; status: number }> {
  if (input.groups.length > MAX_GROUPS) {
    return {
      error: `組は最大${MAX_GROUPS}組までです（現在${input.groups.length}組）。1組あたりの人数を増やすか手動で調整してください`,
      status: 400,
    };
  }
  const groupNos = input.groups.map((g) => g.groupNo);
  if (new Set(groupNos).size !== groupNos.length) {
    return { error: "組番号が重複しています", status: 400 };
  }
  // ショットガンは各組で開始ホールが異なる必要がある
  const startHoles = input.groups.map((g) => g.startHole);
  if (new Set(startHoles).size !== startHoles.length) {
    return {
      error: "開始ホールが重複しています。ショットガンでは各組に異なる開始ホールを設定してください",
      status: 400,
    };
  }
  const validGroupNos = new Set(groupNos);

  // 人数上限チェック
  const counts = new Map<number, number>();
  for (const [, no] of Object.entries(input.assignments)) {
    if (no == null) continue;
    if (!validGroupNos.has(no)) {
      return { error: `未定義の組番号があります: ${no}`, status: 400 };
    }
    counts.set(no, (counts.get(no) ?? 0) + 1);
  }
  for (const [no, c] of counts) {
    if (c > MAX_PER_GROUP) {
      return { error: `第${no}組が${c}名（上限${MAX_PER_GROUP}名）`, status: 400 };
    }
  }

  const participants = await prisma.participant.findMany({
    where: { tournamentId },
    select: { id: true },
  });
  const validPids = new Set(participants.map((p) => p.id));

  await prisma.$transaction(async (tx) => {
    // 既存の組を削除（参加者の groupId は SetNull）
    await tx.group.deleteMany({ where: { tournamentId } });
    // 新しい組を作成
    const idByNo = new Map<number, string>();
    for (const g of input.groups) {
      const created = await tx.group.create({
        data: {
          tournamentId,
          groupNo: g.groupNo,
          name: g.name ?? null,
          startHole: g.startHole,
          pin: g.pin ?? null,
        },
      });
      idByNo.set(g.groupNo, created.id);
    }
    // 参加者を割当
    for (const [pid, no] of Object.entries(input.assignments)) {
      if (!validPids.has(pid)) continue;
      await tx.participant.update({
        where: { id: pid },
        data: { groupId: no != null ? idByNo.get(no) ?? null : null },
      });
    }
  });

  return { ok: true };
}

/** 手動編集の保存 */
export async function PUT(
  req: Request,
  ctx: RouteContext<"/api/tournaments/[id]/pairing">
) {
  const denied = await guardAdmin();
  if (denied) return denied;
  const { id } = await ctx.params;

  const body = await req.json().catch(() => null);
  const parsed = saveSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "入力が不正です" },
      { status: 400 }
    );
  }
  const result = await applyPairing(id, parsed.data);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ ok: true });
}

/** 期でまとめる自動組分け */
export async function POST(
  _req: Request,
  ctx: RouteContext<"/api/tournaments/[id]/pairing">
) {
  const denied = await guardAdmin();
  if (denied) return denied;
  const { id } = await ctx.params;

  const participants = await prisma.participant.findMany({
    where: { tournamentId: id },
    orderBy: [{ term: "asc" }, { name: "asc" }],
    select: { id: true, term: true },
  });

  // まず期ごとに最大8名でまとめる（期の混在を避ける）
  let chunks = chunkByTerm(participants);
  // 期数が多く18組を超える場合は、期順のまま詰め直して18組以内に収める
  // （同一期はできるだけ同組に残る。細かな調整は手動編集で対応）
  if (chunks.length > MAX_GROUPS) {
    chunks = chunkSequential(participants.map((p) => p.id));
  }

  const groups = chunks.map((_, i) => ({
    groupNo: i + 1,
    name: null,
    startHole: (i % 18) + 1,
    pin: null,
  }));
  const assignments: Record<string, number | null> = {};
  chunks.forEach((ids, i) => {
    ids.forEach((pid) => {
      assignments[pid] = i + 1;
    });
  });

  const result = await applyPairing(id, { groups, assignments });
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ ok: true, groupCount: groups.length });
}
