import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import pkg from './package.json' with { type: 'json' };
import { APP_INFO } from './src/appInfo.ts';
import { pevenApp, pevenManifest } from './pevenmui/src/vite.ts';

const root = process.cwd();
const pevenmui = resolve(root, 'pevenmui');

export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  resolve: {
    alias: [
      { find: /^pevenmui$/, replacement: resolve(pevenmui, 'src/index.ts') },
      { find: /^pevenmui\/web$/, replacement: resolve(pevenmui, 'src/web/index.ts') },
      { find: /^pevenmui\/pwa$/, replacement: resolve(pevenmui, 'src/pwa/index.ts') },
    ],
    dedupe: ['react', 'react-dom', '@mui/material', '@emotion/react', '@emotion/styled', '@fortawesome/react-fontawesome', 'workbox-window'],
  },
  plugins: [
    react(),
    pevenApp(APP_INFO, { version: pkg.version, root }),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src/sw',
      filename: 'sw.ts',
      registerType: 'prompt',
      injectManifest: { globPatterns: ['**/*.{js,css,html,svg,png,woff2,json}'] },
      manifest: {
        ...pevenManifest(APP_INFO),
        display: 'standalone',
        start_url: '.',
        scope: '.',
        background_color: '#202020',
        theme_color: '#202020',
        icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
      },
      devOptions: { enabled: false },
    }),
  ],
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts'],
  },
});
