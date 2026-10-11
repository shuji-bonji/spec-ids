# AGENTS.md

このリポジトリ（spec-ids）で作業するエージェントと人が、最初に読む規則です。spec-ids は利用側のリポジトリの仕様 ID を検査する CLI ですが、spec-ids 自身の振る舞いも、利用側と同じ仕様 ID とテストの仕組みで守ります（spec-ids#8）。運用の全体は [docs/operations.md](docs/operations.md) にあります。

## 仕様の正本

spec-ids の振る舞い（サブコマンドの入力・出力・終了コード）について、何を意図とするかを決める場所です。

- 意図の正本は `specs/current/` です。Wiki・Discussions・README は正本にしません。
- 変更は `specs/changes/<yyyymmdd>-<slug>/` に出し、人が承認するまで実装を始めません。
- 実装する係は `specs/current/` の本文を書き換えません。実装から仕様へ戻したい発見は、新しい `specs/changes/` に書きます。
- `specs/current/` が空のあいだは、`spec-gate` の `check` は 0 件で通ります。最初の `spec.md` は初版起こしの PR（`spec-init/<dir>`）で入れます。

## 仕様 ID

仕様の 1 件と、それを確かめるテストを結び付ける名前の決まりです。

- 形式は `SPEC-SPECIDS-<機能>-<3 桁>` です（例: `SPEC-SPECIDS-CHECK-001`）。機能は `specs/current/<dir>/spec.md` のディレクトリ名を大文字にし、`_` を `-` にしたものです（`specs/spec-ids.json` の `dirPrefix` は `""`）。番号は機能ごとに 001 からの通し番号です。
- 新しい ID は `node bin/spec-ids.mjs next specs/current/<dir>/spec.md` で取ります（複数なら `--count 3`）。一度使った番号はその機能の中で再利用しません。採番は作業ツリーの `bin/` で行ってかまいません。
- 仕様を外すときは `specs/changes/` の `REMOVED` に書き、テストからも ID を外します。

## テスト名の書き方

`spec-ids check` がどのテストから ID を拾うかと、検査の見本の書き方です。

- 検査の対象は `test/*.test.mjs` です（`specs/spec-ids.json` の `tests`）。`test/helpers.mjs` は対象にしません。
- 受入テストの `test(...)` / `describe(...)` の名前に、仕様 ID を含めます。期待値は仕様 ID のために変えません。
- fixture として書く「利用側のテストファイル」の中身（`it('SPEC-NTA-…', () => {});` のような見本）は、ソースに `it(` と引用符と ID を続けて書かず、`test/helpers.mjs` の `itLine(name)` で実行時に組み立てます。ソースにそのまま書くと、spec-ids 自身の `check` が見本の ID を「テストにあって仕様に無い ID」として拾います。

## PR の種類

ブランチ名の接頭辞で PR の種類が決まり、`spec-ids pr-scope` が変えてよいパスを検査します。詳しくは [docs/operations.md](docs/operations.md) の 1.2 と 4 章にあります。

| ブランチ | 種類 | 入れてよいもの |
| --- | --- | --- |
| `spec/<yyyymmdd>-<slug>` | 仕様 PR | `specs/changes/<id>/` の proposal.md と差分の spec.md |
| `spec-init/<dir>` | 初版起こし | `specs/current/<dir>/spec.md` と、既存のテスト名への仕様 ID の追加（期待値と本文は変えない） |
| それ以外（`feat/` `fix/` `docs/` `chore/` など） | 実装 PR | `src/`・`bin/`・テスト・版・CHANGELOG、`specs/current/` への取り込み（最終コミット） |

- 振る舞いに何を許すかは仕様 PR で決め、実装 PR のレビューに持ち込みません。
- 承認の記録（front matter の `approved` と `pr`）は人が書きます。エージェントは空のまま出します。
- 署名・push・PR・マージ・タグは人が行います。

## spec-gate が使う版

`.github/workflows/spec-gate.yml` の `spec-gate`（`check`）と `pr-scope` は、作業ツリーの `bin/` ではなく、publish 済みの決まった版の spec-ids で動きます。

- 版は `spec-gate.yml` の `env` の `SPEC_IDS_VERSION` の 1 か所に書きます。npm の `latest` は使いません。
- 理由: 作業中の `check` に不具合があると、その `check` で自分の `specs/` を検査したときに不具合が見逃されます。PR の中で `src/` を変えても、検査するのはいつも publish 済みの版です。
- `check` と `pr-scope` の正しさそのものは、`test/*.test.mjs`（一時ディレクトリの fixture に対して関数を呼ぶテスト）と `ci.yml` の smoke test で守ります。
- `npx -y @shuji-bonji/spec-ids@<版>` を使わず、決まった版を `$RUNNER_TEMP/spec-ids` に `npm install --prefix` で入れて、そこの `bin` を呼びます。このリポジトリの中で `npx -y @shuji-bonji/spec-ids@0.4.0` を実行すると、npm はルートの `package.json`（同じ名前で同じ版）を「入っている」とみなして registry から取らず、`spec-ids: not found`（終了コード 127）で止まるためです。ルートの版が違えば registry から取りますが、作業ツリーの版に左右されない形にしています。

## 版を上げる手順

`SPEC_IDS_VERSION` を新しい版に上げるときの順序です。

1. 実装 PR をマージし、タグ（`v*`）を push して `publish.yml` で npm に publish します。
2. publish の後、別の PR（`chore/<yyyymmdd>-spec-gate-<版>` など、実装 PR の扱い）で `spec-gate.yml` の `SPEC_IDS_VERSION` だけを新しい版にします。
3. その PR の `spec-gate` と `pr-scope` が新しい版で通ることを確かめます（ログの `spec-ids --version` の行で版を確かめられます）。
4. `spec.md` の書き方や front matter の形を変える変更は、「新しい版を publish する」→「`SPEC_IDS_VERSION` を上げる」の 2 段階になります。古い版のまま新しい形の `spec.md` を入れると `check` が止まるので、版を上げる PR を先にマージします。
