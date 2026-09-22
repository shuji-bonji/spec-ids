import assert from 'node:assert/strict';
import { test } from 'node:test';
import { dirNameOfTarget, nextIds } from '../src/next.mjs';
import { CONFIG, fixture, SPEC_OK } from './helpers.mjs';

test('dirNameOfTarget はパスでもディレクトリ名でも同じ結果', () => {
  for (const t of [
    'specs/current/nta_get_tsutatsu/spec.md',
    'specs/current/nta_get_tsutatsu',
    'specs/current/nta_get_tsutatsu/',
    'nta_get_tsutatsu',
  ]) {
    assert.equal(dirNameOfTarget(t), 'nta_get_tsutatsu', t);
  }
});

test('その機能の最大番号 +1 を返し、changes の草案も数える', () => {
  const root = fixture({
    'specs/current/nta_get_tsutatsu/spec.md': SPEC_OK,
    'specs/changes/20260922-x/spec.md': '### SPEC-NTA-GET-TSUTATSU-005 草案\n',
  });
  assert.deepEqual(nextIds(root, CONFIG, 'nta_get_tsutatsu'), ['SPEC-NTA-GET-TSUTATSU-006']);
  assert.deepEqual(nextIds(root, CONFIG, 'specs/current/nta_get_tsutatsu/spec.md', 2), [
    'SPEC-NTA-GET-TSUTATSU-006',
    'SPEC-NTA-GET-TSUTATSU-007',
  ]);
});

test('まだ 1 件も無い機能は 001 から', () => {
  const root = fixture({ 'specs/current/nta_get_tsutatsu/spec.md': SPEC_OK });
  assert.deepEqual(nextIds(root, CONFIG, 'nta_search_qa'), ['SPEC-NTA-SEARCH-QA-001']);
});

test('999 を超えるときは例外', () => {
  const root = fixture({ 'specs/current/nta_a/spec.md': '### SPEC-NTA-A-999 x\n' });
  assert.throws(() => nextIds(root, CONFIG, 'nta_a'), /3 桁を超えます/);
});
