import { memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, ButtonBase, IconButton, LinearProgress, Typography } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck, faPause, faPlay } from '@fortawesome/free-solid-svg-icons';
import type { Episode, PlaybackState } from '../../db/schema';
import { useLang, useT } from '../../i18n';
import { load, toggle } from '../../services/player/playerService';
import { usePlayerStore } from '../../store/playerStore';
import { formatDate, formatDuration } from '../../util/format';
import { EpisodeActions } from './EpisodeActions';

/** エピソード一覧の 1 行。押すと詳細、右の ▶ で再生 */
export const EpisodeListItem = memo(function EpisodeListItem({ episode, state, subtitle }: { episode: Episode; state?: PlaybackState; subtitle?: string }) {
  const t = useT();
  const lang = useLang();
  const navigate = useNavigate();
  const isCurrent = usePlayerStore((s) => s.currentEpisodeId === episode.id);
  const playing = usePlayerStore((s) => s.currentEpisodeId === episode.id && (s.status === 'playing' || s.status === 'loading'));
  const played = !!state?.played;
  const duration = state?.duration ?? episode.duration;
  const inProgress = !played && !!state?.position && !!duration;
  const remain = inProgress ? t('episode.remaining', { time: formatDuration(duration! - state!.position) }) : formatDuration(duration);

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 1, borderBottom: 1, borderColor: 'divider', opacity: played ? 0.6 : 1 }}>
      <ButtonBase onClick={() => navigate(`/episode/${episode.id}`)} sx={{ flex: 1, minWidth: 0, display: 'block', textAlign: 'left', borderRadius: 1, py: 0.5 }}>
        <Typography variant="caption" color="text.secondary" component="div">
          {[subtitle, formatDate(episode.pubDate, lang)].filter(Boolean).join(' · ')}
        </Typography>
        <Typography variant="body2" sx={{ fontWeight: 500, color: isCurrent ? 'primary.main' : undefined, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {episode.title}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.25 }}>
          {played && <FontAwesomeIcon icon={faCheck} fontSize={11} aria-label={t('episode.played')} />}
          <Typography variant="caption" color="text.secondary">
            {remain}
          </Typography>
          {inProgress && <LinearProgress variant="determinate" value={(state!.position / duration!) * 100} sx={{ width: 60, height: 3, borderRadius: 1 }} />}
        </Box>
      </ButtonBase>
      <IconButton aria-label={playing ? t('player.pause') : t('player.play')} onClick={() => (isCurrent ? toggle() : void load(episode.id))} color={isCurrent ? 'primary' : 'default'}>
        <FontAwesomeIcon icon={playing ? faPause : faPlay} fixedWidth />
      </IconButton>
      <EpisodeActions episodeId={episode.id} played={played} />
    </Box>
  );
})
