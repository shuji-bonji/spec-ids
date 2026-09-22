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
  assert.deepEqual(r.counts, { specFiles: 1, specIds: 2, headings: 2, testFiles: 1, testIds: 2 });
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

test('specs/changes の草案も突合の対象で、specs/releases は対象外', () => {
  const root = fixture({
    'specs/current/nta_get_tsutatsu/spec.md': SPEC_OK,
    'specs/changes/20260922-x/spec.md': '## ADDED\n\n### SPEC-NTA-GET-TSUTATSU-003 新しい\n',
    'specs/releases/v1.0.0/nta_get_tsutatsu/spec.md': '### SPEC-NTA-GET-TSUTATSU-099 古い版\n',
    'src/x.test.ts': TEST_OK,
  });
  const r = check(root, CONFIG);
  assert.deepEqual(
    r.missingTests.map((m) => m.id),
    ['SPEC-NTA-GET-TSUTATSU-003']
  );
  assert.equal(r.missingSpecs.length, 0);
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
