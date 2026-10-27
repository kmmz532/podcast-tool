import { Box, ButtonBase, LinearProgress, Typography } from '@mui/material';
import { useT } from '../../i18n';
import { playerErrorText, usePlayerStore } from '../../store/playerStore';
import { useUiStore } from '../../store/uiStore';
import { Artwork } from '../podcast/Artwork';
import { PlayPauseButton, TransportButtons } from './PlayerButtons';
import { SeekBar } from './SeekBar';
import { SpeedSelector } from './SpeedSelector';
import { useCurrentEpisode } from './useCurrentEpisode';

const openFull = () => useUiStore.setState({ fullPlayerOpen: true });

export function MiniPlayer({ desktop }: { desktop: boolean }) {
  const t = useT();
  const cur = useCurrentEpisode();
  const position = usePlayerStore((s) => s.position);
  const duration = usePlayerStore((s) => s.duration);
  const error = usePlayerStore((s) => s.error);
  const errorStatus = usePlayerStore((s) => s.errorStatus);
  if (!cur) return null;
  const { episode, podcast } = cur;
  const subtitle = playerErrorText({ error, errorStatus }, t) ?? podcast?.title;

  const info = (
    <ButtonBase onClick={openFull} aria-label={t('player.openFull')} sx={{ flex: 1, minWidth: 0, justifyContent: 'flex-start', gap: 1.5, textAlign: 'left', borderRadius: 1, p: 0.5 }}>
      <Artwork src={episode.artworkUrl ?? podcast?.artworkUrl} size={desktop ? 44 : 40} />
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="body2" noWrap sx={{ fontWeight: 500 }}>
          {episode.title}
        </Typography>
        <Typography variant="caption" noWrap color={error ? 'error' : 'text.secondary'} component="div">
          {subtitle}
        </Typography>
      </Box>
    </ButtonBase>
  );

  if (desktop) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, px: 1.5, py: 0.5, borderTop: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
        <Box sx={{ width: 300, minWidth: 0, display: 'flex' }}>{info}</Box>
        <TransportButtons size="small" />
        <Box sx={{ flex: 1, minWidth: 120, pt: 1 }}>
          <SeekBar compact />
        </Box>
        <SpeedSelector />
      </Box>
    );
  }

  return (
    <Box sx={{ borderTop: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
      <LinearProgress variant="determinate" value={duration ? (position / duration) * 100 : 0} sx={{ height: 2 }} />
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 1, py: 0.5 }}>
        {info}
        <PlayPauseButton />
      </Box>
    </Box>
  );
}
