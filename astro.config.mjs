// @ts-check
import { readFileSync } from 'node:fs';
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

const sito = JSON.parse(readFileSync(new URL('./data/config/sito.json', import.meta.url), 'utf8'));

// Percorso base configurabile (per esempio BASE_PATH=/nerviano-serie-b per GitHub Pages).
const base = process.env.BASE_PATH || '/';

export default defineConfig({
  site: sito.url,
  base,
  output: 'static',
  trailingSlash: 'always',
  build: {
    format: 'directory',
    // niente CSS inline: la Content-Security-Policy non consente 'unsafe-inline'
    inlineStylesheets: 'never',
  },
  vite: {
    build: {
      // niente asset trasformati in data: URI dentro gli script
      assetsInlineLimit: 0,
    },
  },
  // la sitemap si pubblica solo quando il sito è indicizzabile (data/config/sito.json)
  integrations: sito.indicizzabile ? [sitemap()] : [],
  devToolbar: { enabled: false },
});
