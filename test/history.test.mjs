import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatHistory, history, historyAll } from '../src/history.mjs';
import { history as fromIndex } from '../src/index.mjs';
import { CONFIG, fixture, fm, run, snapshot } from './helpers.mjs';

const EGOV = { domain: 'EGOV', dirPrefix: '', tests: ['src/**/*.test.ts'] };

const cur = (data) => `${fm({ spec_id: 'EGOV', kind: 'tool', ...data })}# 機能\n`;
const prop = (approved, pr, targets, implementation = 'required') =>
  `${fm({ approved, pr, implementation, targets })}# 変更\n`;

/** 設計の「spec-ids history <dir> の出力」の get_toc の例を、houki-egov-mcp の置き場の形で組む */
function egovGetToc() {
  return fixture({
    'specs/spec-ids.json': JSON.stringify(EGOV),
    'specs/current/get_toc/spec.md': cur({ approved: '2026-09-28', pr: 50 }),
    'specs/current/search_law/spec.md': cur({ approved: '2026-09-28', pr: 50 }),
    'specs/releases/v0.15.2/20260928-undecided-to-issues/proposal.md': prop(
      '2026-09-28',
      68,
      ['get_toc', 'search_law'],
      'none'
    ),
    'specs/releases/v0.15.2/20260928-untested-behaviors/proposal.md': prop('2026-09-28', 76, [
      'get_toc',
      'search_law',
    ]),
    'specs/releases/v0.16.0/20261001-t1-argument-guards/proposal.md': prop('2026-10-01', 84, [
      'get_toc',
    ]),
    'specs/releases/v0.16.0/20261001-t2-error-codes/proposal.md': prop('2026-10-01', 85, [
      'get_toc',
    ]),
    'specs/releases/v0.16.0/20261001-t3-normalize/proposal.md': prop('2026-10-01', 86, [
      'get_toc',
      'search_law',
    ]),
    'specs/releases/v0.16.0/20261002-t1-followups/proposal.md': prop('2026-10-01', 89, [
      'common_errors',
      'get_law_range',
      'get_toc',
      'search_fulltext',
    ]),
    'specs/releases/v0.17.0/20261003-t4-response-shape/proposal.md': prop('2026-10-03', 91, [
      'get_toc',
    ]),
    'specs/releases/v0.17.0/20261003-t5-docs-mismatch/proposal.md': prop('2026-10-03', 92, [
      'cli_entry',
      'get_toc',
    ]),
    'specs/releases/v0.18.0/20261003-law-resolution/proposal.md': prop('2026-10-03', 95, [
      'get_toc',
    ]),
    'specs/releases/v0.18.0/20261003-search-explain-attachment/proposal.md': prop(
      '2026-10-03',
      96,
      ['search_law']
    ),
  });
}

const GET_TOC_TEXT = `get_toc（SPEC-EGOV-GET-TOC）

| 承認日 | 差分 | PR | 版 |
|---|---|---|---|
| 2026-09-28 | （初版） | #50 | - |
| 2026-09-28 | 20260928-undecided-to-issues | #68 | v0.15.2 |
| 2026-09-28 | 20260928-untested-behaviors | #76 | v0.15.2 |
| 2026-10-01 | 20261001-t1-argument-guards | #84 | v0.16.0 |
| 2026-10-01 | 20261001-t2-error-codes | #85 | v0.16.0 |
| 2026-10-01 | 20261001-t3-normalize | #86 | v0.16.0 |
| 2026-10-01 | 20261002-t1-followups | #89 | v0.16.0 |
| 2026-10-03 | 20261003-t4-response-shape | #91 | v0.17.0 |
| 2026-10-03 | 20261003-t5-docs-mismatch | #92 | v0.17.0 |
| 2026-10-03 | 20261003-law-resolution | #95 | v0.18.0 |`;

test('history の出力: 設計の get_toc の例と同じ表を出す（targets に get_toc を含まない差分は出さない）', () => {
  const root = egovGetToc();
  assert.equal(formatHistory(history(root, EGOV, 'get_toc')).join('\n'), GET_TOC_TEXT);
  const r = run(root, ['history', 'get_toc']);
  assert.equal(r.status, 0);
  assert.equal(r.stdout, `${GET_TOC_TEXT}\n`);
});

test('history: <dir> は spec.md のパスや specs/current/<dir> でも受ける', () => {
  const root = egovGetToc();
  const byDir = history(root, EGOV, 'get_toc');
  assert.deepEqual(history(root, EGOV, 'specs/current/get_toc/spec.md'), byDir);
  assert.deepEqual(history(root, EGOV, 'specs/current/get_toc/'), byDir);
});

test('history: 承認日の順に並べ、同じ日は PR 番号の順（差分 ID の並びには依らない）', () => {
  const root = fixture({
    'specs/current/get_toc/spec.md': cur({ approved: '2026-09-28', pr: 50 }),
    'specs/releases/v1.0.0/a-late/proposal.md': prop('2026-10-01', 20, ['get_toc']),
    'specs/releases/v1.0.0/b-early/proposal.md': prop('2026-10-01', 10, ['get_toc']),
    'specs/releases/v0.9.0/c-next-day/proposal.md': prop('2026-10-02', 1, ['get_toc']),
  });
  const rows = history(root, EGOV, 'get_toc').rows;
  assert.deepEqual(
    rows.map((r) => [r.approved, r.change, r.pr]),
    [
      ['2026-09-28', null, 50],
      ['2026-10-01', 'b-early', 10],
      ['2026-10-01', 'a-late', 20],
      ['2026-10-02', 'c-next-day', 1],
    ]
  );
});

test('history: specs/changes の差分は版を changes と出し、approved が空の草案は出さない', () => {
  const root = fixture({
    'specs/current/get_toc/spec.md': cur({ approved: '2026-09-28', pr: 50 }),
    'specs/changes/20261009-approved/proposal.md': prop('2026-10-09', 157, ['get_toc'], 'none'),
    'specs/changes/20261010-draft/proposal.md': prop(null, null, ['get_toc']),
  });
  const lines = formatHistory(history(root, EGOV, 'get_toc'));
  assert.deepEqual(lines.slice(4), [
    '| 2026-09-28 | （初版） | #50 | - |',
    '| 2026-10-09 | 20261009-approved | #157 | changes |',
  ]);
});

test('history: introduced_by のある機能は、初版の行の代わりに「<id>（新設）」の行を 1 つ出す', () => {
  const root = fixture({
    'specs/current/cli_status/spec.md': `${fm({ spec_id: 'NTA', kind: 'cli', introduced_by: '20261004-db-location' })}# 機能\n`,
    'specs/releases/v0.25.0/20261004-db-location/proposal.md': prop('2026-10-05', 142, [
      'cli_entry',
      'cli_status',
      'db_schema',
    ]),
    'specs/releases/v0.26.0/20261006-db-failure-paths/proposal.md': prop('2026-10-06', 152, [
      'cli_status',
    ]),
  });
  assert.deepEqual(formatHistory(history(root, CONFIG, 'cli_status')), [
    'cli_status（SPEC-NTA-CLI-STATUS）',
    '',
    '| 承認日 | 差分 | PR | 版 |',
    '|---|---|---|---|',
    '| 2026-10-05 | 20261004-db-location（新設） | #142 | v0.25.0 |',
    '| 2026-10-06 | 20261006-db-failure-paths | #152 | v0.26.0 |',
  ]);
});

test('history: 初版と差分が同じ PR のときは、初版と差分の 2 行を出す（1 行にまとめない）', () => {
  const root = fixture({
    'specs/current/nta_get_bunshokaitou/spec.md': `${fm({ spec_id: 'NTA', approved: '2026-09-26', pr: 63 })}# 機能\n`,
    'specs/releases/v0.21.1/20260926-processing-flow/proposal.md': prop(
      '2026-09-26',
      63,
      ['nta_get_bunshokaitou'],
      'none'
    ),
  });
  assert.deepEqual(formatHistory(history(root, CONFIG, 'nta_get_bunshokaitou')), [
    'nta_get_bunshokaitou（SPEC-NTA-GET-BUNSHOKAITOU）',
    '',
    '| 承認日 | 差分 | PR | 版 |',
    '|---|---|---|---|',
    '| 2026-09-26 | （初版） | #63 | - |',
    '| 2026-09-26 | 20260926-processing-flow | #63 | v0.21.1 |',
  ]);
});

test('history --json: 同じ内容を JSON で出す', () => {
  const root = egovGetToc();
  const h = history(root, EGOV, 'get_toc');
  assert.equal(h.dir, 'get_toc');
  assert.equal(h.specId, 'SPEC-EGOV-GET-TOC');
  assert.equal(h.rows.length, 10);
  assert.deepEqual(h.rows[0], {
    kind: 'initial',
    approved: '2026-09-28',
    change: null,
    pr: 50,
    version: null,
  });
  assert.deepEqual(h.rows[1], {
    kind: 'change',
    approved: '2026-09-28',
    change: '20260928-undecided-to-issues',
    pr: 68,
    version: 'v0.15.2',
  });
  const r = run(root, ['history', 'get_toc', '--json']);
  assert.equal(r.status, 0);
  assert.deepEqual(JSON.parse(r.stdout), h);
});

test('history --all: すべての <dir> を名前の順に出す（--json と組み合わせられる）', () => {
  const root = egovGetToc();
  const all = historyAll(root, EGOV);
  assert.deepEqual(
    all.map((h) => h.dir),
    ['get_toc', 'search_law']
  );
  assert.deepEqual(all[0], history(root, EGOV, 'get_toc'));
  assert.deepEqual(
    all[1].rows.map((r) => r.change),
    [
      null,
      '20260928-undecided-to-issues',
      '20260928-untested-behaviors',
      '20261001-t3-normalize',
      '20261003-search-explain-attachment',
    ]
  );

  const text = run(root, ['history', '--all']);
  assert.equal(text.status, 0);
  assert.ok(text.stdout.startsWith(`${GET_TOC_TEXT}\n\nsearch_law（SPEC-EGOV-SEARCH-LAW）\n`));
  const json = run(root, ['history', '--all', '--json']);
  assert.equal(json.status, 0);
  assert.deepEqual(JSON.parse(json.stdout), all);
});

test('history: <dir> が specs/current/ に無いときは exit 2', () => {
  const root = egovGetToc();
  assert.throws(() => history(root, EGOV, 'get_tco'), /specs\/current/);
  const r = run(root, ['history', 'get_tco']);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /get_tco/);
  assert.equal(run(root, ['history']).status, 2);
});

test('history: ファイルを書かない', () => {
  const root = egovGetToc();
  const before = snapshot(root);
  run(root, ['history', 'get_toc']);
  run(root, ['history', '--all', '--json']);
  assert.deepEqual(snapshot(root), before);
});

test('Node の API: history を index から import できる', () => {
  assert.equal(fromIndex, history);
});
