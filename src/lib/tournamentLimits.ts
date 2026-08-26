// 組数の上限。スタート方式に関わらず MAX_GROUPS を超えない。
//   - shotgun(ショットガン): 各組が別ホールから一斉スタート。
//       ラウンドはそれぞれ別コース（例: 2ラウンド = OUT/IN）を指すため、
//       同時スタートできる地点の数は総ホール数（=ラウンド数×1ラウンドのホール数）に等しい。
//       例: 2ラウンド×8ホール なら OUT1〜8=通し1〜8番、IN1〜8=通し9〜16番 の計16地点。
//       総ホール数が17以上の場合は MAX_GROUPS で頭打ちになる。
//   - sequential(順次スタート): 全組が1番から時間差スタート。ホール数の制約を受けないため MAX_GROUPS まで。

/** 大会あたりの組数の上限 */
export const MAX_GROUPS = 16;

export type StartMethod = "shotgun" | "sequential";

export const START_METHOD_LABELS: Record<string, string> = {
  shotgun: "ショットガン（一斉スタート）",
  sequential: "順次スタート（1番から時間差）",
};

/** スタート方式に応じた組数上限（ショットガンは総ホール数、いずれも MAX_GROUPS が上限） */
export function maxGroupsFor(startMethod: string, holeCount: number): number {
  return startMethod === "sequential"
    ? MAX_GROUPS
    : Math.min(holeCount, MAX_GROUPS);
}

/** ショットガンで組数上限を決めているのが「総ホール数」かどうか（メッセージ用） */
export function limitedByHoles(
  startMethod: string,
  holeCount: number
): boolean {
  return startMethod !== "sequential" && holeCount <= MAX_GROUPS;
}
