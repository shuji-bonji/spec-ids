# Changelog

## 0.2.0 — 2026-09-24

仕様 PR（`specs/changes/` だけ）と実装 PR（テスト・実装・`specs/current/` への取り込み）を分ける運用で、仕様 PR をマージした後の main が RED にならないようにした。

- `check` の突き合わせの集合を変えた（互換性の無い変更）
  - テストに無い ID: `specs/current/` の見出しだけを見る。`specs/changes/` にだけある ID にはテストを求めない
  - 仕様に無い ID: テストの ID を、`specs/current/` と `specs/changes/` の見出しの和と比べる
  - 見出しの重複: current の中と changes の中を別々に見る。current と changes のあいだは見ない（`MODIFIED` の差分は current と同じ ID の見出しを持つ）
  - 仕様の ID は見出しだけを数える。0.1.0 は本文の参照（`SPEC-…` の文字列）も仕様の ID として数えていた
- `check()` の戻り値の `counts` を `{ currentFiles, currentHeadings, changesFiles, changesHeadings, testFiles, testIds }` に変えた。`duplicated[]` の要素に `box`（`current` / `changes`）を足した
- 出力の 1 行目・2 行目の形を変えた（`current: N files, N IDs / changes: N files, N IDs`）
- `next` は変えていない（current と changes の見出しの最大番号 +1）

## 0.1.0 — 2026-09-24

- 初版。houki-nta-mcp の `scripts/spec-id-format.mjs` / `check-spec-ids.mjs` / `next-spec-id.mjs` を CLI にまとめた
- `spec-ids check`: 見出しの重複 / 仕様にあってテストに無い ID / テストにあって仕様に無い ID / 見出しの機能とディレクトリ名の不一致、のどれかで exit 1
- `spec-ids next`: その機能の最大番号 +1
- `spec-ids init`: `specs/` の置き場、`specs/spec-ids.json`、`spec-gate.yml` を作る
- 設定に出すのは `domain` / `dirPrefix` / `tests` だけ。ID の形式と `specs/` の構造は固定
