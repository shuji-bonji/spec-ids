# Changelog

## 0.1.0 — 2026-09-24

- 初版。houki-nta-mcp の `scripts/spec-id-format.mjs` / `check-spec-ids.mjs` / `next-spec-id.mjs` を CLI にまとめた
- `spec-ids check`: 見出しの重複 / 仕様にあってテストに無い ID / テストにあって仕様に無い ID / 見出しの機能とディレクトリ名の不一致、のどれかで exit 1
- `spec-ids next`: その機能の最大番号 +1
- `spec-ids init`: `specs/` の置き場、`specs/spec-ids.json`、`spec-gate.yml` を作る
- 設定に出すのは `domain` / `dirPrefix` / `tests` だけ。ID の形式と `specs/` の構造は固定
