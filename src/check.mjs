/**
 * 仕様 ID とテストの突き合わせ。
 *
 * 仕様の ID は見出し（`### SPEC-…`）だけを数える。本文の参照は数えない。
 * 見る箱は 2 つある。
 *   - current: `specs/current/` の下の `spec.md`。出荷済みの正
 *   - changes: `specs/changes/` の下の `spec.md`。承認済みでも未出荷の差分
 *
 * 次のどれかが 1 つでもあれば失敗。
 *   1. 同じ箱の中で、見出しに同じ ID が 2 回以上ある（採番の衝突）。current と changes の
 *      あいだは見ない（MODIFIED / REMOVED の差分は current と同じ ID の見出しを持つ）
 *   2. current の見出しにあってテストに無い ID（出荷済みの正にテストが付いていない）。
 *      changes にだけある ID はテストを求めない（仕様 PR のマージ後、実装 PR の前）
 *   3. テストにあって、current にも changes にも見出しが無い ID
 *   4. specs/current/<dir>/spec.md の見出しの ID の領域・機能が、設定の領域と
 *      そのディレクトリ名から導いた機能に一致しない（別の機能の数列を伸ばしている）
 *
 * テストは実行しない。番号の欠番も見ない。
 */
import { readFileSync } from 'node:fs';
import { HEADING_RE, ID_RE, parseId, TEST_NAME_RE } from './format.mjs';
import {
  changesSpecFiles,
  collect,
  collectHeadings,
  currentSpecFiles,
  featureOfSpecPath,
  relPath,
  testFiles,
} from './scan.mjs';

/** 同じ箱の中で 2 回以上現れた見出しを返す */
function duplicatesIn(headings, box) {
  return [...headings.entries()]
    .filter(([, files]) => files.length > 1)
    .map(([id, files]) => ({ id, box, files }));
}

/**
 * @returns {{ ok: boolean, counts: object, duplicated: Array, missingTests: Array, missingSpecs: Array, misplaced: Array }}
 */
export function check(root, config) {
  const current = currentSpecFiles(root);
  const changes = changesSpecFiles(root);
  const tests = testFiles(root, config.tests);

  const currentHeadings = collectHeadings(root, current);
  const changesHeadings = collectHeadings(root, changes);
  const testIds = collect(root, tests, (text) => {
    const ids = [];
    for (const m of text.matchAll(TEST_NAME_RE)) ids.push(...(m[2].match(ID_RE) ?? []));
    return ids;
  });

  const duplicated = [
    ...duplicatesIn(currentHeadings, 'current'),
    ...duplicatesIn(changesHeadings, 'changes'),
  ].sort((a, b) => a.id.localeCompare(b.id) || a.box.localeCompare(b.box));
  const missingTests = [...currentHeadings.keys()]
    .filter((id) => !testIds.has(id))
    .sort()
    .map((id) => ({ id, files: [...new Set(currentHeadings.get(id))] }));
  const missingSpecs = [...testIds.keys()]
    .filter((id) => !currentHeadings.has(id) && !changesHeadings.has(id))
    .sort()
    .map((id) => ({ id, files: [...testIds.get(id)] }));

  const misplaced = [];
  for (const f of current) {
    const feature = featureOfSpecPath(root, f, config.dirPrefix);
    if (!feature) continue;
    const text = readFileSync(f, 'utf8');
    for (const m of text.matchAll(HEADING_RE)) {
      const p = parseId(m[1]);
      if (!p || p.domain !== config.domain || p.feature !== feature) {
        misplaced.push({
          id: m[1],
          file: relPath(root, f),
          expected: `SPEC-${config.domain}-${feature}-###`,
        });
      }
    }
  }

  return {
    ok:
      duplicated.length === 0 &&
      missingTests.length === 0 &&
      missingSpecs.length === 0 &&
      misplaced.length === 0,
    counts: {
      currentFiles: current.length,
      currentHeadings: currentHeadings.size,
      changesFiles: changes.length,
      changesHeadings: changesHeadings.size,
      testFiles: tests.length,
      testIds: testIds.size,
    },
    duplicated,
    missingTests,
    missingSpecs,
    misplaced,
  };
}

/** 結果を人が読む行にする。stdout 用と stderr 用に分けて返す */
export function formatReport(result) {
  const { counts } = result;
  const out = [
    `current: ${counts.currentFiles} files, ${counts.currentHeadings} IDs / changes: ${counts.changesFiles} files, ${counts.changesHeadings} IDs`,
    `tests: ${counts.testFiles} files, ${counts.testIds} IDs`,
  ];
  const err = [];
  if (result.duplicated.length > 0) {
    err.push(
      '',
      '同じ箱（current または changes）の見出しに同じ ID が 2 回以上ある（採番の衝突）:'
    );
    for (const d of result.duplicated) err.push(`  ${d.id}  [${d.box}] (${d.files.join(', ')})`);
  }
  if (result.misplaced.length > 0) {
    err.push('', '見出しの ID が、その spec.md のディレクトリから導いた機能と一致しない:');
    for (const m of result.misplaced) err.push(`  ${m.id}  (${m.file}、期待する形: ${m.expected})`);
  }
  if (result.missingTests.length > 0) {
    err.push('', 'specs/current にあってテストに無い ID:');
    for (const m of result.missingTests) err.push(`  ${m.id}  (${m.files.join(', ')})`);
  }
  if (result.missingSpecs.length > 0) {
    err.push('', 'テストにあって specs/current にも specs/changes にも見出しが無い ID:');
    for (const m of result.missingSpecs) err.push(`  ${m.id}  (${m.files.join(', ')})`);
  }
  if (result.ok) out.push('OK: 仕様 ID とテストが一致しています');
  return { out, err };
}
