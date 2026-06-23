# Ameer Jamal Portfolio

Angular portfolio site for showcasing projects, experience, CV, and contact details. The production site is deployed to GitHub Pages at https://ameer-jamal.github.io.

## Architecture

- Angular CLI app at the repository root.
- App source lives in `src/app`.
- Static assets live in `src/assets`.
- GitHub project carousel data is loaded from GitHub first, with `src/assets/data/github-highlight-repos.json` as the static fallback.
- `scripts/` and `tests/` are build support for refreshing and validating the GitHub highlights data.

There is no legacy root `index.html` or duplicate static `assets/` app. Angular is the source of truth.

## Local Development

```bash
npm install
npm start
```

Open http://localhost:4200.

## Build

```bash
npm run build
```

The production build is written to `dist/portfolio`.

## Tests

```bash
npm test
```

This runs the Node-based tests for the GitHub highlights loader and refresh helpers.

Angular/Karma tests can be run separately:

```bash
npm run test:angular
```

## Deployment

GitHub Pages deployment is handled by `.github/workflows/deploy.yml`.

On pushes to `main`, the workflow:

1. Installs root Angular dependencies with `npm ci`.
2. Runs the Node test suite.
3. Refreshes the GitHub highlights fallback JSON.
4. Builds the Angular app.
5. Uploads `dist/portfolio/browser` or `dist/portfolio` to GitHub Pages.

GitHub Pages should be configured to use **GitHub Actions** as the source.
