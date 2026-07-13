// 認証系エンドポイント向けの簡易レート制限（総当たり緩和）。
//
// 注意: これはプロセス内メモリの固定ウィンドウ方式です。
//  - Vercel などサーバーレスではインスタンスごと・コールドスタートで状態が揮発します。
//  - 小規模大会（同時18端末程度）では十分な抑止になりますが、
//    本格運用では Upstash Redis 等の永続ストアへの置き換えを推奨します。

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 5000; // メモリ肥大の防止上限

/** 期限切れバケットを掃除（サイズ超過時のみ実行） */
function prune(now: number) {
  if (buckets.size < MAX_BUCKETS) return;
  for (const [key, b] of buckets) {
    if (now >= b.resetAt) buckets.delete(key);
  }
}

/**
 * key 単位で windowMs あたり limit 回まで許可する。
 * 戻り値 ok=false のとき retryAfter(秒) を添えて 429 を返すとよい。
 */
export function rateLimit(
  key: string,
  limit = 10,
  windowMs = 60_000
): { ok: boolean; retryAfter: number } {
  const now = Date.now();
  prune(now);
  const b = buckets.get(key);
  if (!b || now >= b.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfter: 0 };
  }
  if (b.count >= limit) {
    return { ok: false, retryAfter: Math.ceil((b.resetAt - now) / 1000) };
  }
  b.count++;
  return { ok: true, retryAfter: 0 };
}

/** リバースプロキシ経由のクライアントIPを推定（Vercel は x-forwarded-for を付与） */
export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

/** 429 レスポンスの共通生成 */
export function tooManyRequests(retryAfter: number) {
  return Response.json(
    { error: `試行回数が多すぎます。${retryAfter}秒後に再試行してください` },
    { status: 429, headers: { "Retry-After": String(retryAfter) } }
  );
}
