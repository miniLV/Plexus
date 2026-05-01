# npm Release

Plexus keeps the product name, but the public npm package name is
`plexus-agent-config` because the unscoped `plexus` package is already taken.
The installed binary is still `plexus`. The first public npm release started at
`0.0.1`; use the current root `package.json` version for future releases.

## Package

Publish one public package:

- `plexus-agent-config`

The CLI package bundles the internal core and web packages. The bundled web
package includes the built Next.js `.next` output so a global install can start
the dashboard without cloning the monorepo.

## Release Commands

```bash
export PATH="$HOME/.nvm/versions/node/v20.19.6/bin:$PATH"
npm run release:npm:dry
```

The dry-run command builds the monorepo, creates the npm tarball, inspects the
published manifest, installs the tarball into a temporary project, then runs:

- `plexus help`
- `plexus detect`
- `plexus start -p <random-port>`
- `curl /` equivalent HTTP check

To publish manually from a logged-in local machine:

```bash
npm login
npm run release:npm
```

The publish command publishes the same verified tarball, checks `latest` on the
npm registry, then installs `plexus-agent-config@latest` in a fresh temporary
project and repeats the CLI/dashboard smoke test.

After publishing, users should be able to run:

```bash
npm install -g plexus-agent-config
plexus
```

For one-off use:

```bash
npx -y plexus-agent-config@latest start
```

## GitHub Actions Publishing

The repo includes `.github/workflows/publish-npm.yml`. It runs on tags matching
`v*.*.*`, uses Node 24 for npm Trusted Publishing support, and calls:

```bash
npm run release:npm
```

Configure npm once:

1. Open `plexus-agent-config` on npmjs.com.
2. Go to **Settings -> Trusted publishing**.
3. Add a GitHub Actions trusted publisher:
   - Organization or user: `miniLV`
   - Repository: `Plexus`
   - Workflow filename: `publish-npm.yml`
   - Environment name: leave empty unless GitHub environments are added later.
4. Keep `id-token: write` in the workflow permissions.

After this, do not add `NPM_TOKEN` to GitHub Secrets for the normal release
path. npm Trusted Publishing uses short-lived OIDC credentials and npm
provenance for GitHub-hosted runners.

The release flow becomes:

```bash
npm run release:patch
```

That script creates and pushes the version tag. If you create a version
commit/tag manually instead, push the tag to trigger the npm workflow. The
GitHub workflow verifies the tarball before publishing and verifies the npm
registry package after publishing.

## Verification Contract

Before publishing, the release path must pass:

```bash
npm run verify
npm run release:npm:dry
```

The release script verifies:

- `plexus help` prints usage.
- `plexus detect` can import `plexus-agent-config-core`.
- `plexus start -p <port>` starts the packaged web dashboard.
- `curl http://localhost:<port>/` returns `200`.
- the tarball contains vendored `core` and `web` packages.
- the published manifest does not depend on unpublished internal packages.
- `prepack`/`postpack` temporary files are cleaned before the script exits.
