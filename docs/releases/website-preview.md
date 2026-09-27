# Website preview delivery

The public entry is `https://mobile.ruban-labs.work/download/`. It links to mobile
prereleases, not GitHub's stable-only `releases/latest` redirect. The site is static;
publishing a build does not require rebuilding the website or calling an API in a visitor's browser.

## Publish from CI

1. Review and push the intended source revision. Run the normal package, App intent,
   native and website checks before publication.
2. Manually dispatch `mobile-release` on that revision with target
   `android-latest-website` and `publish_website=true`. Other target combinations
   fail before building. Leaving the checkbox off only produces Actions artifacts.
3. The existing signing workflow consumes repository secrets and uses the website
   app-signing key, not the Play upload key. It builds `release-clean`, verifies the
   signing fingerprint, Hermes bytecode and 16 KB native alignment, then exports
   only the APK, `SHA256SUMS` and the allowlisted `release.json` receipt.
4. A separate Ubuntu job with `contents: write` creates a draft tagged
   `mobile-v<version>-b<run_number>` at the workflow SHA and publishes it after all
   assets upload. The release is a prerelease, not a store submission. Existing tags
   are never overwritten. An interrupted upload may leave a draft; inspect it before
   explicitly removing/retrying it or start a fresh build number.
5. Verify the public APK/checksum/download on a compatible real Android device.
   A successful CI build alone does not prove startup or user flows. Compare signing
   fingerprints and version codes before replacing an existing production install.

Standard Ubuntu/macOS runners and existing dependency caches remain unchanged.
Only the Android website publication uses this path; iOS retains its certificate,
provisioning and store/ad-hoc distribution constraints. No private key, shared API
key or raw build/source-map manifest belongs in the public release payload.

## No-key acceptance

- Fresh install: Try example opens the native mock → SQLite → TS projection path.
- Offline relaunch: saved example data is available; no paid API or remote logo requests.
- Refresh with an existing DeBank key: example still uses the mock path and consumes
  zero provider requests. Opening it does not replace that key or real snapshots.
- Repeated/concurrent opening: one watch-only example account, existing selection
  preserved until the example is successfully prepared.
- Real address without key: show cached real data or a Data source prompt, never
  substitute mock balances. Historical mock snapshots on real addresses are hidden.
- Opening or returning to a portfolio, including an uncached real address, only
  reads SQLite. Importing a key does not start synchronization. The user explicitly
  pulls to refresh; removing the key preserves cached balances.
- Key import/removal: native credential storage only; receipts contain status,
  never the key or raw native errors. No secret is accepted through a deep link.
- Nonproduction automation: `ruban-debug://dev/portfolio/demo?runId=<id>` (or
  regression scheme) calls the same typed intent as the UI. Production rejects
  developer deep links. The existing device intent smoke also exercises this path.

The example reserves the all-zero address as a synthetic identity, not an EOA whose
balances we claim to represent. Ordinary address import cannot claim that identity.
It is a watch-only example, not a source of signing keys. The latest app owns the
portfolio product; older sample apps continue exercising their existing compatibility
surfaces and the shared native package contracts.
