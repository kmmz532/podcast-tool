import { useLocation, useNavigate } from 'react-router-dom';
import { Box, List, ListItemButton, ListItemIcon, ListItemText, Typography } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faListUl, faTableCells } from '@fortawesome/free-solid-svg-icons';
import { usePanelWidth } from 'pevenmui';
import { APP } from '../../appConfig';
import { useT } from '../../i18n';
import { usePodcastsWithUnplayed } from '../../pages/LibraryPage';
import { Artwork } from './Artwork';

/** PC の左の欄。ライブラリ・キューと、購読中の番組 */
export function PodcastSidebar() {
  const t = useT();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const items = usePodcastsWithUnplayed() ?? [];
  const { width, bar } = usePanelWidth(APP.key('sidebarWidth'), 260, 180, 480, 'left');

  return (
    <Box sx={{ width, flexShrink: 0, display: 'flex', borderRight: 1, borderColor: 'divider', position: 'relative' }}>
      <Box component="nav" sx={{ flex: 1, minWidth: 0, overflowY: 'auto' }}>
        <List dense>
          <ListItemButton selected={pathname === '/'} onClick={() => navigate('/')}>
            <ListItemIcon sx={{ minWidth: 32 }}>
              <FontAwesomeIcon icon={faTableCells} />
            </ListItemIcon>
            <ListItemText primary={t('nav.library')} />
          </ListItemButton>
          <ListItemButton selected={pathname === '/queue'} onClick={() => navigate('/queue')}>
            <ListItemIcon sx={{ minWidth: 32 }}>
              <FontAwesomeIcon icon={faListUl} />
            </ListItemIcon>
            <ListItemText primary={t('nav.queue')} />
          </ListItemButton>
        </List>
        <List dense subheader={<Typography variant="caption" color="text.secondary" sx={{ px: 2 }}>{t('nav.podcasts')}</Typography>}>
          {items.map(({ podcast, unplayed }) => (
            <ListItemButton key={podcast.id} selected={pathname === `/podcast/${podcast.id}`} onClick={() => navigate(`/podcast/${podcast.id}`)} sx={{ gap: 1 }}>
              <Artwork src={podcast.artworkUrl} size={28} radius={0.5} />
              <ListItemText primary={podcast.title} slotProps={{ primary: { noWrap: true } }} />
              {unplayed > 0 && (
                <Typography variant="caption" color="text.secondary">
                  {unplayed}
                </Typography>
              )}
            </ListItemButton>
          ))}
        </List>
      </Box>
      {bar}
    </Box>
  );
}
