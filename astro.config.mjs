import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import tailwind from '@astrojs/tailwind';

export default defineConfig({
  site: 'https://ajcreates.dev',
  base: '/learn-card-magic',
  integrations: [mdx(), tailwind()],
  output: 'static',
});
