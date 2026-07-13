import { NextResponse } from "next/server";
import {
  checkAdminPassword,
  createAdminSession,
  ADMIN_COOKIE,
  ADMIN_COOKIE_OPTIONS,
} from "@/lib/auth";
import { rateLimit, clientIp, tooManyRequests } from "@/lib/rateLimit";

export async function POST(req: Request) {
  const rl = rateLimit(`login:${clientIp(req)}`, 10, 60_000);
  if (!rl.ok) return tooManyRequests(rl.retryAfter);

  const body = (await req.json().catch(() => null)) as {
    password?: unknown;
  } | null;
  const password = body?.password;

  if (typeof password !== "string" || !checkAdminPassword(password)) {
    return NextResponse.json(
      { ok: false, error: "パスワードが違います" },
      { status: 401 }
    );
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, createAdminSession(), ADMIN_COOKIE_OPTIONS);
  return res;
}
