## 仕様の正本

- 意図の正本は `openspec/specs/` です（OpenSpec の置き場）。Wiki・Discussions・README は正本にしません。
- 変更は `openspec/changes/<slug>/` に出し（`/opsx:propose` または `openspec new change <slug>`）、人が承認するまで Coder を起動しません。`<slug>` に日付を入れません（`openspec archive` が `YYYY-MM-DD-` を付けます）。
- Coder は `openspec/specs/` の本文を書き換えません。実装から仕様へ戻したい発見は、新しい `openspec/changes/` に書きます。
- 受入テストの `describe` / `it` の名前には仕様 ID を含めます。`npx openspec validate --all` と `npx spec-ids check` が CI（spec-gate）で走ります。

## 仕様 ID

- 形式は `SPEC-{{domain}}-<機能>-<3 桁>` です（例: `{{example}}`）。機能は `openspec/specs/<dir>/spec.md` のディレクトリ名{{prefixNote}}、`_` を `-` にしたものです。番号は機能ごとに 001 からの通し番号です。
- 要求の見出しは `### Requirement: {{example}} 題` の形で書きます（`Requirement:` の直後に仕様 ID）。各要求に `#### Scenario:` を 1 つ以上書き、Scenario 名をテスト名の後半にします。
- 新しい ID は `npx spec-ids next openspec/specs/<dir>/spec.md` で取ります（複数なら `--count 3`）。一度使った番号はその機能の中で再利用しません。
- 仕様を外すときは差分の `## REMOVED Requirements` に書き、テストからも ID を外します。
