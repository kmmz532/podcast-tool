import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { Badge, Box, Button, ButtonBase, Stack, Typography } from '@mui/material'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPlus } from '@fortawesome/free-solid-svg-icons'
import { db } from '../db/schema'
import { useT } from '../i18n'
import { Artwork } from '../components/podcast/Artwork'
import { useUiStore } from '../store/uiStore'

export function usePodcastsWithUnplayed() {
  return useLiveQuery(async () => {
    const [podcasts, played] = await Promise.all([db.podcasts.orderBy('sortOrder').toArray(), db.playbackStates.filter((s) => s.played).primaryKeys()]);
    const playedSet = new Set(played);
    return Promise.all(
      podcasts.map(async (p) => {
        const ids = await db.episodes.where('podcastId').equals(p.id).primaryKeys();
        return { podcast: p, unplayed: ids.filter((id) => !playedSet.has(id)).length };
      }),
    );
  });
}

export default function LibraryPage() {
  const t = useT();
  const navigate = useNavigate();
  const items = usePodcastsWithUnplayed();
  if (!items) return null;

  if (!items.length) {
    return (
      <Stack spacing={2} sx={{ p: 4, alignItems: 'center', textAlign: 'center' }}>
        <Typography variant="h6">{t('library.empty')}</Typography>
        <Typography color="text.secondary">{t('library.emptyHint')}</Typography>
        <Button variant="contained" startIcon={<FontAwesomeIcon icon={faPlus} />} onClick={() => useUiStore.setState({ addOpen: true })}>
          {t('add.title')}
        </Button>
      </Stack>
    );
  }

  return (
    <Box sx={{ p: 2, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 2 }}>
      {items.map(({ podcast, unplayed }) => (
        <ButtonBase key={podcast.id} onClick={() => navigate(`/podcast/${podcast.id}`)} sx={{ display: 'block', textAlign: 'left', borderRadius: 1 }}>
          <Badge badgeContent={unplayed} color="primary" max={999} sx={{ display: 'block', '& .MuiBadge-badge': { top: 8, right: 8 } }}>
            <Artwork src={podcast.artworkUrl} size="100%" />
          </Badge>
          <Typography variant="body2" sx={{ mt: 0.75, fontWeight: 500, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {podcast.title}
          </Typography>
          {podcast.author && (
            <Typography variant="caption" color="text.secondary" noWrap component="div">
              {podcast.author}
            </Typography>
          )}
        </ButtonBase>
      ))}
    </Box>
  );
}
