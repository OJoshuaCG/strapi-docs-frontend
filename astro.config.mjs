import { defineConfig } from 'astro/config';
import { loadEnv } from 'vite';
import node from '@astrojs/node';
import tailwind from '@astrojs/tailwind';

// Astro does not load .env into process.env while evaluating this file,
// so read SITE_URL through Vite's loadEnv (shell variables still take precedence).
const { SITE_URL } = loadEnv(process.env.NODE_ENV ?? 'production', process.cwd(), '');

export default defineConfig({
  site: process.env.SITE_URL || SITE_URL || undefined,
  output: 'server',
  adapter: node({
    mode: 'standalone',
  }),
  integrations: [tailwind()],
});
