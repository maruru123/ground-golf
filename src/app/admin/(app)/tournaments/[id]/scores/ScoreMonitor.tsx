"use client";

import { useState } from "react";
import { summarizeScores, type ScoreRule } from "@/lib/scoring";

interface Member {
  id: string;
  name: string;
  scores: Record<string, number | null>;
}
interface Group {
  groupNo: number;
  name: string | null;
  startHole: number;
  members: Member[];
}

export default function ScoreMonitor({
  groups,
  rule,
  holeCount,
  holesPerRound,
}: {
  groups: Group[];
  rule: ScoreRule;
  holeCount: number;
  holesPerRound: number;
}) {
  const [data, setData] = useState<Group[]>(groups);
  const [err, setErr] = useState("");
  const HOLES = Array.from({ length: holeCount }, (_, i) => i + 1);
  const roundCount = Math.max(1, Math.ceil(holeCount / holesPerRound));
  const isMultiRound = roundCount > 1;
  // ラウンドごとの列数（例: 2R×8Hなら [8, 8]）
  const roundSpans = Array.from({ length: roundCount }, (_, r) =>
    Math.min(holesPerRound, holeCount - r * holesPerRound)
  );

  /** 入力欄の表示と保持データを、実際に保存される値に揃える。 */
  function apply(
    memberId: string,
    hole: number,
    strokes: number | null,
    el: HTMLInputElement
  ) {
    el.value = strokes == null ? "" : String(strokes);
    setData((gs) =>
      gs.map((g) => ({
        ...g,
        members: g.members.map((m) =>
          m.id === memberId
            ? { ...m, scores: { ...m.scores, [hole]: strokes } }
            : m
        ),
      }))
    );
  }

  async function save(
    memberId: string,
    hole: number,
    el: HTMLInputElement,
    prev: number | null
  ) {
    const raw = el.value.trim();
    let strokes: number | null = null;
    if (raw !== "") {
      const n = Number(raw);
      if (!Number.isInteger(n) || n < 1) {
        el.value = prev == null ? "" : String(prev); // 数値でない/0以下は元に戻す
        return;
      }
      strokes = Math.min(n, rule.maxStrokes); // 上限打数を超えたら上限に補正
    }
    apply(memberId, hole, strokes, el);
    try {
      const res = await fetch(`/api/participants/${memberId}/scores`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ holeNo: hole, strokes }),
      });
      const d = await res.json().catch(() => null);
      if (!res.ok) {
        setErr(d?.error ?? "保存に失敗しました");
        return;
      }
      setErr("");
      // サーバ側でも上限打数に丸めるため、保存値がずれていたら表示を合わせ直す
      if (d && d.strokes !== undefined && d.strokes !== strokes) {
        apply(memberId, hole, d.strokes, el);
      }
    } catch {
      setErr("通信エラー");
    }
  }

  function total(m: Member) {
    const map = new Map<number, number | null>();
    for (const [k, v] of Object.entries(m.scores)) map.set(Number(k), v);
    return summarizeScores(map, rule, holeCount);
  }

  if (groups.length === 0) {
    return (
      <p className="text-slate-400 text-sm">
        組が未設定です。「ペアリング」で組を作成してください。
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-500">
        管理者は状態に関わらず修正できます。数値は打数（空欄で未入力）。
        上限打数({rule.maxStrokes}打)を超える値は{rule.maxStrokes}に補正されます。
      </p>
      {err && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
          {err}
        </p>
      )}
      {data.map((g) => (
        <div key={g.groupNo} className="space-y-2">
          <h3 className="font-bold text-slate-700">
            第{g.groupNo}組
            {g.name ? `（${g.name}）` : ""}
            <span className="text-sm font-normal text-slate-400 ml-2">
              開始{g.startHole}番
            </span>
          </h3>
          <div className="bg-white rounded-2xl border border-slate-200 overflow-x-auto">
            <table className="text-xs">
              <thead>
                {isMultiRound && (
                  <tr className="bg-slate-100 text-slate-500">
                    <th className="sticky left-0 bg-slate-100" />
                    {roundSpans.map((span, r) => (
                      <th
                        key={r}
                        colSpan={span}
                        className={`px-1 py-0.5 font-semibold text-slate-600 ${
                          r > 0 ? "border-l-2 border-slate-300" : ""
                        }`}
                      >
                        {r + 1}R
                      </th>
                    ))}
                    <th />
                  </tr>
                )}
                <tr className="bg-slate-50 text-slate-500">
                  <th className="px-2 py-1 sticky left-0 bg-slate-50 text-left min-w-[6rem]">
                    氏名
                  </th>
                  {HOLES.map((h) => {
                    const isRoundStart =
                      isMultiRound && (h - 1) % holesPerRound === 0 && h !== 1;
                    const label = isMultiRound
                      ? ((h - 1) % holesPerRound) + 1
                      : h;
                    return (
                      <th
                        key={h}
                        className={`px-1 py-1 w-8 ${
                          isRoundStart ? "border-l-2 border-slate-300" : ""
                        }`}
                      >
                        {label}
                      </th>
                    );
                  })}
                  <th className="px-2 py-1 w-12">計</th>
                </tr>
              </thead>
              <tbody>
                {g.members.length === 0 && (
                  <tr>
                    <td
                      colSpan={20}
                      className="px-2 py-3 text-center text-slate-400"
                    >
                      メンバーなし
                    </td>
                  </tr>
                )}
                {g.members.map((m) => {
                  const sum = total(m);
                  return (
                    <tr key={m.id} className="border-t border-slate-100">
                      <td className="px-2 py-1 sticky left-0 bg-white font-medium whitespace-nowrap">
                        {m.name}
                      </td>
                      {HOLES.map((h) => {
                        const isRoundStart =
                          isMultiRound &&
                          (h - 1) % holesPerRound === 0 &&
                          h !== 1;
                        return (
                          <td
                            key={h}
                            className={`px-0.5 py-1 ${
                              isRoundStart ? "border-l-2 border-slate-300" : ""
                            }`}
                          >
                            <input
                              defaultValue={m.scores[h] ?? ""}
                              inputMode="numeric"
                              onBlur={(e) =>
                                save(m.id, h, e.target, m.scores[h] ?? null)
                              }
                              className="w-7 text-center rounded border border-slate-200 py-1"
                            />
                          </td>
                        );
                      })}
                      <td className="px-2 py-1 text-right font-semibold">
                        {sum.enteredHoles > 0 ? sum.total : "-"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}
