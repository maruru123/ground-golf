"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  playOrder,
  holePoints,
  summarizeScores,
  isHoleInOne,
  DEFAULT_RULE,
  type ScoreRule,
} from "@/lib/scoring";

interface GroupInfo {
  id: string;
  groupNo: number;
  name: string | null;
  startHole: number;
  hasPin: boolean;
  memberCount: number;
}
interface Member {
  id: string;
  name: string;
  scores: Record<string, number | null>;
}

type Step = "passcode" | "group" | "input";

export default function EntryPage() {
  const [step, setStep] = useState<Step>("passcode");
  const [passcode, setPasscode] = useState("");
  const [pin, setPin] = useState("");
  const [rule, setRule] = useState<ScoreRule>(DEFAULT_RULE);
  const [holeCount, setHoleCount] = useState(18);
  const [holesPerRound, setHolesPerRound] = useState(18);
  const [roundCount, setRoundCount] = useState(1);
  const [tournament, setTournament] = useState<{
    id: string;
    name: string;
    status: string;
  } | null>(null);
  const [groups, setGroups] = useState<GroupInfo[]>([]);
  const [group, setGroup] = useState<{
    id: string;
    groupNo: number;
    name: string | null;
    startHole: number;
  } | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [order, setOrder] = useState<number[]>([]);
  const [holeIdx, setHoleIdx] = useState(0);
  const [status, setStatus] = useState("active");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  // 同じ人・同じホールへの保存を直列実行するためのキュー（連打時の書き込み順序を保証）
  const saveQueueRef = useRef<Map<string, Promise<void>>>(new Map());

  // sessionStorage から復元（SSRでは storage 不可のためマウント時に一度だけ反映）
  useEffect(() => {
    const saved = sessionStorage.getItem("gg_entry");
    if (!saved) return;
    try {
      const s = JSON.parse(saved);
      /* eslint-disable react-hooks/set-state-in-effect --
         ブラウザ保存値の初回ハイドレーション（外部ストアからの一度きりの同期） */
      if (s.passcode) setPasscode(s.passcode);
      if (s.pin) setPin(s.pin);
      /* eslint-enable react-hooks/set-state-in-effect */
    } catch {}
  }, []);

  async function verify(e?: React.FormEvent) {
    e?.preventDefault();
    // 入力中は素通しにしているため、送信時にここで正規化（空白除去・大文字化）
    const code = passcode.replace(/\s/g, "").toUpperCase();
    if (!code) return;
    setErr("");
    setBusy(true);
    try {
      const res = await fetch("/api/entry/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passcode: code }),
      });
      const data = await res.json();
      if (res.ok) {
        setPasscode(code); // 以降のAPI呼び出し用に正規化済みの値へ統一
        setTournament(data.tournament);
        setGroups(data.groups);
        setStatus(data.tournament.status);
        setStep("group");
        sessionStorage.setItem("gg_entry", JSON.stringify({ passcode: code }));
      } else setErr(data.error ?? "失敗しました");
    } catch {
      setErr("通信エラーが発生しました");
    } finally {
      setBusy(false);
    }
  }

  async function openGroup(g: GroupInfo) {
    setErr("");
    let usePin = pin;
    if (g.hasPin) {
      const entered = prompt(`第${g.groupNo}組のPINを入力してください`);
      if (entered == null) return;
      usePin = entered.trim();
      setPin(usePin);
    }
    setBusy(true);
    try {
      const res = await fetch("/api/entry/group", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passcode, groupId: g.id, pin: usePin }),
      });
      const data = await res.json();
      if (res.ok) {
        setGroup(data.group);
        setMembers(data.members);
        setStatus(data.status);
        if (data.rule) setRule(data.rule);
        const hc = data.holeCount ?? 18;
        const hpr = data.holesPerRound ?? hc;
        const rc = data.roundCount ?? 1;
        setHoleCount(hc);
        setHolesPerRound(hpr);
        setRoundCount(rc);
        setOrder(playOrder(data.group.startHole, hpr, rc));
        setHoleIdx(0);
        setStep("input");
        sessionStorage.setItem(
          "gg_entry",
          JSON.stringify({ passcode, pin: usePin })
        );
      } else setErr(data.error ?? "失敗しました");
    } catch {
      setErr("通信エラーが発生しました");
    } finally {
      setBusy(false);
    }
  }

  function memberSummary(m: Member) {
    const map = new Map<number, number | null>();
    for (const [k, v] of Object.entries(m.scores)) map.set(Number(k), v);
    return summarizeScores(map, rule, holeCount);
  }

  async function saveScore(memberId: string, hole: number, next: number | null) {
    try {
      const res = await fetch(`/api/participants/${memberId}/scores`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ holeNo: hole, strokes: next, passcode, pin }),
      });
      if (!res.ok) {
        const d = await res.json();
        setErr(d.error ?? "保存に失敗しました");
      } else {
        setErr("");
      }
    } catch {
      setErr("通信エラー：保存できませんでした");
    }
  }

  function setStroke(memberId: string, hole: number, next: number | null) {
    // 楽観的更新（画面表示はタップ直後に反映）
    setMembers((ms) =>
      ms.map((m) =>
        m.id === memberId
          ? { ...m, scores: { ...m.scores, [hole]: next } }
          : m
      )
    );
    // 同じ人・同じホールへの保存は前のリクエストの完了を待ってから送る
    // （連打時にサーバーへの到達順が入れ替わり、古い打数が最終的に残るのを防ぐ）
    const key = `${memberId}:${hole}`;
    const prev = saveQueueRef.current.get(key) ?? Promise.resolve();
    const queued = prev.then(() => saveScore(memberId, hole, next));
    saveQueueRef.current.set(key, queued);
  }

  // ---------- 画面 ----------
  if (step === "passcode") {
    return (
      <main className="flex-1 flex items-center justify-center p-6">
        <form
          onSubmit={verify}
          className="w-full max-w-sm bg-white rounded-2xl border border-slate-200 p-8 space-y-4"
        >
          <div>
            <Link href="/" className="text-sm text-slate-400">
              ← トップ
            </Link>
            <h1 className="text-xl font-bold text-brand-600 mt-1">
              スコア入力
            </h1>
            <p className="text-sm text-slate-500">合言葉を入力してください</p>
          </div>
          {/* iOS Safari では入力中に値を加工すると文字が重複するため、
              ここでは素通しにし、表示はCSSで大文字化、正規化は送信時(verify)に行う */}
          <input
            value={passcode}
            onChange={(e) => setPasscode(e.target.value)}
            autoFocus
            type="text"
            inputMode="text"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            enterKeyHint="go"
            className="tap w-full rounded-lg border border-slate-300 px-3 py-3 text-lg tracking-widest text-center uppercase outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            placeholder="合言葉"
          />
          {err && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
              {err}
            </p>
          )}
          <button
            disabled={busy || !passcode}
            className="tap w-full rounded-lg bg-brand-500 text-white text-lg font-semibold py-3 hover:bg-brand-600 disabled:opacity-50"
          >
            {busy ? "確認中..." : "次へ"}
          </button>
        </form>
      </main>
    );
  }

  if (step === "group") {
    return (
      <main className="flex-1 p-4 max-w-md mx-auto w-full space-y-4">
        <div>
          <button
            onClick={() => setStep("passcode")}
            className="text-sm text-slate-400"
          >
            ← 戻る
          </button>
          <h1 className="text-lg font-bold text-slate-800 mt-1">
            {tournament?.name}
          </h1>
          {status !== "active" && (
            <p className="text-sm text-amber-600 bg-amber-50 rounded-lg px-3 py-2 mt-2">
              現在は入力できません（開催中のみ入力可）。閲覧はできます。
            </p>
          )}
        </div>
        <p className="text-sm text-slate-500">自分の組を選んでください</p>
        {err && <p className="text-sm text-red-600">{err}</p>}
        <div className="space-y-2">
          {groups.length === 0 && (
            <p className="text-slate-400 text-sm">組がまだ設定されていません。</p>
          )}
          {groups.map((g) => (
            <button
              key={g.id}
              disabled={busy}
              onClick={() => openGroup(g)}
              className="tap w-full text-left bg-white rounded-xl border border-slate-200 p-4 hover:border-brand-400 flex items-center justify-between"
            >
              <span className="font-semibold">
                第{g.groupNo}組
                {g.name ? `（${g.name}）` : ""}
              </span>
              <span className="text-sm text-slate-500">
                {g.memberCount}名／開始{g.startHole}番
                {g.hasPin && " 🔒"}
              </span>
            </button>
          ))}
        </div>
      </main>
    );
  }

  // input step
  const hole = order[holeIdx];
  const canEdit = status === "active";
  const isMultiRound = roundCount > 1;
  const currentRound = Math.ceil(hole / holesPerRound);
  const holeInRound = ((hole - 1) % holesPerRound) + 1;
  return (
    <main className="flex-1 flex flex-col max-w-md mx-auto w-full">
      {/* ヘッダ */}
      <div className="bg-brand-600 text-white p-4 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <button onClick={() => setStep("group")} className="text-sm">
            ← 組選択
          </button>
          <span className="text-sm">
            第{group?.groupNo}組／開始{group?.startHole}番
          </span>
        </div>
        <div className="flex items-baseline justify-between mt-2">
          <div className="text-2xl font-bold">
            {isMultiRound ? (
              <>
                {currentRound}R {holeInRound}番
                <span className="text-sm font-normal ml-2 text-white/70">
                  (通し{hole})
                </span>
              </>
            ) : (
              <>ホール {hole}</>
            )}
          </div>
          <div className="text-sm">
            {holeIdx + 1} / {holeCount}
          </div>
        </div>
      </div>

      {!canEdit && (
        <p className="text-sm text-amber-700 bg-amber-50 px-4 py-2">
          現在は入力できません（開催中のみ）。
        </p>
      )}
      {err && (
        <p className="text-sm text-red-600 bg-red-50 px-4 py-2">{err}</p>
      )}

      {/* メンバー入力 */}
      <div className="flex-1 p-3 space-y-2">
        {members.map((m) => {
          const cur = m.scores[hole] ?? null;
          const sum = memberSummary(m);
          return (
            <div
              key={m.id}
              className="bg-white rounded-xl border border-slate-200 p-3"
            >
              <div className="flex items-center justify-between">
                <div className="font-medium">{m.name}</div>
                <div className="text-xs text-slate-400">
                  計 {sum.total}（{sum.enteredHoles}/{holeCount}）
                </div>
              </div>
              <div className="flex items-center justify-between mt-2">
                <button
                  disabled={!canEdit}
                  onClick={() =>
                    setStroke(
                      m.id,
                      hole,
                      cur == null ? null : cur <= 1 ? null : cur - 1
                    )
                  }
                  className="tap w-14 h-12 rounded-lg bg-slate-100 text-2xl font-bold disabled:opacity-40 active:bg-slate-200"
                >
                  −
                </button>
                <div className="text-center min-w-[5rem]">
                  <div className="text-3xl font-bold tabular-nums">
                    {cur == null ? "—" : cur}
                  </div>
                  <div className="text-xs h-4">
                    {cur != null && isHoleInOne(cur) && (
                      <span className="text-red-600 font-bold">
                        ホールインワン ({rule.hioPoints})
                      </span>
                    )}
                    {cur != null && !isHoleInOne(cur) && cur >= rule.maxStrokes && (
                      <span className="text-slate-400">上限{rule.maxStrokes}打</span>
                    )}
                    {cur != null &&
                      !isHoleInOne(cur) &&
                      cur < rule.maxStrokes &&
                      `${holePoints(cur, rule)}点`}
                  </div>
                </div>
                <button
                  disabled={!canEdit}
                  onClick={() =>
                    setStroke(
                      m.id,
                      hole,
                      cur == null ? 1 : cur >= rule.maxStrokes ? rule.maxStrokes : cur + 1
                    )
                  }
                  className="tap w-14 h-12 rounded-lg bg-brand-500 text-white text-2xl font-bold disabled:opacity-40 active:bg-brand-600"
                >
                  ＋
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* フッタ ナビ */}
      <div className="p-3 border-t border-slate-200 bg-white flex items-center justify-between gap-3 sticky bottom-0">
        <button
          disabled={holeIdx === 0}
          onClick={() => setHoleIdx((i) => Math.max(0, i - 1))}
          className="tap flex-1 rounded-lg border border-slate-300 py-3 font-semibold disabled:opacity-40"
        >
          ◀ 前
        </button>
        <button
          disabled={holeIdx >= order.length - 1}
          onClick={() =>
            setHoleIdx((i) => Math.min(order.length - 1, i + 1))
          }
          className="tap flex-1 rounded-lg bg-brand-500 text-white py-3 font-semibold disabled:opacity-40"
        >
          次 ▶
        </button>
      </div>
    </main>
  );
}
