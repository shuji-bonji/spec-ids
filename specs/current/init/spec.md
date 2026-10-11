---
spec_id: SPECIDS
kind: cli
approved:
pr:
---
# 機能: init（仕様の置き場・設定・CI の作成）

- 版: current
- 起こした元: v0.4.0 の `bin/spec-ids.mjs`（`init`）、`src/init.mjs`、`templates/spec-gate.yml`、`templates/agents-section.md`、`test/config-init.test.mjs`、README の「導入」「`AGENTS.md` の役割」
- 関連する Issue: spec-ids #9（0.4.0 で `spec-gate.yml` に `pr-scope` のジョブを足した）、spec-ids #8

この文書は「`spec-ids init` が何を作り、何を作らず、何を表示するか」を書きます。設定のキーの意味は config の仕様（SPEC-SPECIDS-CONFIG-001〜006）にあります。

## アクター

- spec-ids を導入する利用側のリポジトリの人。リポジトリのルートで 1 回実行し、作られたファイルをコミットし、表示された節を `AGENTS.md` に貼る

## 入力

| オプション | 必須 | 内容 |
| --- | --- | --- |
| `--domain <領域>` | 必須 | 設定の `domain` |
| `--dir-prefix <接頭辞>` | 任意 | 設定の `dirPrefix`。既定 `""` |
| `--tests <glob,glob>` | 任意 | 設定の `tests`。`,` で区切る。既定 `src/**/*.test.ts,tests/**/*.test.ts` |

実行したディレクトリに作る（設定を上へ辿って探さない）。

## できること

### SPEC-SPECIDS-INIT-001 置き場・設定・workflow の 5 つのファイルを作る

次の 5 つのファイルを、この順に作る。

1. `specs/current/.gitkeep`
2. `specs/changes/.gitkeep`
3. `specs/releases/.gitkeep`
4. `specs/spec-ids.json`（`domain`・`dirPrefix`・`tests` の 3 つのキーを、既定値を埋めて書く）
5. `.github/workflows/spec-gate.yml`

例: `--domain EGOV --dir-prefix egov_` で作った `specs/spec-ids.json` は `{"domain":"EGOV","dirPrefix":"egov_","tests":["src/**/*.test.ts","tests/**/*.test.ts"]}`。

### SPEC-SPECIDS-INIT-002 既にあるファイルは変更しない

作るファイルが既にあるときは、書き換えずに「既存のため変更なし」として扱う。置き場は、フォルダー（`specs/current` など）が既にあれば作らない。`AGENTS.md` には書き込まない。

例: `AGENTS.md` のあるフォルダーで 2 回続けて実行すると、1 回目は 5 つを作り、2 回目は何も作らず 5 つを既存とする。`AGENTS.md` の中身は変わらない。

### SPEC-SPECIDS-INIT-003 AGENTS.md に貼る節を表示する

`AGENTS.md`（または `CONTRIBUTING.md`）に貼る節を表示する。節は「仕様の正本」と「仕様 ID」の 2 つで、領域を埋めた例の ID（`SPEC-<領域>-GET-THING-001`）と、`dirPrefix` があればその接頭辞を除く旨の文を含む。役割表と承認の手順は含めない。

例: `--domain EGOV --dir-prefix egov_` の節には `SPEC-EGOV-GET-THING-001` と ``接頭辞 `egov_` `` が入る。

### SPEC-SPECIDS-INIT-004 spec-gate.yml は check と、PR のときだけ pr-scope を動かす

作る `.github/workflows/spec-gate.yml` には、PR と main への push で `npx spec-ids check` を動かす `spec-gate` のジョブと、PR のときだけ動く `pr-scope` のジョブを入れる。`pr-scope` のジョブは、`actions/checkout` に `fetch-depth: 0` を付け、`npm ci` の直後に `npx spec-ids pr-scope` を、環境変数 `BASE_REF: origin/${{ github.base_ref }}` と `HEAD_REF: ${{ github.head_ref }}` を付けて実行する。

例: 作った `spec-gate.yml` の `pr-scope:` 以降に、`if: github.event_name == 'pull_request'`・`fetch-depth: 0`・`- run: npm ci` の次の行の `- run: npx spec-ids pr-scope`・`BASE_REF`・`HEAD_REF` の行がある。

## できないこと

- `AGENTS.md` を書くこと（表示するだけ）
- `spec.md` の雛形・役割表・承認の手順を作ること
- 既にあるファイルを新しい形に直すこと（`spec-gate.yml` を作り直すときは、消してから実行する）

## 未決

初版起こしで見つけた、意図か不具合かを人が決める項目と、テストが無いため ID を振らなかった項目です。決まったら「できること」に ID を振るか、`specs/changes/` の差分にします。

1. **フォルダーが既にあり `.gitkeep` が無いとき。** `specs/current` のフォルダーだけがあると `.gitkeep` を作らず、「既存のため変更なし: specs/current」とフォルダーのパスで表示する（作ったときの表示は `specs/current/.gitkeep`。2026-10-11 JST に確かめた）。空のフォルダーは git に入らないので、置き場が commit されないことがある。意図か不具合かを決める
2. **CLI の表示と終了コードのテストが無い。** `作成: <ファイル>`・`既存のため変更なし: <ファイル>` の行と節の表示、`--domain` が無いときの exit 2、`--domain nta`（形が違う）のときの exit 1、`--tests "a/*.ts, b/**"` を `,` で区切って前後の空白を除くことは、今の振る舞いだがテストが無い
