# Grammar provenance

The `.wasm` files here are downloaded, not built: each grammar is the asset its maintainers attach to the GitHub release below, and the runtime is copied from the pinned `web-tree-sitter` package. `refresh.sh` fetches them again and prints their SHA-256. A test checks every `.wasm` here against this table and the runtime against `node_modules`.

To change a version, edit its line in `refresh.sh`, run it, and paste the hashes here:

```bash
src/adapters/treesitter/grammars/refresh.sh
```

A grammar must load in the pinned `web-tree-sitter` (ABI 13 to 15 for 0.27.1); the parser tests load every one.

| File | Source | Version | License | SHA-256 |
|---|---|---|---|---|
| `tree-sitter-typescript.wasm` | [tree-sitter/tree-sitter-typescript](https://github.com/tree-sitter/tree-sitter-typescript/releases/tag/v0.23.2) | 0.23.2 | MIT | `778025db5a8be0e70f8ccc3671e486dfeddd048c25d9e8a70c26de2e1bf6f97d` |
| `tree-sitter-tsx.wasm` | [tree-sitter/tree-sitter-typescript](https://github.com/tree-sitter/tree-sitter-typescript/releases/tag/v0.23.2) | 0.23.2 | MIT | `79e5da75ea62855a0cd67177685f0164eac87d5f630b3cbe1e0a099751ad30f8` |
| `tree-sitter-javascript.wasm` | [tree-sitter/tree-sitter-javascript](https://github.com/tree-sitter/tree-sitter-javascript/releases/tag/v0.25.0) | 0.25.0 | MIT | `5fb488d0cabb4775a594bab85682de5ad6ce83c0d6ac997a9f82dd084d571240` |
| `tree-sitter-python.wasm` | [tree-sitter/tree-sitter-python](https://github.com/tree-sitter/tree-sitter-python/releases/tag/v0.25.0) | 0.25.0 | MIT | `16108b50df4ee9a30168794252ab55e7c93bfc5765d7fa0aa3e335752c515f47` |
| `tree-sitter-go.wasm` | [tree-sitter/tree-sitter-go](https://github.com/tree-sitter/tree-sitter-go/releases/tag/v0.25.0) | 0.25.0 | MIT | `9504573f352b20be7f2f1911754d710622aedc15afff16d5ed8fb5645681aee7` |
| `tree-sitter-java.wasm` | [tree-sitter/tree-sitter-java](https://github.com/tree-sitter/tree-sitter-java/releases/tag/v0.23.5) | 0.23.5 | MIT | `4fdeac4ca6ca089f06c6f7e562abcac1733cd465728cc7031ebb73c2019122c4` |
| `tree-sitter-rust.wasm` | [tree-sitter/tree-sitter-rust](https://github.com/tree-sitter/tree-sitter-rust/releases/tag/v0.24.2) | 0.24.2 | MIT | `24c89bd9252255e4aebbcbd7d2d308bd92c86dd95a130fdc80efa49577b8d738` |
| `tree-sitter-c_sharp.wasm` | [tree-sitter/tree-sitter-c-sharp](https://github.com/tree-sitter/tree-sitter-c-sharp/releases/tag/v0.23.5) | 0.23.5 | MIT | `6f69e1cae44e1c32c1eccc170dc5a9778fb94ff716f71113fe1f8c4299aa2f40` |
| `web-tree-sitter.wasm` | [web-tree-sitter](https://www.npmjs.com/package/web-tree-sitter/v/0.27.1) (the runtime) | 0.27.1 | MIT | `beca80e44cccbf2299ed4d1e3fa6462a9a6fe818aeebf847547a392227ce4acc` |

The rust 0.24.2 release reports itself as 0.24.1 in its language metadata; the release asset is what's pinned.
