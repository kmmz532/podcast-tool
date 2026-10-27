import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Box, Button, IconButton, Stack, Typography } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowDown, faArrowUp, faGripVertical, faPlay, faXmark } from '@fortawesome/free-solid-svg-icons';
import { db } from '../db/schema';
import { useT } from '../i18n';
import { Artwork } from '../components/podcast/Artwork';
import { load } from '../services/player/playerService';
import { clearQueue, dequeue, reorderQueue } from '../services/player/queue';
import { formatDuration } from '../util/format';

export default function QueuePage() {
  const t = useT();
  const [dragging, setDragging] = useState<number | null>(null);
  const items = useLiveQuery(async () => {
    const queue = await db.queue.orderBy('order').toArray();
    const episodes = await db.episodes.bulkGet(queue.map((q) => q.episodeId));
    const podcasts = new Map((await db.podcasts.toArray()).map((p) => [p.id, p]));
    return episodes.flatMap((e) => (e ? [{ episode: e, podcast: podcasts.get(e.podcastId) }] : []));
  });
  if (!items) return null;

  const ids = items.map((i) => i.episode.id);
  const move = (from: number, to: number) => {
    if (to < 0 || to >= ids.length || from === to) return;
    const next = [...ids];
    const [x] = next.splice(from, 1);
    next.splice(to, 0, x);
    void reorderQueue(next);
  }
  const playFrom = async (i: number) => {
    // 押したものとそれより前はキューから外す
    await reorderQueue(ids.slice(i + 1));
    await load(ids[i]);
  };

  return (
    <Box sx={{ height: '100%', overflowY: 'auto' }}>
      <Stack direction="row" sx={{ px: 2, py: 1, alignItems: 'center', borderBottom: 1, borderColor: 'divider' }}>
        <Typography variant="subtitle1" sx={{ flex: 1 }}>
          {t('queue.title')}
        </Typography>
        <Button size="small" disabled={!items.length} onClick={() => void clearQueue()}>
          {t('queue.clear')}
        </Button>
      </Stack>
      {!items.length && <Typography sx={{ p: 3, textAlign: 'center' }} color="text.secondary">{t('queue.empty')}</Typography>}
      {items.map(({ episode, podcast }, i) => (
        <Box
          key={episode.id}
          draggable
          onDragStart={() => setDragging(i)}
          onDragOver={(e) => e.preventDefault()}
          onDrop={() => {
            if (dragging != null) move(dragging, i);
            setDragging(null);
          }}
          onDragEnd={() => setDragging(null)}
          sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1, py: 0.75, borderBottom: 1, borderColor: 'divider', opacity: dragging === i ? 0.4 : 1 }}
        >
          <Box sx={{ cursor: 'grab', color: 'text.disabled', px: 0.5, display: { xs: 'none', md: 'block' } }}>
            <FontAwesomeIcon icon={faGripVertical} />
          </Box>
          <Artwork src={episode.artworkUrl ?? podcast?.artworkUrl} size={40} />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="body2" noWrap sx={{ fontWeight: 500 }}>
              {episode.title}
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap component="div">
              {[podcast?.title, formatDuration(episode.duration)].filter(Boolean).join(' · ')}
            </Typography>
          </Box>
          <IconButton size="small" aria-label={t('player.play')} onClick={() => void playFrom(i)}>
            <FontAwesomeIcon icon={faPlay} fixedWidth />
          </IconButton>
          <IconButton size="small" aria-label={t('queue.moveUp')} disabled={i === 0} onClick={() => move(i, i - 1)}>
            <FontAwesomeIcon icon={faArrowUp} fixedWidth />
          </IconButton>
          <IconButton size="small" aria-label={t('queue.moveDown')} disabled={i === items.length - 1} onClick={() => move(i, i + 1)}>
            <FontAwesomeIcon icon={faArrowDown} fixedWidth />
          </IconButton>
          <IconButton size="small" aria-label={t('queue.remove')} onClick={() => void dequeue(episode.id)}>
            <FontAwesomeIcon icon={faXmark} fixedWidth />
          </IconButton>
        </Box>
      ))}
    </Box>
  );
}
