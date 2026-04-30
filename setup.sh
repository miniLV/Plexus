#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

if [[ -f "$HOME/.nvm/nvm.sh" ]]; then
  # shellcheck source=/dev/null
  source "$HOME/.nvm/nvm.sh"
  nvm use >/dev/null
fi

npm ci
npm run build --workspace=@plexus/core
npm run build --workspace=@plexus/web

cat <<'MSG'

Plexus is ready.
Run `npm run dev` and open http://localhost:7777.
MSG
