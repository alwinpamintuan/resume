import type { APIRoute } from 'astro';
import { loadContent } from '../lib/content';
export const GET: APIRoute = ({ site }) => new Response(loadContent().sample
  ? 'User-agent: *\nDisallow: /\n'
  : `User-agent: *\nAllow: /\nDisallow: /resume/\nDisallow: /downloads/\nSitemap: ${new URL('/sitemap.xml', site).href}\n`, { headers: { 'Content-Type': 'text/plain' } });
