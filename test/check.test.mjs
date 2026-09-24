import assert from 'node:assert/strict';
import { test } from 'node:test';
import { check, formatReport } from '../src/check.mjs';
import { CONFIG, fixture, SPEC_OK, TEST_OK } from './helpers.mjs';

test('仕様とテストが一致していれば ok', () => {
  const root = fixture({
    'specs/current/nta_get_tsutatsu/spec.md': SPEC_OK,
    'src/tools/handlers.test.ts': TEST_OK,
  });
  const r = check(root, CONFIG);
  assert.equal(r.ok, true);
  assert.deepEqual(r.counts, {
    currentFiles: 1,
    currentHeadings: 2,
    changesFiles: 0,
    changesHeadings: 0,
    testFiles: 1,
    testIds: 2,
  });
  assert.match(formatReport(r).out.at(-1), /^OK/);
});

test('仕様にあってテストに無い ID を報告する', () => {
  const root = fixture({
    'specs/current/nta_get_tsutatsu/spec.md': SPEC_OK,
    'src/x.test.ts': `it('SPEC-NTA-GET-TSUTATSU-001 a', () => {});`,
  });
  const r = check(root, CONFIG);
  assert.equal(r.ok, false);
  assert.deepEqual(
    r.missingTests.map((m) => m.id),
    ['SPEC-NTA-GET-TSUTATSU-002']
  );
  assert.equal(r.missingSpecs.length, 0);
});

test('テストにあって仕様に無い ID を報告する', () => {
  const root = fixture({
    'specs/current/nta_get_tsutatsu/spec.md': SPEC_OK,
    'src/x.test.ts': `${TEST_OK}\nit('SPEC-NTA-GET-TSUTATSU-009 old', () => {});`,
  });
  const r = check(root, CONFIG);
  assert.equal(r.ok, false);
  assert.deepEqual(
    r.missingSpecs.map((m) => m.id),
    ['SPEC-NTA-GET-TSUTATSU-009']
  );
});

test('見出しの重複を報告する（本文の参照が残っていても見出しで検知する）', () => {
  const dup = SPEC_OK.replace('### SPEC-NTA-GET-TSUTATSU-002', '### SPEC-NTA-GET-TSUTATSU-001');
  const root = fixture({ 'specs/current/nta_get_tsutatsu/spec.md': dup, 'src/x.test.ts': TEST_OK });
  const r = check(root, CONFIG);
  assert.equal(r.ok, false);
  assert.deepEqual(
    r.duplicated.map((d) => d.id),
    ['SPEC-NTA-GET-TSUTATSU-001']
  );
  assert.equal(r.duplicated[0].files.length, 2);
});

test('見出しの機能がディレクトリ名と違えば報告する', () => {
  const wrong = SPEC_OK.replace(
    '### SPEC-NTA-GET-TSUTATSU-002',
    '### SPEC-NTA-SEARCH-TSUTATSU-002'
  );
  const root = fixture({
    'specs/current/nta_get_tsutatsu/spec.md': wrong,
    'src/x.test.ts': TEST_OK.replace('SPEC-NTA-GET-TSUTATSU-002', 'SPEC-NTA-SEARCH-TSUTATSU-002'),
  });
  const r = check(root, CONFIG);
  assert.equal(r.ok, false);
  assert.deepEqual(r.misplaced, [
    {
      id: 'SPEC-NTA-SEARCH-TSUTATSU-002',
      file: 'specs/current/nta_get_tsutatsu/spec.md',
      expected: 'SPEC-NTA-GET-TSUTATSU-###',
    },
  ]);
});

test('領域が設定と違えば報告する', () => {
  const wrong = SPEC_OK.replaceAll('SPEC-NTA-', 'SPEC-EGOV-');
  const root = fixture({
    'specs/current/nta_get_tsutatsu/spec.md': wrong,
    'src/x.test.ts': TEST_OK.replaceAll('SPEC-NTA-', 'SPEC-EGOV-'),
  });
  const r = check(root, CONFIG);
  assert.equal(r.misplaced.length, 2);
});

const ADDED_003 = '## ADDED\n\n### SPEC-NTA-GET-TSUTATSU-003 新しい\n';
const TEST_003 = `it('SPEC-NTA-GET-TSUTATSU-003 新しい振る舞い', () => {});`;

test('仕様 PR のあと: changes にだけある ID はテストを求めない', () => {
  const root = fixture({
    'specs/current/nta_get_tsutatsu/spec.md': SPEC_OK,
    'specs/changes/20260925-x/spec.md': ADDED_003,
    'src/x.test.ts': TEST_OK,
  });
  const r = check(root, CONFIG);
  assert.equal(r.ok, true);
  assert.equal(r.counts.changesHeadings, 1);
});

test('実装 PR の途中: テストの ID が changes にあれば、current がまだ古くても通る', () => {
  const root = fixture({
    'specs/current/nta_get_tsutatsu/spec.md': SPEC_OK,
    'specs/changes/20260925-x/spec.md': ADDED_003,
    'src/x.test.ts': `${TEST_OK}\n${TEST_003}`,
  });
  assert.equal(check(root, CONFIG).ok, true);
});

test('取り込み後: current とテストに ID があり、releases へ移った差分は見ない', () => {
  const root = fixture({
    'specs/current/nta_get_tsutatsu/spec.md': `${SPEC_OK}\n### SPEC-NTA-GET-TSUTATSU-003 新しい\n`,
    'specs/releases/v1.0.0/20260925-x/specs/nta_get_tsutatsu/spec.md': ADDED_003,
    'specs/releases/v0.9.0/nta_get_tsutatsu/spec.md': '### SPEC-NTA-GET-TSUTATSU-099 古い版\n',
    'src/x.test.ts': `${TEST_OK}\n${TEST_003}`,
  });
  const r = check(root, CONFIG);
  assert.equal(r.ok, true);
  assert.equal(r.counts.changesFiles, 0);
});

test('current にある ID は、changes に同じ見出しがあってもテストを求める', () => {
  const root = fixture({
    'specs/current/nta_get_tsutatsu/spec.md': SPEC_OK,
    'specs/changes/20260925-x/spec.md': '## MODIFIED\n\n### SPEC-NTA-GET-TSUTATSU-002 変える\n',
    'src/x.test.ts': `it('SPEC-NTA-GET-TSUTATSU-001 a', () => {});`,
  });
  const r = check(root, CONFIG);
  assert.equal(r.ok, false);
  assert.deepEqual(
    r.missingTests.map((m) => m.id),
    ['SPEC-NTA-GET-TSUTATSU-002']
  );
});

test('MODIFIED の見出しが current と同じ ID でも、重複として扱わない', () => {
  const root = fixture({
    'specs/current/nta_get_tsutatsu/spec.md': SPEC_OK,
    'specs/changes/20260925-x/spec.md': '## MODIFIED\n\n### SPEC-NTA-GET-TSUTATSU-002 変える\n',
    'src/x.test.ts': TEST_OK,
  });
  const r = check(root, CONFIG);
  assert.equal(r.ok, true);
  assert.equal(r.duplicated.length, 0);
});

test('changes の中で同じ ID の見出しが 2 つあれば重複として報告する', () => {
  const root = fixture({
    'specs/current/nta_get_tsutatsu/spec.md': SPEC_OK,
    'specs/changes/20260925-a/spec.md': ADDED_003,
    'specs/changes/20260925-b/spec.md': ADDED_003,
    'src/x.test.ts': TEST_OK,
  });
  const r = check(root, CONFIG);
  assert.equal(r.ok, false);
  assert.deepEqual(
    r.duplicated.map((d) => [d.id, d.box, d.files.length]),
    [['SPEC-NTA-GET-TSUTATSU-003', 'changes', 2]]
  );
});

test('仕様の ID は見出しだけを数える（本文の参照だけの ID はテストにあれば報告する）', () => {
  const root = fixture({
    'specs/current/nta_get_tsutatsu/spec.md': `${SPEC_OK}\n本文だけで SPEC-NTA-GET-TSUTATSU-005 に触れる。\n`,
    'src/x.test.ts': `${TEST_OK}\nit('SPEC-NTA-GET-TSUTATSU-005 x', () => {});`,
  });
  const r = check(root, CONFIG);
  assert.equal(r.ok, false);
  assert.deepEqual(
    r.missingSpecs.map((m) => m.id),
    ['SPEC-NTA-GET-TSUTATSU-005']
  );
  assert.equal(r.missingTests.length, 0);
});

test('tests の glob は設定で変えられる（Jasmine の *.spec.ts など）', () => {
  const root = fixture({
    'specs/current/get_law/spec.md': SPEC_OK.replaceAll('NTA-GET-TSUTATSU', 'EGOV-GET-LAW'),
    'src/app/a.spec.ts': TEST_OK.replaceAll('NTA-GET-TSUTATSU', 'EGOV-GET-LAW'),
    'src/app/b.test.ts': `it('SPEC-EGOV-GET-LAW-050 not scanned', () => {});`,
  });
  const r = check(root, { domain: 'EGOV', dirPrefix: '', tests: ['src/**/*.spec.ts'] });
  assert.equal(r.ok, true);
  assert.equal(r.counts.testFiles, 1);
});

test('node_modules と dist は走査しない', () => {
  const root = fixture({
    'specs/current/nta_get_tsutatsu/spec.md': SPEC_OK,
    'src/x.test.ts': TEST_OK,
    'node_modules/pkg/src/y.test.ts': `it('SPEC-NTA-GET-TSUTATSU-077 x', () => {});`,
    'dist/z.test.ts': `it('SPEC-NTA-GET-TSUTATSU-078 x', () => {});`,
  });
  assert.equal(check(root, CONFIG).ok, true);
});
