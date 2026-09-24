# Website hosting: production and preview

The only website source is `ruban-labs/ruban/website`. App and website design
continue to share `design/theme-colors.json` and the approved `brand/` masters.
Hosting repositories contain generated public files, not another source fork.

| Environment | Public hosting repository | Custom domain | Source policy |
| --- | --- | --- | --- |
| Production | `ruban-labs/mobile-site` | `mobile.ruban-labs.work` | `main` only; relevant pushes or manual dispatch |
| Preview | `ruban-labs/mobile-site-preview` | `mobile-preview.ruban-labs.work` | Manual dispatch of a reviewed branch |

`website/site-environment.mjs` owns the environment mapping. Preview is a single
shared staging site, not a separate URL for each PR. Both repositories use `main`
at the root as their Pages publishing source. They need no dependencies, secrets,
or custom Actions workflows. Do not add hand-maintained content there: each
publication replaces the generated tree while preserving Git history.

## One-time setup

1. Create both hosting repositories as **public**. In the organization's GitHub
   App installation settings, allow the existing publishing App to access both.
   Its repository **Contents** permission must be **Read and write**. Selecting a
   repository and granting an App permission are different settings. Pages admin
   access is unnecessary for CI because the owner performs the setup below.
2. In `ruban-labs/ruban`, verify the existing Actions secrets
   `RUBAN_GITHUB_APP_ID` and `RUBAN_GITHUB_APP_PRIVATE_KEY`. Reuse them; never copy
   the private key into either public hosting repository. CI issues an expiring
   installation token scoped to exactly one destination with `contents: write`.
3. Create the `website-production` and `website-preview` environments in the
   source repository. Restrict production deployment branches to `main`; require
   an owner reviewer for production if desired. Preview dispatches must use
   trusted, reviewed branches because repository workflows can consume secrets.
4. After the workflow change is reviewed and available, manually run **pages**
   with `environment=preview` and select the intended source branch. The default
   is preview. Publication initializes the empty destination's `main` branch.
   The workflow must exist on the default branch for normal UI dispatch discovery.
5. In `mobile-site-preview → Settings → Pages`, choose **Deploy from a branch**,
   **main**, **/(root)**. Do not select GitHub Actions as the source: the source
   repo builds; the hosting repo serves the generated branch. Wait for that repo's
   Pages deployment to complete.
6. Set the preview Custom domain to `mobile-preview.ruban-labs.work`, then add an
   Aliyun DNS **CNAME**, host `mobile-preview`, value `ruban-labs.github.io`.
   Do not include a scheme, slash or repository name in the DNS target. After DNS
   validation and certificate issuance, enable **Enforce HTTPS**.

Settings shortcuts:

- [App installation access](https://github.com/organizations/ruban-labs/settings/installations)
- [Source repository secrets](https://github.com/ruban-labs/ruban/settings/secrets/actions)
- [Source deployment environments](https://github.com/ruban-labs/ruban/settings/environments)
- [Preview Pages](https://github.com/ruban-labs/mobile-site-preview/settings/pages)
- [Production Pages](https://github.com/ruban-labs/mobile-site/settings/pages)

## Move the existing production domain explicitly

The existing live site is bound to Pages in `ruban-labs/ruban`. Do not unpublish
it while preparing these repositories. DNS alone cannot move the domain between
repositories owned by the same organization.

1. Finish preview acceptance first. Merge the reviewed publishing workflow and
   intended production source into `main`, then let its production build publish
   into `mobile-site`. Confirm the generated files and source SHA there before
   switching the domain. Preserve the last known-good source SHA and old Pages
   settings for recovery; do not assume a new production deployment is live yet.
2. During an owner-approved cutover, remove only the Custom domain binding from
   the old Ruban Pages settings and configure `mobile-site` with branch **main**,
   **/(root)** and Custom domain `mobile.ruban-labs.work`. Do not delete the old
   repository or source. The checked-in publishing workflow no longer deploys to
   the old Pages site, so it cannot race to reclaim the domain.
3. The production DNS target remains `ruban-labs.github.io`; keep the existing
   CNAME if it already matches. Wait for the new binding/certificate, enable
   HTTPS, and verify home, privacy, download and CSS URLs. A brief DNS/certificate
   transition is possible; do not promise an atomic or zero-downtime cutover.
4. If cutover fails, preserve both repos and receipts. Diagnose Pages binding,
   DNS and certificate state. An explicit rollback can release the new binding
   and rebind the old site; never automate domain removal during routine builds.

## Routine publication and verification

- Production follows relevant `main` changes; preview is manually selected in
  **Actions → pages → Run workflow → environment: preview**. A production
  dispatch from any non-main branch fails before requesting a publishing token.
- Build runs on standard Ubuntu, installs only website dependencies, checks
  theme drift, site contracts and tests, then uploads the static artifact. It
  never invokes a mobile/native build. A separate job publishes that exact
  artifact; it does not rebuild with secrets present.
- The payload includes `.nojekyll`, the matching `CNAME`, and `deployment.json`
  with an allowlisted environment/source SHA/run ID receipt. Source maps, JS,
  source/config files, arbitrary JSON, hidden directories and symlinks are
  rejected. This is an artifact contract, not a substitute for reviewing public
  page content for secrets or private prompts.
- Source Actions success proves the artifact push, not completion of the hosting
  repo's Pages deployment. Check that deployment separately, then fetch
  `https://<domain>/deployment.json`: `sourceSha`, `environment`, `repository`
  and `url` must match the intended publication. Check `/`, `/privacy/`,
  `/download/`, `robots.txt`, CSS loading, HTTPS and the mobile layout.
- Preview uses its own canonical URLs, `noindex, nofollow`, `Disallow: /`, and a
  compact PREVIEW footer marker. These discourage indexing; they do not provide
  access control. Everything in both hosting repos and sites is public.
- To recover a bad preview, rerun a reviewed branch. To recover production
  content, revert the source change on `main` and publish a new build. Do not
  force-push hosting history or casually select an old feature branch for prod.

Local checks, with no credentials or remote publication:

```bash
RUBAN_SITE_ENV=production pnpm site:check
RUBAN_SITE_ENV=preview pnpm site:check
```

The separate **mobile-release** workflow owns App build and distribution work;
website publishing neither signs nor publishes an App. APK publication is a
separate release decision, not a side effect of deploying either website.

References: [GitHub branch publishing](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site),
[custom domain setup](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site).
