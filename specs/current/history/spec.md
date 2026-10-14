---
spec_id: SPECIDS
kind: cli
approved: 2026-10-11
pr: 14
---

# 機能: history（機能ごとの承認の履歴の表示）

- 版: current
- 起こした元: v0.4.0 の `bin/spec-ids.mjs`（`history`）、`src/history.mjs`、`src/proposals.mjs`、`test/history.test.mjs`、README の「承認の履歴 `spec-ids history`」「終了コード」
- 関連する Issue: spec-ids #5（0.3.0 で追加）、spec-ids #8

この文書は「`spec-ids history` は、機能ごとの承認をどこから集め、どの形で表示するか」を書きます。承認の記録のキーは frontmatter の仕様（SPEC-SPECIDS-FRONTMATTER-012〜019）にあります。

## アクター

- 人。ある機能の仕様が、いつ・どの PR で承認され、どの版で出荷されたかを見る
- Node の API の利用者。`history(root, config, dir)`・`historyAll(root, config)`・`formatHistory(h)` を呼ぶ

## 入力

| 引数・オプション | 必須                   | 内容                                                                   |
| ---------------- | ---------------------- | ---------------------------------------------------------------------- |
| `<dir>`          | `--all` が無ければ必須 | `<dir>`、`<current の置き場>/<dir>`、`<current の置き場>/<dir>/spec.md` のどれか |
| `--all`          | 任意                   | すべての機能を表示する。`<dir>` と一緒には使えない                     |
| `--json`         | 任意                   | 表ではなく JSON で表示する                                             |

読むもの: current の置き場の `<dir>/spec.md` の front matter と、releases・changes の置き場の `proposal.md` の front matter。置き場はレイアウトで決まる（SPEC-SPECIDS-CONFIG-009）。

## できること

### SPEC-SPECIDS-HISTORY-001 初版と、targets にその機能を含む差分の承認を、表にして表示する

1 つの機能について、current の `spec.md` の初版の承認（`approved`・`pr`）と、`targets` にその `<dir>` を含む差分の承認を集め、次の形で標準出力に出して終了コード 0 で終わる。`targets` にその機能を含まない差分は出さない。

```
<dir>（SPEC-<領域>-<機能>）

| 承認日 | 差分 | PR | 版 |
|---|---|---|---|
| <承認日> | （初版） | #<PR 番号> | - |
| <承認日> | <差分 ID> | #<PR 番号> | <版> |
```

「版」は、`specs/releases/<tag>/` の差分なら `<tag>`。

例: houki-egov-mcp の `get_toc` の形（初版 `2026-09-28`・#50 と、`targets` に `get_toc` を含む取り込み済みの差分 9 件、含まない差分 1 件）では、`get_toc（SPEC-EGOV-GET-TOC）` に続いて、`| 2026-09-28 | （初版） | #50 | - |` から `| 2026-10-03 | 20261003-law-resolution | #95 | v0.18.0 |` までの 10 行を出し、`search_law` だけを対象にした `20261003-search-explain-attachment` は出さない。

### SPEC-SPECIDS-HISTORY-002 <dir> は spec.md のパスやフォルダーのパスでもよい

`<dir>` の代わりに、`specs/current/<dir>/spec.md` や `specs/current/<dir>/` を渡しても、同じ履歴を返す（SPEC-SPECIDS-NEXT-001 と同じ取り出し方）。

例: `get_toc`・`specs/current/get_toc/spec.md`・`specs/current/get_toc/` は同じ履歴。

### SPEC-SPECIDS-HISTORY-003 承認日の順に並べ、同じ日は PR 番号の順

行は承認日の古い順に並べ、承認日が同じ行は PR 番号の小さい順に並べる。差分 ID の並びや、版のフォルダーの並びには依らない。

例: 初版 `2026-09-28`・#50、`a-late`（`2026-10-01`・#20）、`b-early`（`2026-10-01`・#10）、`v0.9.0` の `c-next-day`（`2026-10-02`・#1）は、初版・`b-early`・`a-late`・`c-next-day` の順。

### SPEC-SPECIDS-HISTORY-004 specs/changes の差分は版を changes と出し、approved が空の草案は出さない

`specs/changes/<id>/` の差分で `approved` と `pr` のあるものは、「版」を `changes` として出す。`approved` が空の草案は出さない。

例: 承認済みの草案 `20261009-approved`（`2026-10-09`・#157）は `| 2026-10-09 | 20261009-approved | #157 | changes |`、`approved:` と `pr:` が空の `20261010-draft` は出さない。

### SPEC-SPECIDS-HISTORY-005 introduced_by のある機能は、初版の行の代わりに「<差分 ID>（新設）」の行を出す

current の `spec.md` に `introduced_by` があるときは、初版の行を出さず、その差分の行の「差分」の欄を `<差分 ID>（新設）` にする。

例: `introduced_by: 20261004-db-location` の `cli_status` は、`| 2026-10-05 | 20261004-db-location（新設） | #142 | v0.25.0 |` と `| 2026-10-06 | 20261006-db-failure-paths | #152 | v0.26.0 |` の 2 行。

### SPEC-SPECIDS-HISTORY-006 初版と差分が同じ PR のときは、初版を先に 2 行で出す

初版と差分の承認日と PR 番号が同じときも 1 行にまとめず、初版の行を先に、差分の行を後に出す。

例: 初版と `20260926-processing-flow` がどちらも `2026-09-26`・#63 の `nta_get_bunshokaitou` は、`| 2026-09-26 | （初版） | #63 | - |` と `| 2026-09-26 | 20260926-processing-flow | #63 | v0.21.1 |` の 2 行。

### SPEC-SPECIDS-HISTORY-007 --json は同じ内容を JSON で出す

`--json` を付けると、`{ dir, specId, rows }` の JSON を出す。`rows` の 1 つは `{ kind, approved, change, pr, version }` で、`kind` は `initial`（初版）・`introduced`（新設）・`change`（差分）のどれか、初版の `change` と `version` は `null`。Node の API の `history()` の戻り値と同じ。

例: `get_toc` の `rows` は 10 件で、1 件目は `{ kind: "initial", approved: "2026-09-28", change: null, pr: 50, version: null }`、2 件目は `{ kind: "change", approved: "2026-09-28", change: "20260928-undecided-to-issues", pr: 68, version: "v0.15.2" }`。

### SPEC-SPECIDS-HISTORY-008 --all はすべての機能を <dir> の名前の順に出す

`--all` を付けると、`specs/current/<dir>/spec.md` のあるすべての機能の履歴を、`<dir>` の名前の順に、空行 1 つで区切って出す。`--json` と組み合わせると、機能ごとの履歴の配列を JSON で出す。

例: `get_toc` と `search_law` のリポジトリで `spec-ids history --all` は、`get_toc` の表、空行、`search_law（SPEC-EGOV-SEARCH-LAW）` で始まる表の順。

### SPEC-SPECIDS-HISTORY-009 機能が specs/current/ に無いとき、引数が足りないときは exit 2

`<dir>` の `specs/current/<dir>/spec.md` が無いときは、`specs/current/<dir>/spec.md がありません` を標準エラー出力に出して終了コード 2 で終わる。`<dir>` も `--all` も無いときは、使い方を出して終了コード 2 で終わる。

例: `spec-ids history get_tco`（打ち間違い）は、`get_tco` を含む文を出して終了コード 2。`spec-ids history` も終了コード 2。

### SPEC-SPECIDS-HISTORY-010 ファイルを書かない

`history` はどのファイルも作らず、書き換えない。

例: `spec-ids history get_toc` と `spec-ids history --all --json` を実行した前後で、リポジトリのファイルは同じ。

### SPEC-SPECIDS-HISTORY-011 Node の API として history を公開する

パッケージの入口から `history` を import できる。

例: `import { history } from '@shuji-bonji/spec-ids'` は、`src/history.mjs` の `history` と同じ関数。

### SPEC-SPECIDS-HISTORY-012 openspec レイアウトでは、取り込み済みの差分の「差分」の欄は YYYY-MM-DD- を除いた ID、「版」の欄は YYYY-MM-DD

レイアウトが `openspec` のとき、`openspec/changes/archive/<フォルダー名>/` の差分の行は、「差分」の欄をフォルダー名から先頭の `YYYY-MM-DD-` を除いた ID、「版」の欄をその `YYYY-MM-DD` にする（SPEC-SPECIDS-CONFIG-010）。`YYYY-MM-DD-` で始まらないフォルダーの差分は、「差分」の欄をフォルダー名、「版」の欄を `-` にする。`openspec/changes/<id>/`（草案）の差分は、specs レイアウトと同じく「版」を `changes` にする（SPEC-SPECIDS-HISTORY-004）。`--json` の `version` は、表の「版」の欄と同じ文字列（`YYYY-MM-DD`、`changes`）か、無ければ `null`。並び順は SPEC-SPECIDS-HISTORY-003 と同じ。

例: `openspec/specs/read-text/spec.md`（`approved: 2026-10-20`・`pr: 57`）、`openspec/changes/archive/2026-10-24-add-pages/proposal.md`（`approved: 2026-10-22`・`pr: 58`・`targets: [read-text]`）、`openspec/changes/limit-pages/proposal.md`（`approved: 2026-10-25`・`pr: 60`・`targets: [read-text]`）のリポジトリで `spec-ids history read-text` は、`read-text（SPEC-READER-READ-TEXT）` に続いて `| 2026-10-20 | （初版） | #57 | - |`・`| 2026-10-22 | add-pages | #58 | 2026-10-24 |`・`| 2026-10-25 | limit-pages | #60 | changes |` の 3 行。`--json` の 2 行目は `{ kind: "change", approved: "2026-10-22", change: "add-pages", pr: 58, version: "2026-10-24" }`。

### SPEC-SPECIDS-HISTORY-013 文の中のパスと --all の走査は、レイアウトの置き場に従う

機能が無いときの文（SPEC-SPECIDS-HISTORY-009）のパスは、レイアウトの current の置き場で出す。`--all`（SPEC-SPECIDS-HISTORY-008）が走査するのも、レイアウトの current の置き場。`<dir>` の代わりに渡すパス（SPEC-SPECIDS-HISTORY-002）も、レイアウトの置き場のパスを受け付ける。

例: openspec レイアウトで `spec-ids history read-txt`（打ち間違い）は、`openspec/specs/read-txt/spec.md がありません` を出して終了コード 2。`spec-ids history openspec/specs/read-text/spec.md` は `read-text` と同じ履歴。`--all` は `openspec/specs/` の下の機能だけを `<dir>` の名前の順に出し、`specs/current/` にファイルが残っていても出さない。

## できないこと

- 履歴をファイルに書き出すこと
- 差分が書き換えた仕様 ID の一覧を出すこと（`proposal.md` の front matter だけを読む）
- front matter の形が違う差分を知らせること（その差分は表に出さない。形の検査は `check` の検査 5。SPEC-SPECIDS-CHECK-011）

## 未決

初版起こしで見つけた、意図か不具合かを人が決める項目と、テストが無いため ID を振らなかった項目です。決まったら「できること」に ID を振るか、`specs/changes/` の差分にします。

1. **知らないオプションを黙って無視する。** → 2026-10-11 JST に shuji が不具合と決めた（案 B）。`pr-scope`（SPEC-SPECIDS-PR-SCOPE-006）にそろえ、知らないオプションと値の無いオプションは使い方を出して exit 2 で止める。`next`（未決 2）と `init`（未決 3）も同じ仕様 PR でそろえる。今の振る舞い（同じ日に確かめた）: `--` で始まる引数は `--json` と `--all` のほかはすべて捨てる。`history a --jsno` は表を出して exit 0、`history --al a` は `a` の表を出して exit 0。`-` 1 つの `history a -j` は位置引数とみなして exit 2
2. **`<dir>` と `--all` を両方渡したときの exit 2。** README のとおり終了コード 2 になる（同じ日に確かめた）が、テストが無い
3. **初版の `approved` か `pr` の形が違うときは、初版の行を出さない。** エラーにはせず、ほかの行だけを出す。テストが無い
