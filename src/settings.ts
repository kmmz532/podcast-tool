import { useState } from 'react';
import type { Lang } from './i18n';
import { APP } from './appConfig';
import type { ProxyConfig } from './services/network/transports';

export type LangSetting = 'auto' | Lang;

export interface Settings {
  theme: 'system' | 'light' | 'dark';
  language: LangSetting;
  uiScale: number;
  showStatusBar: boolean;
  skipBack: number;
  skipForward: number;
  playbackRate: number;
  autoRefreshHours: number;
  proxies: ProxyConfig[];
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  language: 'auto',
  uiScale: 1,
  showStatusBar: true,
  skipBack: 15,
  skipForward: 30,
  playbackRate: 1,
  autoRefreshHours: 6,
  proxies: [{
    id: 'default',
    name: 'Default',
    urlTemplate: 'https://podcast-proxy.kmmz1127.workers.dev?url={url}',
    enabled: true,
  }],
};

const KEY = APP.key('settings');
export function loadSettings(): Settings {
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function useSettings() {
  const [settings, setSettings] = useState(loadSettings);
  const update = (patch: Partial<Settings>) =>
    setSettings((s) => {
      const next = { ...s, ...patch };
      try {
        localStorage.setItem(KEY, JSON.stringify(next))
      } catch {

      }
      return next
    });
  return [settings, update] as const;
}
