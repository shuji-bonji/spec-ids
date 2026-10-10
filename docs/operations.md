# 運用手順: 仕様とコードを 2 本の PR で変える

- 対象: `@shuji-bonji/spec-ids` を使うリポジトリで、仕様の作成・変更と実装を進める人とエージェント
- 状態: 試行版。houki-nta-mcp で 2026-09-24〜26（JST）に回した記録から起こした。2026-10-09（JST）に spec-ids 0.3.0 の形（承認の記録を front matter に書く。spec-ids #5）に、2026-10-10（JST）に spec-ids 0.4.0 の形（`pr-scope` を spec-ids のサブコマンドにした。spec-ids #9）に合わせた
- 前提の手順: [Discussion #1「仕様を担保するエージェントの導入と実践」](https://github.com/shuji-bonji/spec-ids/discussions/1)（役割と順序）

この文書は、Discussion #1 が決めた役割と順序を、git と GitHub の操作（ブランチ・コミット・PR・承認・マージ・タグ）に対応させた手順書です。仕様をコードと同じリポジトリにある別種の開発資産として扱い、人が振る舞いを承認する場所を仕様 PR 1 か所にします。

## 1. 考え方

### 1.1 2 つの資産

| 資産 | 置き場 | 人が問うこと |
|---|---|---|
| 仕様資産 | `specs/changes/<id>/`（差分）、`specs/current/`（出荷済みの正）、`specs/releases/<tag>/`（取り込み済みの差分） | 変わる振る舞い / 変わらない振る舞い / 対象外 |
| コード資産 | テスト、`src/`、版、CHANGELOG | 承認済みの文と、テストと、コードが同じか。コードの品質 |

- 振る舞いに何を許すかは、仕様 PR で決める。実装 PR のレビューに持ち込まない
- `specs/current/` は仕様資産だが、書き換えるのは実装が main に入るとき（実装 PR の最終コミット）。仕様 PR で先に書き換えると、リポジトリ上の正が未出荷の振る舞いになる
- 仕様 ID 付きの受入テストはコード資産。書く順番だけは「仕様の承認の後、実装の前」

```mermaid
flowchart LR
  subgraph specAsset["仕様資産"]
    Ch["specs/changes/&lt;id&gt;/"]
    Ap["人が承認してマージ"]
    Ch --> Ap
  end
  subgraph codeAsset["コード資産"]
    T["受入テスト"]
    C["実装"]
    Cur["specs/current/ への取り込み"]
    T --> C --> Cur
  end
  Ap -->|"承認済みのパスだけ渡す"| T
```

### 1.2 PR の種類

| ブランチ | 種類 | 入れてよいもの | 入れないもの | 人の判断 |
|---|---|---|---|---|
| `spec/<yyyymmdd>-<slug>` | 仕様 PR | `specs/changes/<id>/proposal.md` と差分の `spec.md`、proposal.md の front matter の `approved` と `pr` | `src/`、テスト、`specs/current/`（例外: 下の `implementation: none`） | 変わる振る舞い / 変わらない振る舞い / 対象外 |
| `spec-init/<dir>` | 初版起こし | `specs/current/<dir>/spec.md`（front matter の `approved` と `pr` を含む）、既存テストの名前への仕様 ID の追加 | テストの期待値と本文、実装 | 今の動きを意図として認めるか、不具合か |
| それ以外（`feat/` `fix/` `docs/` など） | 実装 PR | テスト、`src/`、版と CHANGELOG、最終コミットの取り込み（`specs/current/` の更新と `specs/changes/` → `specs/releases/<tag>/` の移動） | 未承認の意図の追加、承認済み差分の書き換え | 通常のコードレビュー。仕様の再承認ではない |

- ブランチ名の接頭辞 `spec/`・`spec-init/` は、`spec-ids pr-scope`（4 章）が PR の種類を決めるのに使う。接頭辞は spec-ids が固定で持ち、`specs/spec-ids.json` では変えられない。どちらでもないブランチは、すべて実装 PR として検査する
- 実装 PR は、取り込み済み（`specs/releases/<tag>/` に同じ `<id>` がある）差分の `specs/changes/<id>/` に残ったファイルを消してよい（7 章の片付け）
- 仕様 PR の proposal.md の front matter に `implementation: none` と書いた差分（出荷済みの振る舞いを書き直すだけのもの）は、仕様 PR の中で `specs/current/` を書いてよい。正が未出荷にならないため
- 初版起こしは 1 本の PR にする。`spec.md` とテスト名の ID を分けると、どちらを先にマージしても `spec-ids check` が止まる

### 1.3 役割

同じ会話に「書く係」「実装する係」「突き合わせる係」を置きません。次の係には成果物のパスだけを渡し、要約して渡しません。

| 役割 | 書くもの | 書かないもの |
|---|---|---|
| 人 | 承認（仕様 PR のマージ）、承認日と PR 番号（front matter の `approved` と `pr`）、署名、push、マージ、タグ | 仕様やコードの全文 |
| Spec Steward | 差分の草案（`specs/changes/<id>/`）、初版起こしの `specs/current/` | 実装、テストの期待値 |
| Test Designer | 仕様 ID 付きの受入テスト | 実装を見て期待値を足すこと、仕様本文 |
| Coder | 実装、版、CHANGELOG | `specs/`、テストの期待値 |
| Spec Publisher | 実装 PR の最終コミットの取り込み | 実装、テスト、未承認の意図 |
| Spec Auditor | 仕様 ID ごとの一致 / 不一致の報告 | 仕様・実装・テストのどれも |

## 2. 流れ

### 2.1 仕様を変える（仕様 PR → 実装 PR）

```mermaid
sequenceDiagram
  autonumber
  actor H as 人
  participant St as Steward
  participant Td as Test Designer
  participant Cd as Coder
  participant Pb as Publisher
  participant GH as GitHub
  participant CI as CI

  rect rgba(128,128,128,0.08)
  Note over H,CI: 仕様 PR（仕様資産）
  H->>GH: Issue #N
  H->>St: 会話 1: Issue と現行 spec.md のパス
  St->>St: spec/<id> に specs/changes/<id>/ をコミット
  H->>GH: 署名・push・PR（Refs #N）
  GH->>CI: spec-gate・pr-scope（approved と pr が空なので pr-scope は RED）
  H->>H: 変わる / 変わらない / 対象外を判断
  H->>GH: proposal.md の front matter に approved と pr を書いて push
  CI-->>GH: GREEN
  H->>GH: 手元で ff マージして push
  end

  rect rgba(128,128,128,0.08)
  Note over H,CI: 実装 PR（コード資産）
  H->>Td: 会話 2: 承認済み差分のパス
  Td->>Td: 受入テストをコミット（RED でよい）
  H->>Cd: 会話 3: 差分とテストのパス
  Cd->>Cd: 実装・版・CHANGELOG をコミット
  H->>Pb: 会話 4: 差分のパスと次のタグ
  Pb->>Pb: current へ取り込み・releases へ git mv（最終コミット。承認は書き足さない）
  H->>GH: 署名・push・PR（Closes #N）
  GH->>CI: テスト・spec-gate・pr-scope
  CI-->>GH: GREEN
  H->>GH: 手元で ff マージして push、タグを push
  end
```

### 2.2 初版を起こす（初版起こし PR）

```mermaid
sequenceDiagram
  autonumber
  actor H as 人
  participant St as Steward
  participant GH as GitHub
  participant CI as CI

  H->>St: 対象のツール（機能）と見本の spec.md のパス
  St->>St: spec-init/<dir> に spec.md（front matter の approved と pr は空）
  St->>St: 既存テストの名前に仕様 ID を足す（期待値は変えない）
  H->>GH: 署名・push・PR（本文に未決の件数と人が判断する項目）
  GH->>CI: spec-gate・pr-scope（テストの変更が ID の追加だけか検査）
  H->>H: 未決を読んで「意図」と「不具合」を切り分ける
  H->>GH: spec.md の front matter に approved と pr を書いて push
  H->>GH: 手元で ff マージして push
```

不具合に見える動きは「できること」に入れず「未決」に書き、意図か不具合かを人が決めます。不具合と決めたものは、別の Issue と仕様 PR にします。

## 3. git と GitHub のイベント

| 段階 | イベント | 誰 | 確かめること |
|---|---|---|---|
| きっかけ | Issue を立てる | 人 | 変わる振る舞いを 3 行以内で書く |
| 仕様 PR | `spec/<yyyymmdd>-<slug>` を main から切る | Steward | ID は `npx spec-ids next <dir> --count N` で取る |
| 仕様 PR | 署名して push、PR を開く（`Refs #N`） | 人 | CI の `spec-gate` が GREEN。`pr-scope` は front matter の `approved` と `pr` が入るまで RED |
| 承認 | proposal.md の front matter に `approved: YYYY-MM-DD` と `pr: N` を書いて push | 人 | `pr-scope` が GREEN |
| 承認 | 手元で `git merge --ff-only` して push | 人 | main の `spec-gate` が GREEN（新しい ID が changes にだけあってもテストを求めない） |
| 実装 PR | 実装用のブランチを main から切る | Test Designer | テストのコミットを最初に置く |
| 実装 PR | 実装・版・CHANGELOG のコミット | Coder | テストの期待値を変えていない |
| 実装 PR | 取り込みのコミット（最終） | Publisher | `specs/changes/` が空、`specs/releases/<tag>/` に移動、current の spec.md に承認を書き足していない、`spec-ids check` と `pr-scope` が通る |
| 実装 PR | 署名して push、PR を開く（`Closes #N`） | 人 | CI が GREEN |
| 公開 | 手元で ff マージして push、タグを push | 人 | publish のワークフローが成功 |
| 追随 | 利用側のサイト・プラグイン・レジストリの更新 | 人 | リポジトリごとに違う（付録 A） |

### 3.1 マージは手元の ff マージにする

GitHub の 3 つのマージボタンは、どれも PR のコミットをそのまま main に載せません。

| 方法 | main に載るもの | 署名 |
|---|---|---|
| Create a merge commit | PR のコミット + マージコミット | PR のコミットには残る |
| Squash and merge | 1 つにまとめた新しいコミット | 残らない |
| Rebase and merge | 作り直したコミット（SHA が変わる） | 残らない |
| 手元で `git merge --ff-only` して push | PR のコミットそのもの | 残る |

実装 PR のコミットの順（テスト → 実装 → 取り込み）が main に残ると、「テストを先に書き、Coder は期待値を変えていない」ことを `git log` で追えます。

```bash
git switch main
git pull --ff-only
git merge --ff-only <PRのブランチ>
git push origin main
```

仕様 PR の承認を待たずに、仕様 PR のブランチの上に実装 PR のブランチを積んで進めることがあります。その場合、仕様 PR のコミットは front matter に承認日を書いたとき（や squash したとき）に作り直されるので、実装 PR のブランチは作り直す前のコミットの上に残ります。仕様 PR を ff マージした後、実装 PR のブランチを新しい main の上に載せ直してから ff マージします。

```bash
# <旧仕様コミット> は、実装 PR のブランチが載っている、作り直す前の仕様 PR のコミット
git rebase --onto main <旧仕様コミット> <実装 PR のブランチ>
git switch main
git merge --ff-only <実装 PR のブランチ>
```

載せ直さずにマージコミットで合わせると、作り直す前と後の両方の仕様コミットが main に入り、`specs/changes/` の差分と `specs/releases/<tag>/` への移動が両方残ります（7 章）。

### 3.2 承認の記録

承認日と PR 番号は、ファイルの先頭の front matter の 1 か所にだけ書きます（spec-ids 0.3.0 から）。書式の全体は README の「承認の記録の書き方（front matter）」にあります。

- 承認日と PR 番号は、人がマージの前にそのブランチで書く。マージの後に書くと、承認日を書くためだけの PR が要る
- 仕様 PR: `specs/changes/<id>/proposal.md` の front matter の `approved`（`YYYY-MM-DD`、JST）と `pr`（仕様 PR の番号。`#` は付けない）。Steward は `implementation`（`required` か `none`）と `targets` を書き、`approved:` と `pr:` は空のキーで置く
- 初版起こし: `specs/current/<dir>/spec.md` の front matter の `approved` と `pr`。`spec_id`（設定の `domain`）と、任意の `kind`（`tool`・`cli`・`db`・`common`）は Steward が書く
- 差分で新しく作る機能: `specs/current/<dir>/spec.md` の front matter に、`approved` と `pr` の代わりに `introduced_by: <差分 ID>` を書く。Publisher が取り込みで書く
- 取り込み: current の spec.md には差分の承認を書き足さない。差分の承認は、proposal.md が `specs/releases/<tag>/` に移ることで履歴に入る
- 機能ごとの承認の履歴は `npx spec-ids history <dir>`（すべての機能は `--all`）で見る。ファイルには書き出さない
- 本文に「- 承認日:」の行を書くと、`spec-ids check` の検査 7 が止める（0.2.0 までの形）

```yaml
---
approved: 2026-10-01
pr: 89
implementation: required
targets: [common_errors, get_law_range, get_toc, search_fulltext]
---
```

`targets` には、差分の `specs/<dir>/spec.md` を置いた機能のほか、`## 未決` など ID の無い節だけを直す機能と、差分で新しく作る機能も入れます（5 章）。

## 4. CI

| ジョブ | 何を止めるか | 実装 |
|---|---|---|
| `spec-gate` | 仕様 ID とテストの食い違い（検査 1〜4）と、承認の記録の形（検査 5〜7: front matter の形、`targets` の漏れ、古い「- 承認日:」の行） | `npx spec-ids check`（0.3.0 以上） |
| `pr-scope` | PR の種類ごとに変えてよいパスの外の変更。front matter の承認の空欄（仕様 PR の proposal.md の `approved` と `pr`、変わった current の spec.md の `approved` と `pr`、または `introduced_by`）。`implementation: none` でない仕様 PR による `specs/current/` の書き換え | `npx spec-ids pr-scope`（0.4.0 以上）。PR のときだけ動かし、`actions/checkout` は `fetch-depth: 0`、`npm ci` の後に実行する。基準のコミットとブランチ名は環境変数 `BASE_REF`・`HEAD_REF` で渡す |

`spec-ids check` 0.3.0 の検査は次のとおりです。仕様 PR の後、実装 PR の途中、取り込みの後のどの状態でも通ります。1〜4 は 0.2.0 からの仕様 ID とテストの突き合わせ、5〜7 は 0.3.0 で足した承認の記録の検査です。

| 検査 | 見る集合 |
|---|---|
| 1. 見出しの重複 | current の中と changes の中を別々に |
| 2. テストに無い ID | `specs/current/` の見出し |
| 3. 仕様に無い ID | `specs/current/` と `specs/changes/` の見出しの和 |
| 4. 機能名の不一致 | `specs/current/<dir>/spec.md` の見出し |
| 5. front matter の形 | `specs/current/*/spec.md`、`specs/changes/*/proposal.md`、`specs/releases/*/*/proposal.md` |
| 6. `targets` の漏れ | `specs/changes/<id>/` と `specs/releases/<tag>/<id>/`（差分の `specs/<dir>/spec.md` があるのに `<dir>` が `targets` に無いものを止める） |
| 7. 古い行の残り | 5 と同じファイル（「- 承認日:」で始まる行を止める） |

`spec-ids pr-scope` が PR の種類ごとに許す変更は次のとおりです（1.2 の表を CI で確かめる形）。細かい決まりは README の「PR の種類ごとの検査」にあります。

| ブランチ | 許す変更 | 止める変更 |
|---|---|---|
| `spec/*` | `specs/changes/`。`implementation: none` の差分なら `specs/current/` も | それ以外のパス。proposal.md が無い、または `approved` か `pr` が空 |
| `spec-init/*` | `specs/current/<dir>/spec.md` の追加・書き換え、テスト名に仕様 ID を足すだけの変更（ID の付いたテスト名に別の ID を足すのを含む） | テストの ID を消す・差し替える変更、期待値や本文の変更、それ以外のパス |
| それ以外 | `specs/changes/` → `specs/releases/` の移動、取り込み済みの差分の `specs/changes/<id>/` の残りを消すこと、`specs/` の外の変更 | それ以外の `specs/changes/` の変更 |

どの種類でも、変わった `specs/current/<dir>/spec.md` の front matter に `approved` と `pr`（または `introduced_by`）が無ければ止め、`specs/{current,changes,releases}/.gitkeep` の追加と削除は止めません。

`spec-ids init` が作る `.github/workflows/spec-gate.yml` には、`spec-gate` と `pr-scope` の 2 つのジョブが入っています。

## 5. 差分の書き方

差分の `spec.md` は見出しの単位で書きます。取り込みは、この単位で置き換えるだけで済む形にします。

- `## MODIFIED` の `### SPEC-…`: current の同じ ID の節（見出しから次の `###` または `##` の手前まで）を丸ごと置き換える
- `## ADDED` の `### SPEC-…`: current の「できること」の末尾に足す
- `## REMOVED` の `### SPEC-…`: current から消す。テストの ID を外すのは取り込みと同じコミット
- `## 入力` `## できないこと` `## 未決` など ID の無い節: current の同じ見出しの節を丸ごと置き換える

ID の無い節（`## 入力`・`## できないこと`・`## 未決`・`## 処理の流れ` など）の直しも、差分の `spec.md` に節として書きます。こうすると、取り込みは見出しの単位で置き換えるだけで済み、後で取り込みを機械で行うとき（`spec-ids apply` などを作るとき）にも同じ形で扱えます。proposal.md の「取り込みのとき（Publisher）」に文章で書く形は、Publisher の解釈が要るため、これからの差分では使いません（2026-10-09 JST に決定。spec-ids PR #10 の D1 の案 A）。proposal.md の front matter の `targets` には、差分の `spec.md` を置いた機能をすべて入れます。ID の無い節だけを直す機能も、差分の `specs/<dir>/spec.md` を置くので `targets` に入ります。

- 実例: houki-nta-mcp の仕様 PR #160（差分 `20261009-db-folder-access-and-tsutatsu-guide`）は、`db_schema` の `## 処理の流れ` と `nta_get_tsutatsu` の `## できないこと` を差分の `spec.md` に節として書いています

取り込み済みの差分のうち houki-nta-mcp の 9 件と houki-egov-mcp の 2 件は、文章で書いた形のまま残しており、書き直しません。`spec-ids check` の検査 6 は、`targets` にあるのに差分の `specs/<dir>/` が無い機能を止めないので、この 11 件も含めてどちらの形も通ります。

人が差分を読むときは、取り込みの前後を `git diff --no-index --word-diff` で並べると、見慣れた diff の形で確かめられます。

## 6. 各役への指示文

どの指示文も「役」「ブランチ」「読むもののパス」「規則（AGENTS.md）」「コミットの単位」を書き、内容の要約は書きません。

### Steward（仕様 PR）

```
<リポジトリ> の Issue #N について、仕様 PR の差分草案を書いてください。役は Spec Steward です。実装とテストは書きません。
ブランチ: spec/<yyyymmdd>-<slug>（main から切る）
読むもの: Issue #N、specs/current/<dir>/spec.md、AGENTS.md
書くもの: specs/changes/<yyyymmdd>-<slug>/proposal.md（先頭の front matter に implementation: required / none と targets を書き、approved: と pr: は空のキーで置く。本文に変わる振る舞い / 変わらない振る舞い / 対象外 / 人が判断すること）と specs/<dir>/spec.md（見出し単位の差分）
ID の無い節（## 入力・## できないこと・## 未決・## 処理の流れ など）の直しも specs/<dir>/spec.md に節として書き、proposal.md に文章で書かない。
targets には、ID の無い節だけを直す機能と、差分で新しく作る機能も入れる。本文に「- 承認日:」の行は書かない。
ID は npx spec-ids next <dir> --count N で取る。コミットは 1 つ。
```

### Test Designer（実装 PR の最初）

```
<リポジトリ> の実装 PR の受入テストを書いてください。役は Test Designer です。実装は見ません。
ブランチ: <実装用ブランチ>（main から切る）
承認済みの差分: specs/changes/<id>/specs/<dir>/spec.md
規則: AGENTS.md。テスト名の先頭に仕様 ID を書く。外部サイトは差し替える。
既存テストの期待値が承認済みの差分で変わる場合は、準備の部分を直してよい。期待値を変えるなら理由を報告する。
コミットは「test: …」の 1 つ。
```

### Coder

```
<リポジトリ> の #N を実装してください。役は Coder です。specs/ は書き換えません。
ブランチ: <実装用ブランチ>
承認済みの差分: specs/changes/<id>/specs/<dir>/spec.md
受入テスト: このブランチの test: で始まるコミット
規則: AGENTS.md。テストの期待値は変えない。版と CHANGELOG を更新する。コミットは「feat:」または「fix:」で始める。
```

### Publisher（実装 PR の最後）

```
<リポジトリ> の実装 PR の最終コミットとして、承認済み差分を specs/current/ に取り込んでください。役は Spec Publisher です。実装とテストは触りません。
ブランチ: <実装用ブランチ>
差分: specs/changes/<id>/
やること: 見出し単位で current に取り込む（current の spec.md に承認は書き足さない。差分で新しく作る機能は front matter に introduced_by: <id> を書く）、git mv で specs/releases/<次のタグ>/ へ移す、proposal.md の「状態」を取り込み済みにする、spec-ids check と pr-scope が通ること、npx spec-ids history <dir> にこの差分が次のタグで出ることを確かめる。
差分の spec.md の ID の無い節（## 入力・## できないこと・## 未決・## 処理の流れ など）は、current の同じ見出しの節と置き換える。
コミットは「spec: <id> を specs/current/ に取り込み、releases/<tag>/ へ移す」の 1 つ。
```

## 7. 回してみて分かったこと

houki-nta-mcp で差分 2 件（`20260924-tsutatsu-clause-forms`、`20260925-tsutatsu-live-toc`）と初版起こし 2 件を、houki-abbreviations で初版起こし 1 件と差分 2 件（`20260927-undecided-to-issues`、`20260927-untested-behaviors`）を回した記録です。最後の 2 行は、houki 系 3 リポジトリを spec-ids 0.3.0 の front matter の形に変換したとき（2026-10-09 JST）に分かったことです。

| 起きたこと | 原因 | 対処 |
|---|---|---|
| 1 つの差分に PR が 4 本かかった（差分草案・実装・取り込み・承認日） | 承認・実装・取り込みをそれぞれマージで区切っていた | 仕様 PR と実装 PR の 2 本にし、取り込みは実装 PR の最終コミットにした |
| 承認日を書くためだけの PR が要った | 承認（マージ）の後でないと日付を書けないと考えていた | 人がマージの前にそのブランチで書く。`pr-scope` が空欄を止める |
| 仕様 PR をマージすると main の `spec-gate` が RED になる見込みだった | spec-ids 0.1.0 が `specs/changes/` の ID にもテストを求めていた | spec-ids 0.2.0 で突き合わせを current と changes に分けた |
| 実装 PR を 2 段階に分けたら、途中の段階で返す内容が仕様に無かった | 段階 1 のテストが、段階 2 の処理が無いと決まらない振る舞いを含んでいた | 実装 PR を 1 本にまとめた。出荷しない途中の状態のために仕様を書かない |
| main でコミットの順（テスト → 実装 → 取り込み）が消えた | GitHub の Squash and merge を使った | 手元の ff マージにする |
| 手元で `spec-ids check` が CI と違う結果を出した | 手元の node_modules が古い版のまま | 依存を上げた後は `npm ci` をやり直す |
| 差分を読みづらい場面があった | 文面の大きな書き換え | 見出し単位の差分にし、`git diff --no-index --word-diff` を併用する |
| 初版起こしで、仕様に書かれたとおりの動きが不具合だった（一度取得すると同じ通達の他の節が取れない） | 初版は実装から起こすので、不具合も文面に入る | 未決に書き、Issue → 仕様 PR にする。試用（実際の呼び出し）で見つかることが多い |
| 実装 PR をマージした後の main に、`specs/changes/<id>/` と `specs/releases/<tag>/<id>/` の両方が残り、proposal.md に衝突の印（`<<<<<<<`）が入った | 実装 PR のブランチを仕様 PR のブランチの上に積んでいて、仕様 PR のコミットが承認日の追記で作り直された。載せ直さずにマージコミットで合わせたため、作り直す前と後の仕様コミットが両方入った | 仕様 PR のマージ後に、実装 PR のブランチを `git rebase --onto` で新しい main に載せ直してから ff マージする（3.1）。残ったものは片付けの実装 PR で消す（`spec-ids pr-scope` は、releases にある差分の changes の残りを消すことを許す） |
| AGENTS.md や `pr-scope` のエラー文の見本「YYYY-MM-DD（PR #N）」が、実際の日付と番号に置き換わった | 取り込みで各 spec.md に入れた「YYYY-MM-DD（PR #N）」を、リポジトリ全体の一括置換で埋めた | 置き換えは `specs/current/` に限る。取り込みの時点で Publisher が日付と番号を書く（実装 PR を開く前に仕様 PR の番号は分かっている）。spec-ids 0.3.0 からは取り込みで current に承認を書き足さないので、この置き換えをする場面そのものが無い |
| 1 つの未決の項目に、テストを足せばよい部分と判断が要る部分が混ざっていた（`limit` の既定値と `NaN` の扱い） | 初版起こしで、同じ引数についての観察を 1 項目にまとめた | 未決を振り分けるときに 2 項目に分け、判断が要る方だけを Issue にする |
| houki-abbreviations の current の 23 本で、初版の PR 番号が #10 から #26 に置き換わり、差分 `20260927-undecided-to-issues`（PR #26）の記録がどの行からも消えていた | コミット `151d255` が差分の承認を書き足すときに、23 本の「- 承認日:」の行の初版の「PR #10」を「PR #26」に書き換えた。上の行と同じ、一括の書き換えによる事故 | 変換の前直し F4 で、初版を PR #10 に戻し、差分を書き足した（houki-abbreviations PR #38）。0.3.0 からは current に承認を書き足す手順そのものが無い |
| current の「- 承認日:」の行と `specs/releases/` の差分が、取り込み済みの 50 件中 20 件で食い違っていた（対象の機能の集合か、承認日と PR 番号） | 同じ承認を、current の行と proposal.md の 2 か所に手で書いていた。ID の無い節だけを直した機能は current の行にだけ書かれていた | spec-ids 0.3.0 で承認の記録を proposal.md の front matter の 1 か所にした（spec-ids #5）。変換では、16 件は current の行の機能と差分の `specs/<dir>/` の和を `targets` にし、4 件は前直し F1〜F4 で古い形のまま直してから変換した。houki-nta-mcp の未取り込みの差分 `20261009-inspect-pdf-meta-qa-jirei`（PR #157）は、前直し F5（houki-hub の計画書の Q22'）で current の行に書き足してから変換した（houki-egov-mcp PR #117、houki-nta-mcp PR #159、houki-abbreviations PR #38） |

## 8. 実行する環境ごとの違い

役割を分ける規則と、2 本の PR の流れは、どこで回しても同じです。変わるのは「誰が push するか」「会話をどう分けるか」「どこで止めるか」です。

| 項目 | Cowork（今回） | Claude Code（手元の端末） | Claude Code のクラウドセッション |
|---|---|---|---|
| 作業する場所 | Cowork の VM から、手元の Mac の作業フォルダーを読み書き | 手元の Mac の作業フォルダー | Anthropic のクラウドの VM に GitHub のリポジトリを clone |
| GitHub への push・PR | エージェントからは届かない。人が push し、PR 本文を貼る | 人の git と `gh` の設定をそのまま使える | エージェントがブランチを push し、画面から PR を作れる |
| 署名 | エージェントのコミットは未署名。人が `rebase --exec` で署名して push | 人の署名設定がそのまま効く | 署名鍵はサンドボックスの外に置かれ、プロキシが扱う。GitHub 上でどの鍵の署名として表示されるかは、最初の 1 回で確かめる |
| 会話を分ける方法 | 役ごとに別の会話 | 役ごとに別のセッション、またはサブエージェント（`.claude/agents/`） | 役ごとに別のセッション（並べて走らせられる）、またはサブエージェント |
| hooks | 効かない（VM のシェルで書くため） | リポジトリの `.claude/settings.json` の hooks が効く | リポジトリにコミットした `.claude/settings.json` の hooks が効く |
| 止める主な場所 | CI | hooks（手元）と CI | CI。hooks はリポジトリにコミットしたものだけ |
| つまずき | 削除の許可が切れると `.git` にロックファイルが残る。手元の node_modules は macOS 用 | 手元の状態（未コミットの変更、古い依存）がそのまま入る | 手元の設定は使われない。依存や DB が要るなら環境の setup script に書く |

### 8.1 クラウドセッションで変わること

- **push と PR をエージェントが行える。** 仕様 PR・実装 PR とも、ブランチの push と PR の作成までをセッションの中で終えられる。人が行うのは、承認日を書くこと（またはその指示）と、マージとタグ
- **マージの方法を決めておく必要がある。** クラウドセッションが作った PR も、GitHub のボタンで取り込むと 3.1 の問題が起きる。手元の ff マージにするか、署名を要件にしない運用にするかを先に決める
- **役割ごとにセッションを並べられる。** Test Designer と Coder を別のセッションにしても、互いにブランチを push して受け渡せる。受け渡しはブランチ名とパスで行う
- **CI の失敗への対応を任せられる（Auto-fix）。** Claude GitHub App を入れると、PR の CI の失敗やレビューのコメントにセッションが応じる。ただし「テストの期待値を変えない」を AGENTS.md と `pr-scope` で止めておかないと、テストを直して GREEN にする応じ方をしうる
- **hooks をリポジトリに置く意味が出る。** クラウドセッションは手元の設定を読まないので、止めたい規則は `.claude/settings.json`（コミットする）と CI に置く。houki-nta-mcp は今 `.claude/` を .gitignore しているので、hooks を使うなら見直しが要る

### 8.2 おすすめの組み合わせ

| 役 | 環境 | 理由 |
|---|---|---|
| Steward（差分草案・初版起こし） | Cowork または手元の Claude Code | 試用（実際の MCP の呼び出し）や人との相談が多い |
| Test Designer・Coder | クラウドセッション | 手順が決まっていて、並べて走らせられる。push と PR まで任せられる |
| Publisher | クラウドセッション、または手元 | 機械的な取り込み。取り込みの自動化（`spec-ids apply`、10 章）が入ればスクリプトで足りる |
| 人 | 手元 | 承認、署名、ff マージ、タグ |

## 9. 他のリポジトリへの導入

1. `npm install --save-dev @shuji-bonji/spec-ids` と `npx spec-ids init --domain <領域> --dir-prefix <接頭辞>` で、依存と `specs/`・`specs/spec-ids.json`・`spec-gate.yml` を作る
2. AGENTS.md に「仕様の正本」「仕様 ID」「PR の種類」「承認の記録」「役割」の節を置く（houki-nta-mcp の AGENTS.md が見本。「承認の記録」は front matter の書き方）
3. `pr-scope` は、1 の `init` が作る `spec-gate.yml` の `pr-scope` のジョブ（`npx spec-ids pr-scope`）で入る。`spec-gate.yml` を作らず既存の `ci.yml` にまとめるときは、`pull_request` のときだけ動くジョブを作り、`actions/checkout` に `fetch-depth: 0` を付け、`npm ci` の後に `npx spec-ids pr-scope` を、環境変数 `BASE_REF: origin/${{ github.base_ref }}` と `HEAD_REF: ${{ github.head_ref }}` を付けて実行する。ブランチ名は 1.2 の接頭辞（`spec/`・`spec-init/`）にそろえる
4. 最初の 1 機能を初版起こし（`spec-init/<dir>`）で入れ、テスト名に ID を付ける。spec.md は最初から front matter の形で書く
5. main のマージ方法を手元の ff マージにそろえる（GitHub の設定で squash と rebase のボタンを外す）

テストの書き方がリポジトリごとに違う点（Vitest の `it`、Jasmine の `describe`、`node:test` の `test`）は、`specs/spec-ids.json` の `tests` の glob で合わせます。`spec-ids check` は `describe` / `it` / `test` の第 1 引数の文字列を読みます。

## 10. まだ決まっていないこと

| 項目 | 状態 |
|---|---|
| 取り込みの自動化（`spec-ids apply`） | 5 章の書式で houki-nta-mcp の差分 2 件を手で取り込んだ。0.3.0 には入れていない。入れる版は決まっていない |
| spec-ids 自身の `specs/` | spec-ids #5 の後に、最初から front matter の形で初版起こしする（houki-hub の計画書の Q21 の案 A'）。`spec-gate` は 1 つ前に publish した版の `check` で回す |
| Auditor | 今は人の目と CI だけ。ID ごとの一致を CI の結果から PR に出す形を検討する |
| クラウドセッションの署名 | どの鍵の署名として GitHub に出るかを、最初の運用で確かめて 8 章を直す |

0.4.0 で決まったもの（spec-ids #9）:

- `pr-scope` の置き場: houki-egov-mcp・houki-nta-mcp・houki-abbreviations の `.github/scripts/check-pr-scope.mjs` のコピーを、spec-ids のサブコマンド `spec-ids pr-scope` にまとめた。コピーの違いは、テスト名に ID を足すだけかの判定を houki-egov-mcp・houki-nta-mcp の形に、`.gitkeep` の除外と取り込み済み差分の残りの削除を「入れる」にそろえ、houki-nta-mcp のコピーにあった変換のための例外（houki-hub の計画書の Q23'）は入れなかった。ブランチ名の接頭辞は固定し、設定には出していない
- `spec-ids migrate`: houki 系 3 リポジトリの変換は 2026-10-09 JST に済んだ（houki-egov-mcp PR #117、houki-nta-mcp PR #159、houki-abbreviations PR #38）ので、0.4.0 で外した。0.2.0 までの形のリポジトリは、`npx @shuji-bonji/spec-ids@0.3.0 migrate --write` で変換してから上げる

## 付録 A. houki-nta-mcp での追随作業

実装 PR をマージしてタグを push した後に行うこと（houki 系の MCP の例）。

1. タグの push で `publish.yml` が npm に公開する
2. `mcp-publisher publish` で MCP Registry に公開する
3. claude-plugins の版を上げる
4. houki-hub で `npm run build`（ツールリファレンスの再生成）と `node scripts/generate-stack.mjs --readme`。応答が変わったツールは `scripts/reference-examples/` の呼び出し例を取り直す
5. Issue に返信して close する
