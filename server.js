// Passenger (cPanel) startup file.
// Loads .env into process.env before starting the Astro server, because
// Passenger does not load it. Variables that are already set win.
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const envPath = resolve(__dirname, '.env');
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    if (!(key in process.env)) process.env[key] = val;
  }
} else {
  console.warn('[server.js] .env not found at:', envPath);
}

import('./dist/server/entry.mjs').catch((err) => {
  console.error('[server.js] Failed to start the Astro server:', err);
  process.exit(1);
});
