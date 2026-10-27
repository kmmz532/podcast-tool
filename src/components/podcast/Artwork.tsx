import { useState } from 'react';
import { Box } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPodcast } from '@fortawesome/free-solid-svg-icons';

/** アートワーク。読めないときは代わりのアイコン */
export function Artwork({ src, size, radius = 1 }: { src?: string; size: number | string; radius?: number }) {
  const [failed, setFailed] = useState<string | undefined>();
  const ok = src && failed !== src;
  return (
    <Box
      sx={{
        width: size,
        height: size,
        aspectRatio: '1',
        flexShrink: 0,
        borderRadius: radius,
        overflow: 'hidden',
        bgcolor: 'action.hover',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'text.disabled',
      }}
    >
      {ok ? (
        <img src={src} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(src)} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
      ) : (
        <FontAwesomeIcon icon={faPodcast} style={{ width: '40%', height: '40%' }} />
      )}
    </Box>
  );
}
