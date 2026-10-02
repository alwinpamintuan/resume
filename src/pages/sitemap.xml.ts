import type { APIRoute } from 'astro';
import { loadContent } from '../lib/content';
export const GET: APIRoute = ({ site }) => {
  const content = loadContent();
  const paths = content.sample ? [] : ['/', ...content.work.filter((work) => work.visible && work.slug).map((work) => `/${work.slug}/`)];
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${paths.map((path) => `<url><loc>${new URL(path, site).href}</loc></url>`).join('')}</urlset>`, { headers: { 'Content-Type': 'application/xml' } });
};
