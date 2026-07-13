// スコアリング・順位計算ロジック（設計書 02_design.md 第5章）
// 独自ルール:
//   - 1打(ホールインワン) => -3点
//   - 2〜5打 => その打数
//   - 6打以上 => 5点(上限)
//   - 未入力 => null（暫定合計では0扱い、正式対象判定では未完了）

export const TOTAL_HOLES = 18;
export const OUT_HOLES = [1, 2, 3, 4, 5, 6, 7, 8, 9];
export const IN_HOLES = [10, 11, 12, 13, 14, 15, 16, 17, 18];
export const ALL_HOLES = Array.from({ length: TOTAL_HOLES }, (_, i) => i + 1);

/** ホールインワン（1打）判定 */
export function isHoleInOne(strokes: number | null | undefined): boolean {
  return strokes === 1;
}

/** 1ホールの実打数を換算スコア（点）に変換。未入力は null。 */
export function holePoints(strokes: number | null | undefined): number | null {
  if (strokes == null) return null;
  if (strokes <= 1) return -3; // ホールインワン
  if (strokes >= 6) return 5; // 上限5打
  return strokes; // 2〜5打
}

export interface ScoreSummary {
  out: number; // 前半(1-9)の換算合計
  in: number; // 後半(10-18)の換算合計
  total: number; // 合計（順位対象値）
  enteredHoles: number; // 入力済みホール数
  complete: boolean; // 全18ホール入力済みか
  hioCount: number; // ホールインワン回数
}

/** ホール番号 -> 実打数 のマップから小計・合計・HIO数を算出。 */
export function summarizeScores(
  strokesByHole: Map<number, number | null | undefined>
): ScoreSummary {
  let out = 0;
  let inn = 0;
  let entered = 0;
  let hio = 0;

  for (const hole of ALL_HOLES) {
    const strokes = strokesByHole.get(hole);
    const pts = holePoints(strokes);
    if (pts == null) continue;
    entered++;
    if (hole <= 9) out += pts;
    else inn += pts;
    if (isHoleInOne(strokes)) hio++;
  }

  return {
    out,
    in: inn,
    total: out + inn,
    enteredHoles: entered,
    complete: entered === TOTAL_HOLES,
    hioCount: hio,
  };
}

/**
 * ショットガン方式のプレー順（入力導線）。
 * 開始ホールから始まり18ホールを一巡する順序を返す。
 * 例: startHole=5 => [5,6,...,18,1,2,3,4]
 */
export function playOrder(startHole: number): number[] {
  const order: number[] = [];
  for (let i = 0; i < TOTAL_HOLES; i++) {
    order.push(((startHole - 1 + i) % TOTAL_HOLES) + 1);
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
