"use client";

import {
  PARTICIPANT_STATUS_LABELS,
  roundLabel,
  roundHeadClass,
} from "@/lib/labels";

interface Row {
  participantId: string;
  name: string;
  term: number | null;
  groupNo: number | null;
  status: string;
  rank: number | null;
  eligible: boolean;
  total: number;
  enteredHoles: number;
  complete: boolean;
  hioCount: number;
  scores: Record<string, number | null>;
}

/** 氏名などの固定列。ラウンド見出し行ではまとめて空セルにする。 */
const FIXED_COLS = 4;

export default function ResultsTable({
  tournamentName,
  holeCount,
  holesPerRound,
  rows,
}: {
  tournamentName: string;
  holeCount: number;
  holesPerRound: number;
  rows: Row[];
}) {
  const roundCount = Math.max(1, Math.ceil(holeCount / holesPerRound));
  const isMultiRound = roundCount > 1;
  // 表は回り順ではなく 1R1〜8 → 2R1〜8 のホール番号順に固定で並べる
  const cols = Array.from({ length: holeCount }, (_, i) => {
    const holeNo = i + 1;
    return {
      holeNo,
      roundIdx: Math.floor(i / holesPerRound),
      inRound: (i % holesPerRound) + 1,
    };
  });
  const segments = Array.from({ length: roundCount }, (_, r) => ({
    roundIdx: r,
    span: Math.min(holesPerRound, holeCount - r * holesPerRound),
    startIdx: r * holesPerRound,
  }));

  function csv() {
    const bom = "﻿";
    const head = [
      "順位",
      "氏名",
      "期",
      "組",
      ...cols.map((c) =>
        isMultiRound
          ? `${roundLabel(c.roundIdx, roundCount)}-${c.inRound}`
          : String(c.holeNo)
      ),
      "合計",
      "HIO回数",
      "状態",
    ].join(",");
    const body = rows.map((r) =>
      [
        r.eligible && r.rank != null ? r.rank : "",
        r.name,
        r.term ?? "",
        r.groupNo ?? "",
        ...cols.map((c) => r.scores[c.holeNo] ?? ""),
        r.enteredHoles > 0 ? r.total : "",
        r.hioCount,
        PARTICIPANT_STATUS_LABELS[r.status] ?? r.status,
      ].join(",")
    );
    const blob = new Blob([bom + [head, ...body].join("\n") + "\n"], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "results.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2 no-print">
        <p className="text-sm text-slate-500">
          ホールごとの打数を組の順に一覧できます（表示のみ・編集はスコア画面から）。
          赤字はホールインワンです。
        </p>
        <div className="flex gap-2">
          <button
            onClick={csv}
            className="tap text-sm rounded-lg border border-slate-300 px-3 py-1.5 hover:bg-slate-50"
          >
            CSV書き出し
          </button>
          <button
            onClick={() => window.print()}
            className="tap text-sm rounded-lg border border-slate-300 px-3 py-1.5 hover:bg-slate-50"
          >
            印刷 / PDF
          </button>
        </div>
      </div>

      <h2 className="hidden print:block font-bold">{tournamentName} 結果</h2>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-x-auto">
        <table className="text-xs">
          <thead>
            {isMultiRound && (
              <tr className="bg-slate-100">
                <th className="bg-slate-100" colSpan={FIXED_COLS} />
                {segments.map((s) => (
                  <th
                    key={s.roundIdx}
                    colSpan={s.span}
                    className={`px-1 py-0.5 font-semibold ${
                      roundHeadClass(s.roundIdx) || "text-slate-600"
                    } ${s.startIdx > 0 ? "border-l-2 border-slate-300" : ""}`}
                  >
                    {roundLabel(s.roundIdx, roundCount)}
                  </th>
                ))}
                <th colSpan={2} />
              </tr>
            )}
            <tr className="bg-slate-50 text-slate-500">
              <th className="px-2 py-1 w-10 bg-slate-50">順位</th>
              <th className="px-2 py-1 text-left min-w-[6rem] bg-slate-50">
                氏名
              </th>
              <th className="px-2 py-1 w-10 bg-slate-50">期</th>
              <th className="px-2 py-1 w-10 bg-slate-50">組</th>
              {cols.map((c, i) => (
                <th
                  key={c.holeNo}
                  className={`px-1 py-1 w-8 ${
                    isMultiRound ? roundHeadClass(c.roundIdx) : ""
                  } ${
                    isMultiRound && i % holesPerRound === 0 && i > 0
                      ? "border-l-2 border-slate-300"
                      : ""
                  }`}
                >
                  {isMultiRound ? c.inRound : c.holeNo}
                </th>
              ))}
              <th className="px-2 py-1 w-12">計</th>
              <th className="px-2 py-1 w-20">備考</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={FIXED_COLS + holeCount + 2}
                  className="px-3 py-6 text-center text-slate-400"
                >
                  参加者がいません。
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr
                key={r.participantId}
                className={`border-t border-slate-100 ${
                  r.eligible && r.rank != null && r.rank <= 3
                    ? "bg-amber-50"
                    : ""
                }`}
              >
                <td className="px-2 py-1 text-center font-bold">
                  {r.eligible && r.rank != null ? r.rank : "—"}
                </td>
                <td className="px-2 py-1 font-medium whitespace-nowrap">
                  {r.name}
                </td>
                <td className="px-2 py-1 text-center text-slate-500">
                  {r.term ?? "-"}
                </td>
                <td className="px-2 py-1 text-center text-slate-500">
                  {r.groupNo ?? "-"}
                </td>
                {cols.map((c, i) => {
                  const v = r.scores[c.holeNo] ?? null;
                  return (
                    <td
                      key={c.holeNo}
                      className={`px-1 py-1 text-center tabular-nums ${
                        v === 1 ? "text-red-600 font-bold" : ""
                      } ${
                        isMultiRound && i % holesPerRound === 0 && i > 0
                          ? "border-l-2 border-slate-300"
                          : ""
                      }`}
                    >
                      {v ?? "-"}
                    </td>
                  );
                })}
                <td className="px-2 py-1 text-right font-semibold">
                  {r.enteredHoles > 0 ? r.total : "-"}
                </td>
                <td className="px-2 py-1 text-[11px] whitespace-nowrap">
                  {r.hioCount > 0 && (
                    <span className="text-red-600 font-semibold mr-1">
                      HIO×{r.hioCount}
                    </span>
                  )}
                  {r.status !== "playing" && (
                    <span className="text-amber-600">
                      {PARTICIPANT_STATUS_LABELS[r.status] ?? r.status}
                    </span>
                  )}
                  {r.status === "playing" && !r.complete && (
                    <span className="text-slate-400">
                      未完了 {r.enteredHoles}/{holeCount}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
