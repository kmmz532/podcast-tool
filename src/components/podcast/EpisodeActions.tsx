import { useState } from 'react';
import { IconButton, ListItemIcon, Menu, MenuItem } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck, faEllipsisVertical, faListUl, faRotateLeft, faTurnUp } from '@fortawesome/free-solid-svg-icons';
import { useT } from '../../i18n';
import { setPlayed } from '../../services/player/playerService';
import { enqueue, enqueueNext } from '../../services/player/queue';
import { notify } from '../../store/noticeStore';

/** エピソードの ⋮ メニュー（キューに追加、次に再生、再生済みの切り替え） */
export function EpisodeActions({ episodeId, played }: { episodeId: string; played: boolean }) {
  const t = useT();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const run = (fn: () => Promise<unknown>, message?: string) => () => {
    setAnchor(null);
    void fn().then(() => message && notify({ severity: 'success', message }));
  };
  return (
    <>
      <IconButton
        size="small"
        aria-label={t('episode.more')}
        onClick={(e) => {
          e.stopPropagation();
          setAnchor(e.currentTarget);
        }}
      >
        <FontAwesomeIcon icon={faEllipsisVertical} fixedWidth />
      </IconButton>
      <Menu open={!!anchor} anchorEl={anchor} onClose={() => setAnchor(null)} onClick={(e) => e.stopPropagation()}>
        <MenuItem onClick={run(() => enqueueNext(episodeId), t('queue.addedNext'))}>
          <ListItemIcon>
            <FontAwesomeIcon icon={faTurnUp} />
          </ListItemIcon>
          {t('episode.playNext')}
        </MenuItem>
        <MenuItem onClick={run(() => enqueue(episodeId), t('queue.added'))}>
          <ListItemIcon>
            <FontAwesomeIcon icon={faListUl} />
          </ListItemIcon>
          {t('episode.addToQueue')}
        </MenuItem>
        <MenuItem onClick={run(() => setPlayed(episodeId, !played))}>
          <ListItemIcon>
            <FontAwesomeIcon icon={played ? faRotateLeft : faCheck} />
          </ListItemIcon>
          {played ? t('episode.markUnplayed') : t('episode.markPlayed')}
        </MenuItem>
      </Menu>
    </>
  );
}
