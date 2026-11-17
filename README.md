# John Alwin Pamintuan — Résumé

[![Validate and deploy](https://github.com/alwinpamintuan/resume/actions/workflows/deploy.yml/badge.svg)](https://github.com/alwinpamintuan/resume/actions/workflows/deploy.yml)

**Engineering dependable data.**

My personal résumé: experience, technical skills, certifications, and education. Built with Astro and TypeScript, with a visual language shared with the [Projects hub](https://alwinpamintuan.github.io/): warm paper, charcoal dark mode, readable Inter typography, IBM Plex Mono metadata, and fine rules.

**[View résumé](https://alwinpamintuan.github.io/resume/)** · [Download PDF](https://alwinpamintuan.github.io/resume/downloads/Resume_JohnAlwinPamintuan_DataEngineer.pdf) · [Download Word](https://alwinpamintuan.github.io/resume/downloads/Resume_JohnAlwinPamintuan_DataEngineer.docx)

## Features

- Career content maintained in a single validated YAML file.
- Light and dark themes, keyboard navigation, and a usable fallback without JavaScript.
- PDF, Word, and print views generated from the same content model.
- Responsive static pages deployed to GitHub Pages without a runtime server.
- Optional project showcases and skills linked to explicit achievement evidence.
- No analytics, tracking, or external runtime services.

## Local development

Use Node.js 24 and npm. The supported Node version is recorded in `.nvmrc`.

```sh
npm ci
npx playwright install chromium
npm run dev
```

Open the development URL printed by Astro with `/resume/` appended. On Linux, use `npx playwright install --with-deps chromium` to install browser system dependencies too.

For a complete production preview, including downloads:

```sh
npm run build
npm run preview
```

## Editing content

Update [src/content/resume.yml](src/content/resume.yml) to edit career details, credentials, education, and section order. Education honors are a separate `honors` field. The website and résumé downloads use the same content; rebuild after changes.

Keep facts verifiable. Fictional examples belong in [tests/fixtures/resume.yml](tests/fixtures/resume.yml), which is built separately for browser checks.

See the [content and maintenance guide](docs/content-guide.md) for the complete schema, optional project pages, export profiles, and troubleshooting.

## Verification

```sh
npm run build
npm test
npm run audit
```

The build includes Astro, TypeScript, and YAML checks, then creates the static site and résumé exports. `npm test` runs the functional suite (also available as `npm run test:e2e`), including real CLI validation, browser interactions, and downloaded PDF/Word content. Sample and visibility builds generate their own documents without changing `dist/`. Browser tests check accessibility, routes, assets, keyboard behavior, themes, responsive usability, and print content. Lighthouse checks performance, accessibility, best practices, and SEO.

Browser tests use port 4322. Stop any preview using that port before running them. Generated output (`dist/`), reports, and temporary files are excluded from Git. Screenshots are captured only on failure.

## Project structure

| Path | Purpose |
| --- | --- |
| `src/content/resume.yml` | Career content and export profiles |
| `src/lib/` | Content validation, shared document model, and URL helper |
| `src/components/` | Accessible controls, skill evidence, and document rendering |
| `src/pages/` | Homepage, print view, optional showcases, and metadata |
| `src/styles/global.css` | Screen, theme, responsive, and print styles |
| `scripts/` | Validation, export generation, fixture server, and audits |
| `tests/` | Functional CLI, browser, and document integration checks |
| `.github/workflows/deploy.yml` | Validation and GitHub Pages deployment |

## Deployment

The site publishes at **https://alwinpamintuan.github.io/resume/**. GitHub Pages uses **GitHub Actions** as its build source.

Pull requests to `main` build this candidate and the Projects hub repository's `main`, record both commit IDs, and run this suite plus the canonical combined-site journey. Only this repository's production artifact is deployed. Pushes to `main` build the site, generate the PDF and Word files, verify the result, and deploy the `dist/` artifact. A manually dispatched run deploys only when run from `main`.

The workflow pins official actions to commit hashes, grants write permissions only to the deploy job, and uses the `github-pages` environment. Dependabot checks npm dependencies and GitHub Actions monthly.

The project base `/resume/` is defined in [src/lib/urls.ts](src/lib/urls.ts) and used by Astro, internal links, metadata, and verification tools. The document view is `/resume/resume/`; downloads are under `/resume/downloads/`. Update the shared base and Astro site origin if moving the deployment.

See [GitHub's custom workflow documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages) for the Pages deployment model.

## Contributions and reuse

For bugs, include the affected URL, browser, and steps to reproduce in an [issue](https://github.com/alwinpamintuan/resume/issues). Pull requests should describe the behavior change and relevant verification.

This is a personal résumé. Replace personal details and credential links before adapting it. No open-source license has been granted for this repository.

## Shared personal site

The companion [Projects hub](https://alwinpamintuan.github.io/) is maintained in `../alwinpamintuan.github.io`. Both sites use self-hosted Inter, IBM Plex Mono, solid paper/charcoal surfaces, and cobalt focus and link colors. Font licenses are in `public/fonts/`.

Mirror `src/styles/site-tokens.css`, `site-chrome.css`, `site-transitions.css`, `src/scripts/site-navigation.ts`, and `src/components/SiteFooter.astro` between repositories. Keep page-specific layout and conventional document/print styles separate.

The sticky header links the owner's name home and provides navigation to populated page sections. Compact screens use a native disclosure menu. Anchor offsets and active-section tracking account for the header and short sections near the document end. The footer contains profile/contact tiles and Back to top. Credential actions align within each grid row. Screen titles use 36px (32px on mobile), with 16px body text and metadata at least 13px. Major sections use 24px/28px vertical padding; the desktop label column is 160px with a 32px gap. Keep conventional document typography independent of the screen scale.

The `personal-site:theme` preference persists across both sites, including migration from `project-index:theme`. Without an explicit preference, follow system changes. Blocked storage permits a choice for the current page. Without JavaScript, system theming and native navigation still work. Reduced motion removes physical feedback and page transitions.

For combined local review, build both repositories and run `npm run preview:both` from the Projects hub. Open [Projects](http://127.0.0.1:4323/) or [Résumé](http://127.0.0.1:4323/resume/). The companion build defaults to `../work/dist`; override it with `COMPANION_DIST`. Use separate Astro dev servers for live editing.

## Test policy

Every test must identify a concrete production failure it prevents. Use real builds, YAML inputs, browser interactions, CLI subprocesses, and generated documents with independent expected results. No unit tests, mocked responses/browser APIs, cosmetic CSS assertions, DOM-fabricated scenarios, or copy snapshots. External URLs are native-link contracts; third-party availability is outside CI. Accessibility and functional reflow remain build gates.

Build both repositories, then run `npm run test:integration` here to delegate to the hub's canonical journey. The default hub checkout is `../alwinpamintuan.github.io`; set `HUB_DIR` if it is elsewhere. `COMPANION_DIST` defaults to this repository's `dist/`. Missing or outdated checkouts/builds fail instead of skipping. Both workflows run this journey before deployment. Merge the hub integration command before the résumé workflow change.