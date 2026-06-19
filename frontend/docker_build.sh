#!/bin/bash
VERSION=$1

docker build -t atendai/evolution-manager-v2:${VERSION} .
docker push atendai/evolution-manager-v2:${VERSION}
