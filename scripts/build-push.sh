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
ZAPO_JS_VERSION="$(
  awk '
    /"node_modules\/zapo-js":/ { found=1; next }
    found && /"version":/ {
      gsub(/[",]/, "", $2);
      print $2;
      exit
    }
  ' backend/package-lock.json
)"

if [ -z "$ZAPO_JS_VERSION" ]; then
  echo "[build-push] Could not resolve zapo-js version from backend/package-lock.json" >&2
  exit 1
fi

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
