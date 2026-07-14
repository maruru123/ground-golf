import { Prisma } from "@prisma/client";

// Neonのコールドスタート・瞬断など、DB接続系の一時的なエラーだけを対象に自動リトライする。
// バリデーションエラーや一意制約違反などのアプリケーションエラーはリトライせず即座に投げる。

const RETRYABLE_CODES = new Set([
  "P1001", // データベースサーバーに到達できない（Neonのコールドスタート等）
  "P1002", // データベースサーバーがタイムアウト
  "P1008", // 操作がタイムアウト
  "P1011", // TLS接続エラー
  "P1017", // サーバーが接続を閉じた
  "P2024", // コネクションプールからの取得がタイムアウト
]);

function isRetryable(err: unknown): boolean {
  if (err instanceof Prisma.PrismaClientInitializationError) return true;
  if (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    RETRYABLE_CODES.has(err.code)
  ) {
    return true;
  }
  return false;
}

/**
 * DB接続系の一時的なエラーに限定して自動リトライする（最大 maxAttempts 回）。
 * 対象外のエラー（バリデーション・制約違反など）は1回で即座に投げる。
 */
export async function withDbRetry<T>(
  fn: () => Promise<T>,
  maxAttempts = 3
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (!isRetryable(err) || attempt === maxAttempts) throw err;
      await new Promise((r) => setTimeout(r, attempt * 300));
    }
  }
  throw lastErr;
}
