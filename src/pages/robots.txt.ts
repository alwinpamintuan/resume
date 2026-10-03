import type { APIRoute } from 'astro';
import { sitePath } from '../lib/urls';
import { loadContent } from '../lib/content';
export const GET: APIRoute = ({ site }) => new Response(loadContent().sample
  ? 'User-agent: *\nDisallow: /\n'
  : `User-agent: *\nAllow: /\nDisallow: ${sitePath('resume/')}\nDisallow: ${sitePath('downloads/')}\nSitemap: ${new URL(sitePath('sitemap.xml'), site).href}\n`, { headers: { 'Content-Type': 'text/plain' } });
