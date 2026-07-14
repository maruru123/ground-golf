import { PARTICIPANT_STATUS_LABELS } from "@/lib/labels";

export interface RORow {
  name: string;
  term: number | null;
  rank: number | null;
  eligible: boolean;
  total: number;
  hioCount: number;
  complete: boolean;
  status: string;
  entered: number;
}

export default function RankingTableRO({ rows }: { rows: RORow[] }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-50 text-slate-600 text-left">
            <th className="px-3 py-2 w-14">順位</th>
            <th className="px-3 py-2">氏名</th>
            <th className="px-3 py-2 w-12">期</th>
            <th className="px-3 py-2 w-14 text-right">合計</th>
            <th className="px-3 py-2 w-14">備考</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={5} className="px-3 py-6 text-center text-slate-400">
                データがありません。
              </td>
            </tr>
          )}
          {rows.map((s, i) => (
            <tr
              key={i}
              className={`border-t border-slate-100 ${
                s.eligible && s.rank && s.rank <= 3 ? "bg-amber-50" : ""
              }`}
            >
              <td className="px-3 py-2 font-bold">
                {s.eligible && s.rank != null ? s.rank : "—"}
              </td>
              <td className="px-3 py-2 font-medium">{s.name}</td>
              <td className="px-3 py-2">{s.term ?? "-"}</td>
              <td className="px-3 py-2 text-right font-semibold">
                {s.entered > 0 ? s.total : "-"}
              </td>
              <td className="px-3 py-2 text-xs">
                {s.hioCount > 0 && (
                  <span className="text-red-600 font-semibold mr-1">
                    HIO×{s.hioCount}
                  </span>
                )}
                {s.status !== "playing" && (
                  <span className="text-amber-600">
                    {PARTICIPANT_STATUS_LABELS[s.status]}
                  </span>
                )}
                {s.status === "playing" && !s.complete && (
                  <span className="text-slate-400">未完了</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
