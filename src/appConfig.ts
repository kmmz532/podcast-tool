import { defineApp } from 'pevenmui/web';
import { APP_INFO } from './appInfo';

export const APP = defineApp(APP_INFO);

export const LICENSES = [
  { name: APP.name, license: 'CC0-1.0', url: APP.repository },
  { name: 'PevenMUI', license: 'MIT', url: 'https://github.com/PTOM76/pevenmui' },
  { name: 'React', license: 'MIT', url: 'https://react.dev/' },
  { name: 'MUI', license: 'MIT', url: 'https://mui.com/' },
  { name: 'React Router', license: 'MIT', url: 'https://reactrouter.com/' },
  { name: 'Dexie.js', license: 'Apache-2.0', url: 'https://dexie.org/' },
  { name: 'Zustand', license: 'MIT', url: 'https://github.com/pmndrs/zustand' },
  { name: 'React Virtuoso', license: 'MIT', url: 'https://virtuoso.dev/' },
  { name: 'DOMPurify', license: 'MPL-2.0 / Apache-2.0', url: 'https://github.com/cure53/DOMPurify' },
  { name: 'Workbox', license: 'MIT', url: 'https://developer.chrome.com/docs/workbox' },
  { name: 'Font Awesome Free', license: 'CC BY 4.0 / MIT', url: 'https://fontawesome.com/' },
  { name: 'Roboto', license: 'OFL-1.1', url: 'https://fonts.google.com/specimen/Roboto' },
];
