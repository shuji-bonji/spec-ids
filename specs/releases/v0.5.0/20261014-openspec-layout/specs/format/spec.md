# 差分: format（openspec レイアウト）

差分 `20261014-openspec-layout` の format の節。取り込みは見出しの単位で `specs/current/format/spec.md` と置き換える。

## MODIFIED

### SPEC-SPECIDS-FORMAT-003 仕様書の ID は ### の見出しの先頭にあるものだけを数える

仕様書の中で仕様 ID として数えるのは、`###` で始まる見出しの先頭に書いた ID だけとする。先頭とは、`###` と 1 つ以上の空白の直後、または `###`・空白・`Requirement:`・1 つ以上の空白の直後（SPEC-SPECIDS-FORMAT-006）のどちらか。`##` の見出しの ID、本文の中の ID、見出しの 2 つ目以降の ID は数えない。本文で他の ID を参照してよい。

例: 本文が `## SPEC-NTA-A-001 x`・`### SPEC-NTA-A-002 y`・`本文 SPEC-NTA-A-003`・`###  SPEC-NTA-A-004 z` の 4 行なら、数えるのは `SPEC-NTA-A-002` と `SPEC-NTA-A-004`。`check` で、本文で `SPEC-NTA-GET-TSUTATSU-005` に触れるだけの仕様書は、その ID を持たない（SPEC-SPECIDS-CHECK-008）。

## ADDED

### SPEC-SPECIDS-FORMAT-006 ### Requirement: の直後の ID も、どちらのレイアウトでも数える

`###`、1 つ以上の空白、`Requirement:`、1 つ以上の空白、ID の順に書いた見出しも、仕様 ID の見出しとして数える（OpenSpec の要求の見出しの形）。`Requirement:` の大文字小文字は区別し、`Requirement:` と ID のあいだに空白が無いもの、`Requirement:` の後に ID 以外の語が先にあるものは数えない。レイアウトが `specs` でも `openspec` でも同じに読む。`next`・`check`・`pr-scope` のどれも、この見出しを `### SPEC-…` の見出しと同じに扱う。

例: 本文が `### Requirement: SPEC-READER-READ-TEXT-001 pages で指定したページだけを返す`・`### Requirement:SPEC-READER-READ-TEXT-002 x`・`### requirement: SPEC-READER-READ-TEXT-003 x`・`### Requirement: 題 SPEC-READER-READ-TEXT-004` の 4 行なら、数えるのは `SPEC-READER-READ-TEXT-001` だけ。specs レイアウトの `specs/current/nta_get_tsutatsu/spec.md` に `### Requirement: SPEC-NTA-GET-TSUTATSU-003 y` と書いても、`SPEC-NTA-GET-TSUTATSU-003` として数える。
