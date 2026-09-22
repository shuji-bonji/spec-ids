## 仕様の正本

- 意図の正本は `specs/current/` です。Wiki・Discussions・README は正本にしません。
- 変更は `specs/changes/<yyyymmdd>-<slug>/` に出し、人が承認するまで Coder を起動しません。
- Coder は `specs/current/` の本文を書き換えません。実装から仕様へ戻したい発見は、新しい `specs/changes/` に書きます。
- 受入テストの `describe` / `it` の名前には仕様 ID を含めます。`npx spec-ids check` が仕様とテストの ID を突き合わせ、CI（spec-gate）で走ります。

## 仕様 ID

- 形式は `SPEC-{{domain}}-<機能>-<3 桁>` です（例: `{{example}}`）。機能は `specs/current/<dir>/spec.md` のディレクトリ名{{prefixNote}}、`_` を `-` にしたものです。番号は機能ごとに 001 からの通し番号です。
- 新しい ID は `npx spec-ids next specs/current/<dir>/spec.md` で取ります（複数なら `--count 3`）。一度使った番号はその機能の中で再利用しません。
- 仕様を外すときは `specs/changes/` の `REMOVED` に書き、テストからも ID を外します。
