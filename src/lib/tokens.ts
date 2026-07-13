import crypto from "node:crypto";

/** 閲覧URL用の推測困難なトークン */
export function randomToken(bytes = 24): string {
  return crypto.randomBytes(bytes).toString("base64url");
}

/** 合言葉・PIN用の短い人間向けコード（紛らわしい文字を除外） */
export function randomPasscode(len = 6): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const buf = crypto.randomBytes(len);
  let s = "";
  for (let i = 0; i < len; i++) s += chars[buf[i] % chars.length];
  return s;
}
