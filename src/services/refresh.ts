import { db } from '../db/schema';
import { t } from '../i18n';
import { loadSettings } from '../settings';
import { notify } from '../store/noticeStore';
import { openSettings, useUiStore } from '../store/uiStore';
import { refreshAll } from './feed/syncPodcast';
import { CorsBlockedError } from './network/errors';

/** 全番組を更新し、結果を通知する（F-1-5）。quiet なら失敗したときだけ通知する */
export async function runRefreshAll(quiet = false) {
  if (useUiStore.getState().refreshing) return;
  if (!navigator.onLine) {
    if (!quiet) notify({ severity: 'warning', message: t('error.offline') });
    return;
  }
  useUiStore.setState({ refreshing: true });
  try {
    const r = await refreshAll();
    if (r.failed.length) {
      const cors = r.failed.some((f) => f.error instanceof CorsBlockedError);
      notify({
        severity: 'warning',
        message: t('refresh.failed', { count: r.failed.length, names: r.failed.map((f) => f.podcast.title).join(', ') }),
        actions: cors ? [{ label: t('error.openProxySettings'), onClick: () => openSettings('network') }] : undefined,
      });
    } else if (!quiet) {
      notify({ severity: 'success', message: r.added ? t('refresh.added', { count: r.added }) : t('refresh.noNew') });
    }
  } finally {
    useUiStore.setState({ refreshing: false });
  }
}

/** 起動時、前回の更新から一定時間が過ぎていれば更新する */
export async function autoRefreshIfStale() {
  const hours = loadSettings().autoRefreshHours;
  if (hours <= 0) return;
  const podcasts = await db.podcasts.toArray();
  if (!podcasts.length) return;
  const oldest = Math.min(...podcasts.map((p) => p.lastFetchedAt ?? 0));
  if (Date.now() - oldest >= hours * 3600_000) await runRefreshAll(true);
}
