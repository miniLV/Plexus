# npm Release

Plexus keeps the product name, but the public npm package name is
`plexus-agent-config` because the unscoped `plexus` package is already taken.
The installed binary is still `plexus`. The first public npm release starts at
`0.0.1`.

## Package

Publish one public package:

- `plexus-agent-config`

The CLI package bundles the internal core and web packages. The bundled web
package includes the built Next.js `.next` output so a global install can start
the dashboard without cloning the monorepo.

## Release Commands

```bash
export PATH="$HOME/.nvm/versions/node/v20.19.6/bin:$PATH"
npm login
npm run publish:npm:dry
npm run publish:npm
```

After publishing:

```bash
npm install -g plexus-agent-config
plexus
```

For one-off use:

```bash
npx plexus-agent-config
```

## Verification

Before publishing, the release path should pass:

```bash
npm run verify
npm pack -w plexus-agent-config
```

The local tarball install smoke test should verify:

- `plexus help` prints usage.
- `plexus detect` can import `plexus-agent-config-core`.
- `plexus start -p <port>` starts the packaged web dashboard.
- `curl http://localhost:<port>/` returns `200`.
