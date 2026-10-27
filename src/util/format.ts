/**
 * 秒数のフォーマットを1:02:03 / 2:03 に
 * @param sec 秒数
 * @returns フォーマットされた文字列
 */
export function formatDuration(sec: number | undefined): string {
  if (sec == null || !Number.isFinite(sec) || sec < 0) return '--:--';
  const s = Math.floor(sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

/**
 * 配信日をフォーマットする。配信日が今年なら年を省略する。
 * @param ms 配信日を表すミリ秒
 * @param lang 言語コード
 * @returns フォーマットされた文字列
 */
export function formatDate(ms: number, lang: string): string {
  if (!ms) return '';
  const d = new Date(ms);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString(lang.replace('_', '-'), sameYear ? { month: 'short', day: 'numeric' } : { year: 'numeric', month: 'short', day: 'numeric' });
}
