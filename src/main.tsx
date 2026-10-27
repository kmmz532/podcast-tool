import { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { useColorScheme } from '@mui/material';
import '@fontsource/roboto/400.css';
import '@fontsource/roboto/500.css';
import { PevenProvider, preventPageZoom, setUiScale } from 'pevenmui';
import { requestPersist } from 'pevenmui/web';
import App from './App';
import { APP } from './appConfig';
import { i18n } from './i18n';
import { useSettings, type Settings } from './settings';
import { forgetRoutesFor } from './services/network/gateway';
import { init as initPlayer } from './services/player/playerService';
import { autoRefreshIfStale } from './services/refresh';

preventPageZoom();
initPlayer();

void requestPersist().catch(() => {});
void autoRefreshIfStale();

function ThemeSync({ theme }: { theme: Settings['theme'] }) {
  const { setMode } = useColorScheme();
  useEffect(() => setMode(theme), [theme, setMode]);
  return null;
}

function Root() {
  const [settings, update] = useSettings();
  useEffect(() => setUiScale(settings.uiScale), [settings.uiScale]);

  const onSettingsChange = (patch: Partial<Settings>) => {
    if (patch.proxies) {
      const after = new Map(patch.proxies.map((p) => [p.id, JSON.stringify(p)]));
      const changed = settings.proxies.filter((p) => after.get(p.id) !== JSON.stringify(p)).map((p) => p.id);
      void forgetRoutesFor(changed);
    }
    update(patch);
  }

  return (
    <PevenProvider desktopLook app={APP} i18n={i18n} lang={i18n.resolve(settings.language)}>
      <ThemeSync theme={settings.theme} />
      <HashRouter>
        <App settings={settings} onSettingsChange={onSettingsChange} />
      </HashRouter>
    </PevenProvider>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
