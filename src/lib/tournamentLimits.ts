// スタート方式ごとの組数上限
//   - shotgun(ショットガン): 各組が別ホールから一斉スタート。18ホール=最大18組。
//   - sequential(順次スタート): 全組が1番から時間差スタート。ホール数の制約を受けないため上限は安全のための値。

export const SHOTGUN_MAX_GROUPS = 18;
export const SEQUENTIAL_MAX_GROUPS = 100;

export type StartMethod = "shotgun" | "sequential";

export const START_METHOD_LABELS: Record<string, string> = {
  shotgun: "ショットガン（一斉スタート）",
  sequential: "順次スタート（1番から時間差）",
};

/** スタート方式に応じた組数上限 */
export function maxGroupsFor(startMethod: string): number {
  return startMethod === "sequential"
    ? SEQUENTIAL_MAX_GROUPS
    : SHOTGUN_MAX_GROUPS;
}
