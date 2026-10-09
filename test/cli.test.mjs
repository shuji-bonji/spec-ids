import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fixture, fm, run, SPEC_OK, TEST_OK } from './helpers.mjs';

test('bin の USAGE: history と migrate を載せる', () => {
  const r = run(fixture({}), ['--help']);
  assert.equal(r.status, 0);
  assert.match(r.stdout, /spec-ids history <dir> \[--json\]/);
  assert.match(r.stdout, /spec-ids history --all \[--json\]/);
  assert.match(r.stdout, /spec-ids migrate \[--json \| --write\]/);
});

test('spec-ids check: 出力の 2 行目が proposals: の行で、検査 5〜7 の食い違いがあれば exit 1', () => {
  const files = {
    'specs/spec-ids.json': JSON.stringify({ domain: 'NTA', dirPrefix: 'nta_' }),
    'specs/current/nta_get_tsutatsu/spec.md': SPEC_OK,
    'specs/releases/v1.0.0/20261001-a/proposal.md': `${fm({
      approved: '2026-10-01',
      pr: 89,
      implementation: 'required',
      targets: ['nta_get_tsutatsu'],
    })}# 変更\n`,
    'src/x.test.ts': TEST_OK,
  };
  const ok = run(fixture(files), ['check']);
  assert.equal(ok.status, 0, ok.stderr);
  assert.deepEqual(ok.stdout.split('\n'), [
    'current: 1 files, 2 IDs / changes: 0 files, 0 IDs',
    'proposals: changes 0, releases 1',
    'tests: 1 files, 2 IDs',
    'OK: 仕様 ID とテストが一致しています',
    '',
  ]);

  const ng = run(
    fixture({
      ...files,
      'specs/current/nta_get_tsutatsu/spec.md': SPEC_OK.replace(
        '## できること',
        '- 承認日: 2026-09-22（PR #49）\n\n## できること'
      ),
    }),
    ['check']
  );
  assert.equal(ng.status, 1);
  assert.match(ng.stderr, /古い「- 承認日:」の行が残っている:/);
});
