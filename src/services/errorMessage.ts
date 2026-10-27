import type { t as T } from '../i18n';
import { FeedParseError } from './feed/parseFeed';
import { CorsBlockedError, OfflineError } from './network/errors';

/** 失敗を利用者向けの文に。proxy なら「プロキシの設定を開く」を出す */
export function errorMessage(e: unknown, t: typeof T): { text: string; proxy: boolean } {
  if (e instanceof CorsBlockedError) return { text: t('error.cors'), proxy: true };
  if (e instanceof OfflineError) return { text: t('error.offline'), proxy: false };
  if (e instanceof FeedParseError) return { text: t('error.parse'), proxy: false };
  if (e instanceof TypeError && /URL/i.test(e.message)) return { text: t('error.invalidUrl'), proxy: false };
  return { text: t('error.unknown', { message: e instanceof Error ? e.message : String(e) }), proxy: false };
}
