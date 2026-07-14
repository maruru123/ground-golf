"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PARTICIPANT_STATUS_LABELS } from "@/lib/labels";
import type { Standing } from "@/lib/standings";

interface AwardView {
  id: string;
  name: string;
  kind: string;
  winners: { name: string; term: number | null; note: string | null }[];
}

export default function RankingView({
  tournamentId,
  standings,
  awards,
}: {
  tournamentId: string;
  standings: Standing[];
  awards: AwardView[];
}) {
  const router = useRouter();
  const [officialOnly, setOfficialOnly] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  // 手動賞
  const [manualOpen, setManualOpen] = useState(false);
  const [manualName, setManualName] = useState("");
  const [manualSel, setManualSel] = useState<Record<string, boolean>>({});

  const rows = officialOnly ? standings.filter((s) => s.eligible) : standings;

  async function createAuto(
    kind: "rank" | "hio",
    category?: "overall" | "term" | "gender" | "age"
  ) {
    setBusy(true);
    setMsg("");
    const res = await fetch(`/api/tournaments/${tournamentId}/awards`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, category }),
    });
    const data = await res.json();
    setBusy(false);
    if (res.ok) {
      setMsg("賞を作成しました");
      router.refresh();
    } else setMsg(data.error ?? "失敗しました");
  }

  async function createManual() {
    const ids = Object.entries(manualSel)
      .filter(([, v]) => v)
      .map(([k]) => k);
    if (!manualName || ids.length === 0) {
      setMsg("賞名と対象者を選んでください");
      return;
    }
    setBusy(true);
    const res = await fetch(`/api/tournaments/${tournamentId}/awards`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "manual",
        name: manualName,
        participantIds: ids,
      }),
    });
    const data = await res.json();
    setBusy(false);
    if (res.ok) {
      setManualOpen(false);
      setManualName("");
      setManualSel({});
      setMsg("賞を作成しました");
      router.refresh();
    } else setMsg(data.error ?? "失敗しました");
  }

  async function deleteAward(id: string) {
    if (!confirm("この賞を削除しますか？")) return;
    setBusy(true);
    const res = await fetch(`/api/awards/${id}`, { method: "DELETE" });
    setBusy(false);
    if (res.ok) router.refresh();
  }

  return (
    <div className="space-y-6">
      {msg && (
        <p className="text-sm text-brand-700 bg-brand-50 rounded-lg px-3 py-2 no-print">
          {msg}
        </p>
      )}

      {/* 操作バー */}
      <div className="flex flex-wrap gap-3 items-center no-print">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={officialOnly}
            onChange={(e) => setOfficialOnly(e.target.checked)}
            className="w-5 h-5"
          />
          正式対象のみ表示（全ホール入力済・参加者）
        </label>
        <a
          href={`/api/tournaments/${tournamentId}/export/results`}
          className="tap text-sm rounded-lg border border-slate-300 px-3 py-1.5 hover:bg-slate-50"
        >
          結果CSV出力
        </a>
        <button
          onClick={() => window.print()}
          className="tap text-sm rounded-lg border border-slate-300 px-3 py-1.5 hover:bg-slate-50"
        >
          印刷 / PDF
        </button>
      </div>

      {/* 順位表 */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-slate-600 text-left">
              <th className="px-3 py-2 w-14">順位</th>
              <th className="px-3 py-2">氏名</th>
              <th className="px-3 py-2 w-14">期</th>
              <th className="px-3 py-2 w-16 text-right">合計</th>
              <th className="px-3 py-2 w-16">備考</th>
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
            {rows.map((s) => (
              <tr
                key={s.participantId}
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
                  {s.summary.enteredHoles > 0 ? s.summary.total : "-"}
                </td>
                <td className="px-3 py-2 text-xs">
                  {s.summary.hioCount > 0 && (
                    <span className="text-red-600 font-semibold mr-1">
                      HIO×{s.summary.hioCount}
                    </span>
                  )}
                  {s.status !== "playing" && (
                    <span className="text-amber-600">
                      {PARTICIPANT_STATUS_LABELS[s.status]}
                    </span>
                  )}
                  {s.status === "playing" && !s.summary.complete && (
                    <span className="text-slate-400">未完了</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 表彰 */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 flex-wrap no-print">
          <h2 className="font-bold text-slate-800">表彰</h2>
          <button
            disabled={busy}
            onClick={() => createAuto("rank", "overall")}
            className="tap text-sm rounded-lg bg-brand-500 text-white px-3 py-1.5 hover:bg-brand-600"
          >
            総合 上位3位
          </button>
          <button
            disabled={busy}
            onClick={() => createAuto("rank", "term")}
            className="tap text-sm rounded-lg bg-brand-500 text-white px-3 py-1.5 hover:bg-brand-600"
          >
            期別 上位3位
          </button>
          <button
            disabled={busy}
            onClick={() => createAuto("rank", "gender")}
            className="tap text-sm rounded-lg bg-brand-500 text-white px-3 py-1.5 hover:bg-brand-600"
          >
            男女別 上位3位
          </button>
          <button
            disabled={busy}
            onClick={() => createAuto("rank", "age")}
            className="tap text-sm rounded-lg bg-brand-500 text-white px-3 py-1.5 hover:bg-brand-600"
          >
            年代別 上位3位
          </button>
          <button
            disabled={busy}
            onClick={() => createAuto("hio")}
            className="tap text-sm rounded-lg bg-brand-500 text-white px-3 py-1.5 hover:bg-brand-600"
          >
            ホールインワン賞
          </button>
          <button
            disabled={busy}
            onClick={() => setManualOpen((v) => !v)}
            className="tap text-sm rounded-lg border border-slate-300 px-3 py-1.5 hover:bg-slate-50"
          >
            手動で賞を追加
          </button>
        </div>

        {manualOpen && (
          <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3 no-print">
            <input
              value={manualName}
              onChange={(e) => setManualName(e.target.value)}
              placeholder="賞名（例：ブービー賞）"
              className="tap w-full sm:w-80 rounded-lg border border-slate-300 px-3 py-2"
            />
            <div className="max-h-56 overflow-y-auto border border-slate-100 rounded-lg p-2 grid grid-cols-2 sm:grid-cols-3 gap-1">
              {standings.map((s) => (
                <label
                  key={s.participantId}
                  className="flex items-center gap-1 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={!!manualSel[s.participantId]}
                    onChange={(e) =>
                      setManualSel((m) => ({
                        ...m,
                        [s.participantId]: e.target.checked,
                      }))
                    }
                  />
                  {s.name}
                </label>
              ))}
            </div>
            <button
              disabled={busy}
              onClick={createManual}
              className="tap rounded-lg bg-emerald-600 text-white px-4 py-2 hover:bg-emerald-700"
            >
              賞を作成
            </button>
          </div>
        )}

        {awards.length === 0 ? (
          <p className="text-sm text-slate-400">まだ賞がありません。</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {awards.map((a) => (
              <div
                key={a.id}
                className="bg-white rounded-2xl border border-slate-200 p-4"
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-brand-600">{a.name}</h3>
                  <button
                    onClick={() => deleteAward(a.id)}
                    className="text-red-400 text-sm no-print"
                  >
                    削除
                  </button>
                </div>
                <ul className="mt-2 text-sm space-y-0.5">
                  {a.winners.length === 0 && (
                    <li className="text-slate-400">該当者なし</li>
                  )}
                  {a.winners.map((w, i) => (
                    <li key={i}>
                      {w.name}
                      {w.term != null && (
                        <span className="text-slate-400 text-xs">
                          （{w.term}期）
                        </span>
                      )}
                      {w.note && (
                        <span className="text-slate-500 text-xs ml-1">
                          {w.note}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
