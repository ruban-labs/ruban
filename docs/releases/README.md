# Release records

Publication records describe what was actually delivered and verified. Keep
website deployments separate from App releases; a website build does not prove
that an APK, AAB or IPA was built, installed or distributed.

## Website

- [Hosting and publication guide](site-hosting.md)
- [2026-09-24: production website moved to mobile-site](2026-09-24-site-production.md)

For each publication, record the environment, source revision, hosting repository,
build and deployment run links, live verification, recovery baseline, and any
unverified work. Never include credentials, private local paths or internal
approval records. `deployment.json` identifies the currently served artifact;
dated records retain the history after that receipt changes.

## App

See [Gongshu release engineering](../release-engineering.md) for App identities,
signing, build modes and native verification.
