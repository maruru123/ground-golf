// フォーム入力の共通ヘルパー（クライアント用）

/** 数字以外の文字を取り除く。 */
export function digitsOnly(value: string): string {
  return value.replace(/[^0-9]/g, "");
}

/**
 * 非制御の input に数字以外の文字を入力させない。数字のみにした値を返す。
 * 通常の入力では値に触れない（iOS Safari では入力中に値を書き換えると
 * 文字が重複することがあるため、不正な文字が入ったときだけ書き戻す）。
 */
export function onlyDigits(el: HTMLInputElement): string {
  const cleaned = digitsOnly(el.value);
  if (el.value !== cleaned) el.value = cleaned;
  return cleaned;
}
