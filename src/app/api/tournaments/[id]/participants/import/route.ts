import { NextResponse } from "next/server";
import Papa from "papaparse";
import { prisma } from "@/lib/prisma";
import { guardAdmin } from "@/lib/api";
import { genderToInternal, statusToInternal } from "@/lib/labels";

const MAX_PARTICIPANTS = 144;
const MAX_PER_GROUP = 8;
const MAX_GROUPS = 18; // 18ホール = 最大18組。組番号もこの範囲に収める

/** 取込のロールバック用エラー（人数超過など） */
class ImportError extends Error {
  constructor(public messages: string[]) {
    super("import validation failed");
    this.name = "ImportError";
  }
}

interface RowInput {
  参加者ID?: string;
  名前?: string;
  期?: string;
  性別?: string;
  組番号?: string;
  状態?: string;
  備考?: string;
}

interface BuiltRow {
  rowNo: number;
  id: string | null;
  name: string;
  term: number | null;
  gender: string | null;
  status: string;
  groupNo: number | null;
  note: string | null;
}

export async function POST(
  req: Request,
  ctx: RouteContext<"/api/tournaments/[id]/participants/import">
) {
  const denied = await guardAdmin();
  if (denied) return denied;
  const { id: tournamentId } = await ctx.params;

  const body = (await req.json().catch(() => null)) as { csv?: string } | null;
  const csv = body?.csv;
  if (typeof csv !== "string" || csv.trim() === "") {
    return NextResponse.json({ error: "CSVが空です" }, { status: 400 });
  }

  const parsed = Papa.parse<RowInput>(csv.replace(/^﻿/, ""), {
    header: true,
    skipEmptyLines: true,
  });

  const errors: { row: number; message: string }[] = [];
  const rows: BuiltRow[] = [];

  parsed.data.forEach((raw, i) => {
    const rowNo = i + 2; // ヘッダ=1行目
    const name = (raw.名前 ?? "").trim();
    if (!name) {
      errors.push({ row: rowNo, message: "名前が空です" });
      return;
    }
    let term: number | null = null;
    const termStr = (raw.期 ?? "").trim();
    if (termStr !== "") {
      const n = Number(termStr);
      if (!Number.isInteger(n) || n < 0) {
        errors.push({ row: rowNo, message: `期が不正です: ${termStr}` });
        return;
      }
      term = n;
    }
    let gender: string | null = null;
    const genderStr = (raw.性別 ?? "").trim();
    if (genderStr !== "") {
      const g = genderToInternal(genderStr);
      if (!g) {
        errors.push({ row: rowNo, message: `性別が不正です: ${genderStr}` });
        return;
      }
      gender = g;
    }
    let status = "playing";
    const statusStr = (raw.状態 ?? "").trim();
    if (statusStr !== "") {
      const s = statusToInternal(statusStr);
      if (!s) {
        errors.push({ row: rowNo, message: `状態が不正です: ${statusStr}` });
        return;
      }
      status = s;
    }
    let groupNo: number | null = null;
    const groupStr = (raw.組番号 ?? "").trim();
    if (groupStr !== "") {
      const n = Number(groupStr);
      if (!Number.isInteger(n) || n < 1 || n > MAX_GROUPS) {
        errors.push({
          row: rowNo,
          message: `組番号は1〜${MAX_GROUPS}で指定してください: ${groupStr}`,
        });
        return;
      }
      groupNo = n;
    }
    const note = (raw.備考 ?? "").trim() || null;
    rows.push({
      rowNo,
      id: (raw.参加者ID ?? "").trim() || null,
      name,
      term,
      gender,
      status,
      groupNo,
      note,
    });
  });

  if (errors.length > 0) {
    return NextResponse.json(
      { error: "取込前チェックでエラーがあります", errors },
      { status: 400 }
    );
  }

  // 既存参加者数と、更新対象IDの整合チェック
  const existing = await prisma.participant.findMany({
    where: { tournamentId },
    select: { id: true },
  });
  const existingIds = new Set(existing.map((p) => p.id));
  const invalidIdRows = rows.filter((r) => r.id && !existingIds.has(r.id));
  invalidIdRows.forEach((r) =>
    errors.push({ row: r.rowNo, message: `参加者IDが存在しません: ${r.id}` })
  );
  const createRows = rows.filter((r) => !r.id);

  if (existing.length + createRows.length > MAX_PARTICIPANTS) {
    errors.push({
      row: 0,
      message: `参加者が上限${MAX_PARTICIPANTS}名を超えます（取込後 ${
        existing.length + createRows.length
      }名）`,
    });
  }

  if (errors.length > 0) {
    return NextResponse.json(
      { error: "取込前チェックでエラーがあります", errors },
      { status: 400 }
    );
  }

  // 取込は全行を1トランザクションで適用（途中失敗時は全ロールバック）
  try {
    const result = await prisma.$transaction(async (tx) => {
      // 組番号 → group.id を解決（無ければ作成）
      const groupNos = Array.from(
        new Set(rows.map((r) => r.groupNo).filter((n): n is number => n != null))
      );
      const groupIdByNo = new Map<number, string>();
      for (const no of groupNos) {
        const existingGroup = await tx.group.findUnique({
          where: { tournamentId_groupNo: { tournamentId, groupNo: no } },
        });
        if (existingGroup) {
          groupIdByNo.set(no, existingGroup.id);
        } else {
          const g = await tx.group.create({
            data: {
              tournamentId,
              groupNo: no,
              startHole: ((no - 1) % 18) + 1,
            },
          });
          groupIdByNo.set(no, g.id);
        }
      }

      // 適用
      let created = 0;
      let updated = 0;
      for (const r of rows) {
        const groupId =
          r.groupNo != null ? groupIdByNo.get(r.groupNo) ?? null : null;
        if (r.id) {
          await tx.participant.update({
            where: { id: r.id },
            data: {
              name: r.name,
              term: r.term,
              gender: r.gender,
              status: r.status,
              note: r.note,
              ...(r.groupNo != null ? { groupId } : {}),
            },
          });
          updated++;
        } else {
          await tx.participant.create({
            data: {
              tournamentId,
              name: r.name,
              term: r.term,
              gender: r.gender,
              status: r.status,
              note: r.note,
              groupId,
            },
          });
          created++;
        }
      }

      // 組の人数超過はエラーにしてロールバック（ペアリングと同じ基準）
      const groupsAfter = await tx.group.findMany({
        where: { tournamentId },
        select: { groupNo: true, _count: { select: { participants: true } } },
      });
      const over = groupsAfter
        .filter((g) => g._count.participants > MAX_PER_GROUP)
        .map(
          (g) =>
            `第${g.groupNo}組が${g._count.participants}名（上限${MAX_PER_GROUP}名）`
        );
      if (over.length > 0) throw new ImportError(over);

      return { created, updated };
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    if (e instanceof ImportError) {
      return NextResponse.json(
        {
          error: "組の人数が上限を超えるため取込を中止しました",
          errors: e.messages.map((message) => ({ row: 0, message })),
        },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: "取込に失敗しました" }, { status: 400 });
  }
}
