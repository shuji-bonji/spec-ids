# 差分: init（openspec レイアウト）

差分 `20261014-openspec-layout` の init の節。取り込みは見出しの単位で `specs/current/init/spec.md` と置き換える。

## 入力

| オプション              | 必須 | 内容                                                                     |
| ----------------------- | ---- | ------------------------------------------------------------------------ |
| `--domain <領域>`       | 必須 | 設定の `domain`                                                          |
| `--dir-prefix <接頭辞>` | 任意 | 設定の `dirPrefix`。既定 `""`                                            |
| `--tests <glob,glob>`   | 任意 | 設定の `tests`。`,` で区切る。既定 `src/**/*.test.ts,tests/**/*.test.ts` |
| `--layout <specs \| openspec>` | 任意 | 作るレイアウト。既定 `specs`（SPEC-SPECIDS-INIT-001〜004 のとおり）。`openspec` のときは SPEC-SPECIDS-INIT-005〜007 |

実行したディレクトリに作る（設定を上へ辿って探さない）。

## ADDED

### SPEC-SPECIDS-INIT-005 --layout openspec は、openspec/ が無ければ openspec init を案内して exit 2

`--layout openspec` のとき、実行したディレクトリに `openspec/` のフォルダーと `openspec/config.yaml`（または `openspec/config.yml`）が無ければ、何も作らずに、標準エラー出力に ``openspec/ がありません。先に `openspec init` を実行してください`` を出して終了コード 2 で終わる。`--layout` の値が `specs`・`openspec` 以外なら、使い方を出して終了コード 2 で終わる。

例: 空のフォルダーで `spec-ids init --domain READER --layout openspec` は、ファイルを 1 つも作らずに終了コード 2。`openspec/config.yaml` のあるフォルダーなら作る（SPEC-SPECIDS-INIT-006）。`--layout other` は終了コード 2。

### SPEC-SPECIDS-INIT-006 --layout openspec は openspec/spec-ids.json と openspec 用の spec-gate.yml の 2 つを作る

`--layout openspec` のとき、次の 2 つのファイルを作る。`.gitkeep` は作らない（`openspec init` が置き場を作るため）。既にあるファイルは変更しない（SPEC-SPECIDS-INIT-002 と同じ）。

1. `openspec/spec-ids.json`（`domain`・`dirPrefix`・`tests`・`layout` の 4 つのキー。`layout` は `"openspec"`）
2. `.github/workflows/spec-gate.yml`（openspec 用。SPEC-SPECIDS-INIT-007）

`specs/spec-ids.json` と `specs/` の `.gitkeep` は作らない。

例: `openspec/config.yaml` のあるフォルダーで `--domain READER --tests "tests/**/*.test.ts" --layout openspec` を実行すると、`openspec/spec-ids.json` は `{"domain":"READER","dirPrefix":"","tests":["tests/**/*.test.ts"],"layout":"openspec"}` で、`specs/` は作られない。

### SPEC-SPECIDS-INIT-007 openspec 用の spec-gate.yml は openspec validate --all の後に check を動かし、PR のときだけ pr-scope を動かす

`--layout openspec` で作る `.github/workflows/spec-gate.yml` の `spec-gate` のジョブは、`npm ci` の後に `npx openspec validate --all`、その次に `npx spec-ids check` を動かす。`pr-scope` のジョブは specs レイアウトと同じ（SPEC-SPECIDS-INIT-004: PR のときだけ、`fetch-depth: 0`、`BASE_REF`・`HEAD_REF`）。`AGENTS.md` に貼る節（SPEC-SPECIDS-INIT-003）は、置き場を `openspec/specs/`・`openspec/changes/`、見出しの形を `### Requirement: SPEC-<領域>-<機能>-<3 桁> 題` にした文で表示する。

例: 作った `spec-gate.yml` の `spec-gate:` のジョブに、`- run: npm ci` の次の行の `- run: npx openspec validate --all`、その次の行の `- run: npx spec-ids check` がある。表示する節に `openspec/specs/` と `Requirement: SPEC-READER-GET-THING-001` が入る。

## できないこと

- `AGENTS.md` を書くこと（表示するだけ）
- `spec.md` の雛形・役割表・承認の手順を作ること
- 既にあるファイルを新しい形に直すこと（`spec-gate.yml` を作り直すときは、消してから実行する）
- `openspec init` を呼ぶこと、`openspec/config.yaml` を書くこと
- `@fission-ai/openspec` を devDependencies に入れること（`spec-gate.yml` の `npx openspec` が動くように、利用側が入れる）
