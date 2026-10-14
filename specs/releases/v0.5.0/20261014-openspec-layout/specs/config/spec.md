# 差分: config（openspec レイアウト）

差分 `20261014-openspec-layout` の config の節。取り込みは見出しの単位で `specs/current/config/spec.md` と置き換える。

## 入力

`openspec/spec-ids.json` または `specs/spec-ids.json`（JSON のオブジェクト）。どちらを使うかは SPEC-SPECIDS-CONFIG-007。

| キー        | 必須 | 内容                                                                               |
| ----------- | ---- | ---------------------------------------------------------------------------------- |
| `domain`    | 必須 | 領域。英大文字だけの文字列（例: `"NTA"`）                                          |
| `dirPrefix` | 任意 | ディレクトリ名から機能を導くときに除く接頭辞（SPEC-SPECIDS-FORMAT-002）。既定 `""` |
| `tests`     | 任意 | テストファイルの glob の配列。既定 `["src/**/*.test.ts", "tests/**/*.test.ts"]`    |
| `layout`    | 任意 | `"specs"` か `"openspec"`。書かなければ設定ファイルの場所から決める（SPEC-SPECIDS-CONFIG-008） |

## MODIFIED

### SPEC-SPECIDS-CONFIG-001 実行したディレクトリから上へ辿り、最初に見つけた設定ファイルを使う

設定は、コマンドを実行したディレクトリから親へ順に辿り、最初に設定ファイルを持つディレクトリのものを使う。各ディレクトリでは `openspec/spec-ids.json`、次に `specs/spec-ids.json` の順に探す（SPEC-SPECIDS-CONFIG-007）。見つけたディレクトリを基点（置き場とテストファイルの glob の起点）にする。ファイルシステムの根まで辿っても無ければ、設定は見つからない（SPEC-SPECIDS-CONFIG-006）。

例: `<root>/specs/spec-ids.json` に `{"domain":"NTA"}` があるとき、`<root>/src/deep/dir` で実行すると基点は `<root>` で、領域は `NTA`。`<root>/openspec/spec-ids.json` に `{"domain":"READER"}` があるときも基点は `<root>` で、領域は `READER`。どちらも無いフォルダーでは見つからない。

### SPEC-SPECIDS-CONFIG-006 設定が見つからないときは、init を案内して exit 2

`check`・`next`・`history`・`pr-scope` は、設定が見つからないとき（SPEC-SPECIDS-CONFIG-001）、標準エラー出力に ``specs/spec-ids.json も openspec/spec-ids.json も見つかりません。リポジトリのルートで `spec-ids init --domain <領域>`（OpenSpec のリポジトリなら `--layout openspec` を付ける）を実行してください`` を出し、終了コード 2 で終わる。

例: どちらの設定ファイルも無いフォルダーで `spec-ids pr-scope` を実行すると、この文を出して終了コード 2。

## ADDED

### SPEC-SPECIDS-CONFIG-007 同じディレクトリに両方の設定ファイルがあれば openspec/spec-ids.json を使う

1 つのディレクトリに `openspec/spec-ids.json` と `specs/spec-ids.json` の両方があるときは、`openspec/spec-ids.json` を使い、`specs/spec-ids.json` は読まない。親のディレクトリより先に、同じディレクトリの 2 つを見る。

例: `<root>/openspec/spec-ids.json`（`domain: "READER"`）と `<root>/specs/spec-ids.json`（`domain: "NTA"`）があるとき、`<root>` で実行すると領域は `READER`。`<root>/specs/spec-ids.json` だけがあり `<root>/sub/openspec/spec-ids.json` もあるとき、`<root>/sub/x` で実行すると基点は `<root>/sub`。

### SPEC-SPECIDS-CONFIG-008 レイアウトは設定ファイルの場所で決め、layout キーが場所と違えばエラーにする

レイアウトは、使った設定ファイルが `openspec/spec-ids.json` なら `openspec`、`specs/spec-ids.json` なら `specs` とする。設定に `layout` があれば、その値が場所から決めたレイアウトと同じでなければエラーにする。`layout` の値が `"specs"`・`"openspec"` 以外でもエラーにする。エラーの文はキー `layout` と、場所から決めたレイアウトを示す。

例: `openspec/spec-ids.json` に `{"domain":"READER"}` はレイアウト `openspec`。同じ場所に `{"domain":"READER","layout":"openspec"}` も `openspec`。同じ場所に `{"domain":"READER","layout":"specs"}` は、`layout` が場所（`openspec`）と違うエラー。`specs/spec-ids.json` に `{"domain":"NTA","layout":"openspec"}` も同じ種類のエラー。`{"domain":"NTA","layout":"other"}` は値のエラー。

### SPEC-SPECIDS-CONFIG-009 openspec レイアウトの置き場は openspec/specs・openspec/changes・openspec/changes/archive

レイアウトが `openspec` のとき、`check`・`next`・`history`・`pr-scope` が読む置き場は次のとおりとする。specs レイアウトの置き場との対応は 1 対 1 で、各コマンドの検査の意味は変えない。

| 役割 | specs レイアウト | openspec レイアウト |
| --- | --- | --- |
| 出荷済みの正（current） | `specs/current/<dir>/spec.md` | `openspec/specs/<dir>/spec.md` |
| 差分の草案（changes） | `specs/changes/<id>/`（`proposal.md`、`specs/<dir>/spec.md`） | `openspec/changes/<id>/`（同じ）。`openspec/changes/archive/` は含めない |
| 取り込み済み（releases） | `specs/releases/<tag>/<id>/`（`proposal.md`、`specs/<dir>/spec.md`） | `openspec/changes/archive/<フォルダー名>/`（同じ） |

例: `openspec/specs/read-text/spec.md` に `### SPEC-READER-READ-TEXT-001 x` の見出しと front matter があり、テスト名に同じ ID があるリポジトリ（`openspec/spec-ids.json` は `{"domain":"READER","tests":["tests/**/*.test.ts"]}`）で `spec-ids check` は、`current: 1 files, 1 IDs` で通る。`openspec/changes/add-pages/specs/read-text/spec.md` の見出しは changes として、`openspec/changes/archive/2026-10-14-add-pages/proposal.md` は releases として数える。

### SPEC-SPECIDS-CONFIG-010 archive のフォルダー名から、先頭の YYYY-MM-DD- を除いたものを差分の ID、その日付を版とする

レイアウトが `openspec` のとき、`openspec/changes/archive/<フォルダー名>/` の差分の ID は、フォルダー名が `YYYY-MM-DD-` で始まればそれを除いた残り、始まらなければフォルダー名そのものとする。版は、`YYYY-MM-DD-` で始まればその `YYYY-MM-DD`、始まらなければ無い（空）とする。`history`（SPEC-SPECIDS-HISTORY-012）と `pr-scope`（SPEC-SPECIDS-PR-SCOPE-025）はこの ID と版を使う。

例: `openspec/changes/archive/2026-10-14-add-pages/` の ID は `add-pages`、版は `2026-10-14`。`openspec/changes/archive/add-pages/`（手で移したもの）の ID は `add-pages`、版は無い。

## できないこと

- `specs/current`・`specs/changes`・`specs/releases`（specs レイアウト）と `openspec/specs`・`openspec/changes`・`openspec/changes/archive`（openspec レイアウト）以外の置き場を使うこと（2 つのどちらか。パスは設定で変えられない）
- ブランチ名の接頭辞（`spec/`・`spec-init/`）を変えること（SPEC-SPECIDS-PR-SCOPE-001）
- glob の `{a,b}`・`[abc]`・`!` を使うこと
- 走査しないフォルダー（`node_modules` など）を設定で足すこと
- 1 つのリポジトリで 2 つのレイアウトを同時に使うこと（同じディレクトリに両方の設定があれば `openspec/` だけを読む。SPEC-SPECIDS-CONFIG-007）
