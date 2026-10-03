import type { AstroUserConfig } from 'astro';
import { siteBase } from './src/lib/urls';

export default {
  site: 'https://alwinpamintuan.github.io',
  base: siteBase,
  output: 'static',
  trailingSlash: 'always',
} satisfies AstroUserConfig;
