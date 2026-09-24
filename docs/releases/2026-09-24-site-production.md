# Production website publication — 2026-09-24

Status: **published and verified**. This record covers the website only, not an
App release or a merge of the pending portfolio application work.

## Published artifact

| Field | Value |
| --- | --- |
| Environment | Production |
| Website | <https://mobile.ruban-labs.work/> |
| Source repository | `ruban-labs/ruban` |
| Source branch | `main` |
| Source revision | `cfe146c93dff243011948dcffc960e038ef66908` |
| Hosting repository | [`ruban-labs/mobile-site`](https://github.com/ruban-labs/mobile-site) |
| Pages source | Branch `main`, directory `/` |
| Source build and publication | [Run 36001796939 — succeeded](https://github.com/ruban-labs/ruban/actions/runs/36001796939) |
| Hosting Pages deployment | [Run 36001871794 — succeeded](https://github.com/ruban-labs/mobile-site/actions/runs/36001871794) |
| Live artifact receipt | <https://mobile.ruban-labs.work/deployment.json> |

The website patch from `a299a36c4344c8c69c6659f71b45abb098f38007` was promoted
independently onto `main`. The 22-file patch retained the same stable patch ID;
no `apps/` or `packages/` changes were included. The application development
branch and its uncommitted work were left intact.

The source workflow built on standard Ubuntu and published only the generated
site. Its success was followed by a separate successful Pages deployment in
the hosting repository.

## Final hosting state

- `mobile.ruban-labs.work` is bound to `ruban-labs/mobile-site`.
- The old `ruban-labs/ruban` Pages custom domain is unset. The repository and
  previous site were not deleted.
- The production CNAME already pointed to `ruban-labs.github.io`; no production
  DNS change was required.
- Pages reported `built`, an approved certificate and HTTPS enforcement enabled.
- Website source remains in `ruban-labs/ruban/website`; the hosting repository
  contains generated public files, not a second source copy.

## Verification evidence

- All 15 local website deployment and CI path-scope tests passed; the patch
  passed `git diff --check`.
- Both workflow runs linked above completed successfully.
- HTTPS reads succeeded for `/`, `/privacy/`, `/download/`, `/robots.txt`,
  `/deployment.json` and the homepage's generated stylesheet.
- The home, privacy and download responses contained their expected page
  content. The homepage canonical URL was `https://mobile.ruban-labs.work/`.
- Production had no preview `noindex` marker or site-wide `Disallow: /` rule.
- The live receipt matched `environment=production`,
  `repository=ruban-labs/mobile-site`, source revision `cfe146c93dff243011948dcffc960e038ef66908`
  and run ID `36001796939`.

These checks prove the website publication and its HTTP/asset contracts. They
are not a new browser visual review, mobile-device test or App release check.

## Boundaries and follow-up

- The owner explicitly approved proceeding with production while preview
  acceptance remained pending. `mobile-site-preview` was not changed or
  re-verified during this cutover; it needs its own live DNS, Pages and HTTPS
  acceptance check.
- No APK, AAB or IPA was published by this website workflow. Website download
  instructions do not by themselves mean a mobile preview release is available.
- An initial Pages settings API request returned 403 because its scoped token
  omitted Pages and Administration permissions. This was not evidence that the
  GitHub App installation lacked those grants. Final repository bindings and
  live responses, rather than that failed request, are the completion evidence.
- Local credential and approval details remain outside this public record.

## Recovery baseline

Before promotion, source `main` was
`307d948950bea07d807655dfb68f326c0bad640b`. The old site used workflow-based
Pages in `ruban-labs/ruban`, with the production domain and HTTPS enabled.

For a content correction, retain the new hosting workflow and environment
mapping, correct or revert only the affected website content on `main`, and
publish and verify a new artifact. Do not revert the whole cutover commit as
an ordinary content rollback: it also changes the publishing destination.

If the hosting cutover itself must be reversed, obtain an explicit rollback
decision, verify the retained old site, then release the new domain binding and
restore the old one. Preserve both repositories, revisions and publication
history. Recheck HTTPS and public pages; do not promise a zero-downtime switch.

See the [hosting guide](site-hosting.md) and [release index](README.md).
