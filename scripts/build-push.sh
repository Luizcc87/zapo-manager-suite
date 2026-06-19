#!/bin/sh
# Build multi-arch image (linux/amd64 + linux/arm64) and push to Docker Hub.
#
# Usage:
#   bash scripts/build-push.sh           # tag: latest
#   bash scripts/build-push.sh v1.2.0    # tag: v1.2.0 (also tags latest)
#
# Prerequisites:
#   docker buildx create --use   (once per machine)
#   docker login

set -e

IMAGE="lc1868/zapo-manager"
TAG="${1:-latest}"

echo "[build-push] Building $IMAGE:$TAG for linux/amd64 + linux/arm64..."

docker buildx build \
  --platform linux/amd64,linux/arm64 \
  --tag "$IMAGE:$TAG" \
  --push \
  .

if [ "$TAG" != "latest" ]; then
  echo "[build-push] Also tagging as $IMAGE:latest..."
  docker buildx build \
    --platform linux/amd64,linux/arm64 \
    --tag "$IMAGE:latest" \
    --push \
    .
fi

echo "[build-push] Done: https://hub.docker.com/r/$IMAGE/tags"
