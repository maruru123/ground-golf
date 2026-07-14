import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { guardAdmin } from "@/lib/api";
import {
  maxGroupsFor,
  SEQUENTIAL_MAX_GROUPS,
  type StartMethod,
} from "@/lib/tournamentLimits";

const DEFAULT_PER_GROUP = 8; // 大会未設定時のフォールバック

/** 大会のペアリング関連設定を取得（未設定時は既定にフォールバック） */
async function getPairingConfig(
  tournamentId: string
): Promise<{ maxPerGroup: number; startMethod: StartMethod }> {
  const t = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: { maxPerGroup: true, startMethod: true },
  });
  return {
    maxPerGroup: t?.maxPerGroup ?? DEFAULT_PER_GROUP,
    startMethod: (t?.startMethod as StartMethod) ?? "shotgun",
  };
}

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
    .max(SEQUENTIAL_MAX_GROUPS, `組は最大${SEQUENTIAL_MAX_GROUPS}組までです`),
  assignments: z.record(z.string(), z.number().int().nullable()),
});

type SaveInput = z.infer<typeof saveSchema>;

/** 期ごとに最大 maxPerGroup 名でまとめる（期の境界で必ず組を分ける） */
function chunkByTerm(
  participants: { id: string; term: number | null }[],
  maxPerGroup: number
): string[][] {
  const chunks: string[][] = [];
  let current: string[] = [];
  let currentTerm: number | null | undefined = undefined;
  for (const p of participants) {
    const termChanged = current.length > 0 && p.term !== currentTerm;
    if (current.length >= maxPerGroup || termChanged) {
      chunks.push(current);
      current = [];
    }
    if (current.length === 0) currentTerm = p.term;
    current.push(p.id);
  }
  if (current.length > 0) chunks.push(current);
  return chunks;
}

/** 期の境界を無視して先頭から maxPerGroup 名ずつ詰める */
function chunkSequential(ids: string[], maxPerGroup: number): string[][] {
  const step = Math.max(1, maxPerGroup); // 0での無限ループ防止
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += step) {
    chunks.push(ids.slice(i, i + step));
  }
  return chunks;
}

async function applyPairing(
  tournamentId: string,
  input: SaveInput,
  maxPerGroup: number,
  startMethod: StartMethod
): Promise<{ ok: true } | { error: string; status: number }> {
  const maxGroups = maxGroupsFor(startMethod);
  if (input.groups.length > maxGroups) {
    return {
      error:
        startMethod === "shotgun"
          ? `ショットガンでは組は最大${maxGroups}組までです（現在${input.groups.length}組）。1組あたりの人数を増やすか、順次スタートに変更してください`
          : `組は最大${maxGroups}組までです（現在${input.groups.length}組）`,
      status: 400,
    };
  }
  const groupNos = input.groups.map((g) => g.groupNo);
  if (new Set(groupNos).size !== groupNos.length) {
    return { error: "組番号が重複しています", status: 400 };
  }
  // ショットガンは各組で開始ホールが異なる必要がある（順次は全組1番からなので不要）
  if (startMethod === "shotgun") {
    const startHoles = input.groups.map((g) => g.startHole);
    if (new Set(startHoles).size !== startHoles.length) {
      return {
        error:
          "開始ホールが重複しています。ショットガンでは各組に異なる開始ホールを設定してください",
        status: 400,
      };
    }
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
    if (c > maxPerGroup) {
      return { error: `第${no}組が${c}名（上限${maxPerGroup}名）`, status: 400 };
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
    // 新しい組を作成（順次スタートは全組1番から）
    const idByNo = new Map<number, string>();
    for (const g of input.groups) {
      const created = await tx.group.create({
        data: {
          tournamentId,
          groupNo: g.groupNo,
          name: g.name ?? null,
          startHole: startMethod === "sequential" ? 1 : g.startHole,
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
  const { maxPerGroup, startMethod } = await getPairingConfig(id);
  const result = await applyPairing(id, parsed.data, maxPerGroup, startMethod);
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

  const { maxPerGroup, startMethod } = await getPairingConfig(id);
  const maxGroups = maxGroupsFor(startMethod);
  const participants = await prisma.participant.findMany({
    where: { tournamentId: id },
    orderBy: [{ term: "asc" }, { name: "asc" }],
    select: { id: true, term: true },
  });

  // まず期ごとに最大 maxPerGroup 名でまとめる（期の混在を避ける）
  let chunks = chunkByTerm(participants, maxPerGroup);
  // 組数上限を超える場合は、期順のまま詰め直して収める
  // （同一期はできるだけ同組に残る。細かな調整は手動編集で対応）
  if (chunks.length > maxGroups) {
    chunks = chunkSequential(
      participants.map((p) => p.id),
      maxPerGroup
    );
  }

  const groups = chunks.map((_, i) => ({
    groupNo: i + 1,
    name: null,
    // ショットガンは各組バラバラのホール、順次は全組1番から
    startHole: startMethod === "sequential" ? 1 : (i % 18) + 1,
    pin: null,
  }));
  const assignments: Record<string, number | null> = {};
  chunks.forEach((ids, i) => {
    ids.forEach((pid) => {
      assignments[pid] = i + 1;
    });
  });

  const result = await applyPairing(
    id,
    { groups, assignments },
    maxPerGroup,
    startMethod
  );
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ ok: true, groupCount: groups.length });
}
