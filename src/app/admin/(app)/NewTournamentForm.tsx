"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// 空欄・不正入力は既定値に丸める（空欄→0 など）
const toInt = (v: string, fallback: number) => {
  if (v.trim() === "") return fallback;
  const n = Number(v);
  return Number.isNaN(n) ? fallback : Math.trunc(n);
};

export default function NewTournamentForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [venue, setVenue] = useState("");
  // スコアルールは既定値を初期表示（通常はそのままでOK）
  const [hioPoints, setHioPoints] = useState(-3);
  const [maxStrokes, setMaxStrokes] = useState(5);
  const [maxPerGroup, setMaxPerGroup] = useState(8);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      const res = await fetch("/api/tournaments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          heldDate: date || null,
          venue: venue || null,
          hioPoints,
          maxStrokes,
          maxPerGroup,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setName("");
        setDate("");
        setVenue("");
        setHioPoints(-3);
        setMaxStrokes(5);
        setMaxPerGroup(8);
        setOpen(false);
        router.refresh();
      } else {
        setErr(data.error || "作成に失敗しました");
      }
    } catch {
      setErr("通信エラーが発生しました");
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="tap rounded-lg bg-brand-500 text-white font-semibold px-4 py-2 hover:bg-brand-600 transition"
      >
        ＋ 新しい大会を作成
      </button>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4"
    >
      <h2 className="font-bold text-brand-600">新しい大会</h2>
      <div>
        <label className="block text-sm font-medium mb-1">大会名 *</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
          className="tap w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          placeholder="例）第10回 OB親睦グラウンドゴルフ大会"
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">開催日</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="tap w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">会場</label>
          <input
            value={venue}
            onChange={(e) => setVenue(e.target.value)}
            className="tap w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            placeholder="任意"
          />
        </div>
      </div>
      <div>
        <p className="text-sm font-medium mb-1">スコアルール（既定値を設定済み）</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-slate-500 mb-1">
              ホールインワンの点数
            </label>
            <input
              type="number"
              value={hioPoints}
              onChange={(e) => setHioPoints(toInt(e.target.value, 0))}
              className="tap w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">上限打数</label>
            <input
              type="number"
              min={2}
              max={20}
              value={maxStrokes}
              onChange={(e) => setMaxStrokes(Math.max(1, toInt(e.target.value, 1)))}
              className="tap w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">
              1組あたりの人数上限
            </label>
            <input
              type="number"
              min={1}
              max={20}
              value={maxPerGroup}
              onChange={(e) => setMaxPerGroup(Math.max(1, toInt(e.target.value, 1)))}
              className="tap w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
          </div>
        </div>
        <p className="text-xs text-slate-400 mt-1">
          通常はこのまま（−3 / 5 / 8）でOK。必要な大会だけ変更してください。後から設定でも変更できます。
        </p>
      </div>
      {err && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
          {err}
        </p>
      )}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={loading || !name}
          className="tap rounded-lg bg-brand-500 text-white font-semibold px-4 py-2 hover:bg-brand-600 disabled:opacity-50 transition"
        >
          {loading ? "作成中..." : "作成"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="tap rounded-lg border border-slate-300 px-4 py-2 hover:bg-slate-50 transition"
        >
          キャンセル
        </button>
      </div>
    </form>
  );
}
