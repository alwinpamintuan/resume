/** GitHub Pages project path, shared by Astro and local verification tools. */
export const siteBase = '/resume/';
export const sitePath = (path = ''): string => `${siteBase}${path.replace(/^\/+/, '')}`;
