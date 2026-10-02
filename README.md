# Alwin Pamintuan — Résumé Portfolio

A static résumé and project showcase built with Astro and TypeScript. Edit YAML to update career content, generate PDF and Word résumés, and add project pages. Production output runs on GitHub Pages without a server.

> The initial content is fictional. `sample: true` displays notices and disables search indexing. Replace the sample career details, metrics, education, contact information, and project descriptions before using the site for applications.

## Contents

- [Requirements](#requirements)
- [Quick start](#quick-start)
- [Commands](#commands)
- [Files](#files)
- [Editing content](#editing-content)
- [Adding projects](#adding-projects)
- [Résumé exports](#résumé-exports)
- [TypeScript guide](#typescript-guide)
- [Validation and verification](#validation-and-verification)
- [GitHub Pages deployment](#github-pages-deployment)
- [Independent app repositories](#independent-app-repositories)
- [Custom domains](#custom-domains)
- [Troubleshooting](#troubleshooting)
- [Maintenance](#maintenance)

## Requirements

- Node.js **24 LTS** and npm. `.nvmrc` records the supported major version.
- Git to publish the source repository.
- Playwright Chromium for PDF generation and browser checks.

On Linux, install the browser's system dependencies with `npx playwright install --with-deps chromium`. On Windows and macOS, use `npx playwright install chromium`.

## Quick start

From the repository directory:

```sh
npm ci
npx playwright install chromium
npm run dev
```

Open the URL printed by Astro, normally `http://localhost:4321`. YAML and template edits refresh the development site. Downloadable files are produced by a complete build, not by the development server.

To preview the complete site, including downloads:

```sh
npm test
npm run build
npm run preview
```

If Astro cannot write its telemetry configuration in a restricted environment, disable telemetry for the terminal session:

```powershell
$env:ASTRO_TELEMETRY_DISABLED = '1'
```

For bash or zsh: `export ASTRO_TELEMETRY_DISABLED=1`.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the development server. |
| `npm run check` | Check Astro and TypeScript, validate YAML and screenshot paths. |
| `npm test` | Run content validation and document-model tests. |
| `npm run build` | Validate, build HTML/assets, and generate all résumé profiles. |
| `npm run build:site` | Generate the site only; downloads are not produced. |
| `npm run export` | Generate all documents against an existing site build. |
| `npm run export -- --profile=platform` | Generate a single profile against an existing site build. |
| `npm run preview` | Serve the production build locally. |
| `npm run test:e2e` | Check routes, accessibility, responsive layouts, and documents; requires a complete build. |
| `npm run audit` | Run Lighthouse and check the compressed JavaScript budget; requires a complete build. |

`npm run build` fails if a document export fails. Deploy only after it completes successfully. Exporting alone after a content edit does not update site HTML; use a complete build to keep everything synchronized.

## Files

```text
src/
  content/resume.yml       Résumé, work entries, labels, and export profiles
  lib/content.ts          Validation, inferred types, and document model
  components/             Pipeline diagram and conventional résumé
  layouts/                Shared page wrapper and metadata
  pages/                  Homepage, résumé, showcases, 404, sitemap, robots
  styles/global.css       Screen, responsive, and print styles
public/
  favicon.svg
  images/                 Project screenshots and illustrations
scripts/                  Content checks, export generation, local audits
tests/                    Content tests and browser verification
.github/workflows/        Validation and Pages deployment
dist/                     Generated website and downloads; ignored by Git
work/                     Screenshots and audit reports; ignored by Git
```

`dist`, `work`, `node_modules`, and `.astro` are generated directories. Do not edit or commit them.

## Editing content

Edit `src/content/resume.yml`. Use spaces for indentation, quote dates and numeric-only display strings (for example `value: "18"`), and use YAML block scalars (`>-`) for long paragraphs. Do not include HTML in text fields. Content is rendered as text.

### Top-level fields

| Field | Contents |
| --- | --- |
| `sample` | Required boolean; controls sample notices and indexing. |
| `profile` | Required name, title, summary, email, document filename, and optional location/links. |
| `sections` | Required ordered list of section IDs, labels, and optional visibility. |
| `impact` | Optional prominent results: `id`, `value`, `label`, `context`. |
| `experience` | Optional employers, nested roles, scope, and achievement bullets. |
| `work` | Optional work/project entries, placement, links, and showcase details. |
| `expertise` | Optional groups: `area` and nonempty `tools` list. |
| `principles` | Optional entries: `title` and `description`. |
| `education` | Optional entries: `institution`, `qualification`, `year`. |
| `exports` | Required default profile ID and nonempty profile list. |

Empty optional sections disappear. Optional collections default to empty lists.

### Profile and links

```yaml
profile:
  name: Your Name
  title: Data Engineer
  summary: A specific introduction to your work.
  email: you@example.com
  location: Your location or working preference
  documentName: your-name-resume
  links:
    - label: GitHub
      url: https://github.com/your-account
```

`documentName` uses lowercase letters, numbers, and hyphens and begins with a letter. Do not include an extension. Links must use HTTP or HTTPS. Add only public contact details you want published; every field in this YAML is source content, not secret storage.

### Sections and order

Supported IDs are `experience`, `selected`, `other`, `expertise`, `principles`, and `education`. Labels are editable, IDs are stable. Reorder the list to reorder the homepage sections; the exported résumé retains conventional heading order.

```yaml
sections:
  - { id: experience, label: Experience }
  - { id: selected, label: Selected Work }
  - { id: other, label: More Projects, visible: false }
  - { id: expertise, label: Expertise }
  - { id: education, label: Education }
```

Omitting a section or setting `visible: false` removes it from the homepage. For experience, selected work, expertise, and education, it also removes that section from the résumé documents. Hiding a work category does not remove its individual showcase pages; set each entry's `visible: false` to remove its route.

### Employment and promotions

Keep roles within an employer, newest first. Use `YYYY-MM` dates and `Present` for an ongoing role. Each role requires a title, start/end, and scope. Highlights contain an ID and text.

```yaml
experience:
  - id: employer-one
    company: Example Employer
    location: Remote
    roles:
      - title: Senior Data Engineer
        start: "2026-09"
        end: Present
        scope: Own ingestion reliability and delivery standards.
        highlights:
          - id: ingestion-ownership
            text: An accurate, specific achievement and its outcome.
      - title: Data Engineer
        start: "2023-06"
        end: "2026-08"
        scope: Built production ingestion and transformation workflows.
        highlights: []
```

IDs must be unique across employers, achievements, work entries, and impact highlights. Keep them stable because export profiles and section links reference them. When removing or renaming an achievement, update every export profile that references it.

## Adding projects

### A local showcase page

Append an entry to `work`. A local `slug` creates `/<slug>/` automatically during the build; no page template edit is required.

```yaml
- id: pipeline-inspector
  title: Pipeline Inspector
  summary: A concise description of the problem the tool solves.
  placement: other
  type: Independent tool
  year: "2026"
  slug: pipeline-inspector
  visible: true
  technologies: [TypeScript, SQL]
  source: https://github.com/your-account/pipeline-inspector
  demo: https://your-account.github.io/pipeline-inspector-app/
  details:
    problem: Describe the problem.
    contribution: Describe your specific contribution.
    tradeoff: Explain one consequential choice.
    outcome: Describe the result without inventing claims.
    screenshot:
      src: /images/pipeline-inspector.webp
      alt: Describe the important content of this screenshot.
```

- Use `placement: selected` for professionally relevant work and `placement: other` for More Projects. The field controls categorization; it does not alter the entry's route.
- Local showcases require all four detail paragraphs. Screenshots and pipelines are optional.
- Put screenshots under `public/images/`; reference them using `/images/...`. Supply meaningful alt text. The image is displayed at its intrinsic aspect ratio; use a landscape image when possible.
- Slugs start with a letter and contain lowercase letters, digits, and hyphens. Do not use an existing slug or infrastructure names such as `resume`, `downloads`, `images`, `404`, `assets`, or `robots`.
- The sequence in YAML controls display order within each category.

Optional pipeline illustration:

```yaml
pipeline:
  label: From source to trusted data
  nodes: [Source systems, Validated ingestion, Trusted warehouse]
  caption: Explain how the stages relate and what you contributed.
```

The reusable pipeline currently supports exactly three stages. Keep labels short. For a larger architecture, supply an accessible screenshot/diagram or extend the component and schema together.

### A link to an independent application

Use `destination` instead of `slug` when a separate repository or service owns the destination:

```yaml
- id: quality-tool
  title: Quality Tool
  summary: Check a dataset against explicit quality expectations.
  placement: other
  type: Browser tool
  year: "2026"
  technologies: [TypeScript]
  destination: https://alwinpamintuan.github.io/quality-tool/
```

Never specify both `slug` and `destination`. A local showcase may link to a separate application using `demo`, but its own slug must differ from the app's deployment path.

### Hiding or removing work

Set `visible: false` to remove the entry and any generated showcase page. Remove its ID from export profiles first if referenced. Delete the entry to remove it permanently. Remove unused images manually after checking other references.

Work without a slug or destination is displayed as an unlinked summary, suitable for production work that cannot be shared publicly.

## Résumé exports

The root page and `/resume/` print a conventional single-column résumé. PDF and DOCX generation uses the same validated content and document model. The public page links only to the default profile.

```yaml
exports:
  default: general
  profiles:
    - id: general
      label: Data Engineering
      highlightIds: [ingestion-ownership]
      workIds: [reliable-ingestion]
    - id: platform
      label: Data Platform Engineering
      highlightIds: [ingestion-ownership]
      workIds: []
```

- `highlightIds` selects achievement bullets and their order within each role. Role titles, dates, and scopes remain present.
- `workIds` selects and orders work included in the document. References must point to visible entries with `placement: selected`.
- Other projects, impact tiles, and working principles are omitted from documents.
- The default profile creates `dist/downloads/<documentName>.pdf` and `.docx`.
- Additional profiles create `<documentName>-<profileId>.pdf` and `.docx` in the same folder. They are not linked from the interface but **are public if deployed**. Do not put confidential information in them.
- A4 is the default paper size. PDF margins are controlled by `@page` in the stylesheet; DOCX dimensions/margins are in `scripts/export.ts`.
- The exporter starts and shuts down its own local server. No external PDF service is used.

Check each document after content changes: page breaks, contact details, text selection, and copy/paste order. For applications, use the employer's requested file format and verify any autofilled fields. Readable formatting does not guarantee compatibility with every recruitment system.

## TypeScript guide

`src/lib/content.ts` defines the Zod schema. `Resume`, `Work`, and `ExportProfile` are inferred from it with `z.infer`; there is no separate interface to keep synchronized with YAML validation.

Astro components declare `interface Props` to describe incoming data. `.ts` modules and build scripts use strict checking, including `noUncheckedIndexedAccess`, which requires handling potentially missing array elements.

To add a content field:

1. Add the field to the Zod schema; make it optional if old content should still work.
2. Add an example to the YAML file.
3. Render it in the relevant component. For document content, update `resumeBlocks` so the print view and Word exporter receive it together.
4. Add a validation test if the field introduces a constraint.
5. Run `npm run check`, `npm test`, and `npm run build`; update this field reference.

Use `.astro` for markup/layout and `.ts` for shared logic. Avoid `any`; infer validated content types or define a small explicit type for an interface. TypeScript is pinned to the 6.0 series supported by the installed Astro checker.

## Validation and verification

```sh
npm run check
npm test
npm run build
npm run test:e2e
npm run audit
```

Browser checks use port **4322** and start their own static test server, independently of Astro preview. Close another server using that port before running them. Tests check generated pages, links, anchors, accessibility, downloads, PDF text, Word structure, mobile/tablet/desktop widths, printing, keyboard access, and reduced motion.

Responsive screenshots are written to `work/screenshots/`. Lighthouse reports are written to `work/audits/`. Audit scores target at least 95 in each category; sample mode intentionally affects SEO through `noindex`. The audit excludes that expected SEO effect while sample mode is enabled. Audits are local checks, not a guarantee of every user's field performance.

The automated Word check inspects OOXML structure and content; it does not render Microsoft Word's page layout. Open generated DOCX files in Word or LibreOffice to review pagination after content changes. PDF rendering and text checks are separate from Word layout verification.

Before publication:

- Replace all fictional employers, roles, dates, achievements, metrics, education, and projects.
- Replace the sample email and generic LinkedIn URL.
- Remove or replace sample illustrations and their captions.
- Verify titles/dates against your LinkedIn profile and application records.
- Review both résumé formats and all showcase pages.
- Set `sample: false` and rebuild; confirm the sitemap contains public pages.
- Run the verification commands again.

## GitHub Pages deployment

The repository must be named `alwinpamintuan.github.io` under the `alwinpamintuan` account for the root URL `https://alwinpamintuan.github.io/`.

If the local folder is not initialized, create the remote repository in GitHub, then initialize and connect it locally:

```sh
git init -b main
git add .
git commit -m "Add résumé portfolio"
git remote add origin https://github.com/alwinpamintuan/alwinpamintuan.github.io.git
```

If it is already a repository, inspect `git status` and `git remote -v` instead of repeating initialization. Push only when the content is ready to publish:

```sh
git push -u origin main
```

In the GitHub repository, open **Settings → Pages → Build and deployment** and select **GitHub Actions** as the source.

The included workflow validates pull requests. Pushes to `main` and manually dispatched runs on `main` validate, build, generate documents, run browser tests, upload `dist`, and deploy it. Review progress in **Actions**. The deployment job uses the `github-pages` environment and the minimal Pages/token permissions.

The main site uses `site: 'https://alwinpamintuan.github.io'`, no subpath base, and trailing-slash page URLs. GitHub Pages handles static files; no Node process is deployed. A build failure prevents deployment.

Sample mode is not a publication block: a push to `main` will deploy marked sample content if `sample: true` remains set. `noindex` is a search instruction, not access control.

## Independent app repositories

GitHub supports one user site per account and one Pages project site per repository. A repository named `quality-tool` can publish at `https://alwinpamintuan.github.io/quality-tool/` independently of this résumé repository.

For an Astro app in that separate repository:

```ts
import type { AstroUserConfig } from 'astro';

export default {
  site: 'https://alwinpamintuan.github.io',
  base: '/quality-tool',
  output: 'static',
  trailingSlash: 'always',
} satisfies AstroUserConfig;
```

Configure that app's internal links, assets, and router for `/quality-tool/`; use `import.meta.env.BASE_URL` when constructing internal URLs. Give it its own workflow and Pages setup. The root portfolio templates use root-relative paths and must be adapted if copied into a project-site repository.

Add a `destination` entry here pointing to the deployed app. Do not create a local `quality-tool` showcase slug at the same path. If you want both a description page and app, use different paths, for example `/quality-tool-overview/` and `/quality-tool/`.

Browser-only tools can run on Pages. APIs, databases, secrets, and server-side authentication need a separate service. Never embed a private API key in the static build.

## Custom domains

1. Configure the domain in repository **Settings → Pages** and configure DNS using GitHub's current instructions.
2. Update `site` in `astro.config.ts` to the final HTTPS origin.
3. Update any hardcoded independent-app destinations and rebuild.
4. Verify canonical links, the sitemap, downloads, and every app URL; enable HTTPS once available.

Project sites may inherit the user site's domain. If an app has its own domain, configure it in that repository and adjust its origin/base as appropriate. Follow [GitHub's domain documentation](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/about-custom-domains-and-github-pages).

## Troubleshooting

| Symptom | Action |
| --- | --- |
| Content validation fails | Read the reported YAML field path; check indentation, required fields, IDs, dates, and profile references. |
| Browser executable is missing | Run `npx playwright install chromium` using the same OS account that runs the build. |
| Linux browser dependencies are missing | Run `npx playwright install --with-deps chromium`. |
| Downloads are missing in development | Run a complete build and use `npm run preview`. |
| Export cannot find `/resume/` | Run `npm run build:site` before exporting, or use `npm run build`. |
| Screenshot validation fails | Confirm the file exists under `public/` and the YAML path begins with `/images/`. |
| Work is not shown | Check its visibility, placement, and whether the corresponding section is enabled. |
| Pages returns 404 | Check repository/account spelling, Pages source, Actions logs, and successful deployment. |
| Independent app assets return 404 | Check its base path and asset/link construction in that app's repository. |
| Search engines do not index the site | Replace sample content, set `sample: false`, rebuild, and inspect `robots.txt` and metadata. |
| Browser tests cannot start | Free port 4322 and run a complete build first. |
| Type checker rejects a TypeScript update | Restore the lockfile/pinned version; verify Astro checker compatibility before upgrading. |

## Maintenance

Use `npm ci` for reproducible installation. Commit `package-lock.json` with dependency updates and rerun the verification commands. Generated browser and export tooling is needed only during development/CI.

Review links, résumé facts, downloads, and dependencies periodically. Keep sensitive employment information out of YAML and screenshots. No analytics, cookies, tracking services, or backend are configured.

Useful references: [Astro documentation](https://docs.astro.build/), [Astro GitHub Pages guide](https://docs.astro.build/en/guides/deploy/github/), [GitHub Pages documentation](https://docs.github.com/en/pages), and [Playwright documentation](https://playwright.dev/docs/intro).
