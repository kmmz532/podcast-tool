import { useState } from 'react';
import { Box, Slider, Typography } from '@mui/material';
import { useT } from '../../i18n';
import { seekTo } from '../../services/player/playerService';
import { usePlayerStore } from '../../store/playerStore';
import { formatDuration } from '../../util/format';

export function SeekBar({ compact }: { compact?: boolean }) {
  const t = useT();
  const position = usePlayerStore((s) => s.position);
  const duration = usePlayerStore((s) => s.duration);
  const [drag, setDrag] = useState<number | null>(null);
  const value = drag ?? position;

  return (
    <Box sx={{ width: '100%' }}>
      <Slider
        size="small"
        aria-label={t('player.seek')}
        min={0}
        max={duration || 1}
        step={1}
        value={Math.min(value, duration || 1)}
        disabled={!duration}
        onChange={(_, v) => setDrag(v as number)}
        onChangeCommitted={(_, v) => {
          seekTo(v as number);
          setDrag(null);
        }}
        getAriaValueText={(v) => formatDuration(v)}
        sx={{ py: compact ? 0.5 : 1 }}
      />
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: compact ? -0.5 : -0.75 }}>
        <Typography variant="caption" color="text.secondary" sx={{ fontVariantNumeric: 'tabular-nums' }}>
          {formatDuration(value)}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ fontVariantNumeric: 'tabular-nums' }}>
          -{formatDuration(Math.max(0, duration - value))}
        </Typography>
      </Box>
    </Box>
  );
}
