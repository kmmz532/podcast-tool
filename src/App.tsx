import { useState } from 'react';
import { Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { BottomNavigation, BottomNavigationAction, Box, Link } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowsRotate, faGear, faListUl, faPlus, faTableCells } from '@fortawesome/free-solid-svg-icons';
import { AboutDialog, AppHeader, FULL_HEIGHT, HeaderIcon, LicensesDialog, NoticeMessage, StatusBar, StatusItem, StatusSpacer, resolveKeymap, useMobileLayout, useShortcuts, type MenuGroup } from 'pevenmui';
import { UpdatePrompt } from 'pevenmui/pwa';
import { APP, LICENSES } from './appConfig';
import { useT } from './i18n';
import SettingsDialog, { type Category } from './SettingsDialog';
import type { Settings } from './settings';
import { FullPlayer } from './components/player/FullPlayer';
import { MiniPlayer } from './components/player/MiniPlayer';
import { AddPodcastDialog } from './components/podcast/AddPodcastDialog';
import { PodcastSidebar } from './components/podcast/PodcastSidebar';
import EpisodePage from './pages/EpisodePage';
import LibraryPage from './pages/LibraryPage';
import PodcastPage from './pages/PodcastPage';
import QueuePage from './pages/QueuePage';
import { runRefreshAll } from './services/refresh';
import { setRate, skipBack, skipForward, toggle } from './services/player/playerService';
import { exportOpml, importOpml } from './services/opml/opmlActions';
import { closeNotice, useNoticeStore } from './store/noticeStore';
import { usePlayerStore } from './store/playerStore';
import { openSettings, useUiStore } from './store/uiStore';

const BUILD = `${__APP_VERSION__} (${__APP_COMMIT__})`;

const AppIcon = ({ size }: { size: number }) => <img src={`${import.meta.env.BASE_URL}icon.svg`} alt="" width={size} height={size} style={{ display: 'block' }} />;

const openExternal = (url: string) => window.open(url, '_blank', 'noopener,noreferrer');

type ActionId = 'playPause' | 'skipBack' | 'skipForward' | 'slower' | 'faster' | 'refreshAll';

const KEY_ACTIONS: { id: ActionId; keys: string[] }[] = [
  { id: 'playPause', keys: ['Space'] },
  { id: 'skipBack', keys: ['ArrowLeft'] },
  { id: 'skipForward', keys: ['ArrowRight'] },
  { id: 'slower', keys: ['Shift+ArrowLeft'] },
  { id: 'faster', keys: ['Shift+ArrowRight'] },
  { id: 'refreshAll', keys: ['KeyU'] },
];
const KEYMAP = resolveKeymap(KEY_ACTIONS, {});

const routes = (
  <Routes>
    <Route path="/" element={<LibraryPage />} />
    <Route path="/podcast/:id" element={<PodcastPage />} />
    <Route path="/episode/:id" element={<EpisodePage />} />
    <Route path="/queue" element={<QueuePage />} />
    <Route path="*" element={<LibraryPage />} />
  </Routes>
);

export default function App(p: { settings: Settings, onSettingsChange: (patch: Partial<Settings>) => void }) {
  const t = useT();
  const mobile = useMobileLayout();
  const navigate = useNavigate();
  const location = useLocation();
  const { settingsOpen, settingsCategory, addOpen, refreshing } = useUiStore();
  const notice = useNoticeStore((s) => s.notice);
  const hasEpisode = usePlayerStore((s) => !!s.currentEpisodeId);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [licensesOpen, setLicensesOpen] = useState(false);
  const openAdd = () => useUiStore.setState({ addOpen: true });
  const licenses = LICENSES.map((entry) => entry.name === APP.name ? { ...entry, note: t('licenses.app') } : entry);

  useShortcuts(KEYMAP, {
    playPause: hasEpisode ? toggle : undefined,
    skipBack: hasEpisode ? skipBack : undefined,
    skipForward: hasEpisode ? skipForward : undefined,
    slower: () => setRate(usePlayerStore.getState().playbackRate - 0.1),
    faster: () => setRate(usePlayerStore.getState().playbackRate + 0.1),
    refreshAll: () => void runRefreshAll(),
  });

  const menus: MenuGroup[] = [
    {
      label: t('menu.file'),
      accessKey: 'F',
      entries: [
        { label: t('add.title'), onClick: openAdd },
        { label: t('menu.refreshAll'), disabled: refreshing, onClick: () => void runRefreshAll() },
        { divider: true },
        { label: t('opml.importButton'), onClick: importOpml },
        { label: t('opml.exportButton'), onClick: () => void exportOpml() },
        { divider: true },
        { label: t('menu.settings'), onClick: () => openSettings() },
      ],
    },
    {
      label: t('menu.playback'),
      accessKey: 'P',
      entries: [
        { label: t('player.playPause'), disabled: !hasEpisode, onClick: toggle },
        { label: t('player.skipBack'), disabled: !hasEpisode, onClick: skipBack },
        { label: t('player.skipForward'), disabled: !hasEpisode, onClick: skipForward },
        { divider: true },
        { label: t('player.openFull'), disabled: !hasEpisode, onClick: () => useUiStore.setState({ fullPlayerOpen: true }) },
        { label: t('nav.queue'), onClick: () => navigate('/queue') },
      ],
    },
    {
      label: t('menu.view'),
      accessKey: 'V',
      entries: [
        { label: t('nav.library'), onClick: () => navigate('/') },
        { label: t('menu.statusBar'), checked: p.settings.showStatusBar, onClick: () => p.onSettingsChange({ showStatusBar: !p.settings.showStatusBar }) },
      ],
    },
    {
      label: t('menu.help'),
      accessKey: 'H',
      entries: [
        { label: t('menu.guide'), onClick: () => openExternal(APP.repository) },
        { label: t('menu.licenses'), onClick: () => setLicensesOpen(true) },
        { label: t('menu.about'), onClick: () => setAboutOpen(true) },
      ],
    },
  ];

  const tab = location.pathname.startsWith('/queue') ? '/queue' : '/';

  return (
    <Box sx={{ height: FULL_HEIGHT, display: 'flex', flexDirection: 'column', overflow: 'hidden', bgcolor: 'background.default' }}>
      <AppHeader
        icon={<AppIcon size={16} />}
        menus={menus}
        actions={(m) => (
          <>
            <HeaderIcon title={t('add.title')} icon={faPlus} small={!m} onClick={openAdd} />
            <HeaderIcon title={t('menu.refreshAll')} icon={faArrowsRotate} small={!m} disabled={refreshing} onClick={() => void runRefreshAll()} />
            {m && <HeaderIcon title={t('menu.settings')} icon={faGear} onClick={() => openSettings()} />}
          </>
        )}
      />

      <Box sx={{ flex: 1, minHeight: 0, display: 'flex' }}>
        {!mobile && <PodcastSidebar />}
        <Box component="main" sx={{ flex: 1, minWidth: 0, overflowY: 'auto', position: 'relative' }}>
          {routes}
        </Box>
      </Box>

      <MiniPlayer desktop={!mobile} />

      {mobile && (
        <BottomNavigation showLabels value={tab} onChange={(_, v: string) => navigate(v)} sx={{ borderTop: 1, borderColor: 'divider', pb: 'env(safe-area-inset-bottom)', height: 'auto', minHeight: 56 }}>
          <BottomNavigationAction value="/" label={t('nav.library')} icon={<FontAwesomeIcon icon={faTableCells} />} />
          <BottomNavigationAction value="/queue" label={t('nav.queue')} icon={<FontAwesomeIcon icon={faListUl} />} />
        </BottomNavigation>
      )}

      {!mobile && p.settings.showStatusBar && (
        <StatusBar>
          <StatusItem>{refreshing ? t('status.refreshing') : t('status.ready')}</StatusItem>
          <StatusSpacer />
          <StatusItem secondary>{BUILD}</StatusItem>
        </StatusBar>
      )}

      <FullPlayer />
      <AddPodcastDialog open={addOpen} onClose={() => useUiStore.setState({ addOpen: false })} />
      <SettingsDialog
        open={settingsOpen}
        initial={settingsCategory as Category | undefined}
        onClose={() => useUiStore.setState({ settingsOpen: false })}
        settings={p.settings}
        onChange={p.onSettingsChange}
      />
      <NoticeMessage vertical={mobile ? 'top' : 'bottom'} message={notice} onClose={closeNotice} />
      <UpdatePrompt build={BUILD} vertical={mobile ? 'top' : 'bottom'} />
      <LicensesDialog
        open={licensesOpen}
        onClose={() => setLicensesOpen(false)}
        title={t('menu.licenses')}
        entries={licenses}
      />
      <AboutDialog
        open={aboutOpen}
        onClose={() => setAboutOpen(false)}
        icon={<AppIcon size={56} />}
        rows={[
          [t('about.version'), <span className="selectable">{BUILD}</span>],
          [t('about.author'), APP.author],
          [
            t('about.source'),
            <Link className="selectable" href={APP.repository} target="_blank" rel="noopener noreferrer">
              {APP.repository.replace('https://', '')}
            </Link>,
          ],
        ]}
      />
    </Box>
  );
}
