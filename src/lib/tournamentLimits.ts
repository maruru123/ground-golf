// スタート方式ごとの組数上限
//   - shotgun(ショットガン): 各組が別ホールから一斉スタート。
//       物理的なホール数（=1ラウンドのホール数）だけしか同時スタート地点がないため、
//       組数上限は「1ラウンドのホール数」で決まる（総ホール数ではない。
//       複数ラウンドは同じコースを周回するだけで、物理ホールは増えない）。
//   - sequential(順次スタート): 全組が1番から時間差スタート。ホール数の制約を受けないため上限は安全のための値。

export const SEQUENTIAL_MAX_GROUPS = 100;

export type StartMethod = "shotgun" | "sequential";

export const START_METHOD_LABELS: Record<string, string> = {
  shotgun: "ショットガン（一斉スタート）",
  sequential: "順次スタート（1番から時間差）",
};

/** スタート方式に応じた組数上限（ショットガンは1ラウンドのホール数が上限） */
export function maxGroupsFor(startMethod: string, holesPerRound: number): number {
  return startMethod === "sequential" ? SEQUENTIAL_MAX_GROUPS : holesPerRound;
}
