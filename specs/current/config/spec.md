---
spec_id: SPECIDS
kind: common
approved:
pr:
---
# 機能: config（設定 specs/spec-ids.json の探し方・キー・既定値）

- 版: current
- 起こした元: v0.4.0 の `src/config.mjs`、`src/scan.mjs`（テストファイルの glob と、走査しないフォルダー）、`bin/spec-ids.mjs`（設定が見つからないとき）、`test/config-init.test.mjs`、`test/check.test.mjs`、`test/pr-scope.test.mjs`、README の「設定 `specs/spec-ids.json`」
- 関連する Issue: spec-ids #8

この文書は、`check`・`next`・`history`・`pr-scope` が共通に読む設定ファイルについて、「どこから読み、どのキーに何を書けて、書かなければどうなるか」を書きます。`init` が設定を作るときの振る舞いは `init` の仕様（SPEC-SPECIDS-INIT-001）に書きます。

## アクター

- 利用側のリポジトリの人。`specs/spec-ids.json` に領域・ディレクトリ名の接頭辞・テストファイルの場所を書く
- `check`・`next`・`history`・`pr-scope`。実行したディレクトリから設定を探し、見つけたディレクトリを基点にして `specs/` とテストファイルを読む

## 入力

`specs/spec-ids.json`（JSON のオブジェクト）。

| キー | 必須 | 内容 |
| --- | --- | --- |
| `domain` | 必須 | 領域。英大文字だけの文字列（例: `"NTA"`） |
| `dirPrefix` | 任意 | ディレクトリ名から機能を導くときに除く接頭辞（SPEC-SPECIDS-FORMAT-002）。既定 `""` |
| `tests` | 任意 | テストファイルの glob の配列。既定 `["src/**/*.test.ts", "tests/**/*.test.ts"]` |

## できること

### SPEC-SPECIDS-CONFIG-001 実行したディレクトリから上へ辿り、最初に見つけた specs/spec-ids.json を使う

設定は、コマンドを実行したディレクトリから親へ順に辿り、最初に `specs/spec-ids.json` を持つディレクトリのものを使う。そのディレクトリを基点（`specs/` とテストファイルの glob の起点）にする。ファイルシステムの根まで辿っても無ければ、設定は見つからない（SPEC-SPECIDS-CONFIG-006）。

例: `<root>/specs/spec-ids.json` に `{"domain":"NTA"}` があるとき、`<root>/src/deep/dir` で実行すると基点は `<root>` で、領域は `NTA`。`specs/spec-ids.json` の無いフォルダーでは見つからない。

### SPEC-SPECIDS-CONFIG-002 dirPrefix と tests を書かなければ既定値を使う

`dirPrefix` を書かなければ `""`、`tests` を書かなければ `["src/**/*.test.ts", "tests/**/*.test.ts"]` として扱う。

例: `{"domain":"NTA"}` は `{"domain":"NTA","dirPrefix":"","tests":["src/**/*.test.ts","tests/**/*.test.ts"]}` と同じ。

### SPEC-SPECIDS-CONFIG-003 domain が英大文字の文字列でない、tests が文字列の配列でないときはエラーにする

`domain` が英大文字だけの文字列でないとき、`tests` が空でない文字列の配列でないときは、設定を使わずにエラーにする。エラーの文はどのキーが違うかを示す。

例: `{"domain":"nta"}` は `specs/spec-ids.json の domain は英大文字の文字列にしてください（例: "NTA"）。今の値: "nta"` のエラー。`{"domain":"NTA","tests":"src"}` は `tests` のエラー。

### SPEC-SPECIDS-CONFIG-004 tests の glob は **・*・? を扱い、基点からの相対パスに合わせる

`tests` の glob は、基点からの相対パス（`/` 区切り）の全体に合わせる。使えるのは次の 3 つだけ。

| 書き方 | 意味 |
| --- | --- |
| `**/` | 0 個以上のフォルダー |
| `*` | `/` を含まない 0 文字以上 |
| `?` | `/` でない 1 文字 |

例: `src/**/*.test.ts` は `src/a.test.ts` と `src/x/y/a.test.ts` に合い、`src/a.ts` と `lib/a.test.ts` に合わない。`tests/*.spec.ts` は `tests/a/b.spec.ts` に合わない。`src/a?.ts` は `src/ab.ts` に合う。`tests: ["src/**/*.spec.ts"]` のリポジトリでは、`check` は `src/app/a.spec.ts` だけを読み、`src/app/b.test.ts` の ID は数えない。

### SPEC-SPECIDS-CONFIG-005 node_modules と dist の下のファイルはテストファイルとして読まない

`tests` の glob に合っても、`node_modules`・`dist`・`coverage`・`.git` という名前のフォルダーの下のファイルは読まない。

例: `src/**/*.test.ts` のリポジトリで、`node_modules/pkg/src/y.test.ts` と `dist/z.test.ts` のテスト名にある ID は、`check` で「テストにあって仕様に無い ID」にならない。

### SPEC-SPECIDS-CONFIG-006 設定が見つからないときは、init を案内して exit 2

`check`・`next`・`history`・`pr-scope` は、設定が見つからないとき（SPEC-SPECIDS-CONFIG-001）、標準エラー出力に `` specs/spec-ids.json が見つかりません。リポジトリのルートで `spec-ids init --domain <領域>` を実行してください `` を出し、終了コード 2 で終わる。

例: `specs/spec-ids.json` の無いフォルダーで `spec-ids pr-scope` を実行すると、この文を出して終了コード 2。

## できないこと

- `specs/current`・`specs/changes`・`specs/releases` の置き場を変えること（構造は固定）
- ブランチ名の接頭辞（`spec/`・`spec-init/`）を変えること（SPEC-SPECIDS-PR-SCOPE-001）
- glob の `{a,b}`・`[abc]`・`!` を使うこと
- 走査しないフォルダー（`node_modules` など）を設定で足すこと

## 未決

初版起こしで見つけた、意図か不具合かを人が決める項目と、テストが無いため ID を振らなかった項目です。決まったら「できること」に ID を振るか、`specs/changes/` の差分にします。

1. **知らないキーを黙って無視する。** `{"domain":"NTA","dirprefix":"x"}` のように `dirPrefix` を打ち間違えると、エラーにならず既定の `""` で動く（2026-10-11 JST に確かめた）。front matter では知らないキーを止める（SPEC-SPECIDS-FRONTMATTER-011）のと扱いが違う。意図か不具合かを決める
2. **設定が見つからないときの exit 2 は、`pr-scope` でしかテストしていない。** `check`・`next`・`history` も同じ文と終了コード 2 になる（同じ日に確かめた）。テストを足す
3. **設定の形が違うとき・JSON を読めないときの終了コード。** README の「どのコマンドも、設定の形が違うときは、理由を標準エラーに出して exit 1」のとおりに動くが、CLI のテストが無い。`dirPrefix` が文字列でないときのエラーもテストが無い
