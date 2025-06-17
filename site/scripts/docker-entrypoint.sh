#!/bin/sh

API_FILE_PATH=./src/data/api.ts

echo "[entrypoint] Replacing the API URL with the given HOST_PROTOCOL and HOST_URL"
echo "[entrypoint] >>> HOST_URL=$HOST_URL"
echo "[entrypoint] >>> HOST_PROTOCOL=$HOST_PROTOCOL"
echo "[entrypoint] >>> $HOST_PROTOCOL://$HOST_URL"
VITE_API_URL="$HOST_PROTOCOL://$HOST_URL"
export VITE_API_URL

echo "[entrypoint] Running bundle"
npm run bundle

echo "[entrypoint] Running serve"
exec "$@"
