// スコアリング・順位計算ロジック（設計書 02_design.md 第5章）
// 独自ルール（大会ごとに設定可能。既定は hioPoints=-3, maxStrokes=5）:
//   - 1打(ホールインワン) => hioPoints 点
//   - 2〜maxStrokes 打 => その打数
//   - maxStrokes を超える打数 => maxStrokes 点(上限)
//   - 未入力 => null（暫定合計では0扱い、正式対象判定では未完了）

/** スコア換算ルール（大会ごとに可変） */
export interface ScoreRule {
  hioPoints: number; // ホールインワン(1打)の換算点
  maxStrokes: number; // 上限打数（これを超える打数はこの値に丸める）
}

export const DEFAULT_RULE: ScoreRule = { hioPoints: -3, maxStrokes: 5 };

export const DEFAULT_HOLE_COUNT = 18; // 大会未設定時のフォールバック

/** ホールインワン（1打）判定 */
export function isHoleInOne(strokes: number | null | undefined): boolean {
  return strokes === 1;
}

/** 1ホールの実打数を換算スコア（点）に変換。未入力は null。 */
export function holePoints(
  strokes: number | null | undefined,
  rule: ScoreRule = DEFAULT_RULE
): number | null {
  if (strokes == null) return null;
  if (strokes <= 1) return rule.hioPoints; // ホールインワン
  return Math.min(strokes, rule.maxStrokes); // 2打以上は上限で丸め
}

export interface ScoreSummary {
  total: number; // 合計（順位対象値）
  enteredHoles: number; // 入力済みホール数
  complete: boolean; // 全ホール入力済みか
  hioCount: number; // ホールインワン回数
}

/** ホール番号 -> 実打数 のマップから合計・HIO数を算出。 */
export function summarizeScores(
  strokesByHole: Map<number, number | null | undefined>,
  rule: ScoreRule = DEFAULT_RULE,
  holeCount: number = DEFAULT_HOLE_COUNT
): ScoreSummary {
  let total = 0;
  let entered = 0;
  let hio = 0;

  for (let hole = 1; hole <= holeCount; hole++) {
    const strokes = strokesByHole.get(hole);
    const pts = holePoints(strokes, rule);
    if (pts == null) continue;
    entered++;
    total += pts;
    if (isHoleInOne(strokes)) hio++;
  }

  return {
    total,
    enteredHoles: entered,
    complete: entered === holeCount,
    hioCount: hio,
  };
}

/**
 * ショットガン方式のプレー順（入力導線）。
 * 1ラウンド分は開始ホール（物理ホール）から始まり一巡する順序。
 * 複数ラウンドは「同じコースをもう一周」なので、開始ホール（物理位置）は毎ラウンド共通のまま、
 * holeNo だけラウンドごとに holesPerRound ずつ加算して連番にする。
 * 例: startHole=5, holesPerRound=8, roundCount=2
 *   => [5,6,7,8,1,2,3,4, 13,14,15,16,9,10,11,12]
 *      （1周目: 物理5→8→1→4 / 2周目: 同じ物理順で holeNo=9〜16）
 */
export function playOrder(
  startHole: number,
  holesPerRound: number = DEFAULT_HOLE_COUNT,
  roundCount: number = 1
): number[] {
  const order: number[] = [];
  for (let round = 0; round < roundCount; round++) {
    for (let i = 0; i < holesPerRound; i++) {
      const physicalHole = ((startHole - 1 + i) % holesPerRound) + 1;
      order.push(round * holesPerRound + physicalHole);
    }
  }
  return order;
}

export interface RankableParticipant {
  id: string;
  total: number;
  complete: boolean;
  status: string; // playing / absent / withdrawn
}

export interface RankedParticipant extends RankableParticipant {
  rank: number | null; // 正式対象のみ数値。対象外は null
  eligible: boolean; // 正式ランキング対象か
}

/**
 * 標準競技順位方式で順位を付与する。
 * 正式対象 = status==='playing' かつ complete。
 * 同点は同順位、次順位は人数分繰り下げ（例: 1位が3人 => 次は4位）。
 * 対象外（欠席・棄権・未完了）は rank=null, eligible=false。
 */
export function rankParticipants(
  items: RankableParticipant[]
): RankedParticipant[] {
  const eligibleTotals = items
    .filter((p) => p.status === "playing" && p.complete)
    .map((p) => p.total);

  return items.map((p) => {
    const eligible = p.status === "playing" && p.complete;
    if (!eligible) {
      return { ...p, rank: null, eligible: false };
    }
    const rank =
      eligibleTotals.filter((t) => t < p.total).length + 1;
    return { ...p, rank, eligible: true };
  });
}
