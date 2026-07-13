"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { GENDER_LABELS, PARTICIPANT_STATUS_LABELS } from "@/lib/labels";

interface P {
  id: string;
  name: string;
  term: number | null;
  gender: string | null;
  status: string;
  note: string | null;
  groupNo: number | null;
}

export default function ParticipantsManager({
  tournamentId,
  initial,
}: {
  tournamentId: string;
  initial: P[];
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [importErrors, setImportErrors] = useState<
    { row: number; message: string }[]
  >([]);

  // 追加フォーム
  const [name, setName] = useState("");
  const [term, setTerm] = useState("");
  const [gender, setGender] = useState("");
  const [note, setNote] = useState("");

  // 編集中
  const [editId, setEditId] = useState<string | null>(null);
  const [edit, setEdit] = useState<Partial<P>>({});

  async function add() {
    if (!name) return;
    setBusy(true);
    setMsg("");
    const res = await fetch(
      `/api/tournaments/${tournamentId}/participants`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          term: term ? Number(term) : null,
          gender: gender || null,
          note: note || null,
        }),
      }
    );
    const data = await res.json();
    setBusy(false);
    if (res.ok) {
      setName("");
      setTerm("");
      setGender("");
      setNote("");
      router.refresh();
    } else setMsg(data.error ?? "追加に失敗しました");
  }

  async function saveEdit(id: string) {
    setBusy(true);
    const res = await fetch(`/api/participants/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: edit.name,
        term: edit.term === undefined ? undefined : edit.term,
        gender: edit.gender ?? null,
        status: edit.status,
        note: edit.note === undefined ? undefined : edit.note,
      }),
    });
    setBusy(false);
    if (res.ok) {
      setEditId(null);
      setEdit({});
      router.refresh();
    } else {
      const d = await res.json();
      setMsg(d.error ?? "更新に失敗しました");
    }
  }

  async function del(id: string) {
    if (!confirm("この参加者を削除しますか？")) return;
    setBusy(true);
    const res = await fetch(`/api/participants/${id}`, { method: "DELETE" });
    setBusy(false);
    if (res.ok) router.refresh();
  }

  async function onImport(file: File) {
    setBusy(true);
    setMsg("");
    setImportErrors([]);
    const csv = await file.text();
    const res = await fetch(
      `/api/tournaments/${tournamentId}/participants/import`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv }),
      }
    );
    const data = await res.json();
    setBusy(false);
    if (fileRef.current) fileRef.current.value = "";
    if (res.ok) {
      setMsg(
        `取込完了: 新規${data.created}件 / 更新${data.updated}件` +
          (data.warnings?.length ? `（注意: ${data.warnings.join("、")}）` : "")
      );
      router.refresh();
    } else {
      setMsg(data.error ?? "取込に失敗しました");
      if (Array.isArray(data.errors)) setImportErrors(data.errors);
    }
  }

  function downloadTemplate() {
    const bom = "﻿";
    const csv =
      "参加者ID,名前,期,性別,組番号,状態,備考\n,山田太郎,12,男,1,参加,\n,佐藤花子,15,女,1,棄権,体調不良のため\n";
    const blob = new Blob([bom + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "participants_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="font-bold text-slate-800">
          参加者一覧（{initial.length}名 / 最大144名）
        </h2>
      </div>

      {msg && (
        <p className="text-sm text-brand-700 bg-brand-50 rounded-lg px-3 py-2">
          {msg}
        </p>
      )}
      {importErrors.length > 0 && (
        <div className="text-sm text-red-700 bg-red-50 rounded-lg px-3 py-2 max-h-40 overflow-y-auto">
          <p className="font-semibold mb-1">取込エラー:</p>
          <ul className="list-disc pl-5 space-y-0.5">
            {importErrors.map((e, i) => (
              <li key={i}>
                {e.row > 0 ? `${e.row}行目: ` : ""}
                {e.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* CSV操作 */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-wrap gap-2 items-center">
        <span className="text-sm font-medium text-slate-600">CSV:</span>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => e.target.files?.[0] && onImport(e.target.files[0])}
          className="text-sm"
        />
        <a
          href={`/api/tournaments/${tournamentId}/participants/export`}
          className="tap text-sm rounded-lg border border-slate-300 px-3 py-1.5 hover:bg-slate-50"
        >
          名簿を出力
        </a>
        <button
          onClick={downloadTemplate}
          className="tap text-sm rounded-lg border border-slate-300 px-3 py-1.5 hover:bg-slate-50"
        >
          記入例をダウンロード
        </button>
      </div>

      {/* 追加フォーム */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4">
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto_1fr_auto] gap-2 items-end">
          <div>
            <label className="block text-xs text-slate-500 mb-1">氏名 *</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="tap w-full rounded-lg border border-slate-300 px-3 py-2"
              placeholder="山田太郎"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">期</label>
            <input
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              inputMode="numeric"
              className="tap w-20 rounded-lg border border-slate-300 px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">性別</label>
            <select
              value={gender}
              onChange={(e) => setGender(e.target.value)}
              className="tap rounded-lg border border-slate-300 px-2 py-2"
            >
              <option value="">-</option>
              <option value="male">男</option>
              <option value="female">女</option>
              <option value="other">その他</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">備考</label>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="tap w-full rounded-lg border border-slate-300 px-3 py-2"
              placeholder="（任意）"
            />
          </div>
          <button
            disabled={busy || !name}
            onClick={add}
            className="tap rounded-lg bg-brand-500 text-white font-semibold px-4 py-2 hover:bg-brand-600 disabled:opacity-50"
          >
            追加
          </button>
        </div>
      </div>

      {/* 一覧 */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-slate-600 text-left">
              <th className="px-3 py-2">氏名</th>
              <th className="px-3 py-2 w-16">期</th>
              <th className="px-3 py-2 w-16">性別</th>
              <th className="px-3 py-2 w-20">状態</th>
              <th className="px-3 py-2">備考</th>
              <th className="px-3 py-2 w-16">組</th>
              <th className="px-3 py-2 w-28"></th>
            </tr>
          </thead>
          <tbody>
            {initial.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-slate-400">
                  参加者がいません。追加またはCSV取込してください。
                </td>
              </tr>
            )}
            {initial.map((p) => {
              const editing = editId === p.id;
              return (
                <tr key={p.id} className="border-t border-slate-100">
                  {editing ? (
                    <>
                      <td className="px-3 py-2">
                        <input
                          defaultValue={p.name}
                          onChange={(e) =>
                            setEdit((s) => ({ ...s, name: e.target.value }))
                          }
                          className="w-full rounded border border-slate-300 px-2 py-1"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          defaultValue={p.term ?? ""}
                          inputMode="numeric"
                          onChange={(e) =>
                            setEdit((s) => ({
                              ...s,
                              term: e.target.value
                                ? Number(e.target.value)
                                : null,
                            }))
                          }
                          className="w-14 rounded border border-slate-300 px-2 py-1"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <select
                          defaultValue={p.gender ?? ""}
                          onChange={(e) =>
                            setEdit((s) => ({
                              ...s,
                              gender: e.target.value || null,
                            }))
                          }
                          className="rounded border border-slate-300 px-1 py-1"
                        >
                          <option value="">-</option>
                          <option value="male">男</option>
                          <option value="female">女</option>
                          <option value="other">その他</option>
                        </select>
                      </td>
                      <td className="px-3 py-2">
                        <select
                          defaultValue={p.status}
                          onChange={(e) =>
                            setEdit((s) => ({ ...s, status: e.target.value }))
                          }
                          className="rounded border border-slate-300 px-1 py-1"
                        >
                          <option value="playing">参加</option>
                          <option value="absent">欠席</option>
                          <option value="withdrawn">棄権</option>
                          <option value="disqualified">失格</option>
                        </select>
                      </td>
                      <td className="px-3 py-2">
                        <input
                          defaultValue={p.note ?? ""}
                          onChange={(e) =>
                            setEdit((s) => ({
                              ...s,
                              note: e.target.value || null,
                            }))
                          }
                          placeholder="理由など"
                          className="w-full min-w-[8rem] rounded border border-slate-300 px-2 py-1"
                        />
                      </td>
                      <td className="px-3 py-2 text-slate-400">
                        {p.groupNo ?? "-"}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <button
                          disabled={busy}
                          onClick={() => saveEdit(p.id)}
                          className="text-brand-600 font-medium mr-2"
                        >
                          保存
                        </button>
                        <button
                          onClick={() => {
                            setEditId(null);
                            setEdit({});
                          }}
                          className="text-slate-400"
                        >
                          取消
                        </button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-3 py-2 font-medium">{p.name}</td>
                      <td className="px-3 py-2">{p.term ?? "-"}</td>
                      <td className="px-3 py-2">
                        {p.gender ? GENDER_LABELS[p.gender] : "-"}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={
                            p.status === "playing"
                              ? "text-slate-700"
                              : p.status === "disqualified"
                              ? "text-red-600 font-medium"
                              : "text-amber-600"
                          }
                        >
                          {PARTICIPANT_STATUS_LABELS[p.status] ?? p.status}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-slate-500 max-w-[12rem] truncate">
                        {p.note || ""}
                      </td>
                      <td className="px-3 py-2 text-slate-500">
                        {p.groupNo ? `第${p.groupNo}組` : "-"}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <button
                          onClick={() => {
                            setEditId(p.id);
                            setEdit({});
                          }}
                          className="text-brand-600 mr-2"
                        >
                          編集
                        </button>
                        <button
                          onClick={() => del(p.id)}
                          className="text-red-500"
                        >
                          削除
                        </button>
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
