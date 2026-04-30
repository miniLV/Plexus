# Security Policy

Plexus is a local-first tool that reads and writes agent configuration files on
the user's machine. Please treat reports about file writes, path traversal,
secret exposure, or backup/restore behavior as security sensitive.

## Reporting

Open a private security advisory on GitHub if available. If not, open an issue
with a minimal reproduction and redact secrets from all snippets.

## Current Scope

Security-sensitive areas:

- writes outside `~/.config/plexus/`
- symlink handling
- backup and restore
- MCP `env` values
- debug snapshots
- team repository import/pull

## Dependency Audit Note

As of `v0.0.9`, direct high-severity audit findings are cleared by using
current Next.js and Vitest releases. `npm audit` may still report a moderate
PostCSS advisory through Next.js' internal dependency until upstream Next.js
ships a patched internal PostCSS version.
