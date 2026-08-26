// スコアリング・順位計算ロジック（設計書 02_design.md 第5章）
// 独自ルール（大会ごとに設定可能。既定は hioPoints=-3, maxStrokes=5）:
//   - 1打(ホールインワン) => 1点（打数どおり。減算は下記のとおり合計に対して行う）
//   - 2〜maxStrokes 打 => その打数
//   - maxStrokes を超える打数 => maxStrokes 点(上限)
//   - 未入力 => null（暫定合計では0扱い、正式対象判定では未完了）
// 合計 = 各ホールの点の総和 + ホールインワン回数 × hioPoints
//   ホールインワンはホール単体の点を置き換えるのではなく、合計に対して
//   1回につき hioPoints を加算する（グラウンドゴルフ本式の「合計から3打減」に対応）。

/** スコア換算ルール（大会ごとに可変） */
export interface ScoreRule {
  hioPoints: number; // ホールインワン1回につき合計に加算する点（既定 -3）
  maxStrokes: number; // 上限打数（これを超える打数はこの値に丸める）
}

export const DEFAULT_RULE: ScoreRule = { hioPoints: -3, maxStrokes: 5 };

export const DEFAULT_HOLE_COUNT = 18; // 大会未設定時のフォールバック

/** ホールインワン（1打）判定 */
export function isHoleInOne(strokes: number | null | undefined): boolean {
  return strokes === 1;
}

/**
 * 1ホールの実打数を換算スコア（点）に変換。未入力は null。
 * ホールインワン(1打)もそのまま1点として扱う。hioPoints は合計側で加算するため
 * ここでは考慮しない（summarizeScores を参照）。
 */
export function holePoints(
  strokes: number | null | undefined,
  rule: ScoreRule = DEFAULT_RULE
): number | null {
  if (strokes == null) return null;
  if (strokes <= 1) return 1; // ホールインワン（打数どおり1点）
  return Math.min(strokes, rule.maxStrokes); // 2打以上は上限で丸め
}

export interface ScoreSummary {
  total: number; // 合計（順位対象値）
  enteredHoles: number; // 入力済みホール数
  complete: boolean; // 全ホール入力済みか
  hioCount: number; // ホールインワン回数
}

/**
 * ホール番号 -> 実打数 のマップから合計・HIO数を算出。
 * 合計は各ホールの点を足し込んだうえで、ホールインワン回数 × hioPoints を加算する。
 */
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

  // ホールインワンは合計に対して1回につき hioPoints を加算する
  total += hio * rule.hioPoints;

  return {
    total,
    enteredHoles: entered,
    complete: entered === holeCount,
    hioCount: hio,
  };
}

/**
 * ショットガン方式のプレー順（入力導線）。
 * ラウンドはそれぞれ別コース（例: 2ラウンド = OUT/IN）を指し、
 * 通しホール番号 1〜holeCount がコース上の全ホールに対応する。
 * 例: 2ラウンド×8ホール なら OUT1〜8=通し1〜8番、IN1〜8=通し9〜16番。
 * 各組は自分の開始ホールから通し番号順に全ホールを一巡する（holeCount の次は1に戻る）。
 * 例: startHole=5, holeCount=16
 *   => [5,6,7,8, 9,10,11,12,13,14,15,16, 1,2,3,4]
 *      （OUT5→8 → IN1→8 → OUT1→4）
 */
export function playOrder(
  startHole: number,
  holeCount: number = DEFAULT_HOLE_COUNT
): number[] {
  return Array.from(
    { length: holeCount },
    (_, i) => ((startHole - 1 + i) % holeCount) + 1
  );
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
