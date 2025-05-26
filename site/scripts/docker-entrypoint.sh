#!/bin/sh

API_FILE_PATH=./src/data/api.js

echo "[entrypoint] Replacing the API URL with the given HOST_PROTOCOL and HOST_URL"
echo "[entrypoint] >>> HOST_URL=$HOST_URL"
echo "[entrypoint] >>> HOST_PROTOCOL=$HOST_PROTOCOL"
echo "[entrypoint] >>> $HOST_PROTOCOL://$HOST_URL/api"
sed -i -e "s#\"/api\"#\"$HOST_PROTOCOL://$HOST_URL/api\"#g" $API_FILE_PATH

echo "[entrypoint] Running bundle"
npm run bundle

echo "[entrypoint] Running serve"
exec "$@"
