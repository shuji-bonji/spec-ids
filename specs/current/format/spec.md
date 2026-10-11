---
spec_id: SPECIDS
kind: common
approved: 2026-10-11
pr: 14
---

# 機能: format（仕様 ID の形と、見出し・テスト名からの拾い方）

- 版: current
- 起こした元: v0.4.0 の `src/format.mjs`、`src/check.mjs`（テスト名から ID を取り出すところ）、`test/format.test.mjs`、`test/check.test.mjs`、README の「仕様 ID の形式」「仕様書の書き方」「テストの書き方」
- 関連する Issue: spec-ids #8（spec-ids 自身の `specs/` の初版起こし）

この文書は、spec-ids のどのサブコマンドにも共通する「仕様 ID とは何か」と「仕様書とテストのどこから ID を拾うか」を書きます。どう実装しているか（正規表現の名前・関数名）は書きません。

## アクター

- 利用側のリポジトリで仕様書（`specs/current/<dir>/spec.md`・`specs/changes/<id>/spec.md`）とテストを書く人とエージェント。仕様 1 件を `###` の見出しに、それを確かめるテストの名前に、同じ仕様 ID を書く
- spec-ids の `check`・`next`・`history`・`pr-scope`。この文書の約束に従って ID を組み立て、拾う

## 入力

| もの                 | 内容                                                                                   |
| -------------------- | -------------------------------------------------------------------------------------- |
| 領域                 | `specs/spec-ids.json` の `domain`（SPEC-SPECIDS-CONFIG-003）                           |
| 機能                 | `specs/current/<dir>/spec.md` のディレクトリ名と、`specs/spec-ids.json` の `dirPrefix` |
| 仕様書の本文         | `###` の見出しの先頭に ID を書く                                                       |
| テストファイルの本文 | `describe`・`it`・`test` の第 1 引数の文字列に ID を書く                               |

## できること

### SPEC-SPECIDS-FORMAT-001 仕様 ID は SPEC-<領域>-<機能>-<3 桁> の形にする

仕様 ID は `SPEC-<領域>-<機能>-<3 桁>` の形にする。領域は英大文字だけ、機能は英大文字・数字・`-`、番号はちょうど 3 桁の数字（`001`〜`999`）。番号は 1 から 3 桁に 0 で埋める。この形は設定では変えられない。

例: 領域 `NTA`・機能 `GET-TSUTATSU`・番号 7 の ID は `SPEC-NTA-GET-TSUTATSU-007` で、分けると領域 `NTA`・機能 `GET-TSUTATSU`・番号 7 に戻る。`SPEC-NTA-001`（機能が無い）、`SPEC-NTA-GET-TSUTATSU-1`（番号が 1 桁）、`SPEC-nta-GET-001`（領域が小文字）、`SPEC-NTA-GET-TSUTATSU-0001`（番号が 4 桁）は仕様 ID ではない。

### SPEC-SPECIDS-FORMAT-002 機能はディレクトリ名から接頭辞を除き、大文字にして \_ を - にする

ID の機能の部分は、`specs/current/<dir>/spec.md` の `<dir>` から、設定 `dirPrefix` の接頭辞を除き、英大文字にして `_` を `-` にしたものとする。`<dir>` が `dirPrefix` で始まらないときは、何も除かない。

例: `dirPrefix` が `nta_` なら、`nta_get_tsutatsu` は `GET-TSUTATSU`、`search_qa` は `SEARCH-QA`。`dirPrefix` が `""` なら `get_law` は `GET-LAW`。spec-ids 自身（`dirPrefix: ""`）の `pr-scope` は `PR-SCOPE`。

### SPEC-SPECIDS-FORMAT-003 仕様書の ID は ### の見出しの先頭にあるものだけを数える

仕様書の中で仕様 ID として数えるのは、`###` で始まる見出しの先頭（`###` と 1 つ以上の空白の直後）に書いた ID だけとする。`##` の見出しの ID、本文の中の ID、見出しの 2 つ目以降の ID は数えない。本文で他の ID を参照してよい。

例: 本文が `## SPEC-NTA-A-001 x`・`### SPEC-NTA-A-002 y`・`本文 SPEC-NTA-A-003`・`###  SPEC-NTA-A-004 z` の 4 行なら、数えるのは `SPEC-NTA-A-002` と `SPEC-NTA-A-004`。`check` で、本文で `SPEC-NTA-GET-TSUTATSU-005` に触れるだけの仕様書は、その ID を持たない（SPEC-SPECIDS-CHECK-008）。

### SPEC-SPECIDS-FORMAT-004 テストの ID は describe・it・test の第 1 引数の文字列から拾う

テストファイルの中で仕様 ID を拾うのは、`describe(`・`it(`・`test(` の第 1 引数の文字列リテラルだけとする。引用符は `'`・`"`・`` ` `` のどれでもよく、文字列の中に別の種類の引用符があってもよい。`expect('SPEC-…')` のように、ほかの名前の関数の引数に書いた ID は拾わない。本文は JavaScript として解釈せずに文字の並びとして読むので、コメントや文字列の中に書いた `it('…')` なども拾う（「できないこと」）。

例: `describe('a "q" x', …)`・`it("b 'q' y", …)`・``test(`c z`, …)``・`expect('SPEC-NTA-A-001')` の並びから拾う名前は `a "q" x`・`b 'q' y`・`c z` の 3 つで、`expect` の中の ID は入らない。

### SPEC-SPECIDS-FORMAT-005 番号が 3 桁で終わらない文字列は ID として拾わない

テスト名の中の ID は、3 桁の番号の直後が英数字でないものだけを拾う。4 桁以上の番号の文字列は、先頭の 3 桁で切って ID にすることはしない。

例: `a SPEC-NTA-GET-TSUTATSU-001 b SPEC-EGOV-GET-LAW-012, SPEC-NTA-X-0001` から拾う ID は `SPEC-NTA-GET-TSUTATSU-001` と `SPEC-EGOV-GET-LAW-012` の 2 つ。

## できないこと

- ID の形を設定で変えること（変えるときは spec-ids の版を上げる）
- 番号の欠番を見ること（`003` を消して `001`・`002`・`004` になっていても、形の上では問題にしない）
- `ADDED`・`MODIFIED`・`REMOVED` の見出しの意味や、本文の参照を読むこと
- テストファイルのコメント・文字列の中と、本物のテスト名を区別すること。本文を文字の並びとして読むので、次のものも「テスト名の ID」として拾う（2026-10-11 JST に shuji が意図と決めた）
  - `/a/.test('SPEC-…')` のような、名前が `describe`・`it`・`test` のメソッド呼び出しの第 1 引数
  - `// it('SPEC-…', …)` や `/* test('SPEC-…', …) */` のような、コメントにしたテストの名前（実行されないテストの ID も「テストがある」と数え、検査 2 で止まらない）
  - `"describe('SPEC-…')"` のような、文字列の中の `describe(`・`it(`・`test(`

## 未決

初版起こしで見つけた、意図か不具合かを人が決める項目と、テストが無いため ID を振らなかった項目です。決まったら「できること」に ID を振るか、`specs/changes/` の差分にします。

1. **`.test(` などのメソッド呼び出しの文字列も、テスト名として拾う。** → 2026-10-11 JST に shuji が意図と決め、「できないこと」に書いた。残りは 2 つ: README の「コメントや `expect(...)` の中の ID は数えません」を今の振る舞いに合わせて直すこと（spec-init/ の範囲の外なので別の PR）と、この振る舞いのテストを足して「できること」に ID を振ること
2. **コメントにしたテストの名前も拾う。** → 1 と同じ日に意図と決め、「できないこと」に書いた。残りも 1 と同じ（README の直しとテスト）
3. **1 つのテスト名に書いた複数の ID をすべて拾う。** README の「1 つの名前に複数の ID を書けば全部拾います」のとおりに動く（同じ日に確かめた）が、`check` のテストが無い。テストを足してから ID を振る
4. **`it.skip(`・`test.only(`・`test.each(...)(` の名前は拾わない。** `it` や `test` の直後が `(` でないため、`it.skip('SPEC-…', …)`・`test.only('SPEC-…', …)` の ID は拾わない（2026-10-11 JST に確かめた）。`it.skip` は実行されないので拾わない方がよいが、`test.only` と `test.each` は実行されるテストで、ID を書いても検査 2 で止まる。意図か不具合かを決める
