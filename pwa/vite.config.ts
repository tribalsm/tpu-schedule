import tailwind from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { createHash } from 'node:crypto';
import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  plugins: [
    react(),
    tailwind(),
    {
      name: 'schedule-offline-shell',
      apply: 'build',
      generateBundle(_, bundle) {
        const files = Object.keys(bundle).sort();
        const version = createHash('sha256')
          .update(files.map((name) => {
            const output = bundle[name];
            return output.type === 'chunk' ? output.code : String(output.source);
          }).join('\n'))
          .digest('hex').slice(0, 12);
        this.emitFile({
          type: 'asset',
          fileName: 'sw.js',
          source: `
const PREFIX = 'tpu-schedule-shell-';
const CACHE = PREFIX + '${version}';
const files = ${JSON.stringify(['./', './manifest.webmanifest', './icon-192.png', './icon-512.png', './icon-maskable.png', './favicon.ico', './apple-touch-icon.png', ...files.map((name) => `./${name}`)])};
const shell = new URL('./', self.registration.scope).href;
const urls = new Set(files.map((file) => new URL(file, shell).href));

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) =>
    cache.addAll(files.map((file) => new Request(new URL(file, shell), { cache: 'reload' })))
  ));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) =>
    Promise.all(keys.filter((key) => key.startsWith(PREFIX) && key !== CACHE).map((key) => caches.delete(key)))
  ).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.open(CACHE).then((cache) => cache.match(shell))));
  } else if (urls.has(request.url)) {
    event.respondWith(caches.open(CACHE).then(async (cache) =>
      (await cache.match(request, { ignoreVary: true })) || fetch(request)
    ));
  }
});
`,
        });
      },
    },
  ],
});
