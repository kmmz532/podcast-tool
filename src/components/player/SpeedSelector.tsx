import { useState } from 'react';
import { Box, Button, IconButton, Popover, Slider, Stack, Typography } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMinus, faPlus } from '@fortawesome/free-solid-svg-icons';
import { useT } from '../../i18n';
import { setRate } from '../../services/player/playerService';
import { usePlayerStore } from '../../store/playerStore';

const PRESETS = [0.8, 1, 1.2, 1.5, 2];

/** 再生速度（0.5〜3.0、0.1 刻み） */
export function SpeedSelector({ size = 'small' }: { size?: 'small' | 'medium' }) {
  const t = useT();
  const rate = usePlayerStore((s) => s.playbackRate);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);

  return (
    <>
      <Button size={size} aria-label={t('player.speed')} onClick={(e) => setAnchor(e.currentTarget)} sx={{ minWidth: 52, fontVariantNumeric: 'tabular-nums' }}>
        {rate.toFixed(1)}×
      </Button>
      <Popover open={!!anchor} anchorEl={anchor} onClose={() => setAnchor(null)} anchorOrigin={{ vertical: 'top', horizontal: 'center' }} transformOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Box sx={{ p: 2, width: 260 }}>
          <Typography variant="body2" sx={{ mb: 1 }}>
            {t('player.speed')}: {rate.toFixed(1)}×
          </Typography>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <IconButton size="small" aria-label={t('player.slower')} onClick={() => setRate(rate - 0.1)}>
              <FontAwesomeIcon icon={faMinus} fontSize={12} />
            </IconButton>
            <Slider size="small" min={0.5} max={3} step={0.1} value={rate} onChange={(_, v) => setRate(v as number)} aria-label={t('player.speed')} />
            <IconButton size="small" aria-label={t('player.faster')} onClick={() => setRate(rate + 0.1)}>
              <FontAwesomeIcon icon={faPlus} fontSize={12} />
            </IconButton>
          </Stack>
          <Stack direction="row" spacing={0.5} sx={{ mt: 1, justifyContent: 'space-between' }}>
            {PRESETS.map((r) => (
              <Button key={r} size="small" variant={r === rate ? 'contained' : 'text'} onClick={() => setRate(r)} sx={{ minWidth: 0, px: 1 }}>
                {r}×
              </Button>
            ))}
          </Stack>
        </Box>
      </Popover>
    </>
  );
}
