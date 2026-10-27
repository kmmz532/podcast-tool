import { useLiveQuery } from 'dexie-react-hooks'
import { Link as RouterLink, useParams } from 'react-router-dom'
import { Box, Button, Link, Stack, Typography } from '@mui/material'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCheck, faListUl, faPause, faPlay, faRotateLeft } from '@fortawesome/free-solid-svg-icons'
import { db } from '../db/schema'
import { useLang, useT } from '../i18n'
import { Artwork } from '../components/podcast/Artwork'
import { load, setPlayed, toggle } from '../services/player/playerService'
import { dequeue, enqueue } from '../services/player/queue'
import { usePlayerStore } from '../store/playerStore'
import { formatDate, formatDuration } from '../util/format'

export default function EpisodePage() {
  const { id = '' } = useParams();
  const t = useT();
  const lang = useLang();
  const isCurrent = usePlayerStore((s) => s.currentEpisodeId === id);
  const playing = usePlayerStore((s) => s.currentEpisodeId === id && (s.status === 'playing' || s.status === 'loading'));
  const data = useLiveQuery(async () => {
    const episode = await db.episodes.get(id);
    if (!episode) return null;
    const [podcast, state, queued] = await Promise.all([db.podcasts.get(episode.podcastId), db.playbackStates.get(id), db.queue.get(id)]);
    return { episode, podcast, state, queued: !!queued };
  }, [id]);

  if (data === undefined) return null;
  if (data === null) return <Typography sx={{ p: 3 }}>{t('episode.notFound')}</Typography>;
  const { episode, podcast, state, queued } = data;
  const played = !!state?.played;

  return (
    <Box sx={{ height: '100%', overflowY: 'auto' }}>
      <Box sx={{ p: 2, maxWidth: 800, mx: 'auto' }}>
        <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
          <Artwork src={episode.artworkUrl ?? podcast?.artworkUrl} size={80} />
          <Box sx={{ minWidth: 0 }}>
            {podcast && (
              <Link component={RouterLink} to={`/podcast/${podcast.id}`} variant="body2" underline="hover">
                {podcast.title}
              </Link>
            )}
            <Typography variant="h6" sx={{ fontSize: 18, lineHeight: 1.3 }}>
              {episode.title}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {[formatDate(episode.pubDate, lang), formatDuration(state?.duration ?? episode.duration)].filter(Boolean).join(' · ')}
            </Typography>
          </Box>
        </Stack>
        <Stack direction="row" spacing={1} sx={{ my: 2, flexWrap: 'wrap', rowGap: 1 }}>
          <Button variant="contained" startIcon={<FontAwesomeIcon icon={playing ? faPause : faPlay} />} onClick={() => (isCurrent ? toggle() : void load(id))}>
            {playing ? t('player.pause') : state?.position && !played ? t('episode.resume') : t('player.play')}
          </Button>
          <Button variant="outlined" startIcon={<FontAwesomeIcon icon={faListUl} />} onClick={() => void (queued ? dequeue(id) : enqueue(id))}>
            {queued ? t('episode.removeFromQueue') : t('episode.addToQueue')}
          </Button>
          <Button startIcon={<FontAwesomeIcon icon={played ? faRotateLeft : faCheck} />} onClick={() => void setPlayed(id, !played)}>
            {played ? t('episode.markUnplayed') : t('episode.markPlayed')}
          </Button>
        </Stack>
        {episode.description ? (
          <Box
            className="selectable"
            sx={{ typography: 'body2', overflowWrap: 'anywhere', '& img': { maxWidth: '100%', height: 'auto' }, '& a': { color: 'primary.main' } }}
            // parseFeed で DOMPurify によりサニタイズ済み
            dangerouslySetInnerHTML={{ __html: episode.description }}
          />
        ) : (
          <Typography color="text.secondary">{t('episode.noNotes')}</Typography>
        )}
      </Box>
    </Box>
  );
}
