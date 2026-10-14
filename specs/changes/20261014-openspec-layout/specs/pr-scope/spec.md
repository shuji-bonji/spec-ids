# 差分: pr-scope（openspec レイアウト）

差分 `20261014-openspec-layout` の pr-scope の節。取り込みは見出しの単位で `specs/current/pr-scope/spec.md` と置き換える。

## 入力

| 入力                               | 決め方                                                                                             |
| ---------------------------------- | -------------------------------------------------------------------------------------------------- |
| 比べる基準のコミット               | `--base`、無ければ環境変数 `BASE_REF`、無ければ `origin/main`                                      |
| PR のブランチ名                    | `--branch`、無ければ環境変数 `HEAD_REF`、無ければ今のブランチ                                      |
| 変わったファイル                   | 基準との merge-base から `HEAD` までの、名前の変更を含む変更の一覧（追加・変更・削除・名前の変更） |
| テストファイルの行の差分           | 変わったテストファイルの、前後の文脈の無い行の差分                                                 |
| ファイルの中身と releases の置き場 | 作業ツリー                                                                                         |
| 設定とレイアウト                   | `specs/spec-ids.json` または `openspec/spec-ids.json`（`tests` をテストファイルの判定に使う）。SPEC-SPECIDS-PR-SCOPE-007〜023 の `specs/changes/`・`specs/current/<dir>/spec.md`・`specs/releases/` は、openspec レイアウトでは SPEC-SPECIDS-PR-SCOPE-024 の対応表のパスを指す |

## ADDED

### SPEC-SPECIDS-PR-SCOPE-024 openspec レイアウトでは、仕様 PR・初版起こし・実装 PR の範囲のパスを openspec/ の置き場に写す

レイアウトが `openspec` のとき、SPEC-SPECIDS-PR-SCOPE-007〜023 の検査は、次の対応でパスを読み替えて行う。検査の意味・止める条件・文の形は変えず、文の中のパスだけをこの表のパスにする。

| specs レイアウト | openspec レイアウト |
| --- | --- |
| `specs/changes/`（仕様 PR が変えてよい範囲） | `openspec/changes/` のうち `openspec/changes/archive/` を除く |
| `specs/changes/<id>/proposal.md` | `openspec/changes/<id>/proposal.md` |
| `specs/current/<dir>/spec.md` | `openspec/specs/<dir>/spec.md` |
| `specs/releases/`（実装 PR の移動先） | `openspec/changes/archive/` |
| `specs/{current,changes,releases}/.gitkeep` | `openspec/specs/.gitkeep`・`openspec/changes/.gitkeep`・`openspec/changes/archive/.gitkeep` |

`openspec/config.yaml`・`openspec/spec-ids.json`・`openspec/schemas/` は置き場の外として扱う（仕様 PR では止め、実装 PR では通す）。

例: `spec/add-pages` で `openspec/changes/add-pages/proposal.md`（`approved`・`pr` あり）と `openspec/changes/add-pages/specs/read-text/spec.md` を足した仕様 PR は通る。同じ仕様 PR で `openspec/specs/read-text/spec.md` を変えると `（specs/current/ を書けるのは…）` に当たる文（パスは `openspec/specs/`）で止まる。`openspec/config.yaml` を変えた仕様 PR は、`仕様 PR（spec/*）は openspec/changes/ だけを変えます: openspec/config.yaml` で止まる。`spec-init/read-text` で `openspec/specs/read-text/spec.md` を足し、テスト名に ID を足すだけの初版起こしは通る。

### SPEC-SPECIDS-PR-SCOPE-025 openspec レイアウトの実装 PR は、openspec/changes/<id>/ から openspec/changes/archive/YYYY-MM-DD-<id>/ への移動を通し、archive 済みの差分の残りを消すのを通す

レイアウトが `openspec` のとき、実装 PR では `openspec/changes/<id>/` の下から `openspec/changes/archive/<フォルダー名>/` の下への名前の変更を通す（SPEC-SPECIDS-PR-SCOPE-019 の対応）。`<フォルダー名>` は `YYYY-MM-DD-<id>` でも `<id>` でもよい（SPEC-SPECIDS-CONFIG-010）。作業ツリーの `openspec/changes/archive/` に同じ ID（フォルダー名から `YYYY-MM-DD-` を除いたもの）の差分があるとき、`openspec/changes/<id>/` の下のファイルを消すのを通す（SPEC-SPECIDS-PR-SCOPE-020 の対応）。それ以外の `openspec/changes/`（`archive/` を除く）の変更は、`仕様 PR の外で openspec/changes/ を変えています（許されるのは openspec/changes/archive/ への移動と、archive 済みの差分の残りを消すことだけ）: <パス>` で止める。`openspec archive` が同じ PR で `openspec/specs/<dir>/spec.md` を書き換えるのは、current の書き換えとして SPEC-SPECIDS-PR-SCOPE-022（承認の有無）だけを見る。

例: `feat/add-pages` で `src/read-text.ts` と `tests/read-text.test.ts` を変え、`openspec/changes/add-pages/proposal.md` を `openspec/changes/archive/2026-10-24-add-pages/proposal.md` に移し、承認のある `openspec/specs/read-text/spec.md` を書き換えた実装 PR は通る。`openspec/changes/archive/2026-10-24-add-pages/` があるとき、`openspec/changes/add-pages/tasks.md` を消す実装 PR は通る。archive に無い `openspec/changes/limit-pages/proposal.md` を実装 PR で書き換えると止まる。

## できないこと

- front matter の書式（キーの打ち間違い・値の形・古い「- 承認日:」の行）を見ること（`check` の検査 5・7）
- 承認日が正しいか、承認した人が誰かを確かめること（値があるかだけを見る）
- ブランチ名の接頭辞を設定で変えること
- テストの中身が仕様に合っているかを見ること
- `openspec archive` が正本に取り込んだ内容が差分と同じかを見ること（OpenSpec の仕事）
