# @workshops.de/slidev-toolkit

Shared build, dev and deploy tooling for the workshops.de Slidev slide repositories. Slide repositories
depend on this package instead of maintaining their own build scripts, deploy workflow and core
dependencies (Slidev, Playwright, TypeScript, Vue). A fix or dependency update happens here once and
reaches every repository with one version bump.

## What it provides

- **`workshop-slides` CLI**
  - `workshop-slides build [--base /<repo>] [--no-pdf]`: builds every deck into `dist/`, exports a PDF
    per deck and makes deep links like `/<deck>/presenter/1` work on GitHub Pages.
  - `workshop-slides dev [<lesson-number>|all]`: starts the Slidev dev server (interactive menu without
    an argument).
  - `workshop-slides install-browser`: installs the Chromium version that matches the bundled
    Playwright (npm 11 does not run Playwright's own install script).
- **Pinned core dependencies:** `@slidev/cli`, `playwright-chromium`, `typescript` (6, required by
  Slidev's Twoslash setup) and `vue`.
- **Reusable deploy workflow:** `.github/workflows/deploy.yml`, called from each slide repository.

Two repository layouts are detected automatically:

| Layout      | Detected by                                                    | Output                                          |
| ----------- | -------------------------------------------------------------- | ----------------------------------------------- |
| Multi-deck  | `lessons/<NN-name>/*.md` with `base:` and `out:` in headmatter | `dist/<deck>/`, root `index.html` + `404.html`  |
| Single-deck | `slides.md` in the repository root                             | `dist/` (Slidev's own `404.html`)               |

## Using it in a slide repository

`package.json`: only the toolkit, the theme and the addons the decks use:

```json
{
  "scripts": {
    "dev": "workshop-slides dev",
    "build": "workshop-slides build",
    "export": "slidev export"
  },
  "dependencies": {
    "@workshops.de/slidev-theme": "2.1.0",
    "slidev-addon-tldraw": "^0.5.1",
    "slidev-addon-window-mockup": "0.3.1"
  },
  "devDependencies": {
    "@workshops.de/slidev-toolkit": "^1.0.0"
  }
}
```

`.nvmrc`: `v24`

`.github/workflows/deploy.yml`:

```yaml
name: Deploy pages

on:
  workflow_dispatch:
  push:
    branches: [main]

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  deploy:
    uses: workshops-de/slidev-toolkit/.github/workflows/deploy.yml@v1
```

Then set **Settings → Pages → Source → GitHub Actions** once per repository.

## Releasing

1. Bump `version` in `package.json` and commit.
2. Push a tag `vX.Y.Z`. The release workflow publishes to npm (secret `NPM_TOKEN`) and moves the
   major tag (`v1`) that slide repositories use for the reusable workflow.
3. Dependabot in the slide repositories picks up the new version.

Breaking changes (a new Slidev major that needs content changes, a changed CLI) get a new major version,
so repositories move over deliberately.
