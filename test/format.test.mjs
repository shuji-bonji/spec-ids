import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  featureOfDir,
  formatId,
  HEADING_RE,
  ID_RE,
  parseId,
  TEST_NAME_RE,
} from '../src/format.mjs';

test('formatId / parseId は往復する', () => {
  const id = formatId('NTA', 'GET-TSUTATSU', 7);
  assert.equal(id, 'SPEC-NTA-GET-TSUTATSU-007');
  assert.deepEqual(parseId(id), { domain: 'NTA', feature: 'GET-TSUTATSU', n: 7 });
});

test('parseId は形に合わないものを null にする', () => {
  for (const bad of [
    'SPEC-NTA-001',
    'SPEC-NTA-GET-TSUTATSU-1',
    'SPEC-nta-GET-001',
    'SPEC-NTA-GET-TSUTATSU-0001',
  ]) {
    assert.equal(parseId(bad), null, bad);
  }
});

test('featureOfDir は接頭辞を除き、大文字にし、_ を - にする', () => {
  assert.equal(featureOfDir('nta_get_tsutatsu', 'nta_'), 'GET-TSUTATSU');
  assert.equal(featureOfDir('get_law', ''), 'GET-LAW');
  assert.equal(featureOfDir('search_qa', 'nta_'), 'SEARCH-QA');
});

test('ID_RE は本文中の ID を拾い、4 桁には伸びない', () => {
  const text = 'a SPEC-NTA-GET-TSUTATSU-001 b SPEC-EGOV-GET-LAW-012, SPEC-NTA-X-0001';
  assert.deepEqual(text.match(ID_RE), ['SPEC-NTA-GET-TSUTATSU-001', 'SPEC-EGOV-GET-LAW-012']);
});

test('HEADING_RE は ### の見出しだけを拾う', () => {
  const text =
    '## SPEC-NTA-A-001 x\n### SPEC-NTA-A-002 y\n本文 SPEC-NTA-A-003\n###  SPEC-NTA-A-004 z\n';
  assert.deepEqual(
    [...text.matchAll(HEADING_RE)].map((m) => m[1]),
    ['SPEC-NTA-A-002', 'SPEC-NTA-A-004']
  );
});

test('TEST_NAME_RE は describe / it / test の第 1 引数を、引用符の種類を問わず取る', () => {
  const src = `describe('a "q" x', () => {}); it("b 'q' y", () => {}); test(\`c z\`, () => {}); expect('SPEC-NTA-A-001')`;
  assert.deepEqual(
    [...src.matchAll(TEST_NAME_RE)].map((m) => m[2]),
    ['a "q" x', "b 'q' y", 'c z']
  );
});
