#! /bin/bash

# exit on error
set -e # exit when any command fails

# source .bashrc to load nvm and pnpm
. ~/.bashrc

if [ -z "$DATABASE_URL" ]; then
  echo "DATABASE_URL must be set"
  exit 1
fi

# run migrations on startup
pnpm run db-migrate

# start nginx in the background (daemon mode) so Bun can stay in the foreground
nginx -t
nginx -g "daemon on;"

exec node_modules/.bin/next start -p 3000
