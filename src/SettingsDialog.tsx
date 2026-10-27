import { Button } from '@mui/material';
import { Check, Choice, DataRow, Group, NumberInput, Row, SettingsDialog as PevenSettingsDialog, type SettingsCategory } from 'pevenmui';
import { UpdateSection } from 'pevenmui/pwa';
import { i18n, useT } from './i18n';
import { DEFAULT_SETTINGS, type LangSetting, type Settings } from './settings';
import { ProxyList } from './components/settings/ProxyList';
import { exportOpml, importOpml } from './services/opml/opmlActions';
;
export type Category = 'general' | 'appearance' | 'playback' | 'network' | 'data';

const SCALES: ['0.9' | '1' | '1.1' | '1.25', string][] = [
  ['0.9', '90%'],
  ['1', '100%'],
  ['1.1', '110%'],
  ['1.25', '125%'],
];

export default function SettingsDialog(p: { open: boolean; onClose: () => void; settings: Settings; onChange: (patch: Partial<Settings>) => void; initial?: Category }) {
  const t = useT();
  const categories: SettingsCategory<Category>[] = [
    { id: 'general', label: t('settings.general'), texts: [t('settings.language'), t('settings.autoRefresh'), t('settings.update')] },
    { id: 'appearance', label: t('settings.appearance'), texts: [t('settings.theme'), t('settings.uiScale')] },
    { id: 'playback', label: t('settings.playback'), texts: [t('settings.skipBack'), t('settings.skipForward'), t('settings.playbackRate')] },
    { id: 'network', label: t('settings.network'), texts: [t('proxy.title'), t('proxy.help')] },
    { id: 'data', label: t('settings.data'), texts: [t('opml.export'), t('opml.import')] },
  ];

  return (
    <PevenSettingsDialog
      key={p.open ? (p.initial ?? 'general') : 'closed'}
      open={p.open}
      onClose={p.onClose}
      title={t('settings.title')}
      settings={p.settings}
      defaults={DEFAULT_SETTINGS}
      onChange={p.onChange}
      categories={categories}
      initial={p.initial}
      pages={(draft, set) => ({
        general: (
          <>
            <Group title={t('settings.general')}>
              <Row label={t('settings.language')}>
                <Choice<LangSetting> value={draft.language} onChange={(language) => set({ language })} options={[['auto', t('settings.languageAuto')], ...i18n.options()]} />
              </Row>
              <Row label={t('settings.autoRefresh')} help={t('settings.autoRefreshHelp')}>
                <NumberInput value={draft.autoRefreshHours} onChange={(autoRefreshHours) => set({ autoRefreshHours })} min={0} max={168} step={1} unit={t('unit.hours')} />
              </Row>
            </Group>
            <Group title={t('settings.update')}>
              <UpdateSection />
            </Group>
          </>
        ),
        appearance: (
          <Group title={t('settings.appearance')}>
            <Row label={t('settings.theme')}>
              <Choice<Settings['theme']>
                value={draft.theme}
                onChange={(theme) => set({ theme })}
                options={[
                  ['system', t('settings.themeSystem')],
                  ['light', t('settings.themeLight')],
                  ['dark', t('settings.themeDark')],
                ]}
              />
            </Row>
            <Row label={t('settings.uiScale')}>
              <Choice value={String(draft.uiScale) as (typeof SCALES)[number][0]} onChange={(v) => set({ uiScale: Number(v) })} options={SCALES} />
            </Row>
            <Check checked={draft.showStatusBar} onChange={(showStatusBar) => set({ showStatusBar })} label={t('menu.statusBar')} />
          </Group>
        ),
        playback: (
          <Group title={t('settings.playback')}>
            <Row label={t('settings.skipBack')}>
              <NumberInput value={draft.skipBack} onChange={(skipBack) => set({ skipBack })} min={1} max={300} step={1} unit={t('unit.seconds')} />
            </Row>
            <Row label={t('settings.skipForward')}>
              <NumberInput value={draft.skipForward} onChange={(skipForward) => set({ skipForward })} min={1} max={300} step={1} unit={t('unit.seconds')} />
            </Row>
            <Row label={t('settings.playbackRate')}>
              <NumberInput value={draft.playbackRate} onChange={(playbackRate) => set({ playbackRate: Math.round(playbackRate * 10) / 10 })} min={0.5} max={3} step={0.1} unit="×" />
            </Row>
          </Group>
        ),
        network: (
          <Group title={t('proxy.title')}>
            <ProxyList value={draft.proxies} onChange={(proxies) => set({ proxies })} />
          </Group>
        ),
        data: (
          <Group title={t('settings.data')}>
            <DataRow label={t('opml.export')} help={t('opml.exportHelp')}>
              <Button size="small" variant="outlined" onClick={() => void exportOpml()}>
                {t('opml.exportButton')}
              </Button>
            </DataRow>
            <DataRow label={t('opml.import')} help={t('opml.importHelp')}>
              <Button size="small" variant="outlined" onClick={importOpml}>
                {t('opml.importButton')}
              </Button>
            </DataRow>
          </Group>
        ),
      })}
    />
  );
}
