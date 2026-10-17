import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';
import sitemap from 'vite-plugin-sitemap';

// Public origin of the deployed site, without a trailing slash. Used for the
// sitemap, robots.txt, and the canonical/Open Graph tags in index.html.
const SITE_URL = 'https://decide.example.com';

export default defineConfig({
  worker: {
    format: 'es',
  },
  plugins: [
    svelte(),
    tailwindcss(),
    {
      name: 'site-url',
      transformIndexHtml: (html) => html.replaceAll('%SITE_URL%', SITE_URL),
    },
    sitemap({ hostname: SITE_URL }),
  ],
  clearScreen: false,
});
