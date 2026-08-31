# Ruban Website

The Astro site has two public routes:

- `/` — product overview and App Store support URL
- `/privacy/` — Ruban Mobile privacy policy

Build and validate the static output from the repository root:

```bash
pnpm site:build
pnpm site:check
```

Preview it locally:

```bash
pnpm site:dev
pnpm site:preview
```

The deployable directory is `website/dist`. GitHub Actions publishes that
directory directly to GitHub Pages without a generated branch.

The production canonical URL is `https://mobile.ruban-labs.work`. Configure that
custom domain in the repository's Pages settings after the workflow reaches
`main`; the apex DNS records remain infrastructure configuration and are not
stored in this directory.
