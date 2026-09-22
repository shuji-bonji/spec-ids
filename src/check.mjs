/**
 * 仕様 ID とテストの突き合わせ。
 *
 * 次のどれかが 1 つでもあれば失敗。
 *   1. 仕様の見出し（`### SPEC-…`）に同じ ID が 2 回以上ある（採番の衝突）
 *   2. 仕様にあってテストに無い ID
 *   3. テストにあって仕様に無い ID
 *   4. specs/current/<dir>/spec.md の見出しの ID の領域・機能が、設定の領域と
 *      そのディレクトリ名から導いた機能に一致しない（別の機能の数列を伸ばしている）
 *
 * テストは実行しない。番号の欠番も見ない。
 */
import { readFileSync } from 'node:fs';
import { HEADING_RE, ID_RE, parseId, TEST_NAME_RE } from './format.mjs';
import {
  collect,
  collectHeadings,
  featureOfSpecPath,
  relPath,
  specFiles,
  testFiles,
} from './scan.mjs';

/**
 * @returns {{ ok: boolean, counts: object, duplicated: Array, missingTests: Array, missingSpecs: Array, misplaced: Array }}
 */
export function check(root, config) {
  const specs = specFiles(root);
  const tests = testFiles(root, config.tests);

  const specIds = collect(root, specs, (text) => text.match(ID_RE) ?? []);
  const testIds = collect(root, tests, (text) => {
    const ids = [];
    for (const m of text.matchAll(TEST_NAME_RE)) ids.push(...(m[2].match(ID_RE) ?? []));
    return ids;
  });
  const headings = collectHeadings(root, specs);

  const duplicated = [...headings.entries()]
    .filter(([, files]) => files.length > 1)
    .map(([id, files]) => ({ id, files }))
    .sort((a, b) => a.id.localeCompare(b.id));
  const missingTests = [...specIds.keys()]
    .filter((id) => !testIds.has(id))
    .sort()
    .map((id) => ({ id, files: [...specIds.get(id)] }));
  const missingSpecs = [...testIds.keys()]
    .filter((id) => !specIds.has(id))
    .sort()
    .map((id) => ({ id, files: [...testIds.get(id)] }));

  const misplaced = [];
  for (const f of specs) {
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
      specFiles: specs.length,
      specIds: specIds.size,
      headings: headings.size,
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
    `spec files: ${counts.specFiles}, spec IDs: ${counts.specIds}（見出し: ${counts.headings}）`,
    `test files: ${counts.testFiles}, test IDs: ${counts.testIds}`,
  ];
  const err = [];
  if (result.duplicated.length > 0) {
    err.push('', '仕様の見出しに同じ ID が 2 回以上ある（採番の衝突）:');
    for (const d of result.duplicated) err.push(`  ${d.id}  (${d.files.join(', ')})`);
  }
  if (result.misplaced.length > 0) {
    err.push('', '見出しの ID が、その spec.md のディレクトリから導いた機能と一致しない:');
    for (const m of result.misplaced) err.push(`  ${m.id}  (${m.file}、期待する形: ${m.expected})`);
  }
  if (result.missingTests.length > 0) {
    err.push('', '仕様にあってテストに無い ID:');
    for (const m of result.missingTests) err.push(`  ${m.id}  (${m.files.join(', ')})`);
  }
  if (result.missingSpecs.length > 0) {
    err.push('', 'テストにあって仕様に無い ID:');
    for (const m of result.missingSpecs) err.push(`  ${m.id}  (${m.files.join(', ')})`);
  }
  if (result.ok) out.push('OK: 仕様 ID とテストが一致しています');
  return { out, err };
}
