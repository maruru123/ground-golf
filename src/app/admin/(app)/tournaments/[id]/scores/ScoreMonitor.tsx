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
}: {
  groups: Group[];
  rule: ScoreRule;
  holeCount: number;
}) {
  const [data, setData] = useState<Group[]>(groups);
  const [err, setErr] = useState("");
  const HOLES = Array.from({ length: holeCount }, (_, i) => i + 1);

  async function save(memberId: string, hole: number, raw: string) {
    let strokes: number | null = null;
    if (raw.trim() !== "") {
      const n = Number(raw);
      if (!Number.isInteger(n) || n < 1 || n > 20) return;
      strokes = n;
    }
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
    try {
      const res = await fetch(`/api/participants/${memberId}/scores`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ holeNo: hole, strokes }),
      });
      if (!res.ok) {
        const d = await res.json();
        setErr(d.error ?? "保存に失敗しました");
      } else setErr("");
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
                <tr className="bg-slate-50 text-slate-500">
                  <th className="px-2 py-1 sticky left-0 bg-slate-50 text-left min-w-[6rem]">
                    氏名
                  </th>
                  {HOLES.map((h) => (
                    <th key={h} className="px-1 py-1 w-8">
                      {h}
                    </th>
                  ))}
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
                      {HOLES.map((h) => (
                        <td key={h} className="px-0.5 py-1">
                          <input
                            defaultValue={m.scores[h] ?? ""}
                            inputMode="numeric"
                            onBlur={(e) => save(m.id, h, e.target.value)}
                            className="w-7 text-center rounded border border-slate-200 py-1"
                          />
                        </td>
                      ))}
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
