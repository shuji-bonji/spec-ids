---
spec_id: SPECIDS
kind: cli
approved:
pr:
---
# 機能: next（次の仕様 ID の採番）

- 版: current
- 起こした元: v0.4.0 の `bin/spec-ids.mjs`（`next`）、`src/next.mjs`、`src/scan.mjs`、`test/next.test.mjs`、README の「採番 `spec-ids next`」「終了コード」
- 関連する Issue: spec-ids #8

この文書は「`spec-ids next` は、どの機能の、どの番号を表示するか」を書きます。ID の形は format の仕様（SPEC-SPECIDS-FORMAT-001・002）にあります。

## アクター

- Steward。仕様 PR の差分の草案や初版起こしで、新しい仕様の見出しに振る ID を取る

## 入力

| 引数・オプション | 必須 | 内容 |
| --- | --- | --- |
| `<対象>` | 必須 | `specs/current/<dir>/spec.md`、`specs/current/<dir>`、`<dir>` のどれか |
| `--count N` | 任意 | 取る ID の数。正の整数。既定 1 |

設定は `specs/spec-ids.json`（SPEC-SPECIDS-CONFIG-001〜006）。

## できること

### SPEC-SPECIDS-NEXT-001 対象は spec.md のパス・フォルダーのパス・ディレクトリ名のどれでもよい

`<対象>` から `<dir>` を取り出す。`specs/current/<dir>/spec.md`、`specs/current/<dir>`、`specs/current/<dir>/`（末尾の `/`）、`<dir>` は同じ機能を指す。

例: `specs/current/nta_get_tsutatsu/spec.md`・`specs/current/nta_get_tsutatsu`・`specs/current/nta_get_tsutatsu/`・`nta_get_tsutatsu` は、どれも `nta_get_tsutatsu`。

### SPEC-SPECIDS-NEXT-002 current と changes の見出しにある最大の番号の次から、--count の数だけ表示する

その機能について、`specs/current` と `specs/changes` の `spec.md` の見出しにある ID（SPEC-SPECIDS-FORMAT-003）の最大の番号を求め、その次の番号から `--count` の数の ID を、空白で区切って 1 行に表示する。草案（changes）の見出しの番号も数える。ファイルは書き換えず、番号の予約もしない。

例: current の見出しが `001`・`002`、`specs/changes/20260922-x/spec.md` の見出しが `SPEC-NTA-GET-TSUTATSU-005` のとき、`spec-ids next nta_get_tsutatsu` は `SPEC-NTA-GET-TSUTATSU-006`、`--count 2` は `SPEC-NTA-GET-TSUTATSU-006 SPEC-NTA-GET-TSUTATSU-007`。

### SPEC-SPECIDS-NEXT-003 まだ見出しの無い機能は 001 から

その機能の見出しが current にも changes にも無ければ、`001` から表示する。`specs/current/<dir>/` が無くてもよい。

例: `nta_get_tsutatsu` の見出しだけがあるリポジトリで `spec-ids next nta_search_qa` は `SPEC-NTA-SEARCH-QA-001`。

### SPEC-SPECIDS-NEXT-004 番号が 999 を超えるときは表示しない

最大の番号に `--count` を足すと 999 を超えるときは、ID を表示せず、`<機能> の番号が 3 桁を超えます（最大 <最大の番号>）。機能を分けるか、ID の形式を見直してください` で止まる。

例: 見出しが `### SPEC-NTA-A-999` の機能 `nta_a` で `spec-ids next nta_a` を実行すると、ID を表示せずに止まる。

## できないこと

- 番号を予約すること（並行するブランチが同じ番号を取ったときは、マージの後に `check` の検査 1 で止まる。SPEC-SPECIDS-CHECK-004）
- 欠番を埋めること（いつも最大の番号の次から）
- `specs/releases/` の見出しを数えること
- 仕様書に見出しを書き込むこと

## 未決

初版起こしで見つけた、意図か不具合かを人が決める項目と、テストが無いため ID を振らなかった項目です。決まったら「できること」に ID を振るか、`specs/changes/` の差分にします。

1. **999 を超えるときの終了コードは 1。** README の終了コードの表は `next` の 1 の欄が「-」で、この場合を書いていない（2026-10-11 JST に確かめた。終了コード 1）。表に書くか、2 にするかを決める
2. **`--count` に値が無いときと、知らないオプションを黙って受け付ける。** `spec-ids next a --count` は 1 個として、`spec-ids next a --cnt 3` は `--cnt 3` を無視して 1 個として、どちらも終了コード 0 で表示する（同じ日に確かめた）。`pr-scope` は知らないオプションと値の無いオプションを exit 2 にする（SPEC-SPECIDS-PR-SCOPE-006）のと扱いが違う。意図か不具合かを決める
3. **引数が無い・`--count` が正の整数でないときの exit 2。** README のとおり使い方を出して終了コード 2 になる（`--count 0` で確かめた）が、テストが無い
4. **設定の `domain` と違う領域の見出しは数えない、`specs/releases/` の見出しは数えない、ファイルを書かない。** どれも今の振る舞いだが、テストが無い
