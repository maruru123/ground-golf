import crypto from "node:crypto";
import { cookies } from "next/headers";

// 認証土台（設計書 02_design.md 第8章）
//   - 管理者: パスワード認証 → HMAC署名付きCookieセッション
//   - スコア入力: 大会ごとの合言葉(+任意で組PIN)
//   - 閲覧: 推測困難なトークンURL(+任意PW)
// いずれも個人アカウントは発行しない。

const DEV_SECRET_FALLBACK = "insecure-dev-secret-change-me";

export const ADMIN_COOKIE = "gg_admin";

/**
 * セッション署名鍵を返す。
 * 本番(NODE_ENV=production)で SESSION_SECRET 未設定なら例外を投げて fail-closed にする
 * （既定値のまま起動して管理者セッションを偽造されるのを防ぐ）。
 * 開発時のみ固定のダミー鍵にフォールバックする。
 */
function requireSecret(): string {
  const s = process.env.SESSION_SECRET;
  if (s && s.length > 0) return s;
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "SESSION_SECRET が未設定です。本番ではセッションの署名・検証を拒否します。"
    );
  }
  return DEV_SECRET_FALLBACK;
}

/** タイミング攻撃に配慮した文字列比較 */
export function constantTimeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

/**
 * 合言葉・PIN・閲覧PWなどの秘密値を定数時間で照合する。
 * 期待値が未設定(null/空)なら常に false（＝アクセス不許可）。
 */
export function secretEquals(
  input: string | null | undefined,
  expected: string | null | undefined
): boolean {
  if (!expected) return false;
  return constantTimeEqual(input ?? "", expected);
}

function hmac(value: string): string {
  return crypto
    .createHmac("sha256", requireSecret())
    .update(value)
    .digest("base64url");
}

/** value を署名して "base64url(value).署名" のトークンにする */
export function signValue(value: string): string {
  const encoded = Buffer.from(value).toString("base64url");
  return `${encoded}.${hmac(encoded)}`;
}

/** 署名トークンを検証し、正しければ元の value を返す。不正なら null。 */
export function verifyValue(token: string | undefined | null): string | null {
  if (!token) return null;
  const dot = token.lastIndexOf(".");
  if (dot < 0) return null;
  const encoded = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = hmac(encoded);
  if (!constantTimeEqual(sig, expected)) return null;
  try {
    return Buffer.from(encoded, "base64url").toString("utf8");
  } catch {
    return null;
  }
}

/** 管理者ログイン用パスワード検証 */
export function checkAdminPassword(password: string): boolean {
  const expected = process.env.ADMIN_PASSWORD || "";
  if (!expected) return false;
  return constantTimeEqual(password, expected);
}

/** 管理者セッショントークンを生成 */
export function createAdminSession(): string {
  return signValue(JSON.stringify({ role: "admin", iat: Date.now() }));
}

/** 管理者セッショントークンの妥当性判定 */
export function isValidAdminSession(token: string | undefined | null): boolean {
  const value = verifyValue(token);
  if (!value) return false;
  try {
    const payload = JSON.parse(value) as { role?: string };
    return payload.role === "admin";
  } catch {
    return false;
  }
}

/** Cookie から管理者ログイン状態を判定（Server Component / Route Handler 用） */
export async function isAdminAuthed(): Promise<boolean> {
  const store = await cookies();
  return isValidAdminSession(store.get(ADMIN_COOKIE)?.value);
}

export const ADMIN_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  secure: process.env.NODE_ENV === "production",
  maxAge: 60 * 60 * 12, // 12時間
};
