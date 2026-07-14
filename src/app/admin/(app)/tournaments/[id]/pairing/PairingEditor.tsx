"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { maxGroupsFor } from "@/lib/tournamentLimits";

interface GroupMeta {
  groupNo: number;
  name: string;
  startHole: number;
}
interface Part {
  id: string;
  name: string;
  term: number | null;
  groupNo: number | null;
}

export default function PairingEditor({
  tournamentId,
  maxPerGroup,
  startMethod,
  holeCount,
  initialGroups,
  participants,
}: {
  tournamentId: string;
  maxPerGroup: number;
  startMethod: string;
  holeCount: number;
  initialGroups: GroupMeta[];
  participants: Part[];
}) {
  const isSequential = startMethod === "sequential";
  const maxGroups = maxGroupsFor(startMethod, holeCount);
  const router = useRouter();
  const [groups, setGroups] = useState<GroupMeta[]>(initialGroups);
  const [assign, setAssign] = useState<Record<string, number | null>>(
    Object.fromEntries(participants.map((p) => [p.id, p.groupNo]))
  );
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const nameById = new Map(participants.map((p) => [p.id, p]));

  async function autoPair() {
    if (
      !confirm(
        "期でまとめて自動組分けします。現在の組・割当は上書きされます。よろしいですか？"
      )
    )
      return;
    setBusy(true);
    setMsg("");
    const res = await fetch(
      `/api/tournaments/${tournamentId}/pairing`,
      { method: "POST" }
    );
    const data = await res.json();
    setBusy(false);
    if (res.ok) {
      setMsg(`自動組分けしました（${data.groupCount}組）`);
      router.refresh();
    } else setMsg(data.error ?? "失敗しました");
  }

  function addGroup() {
    if (groups.length >= maxGroups) {
      setMsg(
        isSequential
          ? `組は最大${maxGroups}組までです`
          : `組は最大${maxGroups}組までです（ショットガン方式：${holeCount}ホール）`
      );
      return;
    }
    const nextNo = groups.length
      ? Math.max(...groups.map((g) => g.groupNo)) + 1
      : 1;
    setGroups([
      ...groups,
      {
        groupNo: nextNo,
        name: "",
        startHole: isSequential ? 1 : ((nextNo - 1) % holeCount) + 1,
      },
    ]);
  }

  function removeGroup(no: number) {
    setGroups(groups.filter((g) => g.groupNo !== no));
    setAssign((s) => {
      const next = { ...s };
      for (const k of Object.keys(next)) if (next[k] === no) next[k] = null;
      return next;
    });
  }

  async function save() {
    setBusy(true);
    setMsg("");
    const res = await fetch(`/api/tournaments/${tournamentId}/pairing`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        groups: groups.map((g) => ({
          groupNo: g.groupNo,
          name: g.name || null,
          startHole: g.startHole,
        })),
        assignments: assign,
      }),
    });
    const data = await res.json();
    setBusy(false);
    if (res.ok) {
      setMsg("保存しました");
      router.refresh();
    } else setMsg(data.error ?? "保存に失敗しました");
  }

  const unassigned = participants.filter((p) => assign[p.id] == null);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        <button
          disabled={busy}
          onClick={autoPair}
          className="tap rounded-lg bg-brand-500 text-white font-semibold px-4 py-2 hover:bg-brand-600 disabled:opacity-50"
        >
          期でまとめて自動組分け
        </button>
        <button
          disabled={busy}
          onClick={addGroup}
          className="tap rounded-lg border border-slate-300 px-4 py-2 hover:bg-slate-50"
        >
          ＋ 組を追加
        </button>
        <button
          disabled={busy}
          onClick={save}
          className="tap rounded-lg bg-emerald-600 text-white font-semibold px-4 py-2 hover:bg-emerald-700 disabled:opacity-50"
        >
          保存
        </button>
        {msg && <span className="text-sm text-brand-700">{msg}</span>}
      </div>

      <p className="text-sm text-slate-500">
        {isSequential
          ? `順次スタート方式：全組が1番ホールから時間差でスタートします。1組は最大${maxPerGroup}名です。`
          : `ショットガン方式：各組に開始ホールを割り当てます（重複不可）。1組は最大${maxPerGroup}名です。`}
      </p>

      {/* 未割当 */}
      {unassigned.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
          <h3 className="font-semibold text-amber-800 mb-2">
            未割当（{unassigned.length}名）
          </h3>
          <div className="flex flex-wrap gap-2">
            {unassigned.map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-1 bg-white rounded-lg border border-slate-200 px-2 py-1"
              >
                <span className="text-sm">
                  {p.name}
                  {p.term != null && (
                    <span className="text-slate-400 text-xs">（{p.term}期）</span>
                  )}
                </span>
                <select
                  value=""
                  onChange={(e) =>
                    setAssign((s) => ({
                      ...s,
                      [p.id]: e.target.value ? Number(e.target.value) : null,
                    }))
                  }
                  className="text-xs rounded border border-slate-300 px-1 py-0.5"
                >
                  <option value="">組へ</option>
                  {groups.map((g) => (
                    <option key={g.groupNo} value={g.groupNo}>
                      第{g.groupNo}組
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 組カード */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {groups.map((g) => {
          const members = Object.entries(assign)
            .filter(([, no]) => no === g.groupNo)
            .map(([pid]) => nameById.get(pid)!)
            .filter(Boolean);
          const over = members.length > maxPerGroup;
          return (
            <div
              key={g.groupNo}
              className={`bg-white rounded-2xl border p-4 ${
                over ? "border-red-300" : "border-slate-200"
              }`}
            >
              <div className="flex items-center gap-2 flex-wrap mb-2">
                <span className="font-bold text-brand-600">第{g.groupNo}組</span>
                <input
                  value={g.name}
                  onChange={(e) =>
                    setGroups((gs) =>
                      gs.map((x) =>
                        x.groupNo === g.groupNo
                          ? { ...x, name: e.target.value }
                          : x
                      )
                    )
                  }
                  placeholder="組名(任意)"
                  className="text-sm rounded border border-slate-300 px-2 py-1 w-28"
                />
                {isSequential ? (
                  <span className="text-sm text-slate-400 ml-auto">
                    開始 1番
                  </span>
                ) : (
                  <label className="text-sm text-slate-500 ml-auto">
                    開始
                    <select
                      value={g.startHole}
                      onChange={(e) =>
                        setGroups((gs) =>
                          gs.map((x) =>
                            x.groupNo === g.groupNo
                              ? { ...x, startHole: Number(e.target.value) }
                              : x
                          )
                        )
                      }
                      className="ml-1 rounded border border-slate-300 px-1 py-1"
                    >
                      {Array.from({ length: holeCount }, (_, i) => i + 1).map(
                        (h) => (
                          <option key={h} value={h}>
                            {h}番
                          </option>
                        )
                      )}
                    </select>
                  </label>
                )}
                <button
                  onClick={() => removeGroup(g.groupNo)}
                  className="text-red-400 text-sm"
                >
                  削除
                </button>
              </div>
              <div
                className={`text-xs mb-2 ${
                  over ? "text-red-600 font-semibold" : "text-slate-400"
                }`}
              >
                {members.length}名 {over && `（上限${maxPerGroup}名を超過）`}
              </div>
              <ul className="space-y-1">
                {members.map((m) => (
                  <li
                    key={m.id}
                    className="flex items-center justify-between text-sm"
                  >
                    <span>
                      {m.name}
                      {m.term != null && (
                        <span className="text-slate-400 text-xs">
                          （{m.term}期）
                        </span>
                      )}
                    </span>
                    <select
                      value={g.groupNo}
                      onChange={(e) =>
                        setAssign((s) => ({
                          ...s,
                          [m.id]: e.target.value
                            ? Number(e.target.value)
                            : null,
                        }))
                      }
                      className="text-xs rounded border border-slate-300 px-1 py-0.5"
                    >
                      <option value="">未割当</option>
                      {groups.map((gg) => (
                        <option key={gg.groupNo} value={gg.groupNo}>
                          第{gg.groupNo}組
                        </option>
                      ))}
                    </select>
                  </li>
                ))}
                {members.length === 0 && (
                  <li className="text-slate-300 text-sm">（メンバーなし）</li>
                )}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
