import Link from "next/link";

export default function Home() {
  return (
    <main className="flex-1 flex items-center justify-center p-6">
      <div className="w-full max-w-md text-center space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-brand-600">
            グラウンドゴルフ管理システム
          </h1>
          <p className="text-slate-500 mt-2">大会運営・スコア入力・集計・表彰</p>
        </div>
        <div className="space-y-4">
          <Link
            href="/entry"
            className="tap flex items-center justify-center rounded-2xl bg-brand-500 text-white text-lg font-semibold px-6 py-5 hover:bg-brand-600 shadow-sm transition"
          >
            スコアを入力する
          </Link>
          <Link
            href="/admin"
            className="tap flex items-center justify-center rounded-2xl bg-white border border-slate-300 text-slate-700 text-lg font-semibold px-6 py-5 hover:bg-slate-50 transition"
          >
            管理画面（運営）
          </Link>
        </div>
      </div>
    </main>
  );
}
