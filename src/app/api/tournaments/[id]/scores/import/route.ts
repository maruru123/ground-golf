import { NextResponse } from "next/server";
import Papa from "papaparse";
import { prisma } from "@/lib/prisma";
import { guardAdmin } from "@/lib/api";
import { withDbRetry } from "@/lib/dbRetry";

// スコアのCSV取込。
// 列は「名前」「期」＋ホール番号(1〜総ホール数)。名前と期で参加者を特定し、
// 各ホールの打数を設定する。CSVの内容でスコアを上書きする方式で、
// 空欄のセルはそのホールを未入力に戻す（＝既存の打数を削除する）。
// ただし全セルが空欄のCSVは、未記入のテンプレートを誤って取り込む事故を防ぐため拒否する。

interface RowInput {
  名前?: string;
  期?: string;
  [key: string]: string | undefined;
}

/** 適用する1件の変更。strokes が null ならそのホールを未入力に戻す。 */
interface Change {
  participantId: string;
  holeNo: number;
  strokes: number | null;
}

export async function POST(
  req: Request,
  ctx: RouteContext<"/api/tournaments/[id]/scores/import">
) {
  const denied = await guardAdmin();
  if (denied) return denied;
  const { id: tournamentId } = await ctx.params;

  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: { holeCount: true, maxStrokes: true },
  });
  if (!tournament) {
    return NextResponse.json({ error: "大会が見つかりません" }, { status: 404 });
  }
  const { holeCount, maxStrokes } = tournament;

  const body = (await req.json().catch(() => null)) as { csv?: string } | null;
  const csv = body?.csv;
  if (typeof csv !== "string" || csv.trim() === "") {
    return NextResponse.json({ error: "CSVが空です" }, { status: 400 });
  }

  const parsed = Papa.parse<RowInput>(csv.replace(/^﻿/, ""), {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });

  const errors: { row: number; message: string }[] = [];
  const headers = parsed.meta.fields ?? [];

  if (!headers.includes("名前")) {
    return NextResponse.json(
      {
        error:
          "「名前」列が見つかりません。文字コードがUTF-8か、ヘッダ行があるか確認してください",
      },
      { status: 400 }
    );
  }

  // ホール列（数字のヘッダ）を拾う。範囲外の数字はエラー、それ以外の列は無視。
  const holeCols: { header: string; holeNo: number }[] = [];
  for (const h of headers) {
    if (!/^\d+$/.test(h)) continue; // 名前・期・合計などは対象外
    const n = Number(h);
    if (n < 1 || n > holeCount) {
      errors.push({
        row: 1,
        message: `ホール番号が範囲外です（1〜${holeCount}）: ${h}`,
      });
      continue;
    }
    holeCols.push({ header: h, holeNo: n });
  }
  if (holeCols.length === 0 && errors.length === 0) {
    return NextResponse.json(
      {
        error: `ホールの列が見つかりません。1〜${holeCount} の数字を列名にしてください`,
      },
      { status: 400 }
    );
  }

  const participants = await prisma.participant.findMany({
    where: { tournamentId },
    select: { id: true, name: true, term: true },
  });
  // 同名の参加者をまとめておき、期で絞り込む
  const byName = new Map<string, typeof participants>();
  for (const p of participants) {
    const list = byName.get(p.name) ?? [];
    list.push(p);
    byName.set(p.name, list);
  }

  const changes: Change[] = [];
  const warnings: string[] = [];
  const matchedIds = new Set<string>();

  parsed.data.forEach((raw, i) => {
    const rowNo = i + 2; // ヘッダ=1行目
    const name = (raw.名前 ?? "").trim();
    if (!name) {
      errors.push({ row: rowNo, message: "名前が空です" });
      return;
    }

    const termStr = (raw.期 ?? "").trim();
    let term: number | null = null;
    if (termStr !== "") {
      const n = Number(termStr);
      if (!Number.isInteger(n) || n < 0) {
        errors.push({ row: rowNo, message: `期が不正です: ${termStr}` });
        return;
      }
      term = n;
    }

    // 名前（＋期）で参加者を特定する
    const sameName = byName.get(name) ?? [];
    if (sameName.length === 0) {
      errors.push({ row: rowNo, message: `参加者が見つかりません: ${name}` });
      return;
    }
    const candidates =
      term == null ? sameName : sameName.filter((p) => p.term === term);
    if (candidates.length === 0) {
      errors.push({
        row: rowNo,
        message: `参加者が見つかりません: ${name}（期=${termStr}）`,
      });
      return;
    }
    if (candidates.length > 1) {
      errors.push({
        row: rowNo,
        message:
          term == null
            ? `「${name}」が複数います。期の列で指定してください`
            : `「${name}」（期=${termStr}）が複数います。参加者側の期を見直してください`,
      });
      return;
    }
    const participant = candidates[0];
    if (matchedIds.has(participant.id)) {
      errors.push({
        row: rowNo,
        message: `「${name}」がCSV内に重複しています`,
      });
      return;
    }
    matchedIds.add(participant.id);

    for (const { header, holeNo } of holeCols) {
      const cell = (raw[header] ?? "").trim();
      if (cell === "") {
        // 空欄はそのホールを未入力に戻す
        changes.push({ participantId: participant.id, holeNo, strokes: null });
        continue;
      }
      const n = Number(cell);
      if (!Number.isInteger(n) || n < 1) {
        errors.push({
          row: rowNo,
          message: `${holeNo}番の打数が不正です: ${cell}`,
        });
        continue;
      }
      if (n > maxStrokes) {
        warnings.push(
          `${rowNo}行目 ${name} の${holeNo}番: ${n}打を上限の${maxStrokes}打に補正しました`
        );
      }
      changes.push({
        participantId: participant.id,
        holeNo,
        strokes: Math.min(n, maxStrokes), // 上限打数に補正
      });
    }
  });

  if (errors.length > 0) {
    return NextResponse.json(
      { error: "取込前チェックでエラーがあります", errors },
      { status: 400 }
    );
  }
  const setCount = changes.filter((c) => c.strokes != null).length;
  const clearCount = changes.length - setCount;
  if (setCount === 0) {
    // 未記入のテンプレートを取り込んで全スコアを消してしまう事故を防ぐ
    return NextResponse.json(
      {
        error:
          "打数が1つも入力されていません。すべて空欄のCSVでは取り込みません（画面から個別に消してください）",
      },
      { status: 400 }
    );
  }

  // 全件を1トランザクションで適用（途中失敗時は全ロールバック）
  try {
    await withDbRetry(() =>
      prisma.$transaction(
        changes.map((c) =>
          c.strokes == null
            ? prisma.score.deleteMany({
                where: { participantId: c.participantId, holeNo: c.holeNo },
              })
            : prisma.score.upsert({
                where: {
                  participantId_holeNo: {
                    participantId: c.participantId,
                    holeNo: c.holeNo,
                  },
                },
                create: {
                  participantId: c.participantId,
                  holeNo: c.holeNo,
                  strokes: c.strokes,
                },
                update: { strokes: c.strokes },
              })
        )
      )
    );
  } catch {
    return NextResponse.json({ error: "取込に失敗しました" }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    people: matchedIds.size,
    cells: setCount,
    cleared: clearCount,
    warnings,
    applied: changes, // 呼び出し側が画面を更新するために返す
  });
}
