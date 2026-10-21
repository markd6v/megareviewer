#!/usr/bin/env bash
# Refreshes the .wasm files in this folder: each grammar from its pinned GitHub release, and the
# runtime from the installed web-tree-sitter. Prints the SHA-256 lines for PROVENANCE.md.
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
root="$(cd "$here/../../../.." && pwd)"

# language, repository, release tag, release asset
grammars=(
  "typescript tree-sitter/tree-sitter-typescript v0.23.2 tree-sitter-typescript.wasm"
  "tsx tree-sitter/tree-sitter-typescript v0.23.2 tree-sitter-tsx.wasm"
  "javascript tree-sitter/tree-sitter-javascript v0.25.0 tree-sitter-javascript.wasm"
  "python tree-sitter/tree-sitter-python v0.25.0 tree-sitter-python.wasm"
  "go tree-sitter/tree-sitter-go v0.25.0 tree-sitter-go.wasm"
  "java tree-sitter/tree-sitter-java v0.23.5 tree-sitter-java.wasm"
  "rust tree-sitter/tree-sitter-rust v0.24.2 tree-sitter-rust.wasm"
  "c_sharp tree-sitter/tree-sitter-c-sharp v0.23.5 tree-sitter-c_sharp.wasm"
)

for entry in "${grammars[@]}"; do
  read -r language repository tag asset <<<"$entry"
  curl --fail --silent --show-error --location \
    --output "$here/tree-sitter-$language.wasm" \
    "https://github.com/$repository/releases/download/$tag/$asset"
done

cp "$root/node_modules/web-tree-sitter/web-tree-sitter.wasm" "$here/web-tree-sitter.wasm"

cd "$here"
shasum -a 256 -- *.wasm
