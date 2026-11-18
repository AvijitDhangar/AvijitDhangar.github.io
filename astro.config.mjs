import { defineConfig } from 'astro/config';

// User site (avijitdhangar.github.io): base is "/". For a project site set BASE_PATH=/repo-name.
export default defineConfig({
  site: process.env.SITE_URL || 'https://avijitdhangar.github.io',
  base: process.env.BASE_PATH || '/',
  build: { format: 'directory' },
  devToolbar: { enabled: false },
});
