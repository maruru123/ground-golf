// 表示用ラベル（内部値 → 日本語）

export const TOURNAMENT_STATUS_LABELS: Record<string, string> = {
  draft: "準備中",
  active: "開催中",
  closed: "終了",
};

export const TOURNAMENT_STATUS_STYLES: Record<string, string> = {
  draft: "bg-slate-100 text-slate-600",
  active: "bg-emerald-100 text-emerald-700",
  closed: "bg-slate-200 text-slate-700",
};

export const PARTICIPANT_STATUS_LABELS: Record<string, string> = {
  playing: "参加",
  absent: "欠席",
  withdrawn: "棄権",
};

export const GENDER_LABELS: Record<string, string> = {
  male: "男",
  female: "女",
  other: "その他",
};

export function genderToInternal(v: string): string | null {
  const s = v.trim();
  if (s === "男" || s.toLowerCase() === "male") return "male";
  if (s === "女" || s.toLowerCase() === "female") return "female";
  if (s === "その他" || s.toLowerCase() === "other") return "other";
  return null;
}

export function statusToInternal(v: string): string | null {
  const s = v.trim();
  if (s === "参加" || s === "playing") return "playing";
  if (s === "欠席" || s === "absent") return "absent";
  if (s === "棄権" || s === "withdrawn") return "withdrawn";
  return null;
}
