# 差分: history（openspec レイアウト）

差分 `20261014-openspec-layout` の history の節。取り込みは見出しの単位で `specs/current/history/spec.md` と置き換える。

## 入力

| 引数・オプション | 必須                   | 内容                                                                   |
| ---------------- | ---------------------- | ---------------------------------------------------------------------- |
| `<dir>`          | `--all` が無ければ必須 | `<dir>`、`<current の置き場>/<dir>`、`<current の置き場>/<dir>/spec.md` のどれか |
| `--all`          | 任意                   | すべての機能を表示する。`<dir>` と一緒には使えない                     |
| `--json`         | 任意                   | 表ではなく JSON で表示する                                             |

読むもの: current の置き場の `<dir>/spec.md` の front matter と、releases・changes の置き場の `proposal.md` の front matter。置き場はレイアウトで決まる（SPEC-SPECIDS-CONFIG-009）。

## ADDED

### SPEC-SPECIDS-HISTORY-012 openspec レイアウトでは、取り込み済みの差分の「差分」の欄は YYYY-MM-DD- を除いた ID、「版」の欄は YYYY-MM-DD

レイアウトが `openspec` のとき、`openspec/changes/archive/<フォルダー名>/` の差分の行は、「差分」の欄をフォルダー名から先頭の `YYYY-MM-DD-` を除いた ID、「版」の欄をその `YYYY-MM-DD` にする（SPEC-SPECIDS-CONFIG-010）。`YYYY-MM-DD-` で始まらないフォルダーの差分は、「差分」の欄をフォルダー名、「版」の欄を `-` にする。`openspec/changes/<id>/`（草案）の差分は、specs レイアウトと同じく「版」を `changes` にする（SPEC-SPECIDS-HISTORY-004）。`--json` の `version` は、表の「版」の欄と同じ文字列（`YYYY-MM-DD`、`changes`）か、無ければ `null`。並び順は SPEC-SPECIDS-HISTORY-003 と同じ。

例: `openspec/specs/read-text/spec.md`（`approved: 2026-10-20`・`pr: 57`）、`openspec/changes/archive/2026-10-24-add-pages/proposal.md`（`approved: 2026-10-22`・`pr: 58`・`targets: [read-text]`）、`openspec/changes/limit-pages/proposal.md`（`approved: 2026-10-25`・`pr: 60`・`targets: [read-text]`）のリポジトリで `spec-ids history read-text` は、`read-text（SPEC-READER-READ-TEXT）` に続いて `| 2026-10-20 | （初版） | #57 | - |`・`| 2026-10-22 | add-pages | #58 | 2026-10-24 |`・`| 2026-10-25 | limit-pages | #60 | changes |` の 3 行。`--json` の 2 行目は `{ kind: "change", approved: "2026-10-22", change: "add-pages", pr: 58, version: "2026-10-24" }`。

### SPEC-SPECIDS-HISTORY-013 文の中のパスと --all の走査は、レイアウトの置き場に従う

機能が無いときの文（SPEC-SPECIDS-HISTORY-009）のパスは、レイアウトの current の置き場で出す。`--all`（SPEC-SPECIDS-HISTORY-008）が走査するのも、レイアウトの current の置き場。`<dir>` の代わりに渡すパス（SPEC-SPECIDS-HISTORY-002）も、レイアウトの置き場のパスを受け付ける。

例: openspec レイアウトで `spec-ids history read-txt`（打ち間違い）は、`openspec/specs/read-txt/spec.md がありません` を出して終了コード 2。`spec-ids history openspec/specs/read-text/spec.md` は `read-text` と同じ履歴。`--all` は `openspec/specs/` の下の機能だけを `<dir>` の名前の順に出し、`specs/current/` にファイルが残っていても出さない。
