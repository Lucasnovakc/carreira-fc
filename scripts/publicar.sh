#!/usr/bin/env bash
# Publica o jogo no GitHub Pages: gera a versão final (dist/) e envia para o branch gh-pages.
# Uso: bash scripts/publicar.sh   (na pasta do projeto, com os testes passando)
set -euo pipefail

cd "$(dirname "$0")/.."
REMOTO=$(git remote get-url origin)

npm test
npm run build
touch dist/.nojekyll

TMP=$(mktemp -d)
cp -r dist/. "$TMP"
cd "$TMP"
git init -q -b gh-pages
git add -A
git -c user.name="$(git -C "$OLDPWD" config user.name)" -c user.email="$(git -C "$OLDPWD" config user.email)" \
  commit -q -m "publicar: $(git -C "$OLDPWD" rev-parse --short HEAD)"
git push -q -f "$REMOTO" gh-pages
cd - >/dev/null
rm -rf "$TMP"
echo "Publicado. Em 1–2 minutos: https://lucasnovakc.github.io/carreira-fc/"
