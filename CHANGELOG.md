# Changelog

## 0.3.0 — 2026-10-09

承認の記録を、差分の `proposal.md` と current の `spec.md` の先頭の front matter に 1 か所だけ書く形にした（#5）。差分を取り込むたびに current の `spec.md` の「- 承認日:」の行へ承認を書き足す必要は無くなり、機能ごとの履歴は `spec-ids history` が集めて表示する。設計は `docs/proposals/20261009-approval-front-matter.md`（PR #6）。

### 互換性

- `spec-ids check` は、front matter の無い `specs/current/*/spec.md` と `proposal.md`（`specs/changes/*/` と `specs/releases/*/*/`）を止める（互換性の無い変更）。0.2.0 までの形で書いたリポジトリは、変換するまで 0.3.0 の `check` を通らない
- 0.3.0 の `check` は古い形（本文の「- 承認日:」の行）を受け付けない。古い形の行が残っていても止める（検査 7）
- README の「しないこと」のうち「承認日の有無は見ない」「`specs/releases/` を見ない」は成り立たなくなった。`check` は `proposal.md` の front matter と、`specs/releases/` の差分のフォルダーの構成（差分の `specs/<dir>/`）を読む。本文（`###` の見出し以外）は今までどおり見ない
- `check` の出力は 2 行目に `proposals: changes N, releases N` の行が増える。1・3 行目と、0.2.0 の 4 つの検査の結果とエラーの見出しの文は変わらない
- 変換には `spec-ids migrate` を使う。依存を `^0.3.0` に上げる変更・`migrate --write`・各リポジトリの `check-pr-scope.mjs` の書き換えは、途中のコミットで CI が止まらないよう 1 本の PR で行う

### 足したもの

- front matter の読み取り（`src/frontmatter.mjs`）。YAML のパーサーは使わず、決まった書式（1 行に `キー: 値`、値は空・`YYYY-MM-DD`・正の整数・英数字と `_` `-` の文字列・1 行の配列）だけを読む。依存パッケージは足していない
- Node の API に `readFrontMatter` と `history`・`historyAll`・`formatHistory` を足した
- `spec-ids check` に検査を 3 つ足した
  - 5. front matter の形: front matter が無い、キーが無い・値の形が違う、知らないキーがある、`spec_id` が設定の `domain` と違う、`introduced_by` の差分が無い・その差分の `targets` にこの機能が無い
  - 6. targets の漏れ: 差分の `specs/<dir>/spec.md` があるのに `<dir>` が `targets` に無い。`specs/changes/` の差分で、`targets` の `<dir>` が `specs/current/` にも差分の `specs/` にも無い
  - 7. 古い行の残り: 「- 承認日:」で始まる行がある
- `check()` の戻り値の `counts` に `changesProposals`・`releasesProposals` を、戻り値に `frontMatter[]`・`missingTargets[]`・`legacyLines[]` を足した。既存のキーは変えていない
- `spec-ids history <dir>`（`--json`・`--all`）: 初版と差分の承認を、承認日の順（同じ日は PR 番号の順）に表で表示する。ファイルは書かない。`<dir>` が `specs/current/` に無ければ exit 2
- `spec-ids migrate`（オプションなし・`--json`・`--write`）: 0.2.0 までの形（本文の「- 承認日:」「- 機能 ID:」「- 種類:」「- 実装の変更:」の行）を front matter に変換する。食い違いがあれば exit 1 で終わり、`--write` は食い違いが無いときだけ書き換える。**0.3.0 だけに置く一時的なサブコマンドで、0.4.0 で外す**

### 変えていないもの

- `spec-ids next` の採番、`spec-ids init` が作るもの（`templates/agents-section.md` を含む）、仕様 ID の形式、`specs/` の置き場

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
