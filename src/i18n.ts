import { createI18n } from 'pevenmui';
import en_us from './lang/en_us.json';
import ja_jp from './lang/ja_jp.json';

export const i18n = createI18n({
  messages: { en_us, ja_jp },
});

export type Lang = typeof i18n.Lang;
export type MessageKey = typeof i18n.Key;

export const { t, useT, useLang } = i18n;
