import { CircularProgress, IconButton, Stack } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faForwardStep, faPause, faPlay, faRotateLeft, faRotateRight } from '@fortawesome/free-solid-svg-icons';
import { useT } from '../../i18n';
import { next, skipBack, skipForward, toggle } from '../../services/player/playerService';
import { usePlayerStore } from '../../store/playerStore';

export function PlayPauseButton({ size = 'medium' }: { size?: 'small' | 'medium' | 'large' }) {
  const t = useT();
  const status = usePlayerStore((s) => s.status);
  const playing = status === 'playing' || status === 'loading';
  const px = size === 'large' ? 28 : size === 'small' ? 14 : 18;
  return (
    <IconButton size={size} aria-label={playing ? t('player.pause') : t('player.play')} onClick={toggle} sx={{ position: 'relative' }}>
      <FontAwesomeIcon icon={playing ? faPause : faPlay} fontSize={px} fixedWidth />
      {status === 'loading' && <CircularProgress size={px * 2} sx={{ position: 'absolute' }} />}
    </IconButton>
  );
}

/** 戻る・再生・進む・次へ */
export function TransportButtons({ size = 'medium', showNext = true }: { size?: 'small' | 'medium' | 'large'; showNext?: boolean }) {
  const t = useT();
  const px = size === 'large' ? 22 : size === 'small' ? 13 : 16;
  return (
    <Stack direction="row" sx={{ alignItems: 'center' }} spacing={size === 'large' ? 2 : 0}>
      <IconButton size={size} aria-label={t('player.skipBack')} onClick={skipBack}>
        <FontAwesomeIcon icon={faRotateLeft} fontSize={px} />
      </IconButton>
      <PlayPauseButton size={size} />
      <IconButton size={size} aria-label={t('player.skipForward')} onClick={skipForward}>
        <FontAwesomeIcon icon={faRotateRight} fontSize={px} />
      </IconButton>
      {showNext && (
        <IconButton size={size} aria-label={t('player.next')} onClick={() => void next()}>
          <FontAwesomeIcon icon={faForwardStep} fontSize={px} />
        </IconButton>
      )}
    </Stack>
  );
}
