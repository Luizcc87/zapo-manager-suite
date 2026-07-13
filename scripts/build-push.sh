#!/bin/sh
# Build multi-arch image (linux/amd64 + linux/arm64) and push to Docker Hub.
#
# Usage:
#   bash scripts/build-push.sh           # tags: zapo-js-<resolved-version> + latest
#   bash scripts/build-push.sh v1.2.0    # tags: v1.2.0 + latest
#   bash scripts/build-push.sh latest    # tag: latest only
#
# Prerequisites:
#   docker buildx create --use   (once per machine)
#   docker login

set -e

IMAGE="lc1868/zapo-manager"
ZAPO_JS_VERSION="$(node -e "const lock=require('./backend/package-lock.json'); const pkg=require('./backend/package.json'); const version=lock.packages?.['node_modules/zapo-js']?.version || lock.dependencies?.['zapo-js']?.version || (pkg.dependencies?.['zapo-js'] || '').replace(/^[^0-9]*/, ''); if (!version) process.exit(1); process.stdout.write(version);")"
TAG="${1:-zapo-js-$ZAPO_JS_VERSION}"

echo "[build-push] Building $IMAGE:$TAG for linux/amd64 + linux/arm64..."

if [ "$TAG" = "latest" ]; then
  docker buildx build \
    --platform linux/amd64,linux/arm64 \
    --tag "$IMAGE:$TAG" \
    --push \
    .
else
  echo "[build-push] Also tagging same image as $IMAGE:latest..."
  docker buildx build \
    --platform linux/amd64,linux/arm64 \
    --tag "$IMAGE:$TAG" \
    --tag "$IMAGE:latest" \
    --push \
    .
fi

echo "[build-push] Done: https://hub.docker.com/r/$IMAGE/tags"
