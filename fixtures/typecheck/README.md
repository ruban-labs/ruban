# Type-check consumer fixtures (CI matrix layer 2)

Each subdirectory simulates a consumer app pinned to one RN era. Run them with
the driver, never with a bare `npm install` (the library dependency is a
tarball the driver produces first):

```sh
pnpm build                                  # lib/typescript must exist
node scripts/ci/typecheck-matrix.mjs --all
node scripts/ci/typecheck-matrix.mjs --fixture rn-0.66
```

The driver packs `packages/react-native-progress` into `ruban-local.tgz` and
installs it as a real tarball. A `file:` directory dependency would symlink
the monorepo source and let tsc resolve react-native/@types against the
monorepo instead of the era deps, silently invalidating the matrix.

Eras:

- `rn-0.66` - support floor: React 17, `@types/react-native` (RN did not bundle types yet)
- `rn-0.77` - new architecture default boundary: RN-bundled types, React 18
- `rn-latest` - current stable RN / React 19 (version pin bumped during maintenance)

Never add these directories to the pnpm workspace. Installs use plain npm with
`--include=dev` so era type packages survive `NODE_ENV=production` shells, and
`--no-package-lock` because the tarball dependency would churn the lock on
every build while the era dependencies stay exact-pinned.
