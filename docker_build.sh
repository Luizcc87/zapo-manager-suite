#!/bin/sh

# Habilita o Docker Buildx
echo "=== Configurando Docker Buildx ==="
docker buildx create --use --name zapo-builder 2>/dev/null || docker buildx use zapo-builder

# Executa o build multi-arquitetura a partir da raiz do repositório
echo "=== Iniciando compilação multi-arch (linux/amd64, linux/arm64) ==="
# NOTA: Altere 'zapo-manager:latest' para a tag do seu Docker Registry (ex: 'seu-usuario/zapo-manager:latest')
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -t zapo-manager:latest \
  -f zapo-manager/Dockerfile \
  --push \
  .

echo "=== Compilação e Push finalizados com sucesso! ==="
