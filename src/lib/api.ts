import { NextResponse } from "next/server";
import { isAdminAuthed } from "./auth";

/** 管理者APIのガード。未認証なら401レスポンスを返す（呼び出し側で return する）。 */
export async function guardAdmin(): Promise<NextResponse | null> {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return null;
}
