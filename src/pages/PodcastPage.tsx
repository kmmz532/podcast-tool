import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate, useParams } from 'react-router-dom';
import { Virtuoso } from 'react-virtuoso';
import { Box, Button, Collapse, Stack, Typography } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowsRotate, faTrash } from '@fortawesome/free-solid-svg-icons';
import { useConfirm } from 'pevenmui';
import { db, type PlaybackState, type Podcast } from '../db/schema';
import { useT } from '../i18n';
import { Artwork } from '../components/podcast/Artwork';
import { EpisodeListItem } from '../components/podcast/EpisodeListItem';
import { errorMessage } from '../services/errorMessage';
import { refreshPodcast, unsubscribe } from '../services/feed/syncPodcast';
import { notify } from '../store/noticeStore';
import { openSettings } from '../store/uiStore';

function PodcastHeader({ podcast, count }: { podcast: Podcast; count: number }) {
  const t = useT();
  const navigate = useNavigate();
  const { confirm, dialog } = useConfirm();
  const [busy, setBusy] = useState(false);
  const [more, setMore] = useState(false);

  const refresh = async () => {
    setBusy(true);
    try {
      const added = await refreshPodcast(podcast);
      notify({ severity: 'success', message: added ? t('refresh.added', { count: added }) : t('refresh.noNew') });
    } catch (e) {
      const m = errorMessage(e, t);
      notify({ severity: 'error', message: m.text, actions: m.proxy ? [{ label: t('error.openProxySettings'), onClick: () => openSettings('network') }] : undefined });
    } finally {
      setBusy(false);
    }
  }

  const remove = async () => {
    if (!(await confirm({ message: t('podcast.unsubscribeConfirm', { title: podcast.title }), okLabel: t('podcast.unsubscribe'), danger: true }))) return;
    await unsubscribe(podcast.id);
    navigate('/');
  }

  return (
    <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
      <Stack direction="row" spacing={2}>
        <Artwork src={podcast.artworkUrl} size={112} />
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h6" sx={{ fontSize: 18, lineHeight: 1.3 }}>
            {podcast.title}
          </Typography>
          {podcast.author && (
            <Typography variant="body2" color="text.secondary">
              {podcast.author}
            </Typography>
          )}
          <Typography variant="caption" color="text.secondary">
            {t('podcast.episodes', { count })}
          </Typography>
          <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: 'wrap' }}>
            <Button size="small" variant="outlined" disabled={busy} startIcon={<FontAwesomeIcon icon={faArrowsRotate} spin={busy} />} onClick={() => void refresh()}>
              {t('podcast.refresh')}
            </Button>
            <Button size="small" color="error" startIcon={<FontAwesomeIcon icon={faTrash} />} onClick={() => void remove()}>
              {t('podcast.unsubscribe')}
            </Button>
          </Stack>
        </Box>
      </Stack>
      {podcast.description && (
        <Box sx={{ mt: 1.5 }}>
          <Collapse in={more} collapsedSize={40}>
            <Typography variant="body2" color="text.secondary" className="selectable" sx={{ whiteSpace: 'pre-line' }}>
              {podcast.description.replace(/<[^>]+>/g, '')}
            </Typography>
          </Collapse>
          <Button size="small" onClick={() => setMore((m) => !m)} sx={{ px: 0 }}>
            {more ? t('common.less') : t('common.more')}
          </Button>
        </Box>
      )}
      {dialog}
    </Box>
  )
}

// 描画のたびに作り直すと、見出しの状態（説明の開閉など）が消えるので外に置く
const HEADER = { Header: ({ context }: { context: { podcast: Podcast; count: number } }) => <PodcastHeader podcast={context.podcast} count={context.count} /> }

export default function PodcastPage() {
  const { id = '' } = useParams();
  const t = useT();
  const data = useLiveQuery(async () => {
    const podcast = await db.podcasts.get(id);
    if (!podcast) return null;
    const episodes = await db.episodes.where('[podcastId+pubDate]').between([id, -Infinity], [id, Infinity]).reverse().toArray();
    const states = await db.playbackStates.bulkGet(episodes.map((e) => e.id));
    const stateMap = new Map<string, PlaybackState>();
    for (const s of states) if (s) stateMap.set(s.episodeId, s);
    return { podcast, episodes, stateMap };
  }, [id]);

  if (data === undefined) return null;
  if (data === null) return <Typography sx={{ p: 3 }}>{t('podcast.notFound')}</Typography>;

  return (
    <Virtuoso
      style={{ height: '100%' }}
      data={data.episodes}
      computeItemKey={(_, e) => e.id}
      context={{ podcast: data.podcast, count: data.episodes.length }}
      components={HEADER}
      itemContent={(_, e) => <EpisodeListItem episode={e} state={data.stateMap.get(e.id)} />}
    />
  );
}
