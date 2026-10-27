import { downloadBlob } from 'pevenmui/web';
import { db } from '../../db/schema';
import { t } from '../../i18n';
import { notify } from '../../store/noticeStore';
import { subscribe } from '../feed/syncPodcast';
import { parseOpml, toOpml } from './opml';

export async function exportOpml() {
  const podcasts = await db.podcasts.orderBy('sortOrder').toArray();
  downloadBlob(new Blob([toOpml(podcasts)], { type: 'text/x-opml' }), 'podcasts.opml');
}

export function importOpml() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.opml,.xml,text/xml,text/x-opml,application/xml';
  input.onchange = async () => {
    const file = input.files?.[0];
    if (!file) return;
    let entries: { feedUrl: string }[];
    try {
      entries = parseOpml(await file.text());
    } catch {
      notify({ severity: 'error', message: t('opml.invalid') });
      return;
    }
    notify({ severity: 'info', message: t('opml.importing', { count: entries.length }) });
    let ok = 0;
    const failed: string[] = [];
    let next = 0;
    const worker = async () => {
      while (next < entries.length) {
        const e = entries[next++];
        try {
          await subscribe(e.feedUrl);
          ok++;
        } catch {
          failed.push(e.feedUrl);
        }
      };
    };
    await Promise.all(Array.from({ length: Math.min(4, entries.length) }, worker));
    notify({
      severity: failed.length ? 'warning' : 'success',
      message: failed.length ? t('opml.importedWithErrors', { ok, failed: failed.length }) : t('opml.imported', { count: ok }),
    });
  };
  input.click();
}
