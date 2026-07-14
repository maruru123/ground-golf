import { computeStandings } from "@/lib/standings";

export const dynamic = "force-dynamic";

export default async function AnalysisPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const standings = await computeStandings(id);
  const eligible = standings.filter((s) => s.eligible);

  // 期別集計
  const byTerm = new Map<
    string,
    { count: number; sum: number; min: number }
  >();
  for (const s of eligible) {
    const key = s.term != null ? String(s.term) : "未設定";
    const cur = byTerm.get(key) ?? { count: 0, sum: 0, min: Infinity };
    cur.count++;
    cur.sum += s.summary.total;
    cur.min = Math.min(cur.min, s.summary.total);
    byTerm.set(key, cur);
  }
  const terms = Array.from(byTerm.entries())
    .map(([term, v]) => ({
      term,
      count: v.count,
      avg: v.sum / v.count,
      min: v.min,
    }))
    .sort((a, b) => a.avg - b.avg);

  const maxAvg = terms.length ? Math.max(...terms.map((t) => t.avg)) : 0;

  return (
    <div className="space-y-5">
      <h2 className="font-bold text-slate-800">期別平均スコア</h2>
      <p className="text-sm text-slate-500">
        正式対象（全ホール入力済・参加者）のみを集計しています。
      </p>

      {terms.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-8 text-center text-slate-400">
          集計対象がまだありません（全ホール入力済の参加者が必要です）。
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-slate-600 text-left">
                <th className="px-3 py-2">期</th>
                <th className="px-3 py-2 w-16 text-right">人数</th>
                <th className="px-3 py-2 w-24 text-right">平均合計</th>
                <th className="px-3 py-2 w-20 text-right">最小</th>
                <th className="px-3 py-2">グラフ</th>
              </tr>
            </thead>
            <tbody>
              {terms.map((t) => (
                <tr key={t.term} className="border-t border-slate-100">
                  <td className="px-3 py-2 font-medium">
                    {t.term === "未設定" ? "未設定" : `${t.term}期`}
                  </td>
                  <td className="px-3 py-2 text-right">{t.count}</td>
                  <td className="px-3 py-2 text-right font-semibold">
                    {t.avg.toFixed(1)}
                  </td>
                  <td className="px-3 py-2 text-right">{t.min}</td>
                  <td className="px-3 py-2">
                    <div className="bg-slate-100 rounded h-3 w-full max-w-[200px]">
                      <div
                        className="bg-brand-500 h-3 rounded"
                        style={{
                          width: `${maxAvg ? (t.avg / maxAvg) * 100 : 0}%`,
                        }}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
