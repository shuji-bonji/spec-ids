# 差分: check（openspec レイアウト）

差分 `20261014-openspec-layout` の check の節。取り込みは見出しの単位で `specs/current/check/spec.md` と置き換える。

## 入力

| もの           | 内容                                                                                                          |
| -------------- | ------------------------------------------------------------------------------------------------------------- |
| 設定           | `specs/spec-ids.json` または `openspec/spec-ids.json`（SPEC-SPECIDS-CONFIG-001〜010）。引数とオプションは無い |
| レイアウト     | 設定の場所で決まる（SPEC-SPECIDS-CONFIG-008）。以下の current・changes・差分の置き場は、レイアウトごとに SPEC-SPECIDS-CONFIG-009 の表のパスを指す |
| current        | current の置き場の下の `spec.md`（出荷済みの正）                                                              |
| changes        | changes の置き場の下の `spec.md`（承認済みでも未出荷の差分）                                                  |
| 差分           | changes と releases の置き場の `proposal.md` と、それぞれの `specs/<dir>/spec.md`                             |
| テストファイル | 設定 `tests` の glob に合うファイル（SPEC-SPECIDS-CONFIG-004・005）                                           |

## MODIFIED

### SPEC-SPECIDS-CHECK-001 食い違いが無ければ、レイアウトの行と数えた結果と OK の行を出して exit 0

検査 1〜7 のどれにも当たらなければ、次の 5 行を標準出力に出し、終了コード 0 で終わる。標準エラー出力には何も出さない。

```
layout: <specs または openspec>
current: <current の spec.md の数> files, <current の見出しの ID の数> IDs / changes: <changes の spec.md の数> files, <changes の見出しの ID の数> IDs
proposals: changes <changes の置き場の proposal.md の数>, releases <releases の置き場の proposal.md の数>
tests: <テストファイルの数> files, <テスト名の ID の数> IDs
OK: 仕様 ID とテストが一致しています
```

ID の数は、同じ ID を 1 つと数えた数。1 行目以外は 0.4.0 と同じ形。

例: specs レイアウトで、current に 2 件の見出しの `spec.md` が 1 つ、取り込み済みの差分が 1 つ、その 2 件の ID を名前に書いたテストファイルが 1 つのリポジトリでは、`layout: specs`・`current: 1 files, 2 IDs / changes: 0 files, 0 IDs`・`proposals: changes 0, releases 1`・`tests: 1 files, 2 IDs`・`OK: 仕様 ID とテストが一致しています` を出して終了コード 0。

### SPEC-SPECIDS-CHECK-020 食い違いがあれば、種類ごとに見出しを付けて標準エラー出力に出し、exit 1

検査 1〜7 のどれか 1 件でもあれば、レイアウトの行と数えた結果の 4 行を標準出力に出し（`OK:` の行は出さない）、食い違いを種類ごとに、空行・見出しの行・`  ` で始まる行の順で標準エラー出力に出し、終了コード 1 で終わる。検査 5〜7 の見出しと行は次のとおり。行の中のファイルのパスは、レイアウトの置き場のパスで出す。

| 検査 | 見出しの行                             | 続く行                                             |
| ---- | -------------------------------------- | -------------------------------------------------- |
| 5    | `front matter が無い、または形が違う:` | `  <ファイル>: <理由>`                             |
| 6    | `targets の漏れ:`                      | `  <proposal.md>: <理由>`（理由に `<dir>` が入る） |
| 7    | `古い「- 承認日:」の行が残っている:`   | `  <ファイル>:<行番号>`                            |

例: specs レイアウトで、front matter の無い `specs/current/nta_search_qa/spec.md` の 2 行目に `- 承認日: 2026-09-22（PR #49）` があり、取り込み済みの差分の `specs/nta_search_qa/spec.md` が `targets` に無いリポジトリでは、標準出力は 4 行で、標準エラー出力に 3 つの見出しと、`  specs/current/nta_search_qa/spec.md: …`、`nta_search_qa` を含む `  specs/releases/v1.0.0/20261001-a/proposal.md: …`、`  specs/current/nta_search_qa/spec.md:2` が入る。openspec レイアウトで同じ形なら、パスは `openspec/specs/read-text/spec.md` と `openspec/changes/archive/2026-10-14-add-pages/proposal.md` になる。CLI では終了コード 1。

## ADDED

### SPEC-SPECIDS-CHECK-021 openspec レイアウトでは openspec/specs を current、openspec/changes（archive を除く）を changes、archive を releases として読む

レイアウトが `openspec` のとき、current の見出しは `openspec/specs/<dir>/spec.md` から、changes の見出しは `openspec/changes/<id>/` の下の `spec.md`（`openspec/changes/archive/` の下は除く）から集め、`openspec/changes/archive/<フォルダー名>/` は releases として扱う（見出しは数えず、`proposal.md` の front matter と `specs/<dir>/` の構成だけを見る。SPEC-SPECIDS-CHECK-009 と同じ）。検査 4（SPEC-SPECIDS-CHECK-010）の `<dir>` は `openspec/specs/<dir>` のディレクトリ名。検査 5〜7 の対象は `openspec/specs/<dir>/spec.md`・`openspec/changes/<id>/proposal.md`・`openspec/changes/archive/<フォルダー名>/proposal.md`。

例: `openspec/specs/read-text/spec.md`（front matter 付き、`### Requirement: SPEC-READER-READ-TEXT-001 x`）、`openspec/changes/add-pages/proposal.md`（`targets: [read-text]`）と `openspec/changes/add-pages/specs/read-text/spec.md`（`## ADDED Requirements` に `### Requirement: SPEC-READER-READ-TEXT-002 y`）、`openspec/changes/archive/2026-10-10-first/proposal.md`（`approved`・`pr` あり、`targets: [read-text]`）、テスト名に `SPEC-READER-READ-TEXT-001` があるリポジトリでは、`current: 1 files, 1 IDs / changes: 1 files, 1 IDs`・`proposals: changes 1, releases 1` で通る。`002` はテストに無くても止めない（SPEC-SPECIDS-CHECK-007）。`openspec/specs/read-text/spec.md` の見出しが `### Requirement: SPEC-READER-SEARCH-TEXT-001 x` なら、期待する形 `SPEC-READER-READ-TEXT-###` を付けて止める。

### SPEC-SPECIDS-CHECK-022 openspec レイアウトでは specs/ の下を読まず、specs レイアウトでは openspec/ の下を読まない

レイアウトが `openspec` のとき、`specs/current/`・`specs/changes/`・`specs/releases/` にファイルがあっても読まない。レイアウトが `specs` のとき、`openspec/` の下にファイルがあっても読まない。どちらも数えた結果に入れず、食い違いにもしない。

例: `openspec/spec-ids.json` のリポジトリに `specs/current/old/spec.md`（`### SPEC-READER-OLD-001 x`）が残っていても、`current:` の数に入らず、テストにその ID が無くても止めない。`specs/spec-ids.json` のリポジトリに `openspec/specs/x/spec.md` があっても同じ。

### SPEC-SPECIDS-CHECK-023 specs レイアウトの結果は、1 行目を除いて 0.4.0 と同じ

レイアウトが `specs` のとき、検査 1〜7 で止める ID・ファイル・理由と、数えた結果の 3 行、標準エラー出力の内容、終了コードは 0.4.0 と同じにする。違うのは標準出力の 1 行目 `layout: specs` が増えることだけ。Node の API の `check()` の戻り値は、`layout`（`"specs"` か `"openspec"`）の 1 つが増えること以外は同じ。

例: spec-ids 0.4.0 の `test/check.test.mjs`・`test/check-approval.test.mjs` の fixture をそのまま 0.5.0 に通すと、`counts`・`duplicated`・`missingTests`・`missingSpecs`・`misplaced`・`frontMatter`・`missingTargets`・`legacyLines`・`ok` はすべて同じ値になり、`layout` は `"specs"`。

## できないこと

- テストを実行すること（`npm test` の仕事）
- 番号の欠番を見ること
- 仕様の本文（`ADDED`・`MODIFIED`・`REMOVED` の意味、本文の参照、OpenSpec の `## Purpose`・`#### Scenario:`）を読むこと
- current へ差分を取り込むこと、releases へ写すこと（OpenSpec の `openspec archive` も呼ばない）
- PR が変えてよい範囲を見ること（`pr-scope` の仕事。SPEC-SPECIDS-PR-SCOPE-001〜025）
- 2 つのレイアウトを同時に読むこと（SPEC-SPECIDS-CHECK-022）
