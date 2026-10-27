import { useNavigate } from 'react-router-dom';
import { Box, Button, Dialog, IconButton, Stack, Typography, useMediaQuery, useTheme } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronDown, faCircleInfo, faListUl } from '@fortawesome/free-solid-svg-icons';
import { useT } from '../../i18n';
import { playerErrorText, usePlayerStore } from '../../store/playerStore';
import { useUiStore } from '../../store/uiStore';
import { Artwork } from '../podcast/Artwork';
import { TransportButtons } from './PlayerButtons';
import { SeekBar } from './SeekBar';
import { SpeedSelector } from './SpeedSelector';
import { useCurrentEpisode } from './useCurrentEpisode';

const close = () => useUiStore.setState({ fullPlayerOpen: false });

/** フルプレイヤー。スマホは全画面、PC はダイアログ */
export function FullPlayer() {
  const t = useT();
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const open = useUiStore((s) => s.fullPlayerOpen);
  const error = usePlayerStore((s) => s.error);
  const errorStatus = usePlayerStore((s) => s.errorStatus);
  const navigate = useNavigate();
  const cur = useCurrentEpisode();
  if (!cur) return null;
  const { episode, podcast } = cur;
  const go = (path: string) => {
    close();
    navigate(path);
  };

  return (
    <Dialog open={open} onClose={close} fullScreen={fullScreen} fullWidth maxWidth="xs" aria-label={episode.title}>
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', p: 2, pt: 'max(16px, env(safe-area-inset-top))', pb: 'max(16px, env(safe-area-inset-bottom))' }}>
        <Box>
          <IconButton aria-label={t('common.close')} onClick={close}>
            <FontAwesomeIcon icon={faChevronDown} />
          </IconButton>
        </Box>
        <Stack spacing={2} sx={{ flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 0 }}>
          <Box sx={{ width: '100%', maxWidth: 320 }}>
            <Artwork src={episode.artworkUrl ?? podcast?.artworkUrl} size="100%" radius={2} />
          </Box>
          <Box sx={{ width: '100%', textAlign: 'center' }}>
            <Typography variant="h6" sx={{ fontSize: 18, lineHeight: 1.3 }}>
              {episode.title}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {podcast?.title}
            </Typography>
            {error && (
              <Typography variant="body2" color="error" sx={{ mt: 1 }}>
                {playerErrorText({ error, errorStatus }, t)}
              </Typography>
            )}
          </Box>
          <SeekBar />
          <TransportButtons size="large" />
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <SpeedSelector size="medium" />
            <Button startIcon={<FontAwesomeIcon icon={faCircleInfo} />} onClick={() => go(`/episode/${episode.id}`)}>
              {t('player.notes')}
            </Button>
            <Button startIcon={<FontAwesomeIcon icon={faListUl} />} onClick={() => go('/queue')}>
              {t('nav.queue')}
            </Button>
          </Stack>
        </Stack>
      </Box>
    </Dialog>
  );
}
