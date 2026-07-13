"use client";

import { useState } from "react";
import RankingTableRO, { type RORow } from "./RankingTableRO";

export default function PasswordGate({ token }: { token: string }) {
  const [password, setPassword] = useState("");
  const [rows, setRows] = useState<RORow[] | null>(null);
  const [name, setName] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      const res = await fetch(`/api/view/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (res.ok) {
        setRows(data.rows);
        setName(data.tournamentName);
      } else setErr(data.error ?? "表示できませんでした");
    } catch {
      setErr("通信エラーが発生しました");
    } finally {
      setBusy(false);
    }
  }

  if (rows) {
    return (
      <main className="flex-1 p-4 max-w-2xl mx-auto w-full space-y-4">
        <h1 className="text-xl font-bold text-slate-800">{name} 順位表</h1>
        <RankingTableRO rows={rows} />
      </main>
    );
  }

  return (
    <main className="flex-1 flex items-center justify-center p-6">
      <form
        onSubmit={submit}
        className="w-full max-w-sm bg-white rounded-2xl border border-slate-200 p-8 space-y-4"
      >
        <h1 className="text-lg font-bold text-brand-600">順位表を表示</h1>
        <p className="text-sm text-slate-500">閲覧パスワードを入力してください</p>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
          className="tap w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
        />
        {err && (
          <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
            {err}
          </p>
        )}
        <button
          disabled={busy || !password}
          className="tap w-full rounded-lg bg-brand-500 text-white font-semibold py-2 hover:bg-brand-600 disabled:opacity-50"
        >
          表示
        </button>
      </form>
    </main>
  );
}
