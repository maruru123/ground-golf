"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface TournamentData {
  id: string;
  name: string;
  heldDate: string;
  venue: string;
  status: string;
  scorePasscode: string;
  viewEnabled: boolean;
  viewToken: string;
  viewPassword: string;
}

const STATUS_FLOW: { value: string; label: string; desc: string }[] = [
  { value: "draft", label: "準備中", desc: "設定・参加者・組を編集。入力不可" },
  { value: "active", label: "開催中", desc: "スコア入力可。順位は暫定表示" },
  { value: "closed", label: "終了", desc: "入力ロック。正式順位・表彰確定" },
];

export default function SettingsForm({
  tournament,
}: {
  tournament: TournamentData;
}) {
  const router = useRouter();
  const [t, setT] = useState(tournament);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [customPass, setCustomPass] = useState("");
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  async function patch(body: Record<string, unknown>, note = "保存しました") {
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch(`/api/tournaments/${t.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok) {
        const tt = data.tournament;
        setT((prev) => ({
          ...prev,
          name: tt.name,
          heldDate: tt.heldDate
            ? new Date(tt.heldDate).toISOString().slice(0, 10)
            : "",
          venue: tt.venue ?? "",
          status: tt.status,
          scorePasscode: tt.scorePasscode ?? "",
          viewEnabled: tt.viewEnabled,
          viewToken: tt.viewToken ?? "",
          viewPassword: tt.viewPassword ?? "",
        }));
        setMsg(note);
        router.refresh();
      } else {
        setMsg(data.error ?? "保存に失敗しました");
      }
    } catch {
      setMsg("通信エラーが発生しました");
    } finally {
      setBusy(false);
    }
  }

  async function onDelete() {
    if (!confirm("この大会を削除します。参加者・スコアもすべて削除されます。よろしいですか？"))
      return;
    setBusy(true);
    const res = await fetch(`/api/tournaments/${t.id}`, { method: "DELETE" });
    if (res.ok) {
      router.push("/admin");
      router.refresh();
    } else {
      setMsg("削除に失敗しました");
      setBusy(false);
    }
  }

  const entryUrl = `${origin}/entry`;
  const viewUrl = t.viewToken ? `${origin}/view/${t.viewToken}` : "";

  return (
    <div className="space-y-6 max-w-2xl">
      {msg && (
        <p className="text-sm text-brand-700 bg-brand-50 rounded-lg px-3 py-2">
          {msg}
        </p>
      )}

      {/* 基本情報 */}
      <section className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
        <h2 className="font-bold text-slate-800">基本情報</h2>
        <div>
          <label className="block text-sm font-medium mb-1">大会名</label>
          <input
            value={t.name}
            onChange={(e) => setT({ ...t, name: e.target.value })}
            className="tap w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">開催日</label>
            <input
              type="date"
              value={t.heldDate}
              onChange={(e) => setT({ ...t, heldDate: e.target.value })}
              className="tap w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">会場</label>
            <input
              value={t.venue}
              onChange={(e) => setT({ ...t, venue: e.target.value })}
              className="tap w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
          </div>
        </div>
        <button
          disabled={busy || !t.name}
          onClick={() =>
            patch({
              name: t.name,
              heldDate: t.heldDate || null,
              venue: t.venue || null,
            })
          }
          className="tap rounded-lg bg-brand-500 text-white font-semibold px-4 py-2 hover:bg-brand-600 disabled:opacity-50"
        >
          基本情報を保存
        </button>
      </section>

      {/* 状態 */}
      <section className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
        <h2 className="font-bold text-slate-800">大会の状態</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {STATUS_FLOW.map((s) => (
            <button
              key={s.value}
              disabled={busy}
              onClick={() => patch({ status: s.value }, `状態を「${s.label}」にしました`)}
              className={`text-left rounded-xl border p-3 transition ${
                t.status === s.value
                  ? "border-brand-500 bg-brand-50"
                  : "border-slate-200 hover:border-slate-300"
              }`}
            >
              <div className="font-semibold text-sm">
                {s.label}
                {t.status === s.value && (
                  <span className="ml-2 text-brand-600 text-xs">● 現在</span>
                )}
              </div>
              <div className="text-xs text-slate-500 mt-1">{s.desc}</div>
            </button>
          ))}
        </div>
      </section>

      {/* スコア入力設定 */}
      <section className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
        <h2 className="font-bold text-slate-800">スコア入力（合言葉）</h2>
        <p className="text-sm text-slate-500">
          代表者は下記URLを開き、合言葉で入場します（開催中のみ入力可）。
        </p>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm">合言葉:</span>
          <code className="text-lg font-bold bg-slate-100 rounded px-3 py-1 tracking-widest">
            {t.scorePasscode || "（未発行）"}
          </code>
          <button
            disabled={busy}
            onClick={() =>
              patch({ regeneratePasscode: true }, "合言葉を自動発行しました")
            }
            className="tap text-sm rounded-lg border border-slate-300 px-3 py-1.5 hover:bg-slate-50"
          >
            {t.scorePasscode ? "自動で再発行" : "自動発行"}
          </button>
        </div>

        {/* 合言葉を自分で決める */}
        <div className="border-t border-slate-100 pt-3">
          <label className="block text-sm font-medium mb-1">
            合言葉を自分で設定する（任意）
          </label>
          <div className="flex items-end gap-2 flex-wrap">
            <input
              value={customPass}
              onChange={(e) => setCustomPass(e.target.value)}
              placeholder="例: SAKURA2026"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              className="tap rounded-lg border border-slate-300 px-3 py-2 tracking-widest uppercase outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
            <button
              disabled={busy || !customPass.trim()}
              onClick={() => {
                const code = customPass.replace(/\s/g, "").toUpperCase();
                patch({ scorePasscode: code }, "合言葉を設定しました");
                setCustomPass("");
              }}
              className="tap rounded-lg bg-brand-500 text-white font-semibold px-4 py-2 hover:bg-brand-600 disabled:opacity-50"
            >
              この合言葉にする
            </button>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            英数字がおすすめです。参加者は大文字・小文字を気にせず入力できます（自動で大文字に統一）。
          </p>
        </div>

        <div className="text-sm text-slate-600">
          入場URL: <span className="font-mono">{entryUrl}</span>
        </div>
      </section>

      {/* 閲覧公開設定 */}
      <section className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
        <h2 className="font-bold text-slate-800">順位表の公開（閲覧専用URL）</h2>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={t.viewEnabled}
            onChange={(e) =>
              patch(
                { viewEnabled: e.target.checked },
                e.target.checked ? "公開しました" : "非公開にしました"
              )
            }
            className="w-5 h-5"
          />
          閲覧専用URLを発行する
        </label>
        {t.viewEnabled && (
          <div className="space-y-3 pl-1">
            {viewUrl && (
              <div className="text-sm text-slate-600 break-all">
                閲覧URL: <span className="font-mono">{viewUrl}</span>
              </div>
            )}
            <div className="flex items-end gap-2 flex-wrap">
              <div>
                <label className="block text-sm font-medium mb-1">
                  閲覧パスワード（任意）
                </label>
                <input
                  value={t.viewPassword}
                  onChange={(e) => setT({ ...t, viewPassword: e.target.value })}
                  placeholder="空欄ならパスワードなし"
                  className="tap rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                />
              </div>
              <button
                disabled={busy}
                onClick={() =>
                  patch(
                    { viewPassword: t.viewPassword || null },
                    "閲覧パスワードを保存しました"
                  )
                }
                className="tap rounded-lg border border-slate-300 px-3 py-2 hover:bg-slate-50"
              >
                保存
              </button>
              <button
                disabled={busy}
                onClick={() =>
                  patch({ regenerateViewToken: true }, "URLを再発行しました")
                }
                className="tap rounded-lg border border-slate-300 px-3 py-2 hover:bg-slate-50"
              >
                URL再発行
              </button>
            </div>
          </div>
        )}
      </section>

      {/* 危険な操作 */}
      <section className="bg-white rounded-2xl border border-red-200 p-5 space-y-3">
        <h2 className="font-bold text-red-600">危険な操作</h2>
        <button
          disabled={busy}
          onClick={onDelete}
          className="tap rounded-lg border border-red-300 text-red-600 px-4 py-2 hover:bg-red-50"
        >
          この大会を削除
        </button>
      </section>
    </div>
  );
}
