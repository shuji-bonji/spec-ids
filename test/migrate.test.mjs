import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { check } from '../src/check.mjs';
import { historyAll } from '../src/history.mjs';
import { formatMigration, migrationJson, planMigration, writeMigration } from '../src/migrate.mjs';
import { fixture, run, snapshot } from './helpers.mjs';

const EGOV = { domain: 'EGOV', dirPrefix: '', tests: ['src/**/*.test.ts'] };
const CONFIG_JSON = JSON.stringify(EGOV);

/** 古い形の current の spec.md（0.2.0 までの運用） */
function oldCur(approval, { id = '- 機能 ID: EGOV', kind = '- 種類: ツール' } = {}) {
  const head = [id, kind].filter(Boolean).join('\n');
  return `# 機能: get_toc（目次）\n\n${head ? `${head}\n` : ''}- 版: current\n- 承認日: ${approval}\n- 起こした元: v0.15.1\n\n本文。\n`;
}

/** 古い形の proposal.md。null の行は書かない */
function oldProp({ impl = '要', approval = '2026-10-01（PR #89）' } = {}) {
  return [
    '# 変更: x',
    '',
    '- 対象: `specs/current/get_toc/spec.md`',
    impl === null ? null : `- 実装の変更: ${impl}`,
    approval === null ? null : `- 承認日: ${approval}`,
    '- 状態: 取り込み済み（v0.16.0）',
    '',
    '## なぜ変えるか',
    '',
    '本文。',
    '',
  ]
    .filter((l) => l !== null)
    .join('\n');
}

const json = (root) => migrationJson(planMigration(root, EGOV));
const mismatchFiles = (root) =>
  [...new Set(planMigration(root, EGOV).mismatches.map((m) => m.file))].sort();

test('migrate 読み取りの規則: proposal.md の approved・pr は「- 承認日:」から読む（日付と括弧のあいだの空白も読む）', () => {
  const root = fixture({
    'specs/current/get_toc/spec.md': oldCur(
      '2026-09-28（PR #50）。差分 `20261002-t1-followups` は 2026-10-01（PR #89）。差分 `20260927-spaced` は 2026-09-27（PR #84）'
    ),
    'specs/releases/v0.16.0/20261002-t1-followups/proposal.md': oldProp(),
    'specs/releases/v0.15.0/20260927-spaced/proposal.md': oldProp({
      approval: '2026-09-27 （PR #84）',
    }),
  });
  const j = json(root);
  assert.deepEqual(j.mismatches, []);
  assert.deepEqual(j.changes['20261002-t1-followups'], {
    approved: '2026-10-01',
    pr: 89,
    targets: ['get_toc'],
    version: 'v0.16.0',
  });
  assert.deepEqual(j.changes['20260927-spaced'].pr, 84);
});

test('migrate 読み取りの規則: proposal.md に「- 承認日:」が無ければ、current の行の「差分 <id> は …」から読む', () => {
  const root = fixture({
    'specs/current/get_toc/spec.md': oldCur(
      '2026-09-22（初版。PR #49 のマージ）。差分 `20260924-tsutatsu-clause-forms` は 2026-09-24（PR #53 のマージ）'
    ),
    'specs/releases/v0.20.3/20260924-tsutatsu-clause-forms/proposal.md': oldProp({
      approval: null,
    }),
  });
  const j = json(root);
  assert.deepEqual(j.mismatches, []);
  assert.deepEqual(j.changes['20260924-tsutatsu-clause-forms'], {
    approved: '2026-09-24',
    pr: 53,
    targets: ['get_toc'],
    version: 'v0.20.3',
  });
});

test('migrate 読み取りの規則: proposal.md と current の行の両方にあって値が違えば食い違い', () => {
  const root = fixture({
    'specs/current/get_toc/spec.md': oldCur(
      '2026-09-27（PR #10）。差分 `20260927-untested-behaviors` は 2026-09-27（PR #28）'
    ),
    'specs/releases/v0.6.1/20260927-untested-behaviors/proposal.md': oldProp({
      approval: '2026-09-27（PR #27）',
    }),
  });
  assert.deepEqual(mismatchFiles(root), [
    'specs/releases/v0.6.1/20260927-untested-behaviors/proposal.md',
  ]);
});

test('migrate 読み取りの規則: current の行どうしで同じ差分の値が違っても食い違い', () => {
  const root = fixture({
    'specs/current/get_toc/spec.md': oldCur(
      '2026-09-27（PR #10）。差分 `20260927-x` は 2026-09-27（PR #28）'
    ),
    'specs/current/get_law/spec.md': oldCur(
      '2026-09-27（PR #10）。差分 `20260927-x` は 2026-09-27（PR #27）'
    ),
    'specs/releases/v0.6.1/20260927-x/proposal.md': oldProp({ approval: null }),
  });
  assert.deepEqual(mismatchFiles(root), ['specs/releases/v0.6.1/20260927-x/proposal.md']);
});

test('migrate 読み取りの規則: approved・pr が proposal.md にも current の行にも無ければ食い違い', () => {
  const root = fixture({
    'specs/current/get_toc/spec.md': oldCur('2026-09-28（PR #50）'),
    'specs/releases/v0.16.0/20261001-x/proposal.md': oldProp({ approval: null }),
    'specs/releases/v0.16.0/20261001-x/specs/get_toc/spec.md': '## MODIFIED\n',
  });
  assert.deepEqual(mismatchFiles(root), ['specs/releases/v0.16.0/20261001-x/proposal.md']);
});

test('migrate 読み取りの規則: implementation は「要」→ required、「不要」→ none。行が無ければ食い違い', () => {
  const root = fixture({
    'specs/current/get_toc/spec.md': oldCur(
      '2026-09-28（PR #50）。差分 `a` は 2026-10-01（PR #1）。差分 `b` は 2026-10-01（PR #2）。差分 `c` は 2026-10-01（PR #3）'
    ),
    'specs/releases/v1/a/proposal.md': oldProp({ impl: '要', approval: '2026-10-01（PR #1）' }),
    'specs/releases/v1/b/proposal.md': oldProp({
      impl: '不要（テストを足すだけ）',
      approval: '2026-10-01（PR #2）',
    }),
    'specs/releases/v1/c/proposal.md': oldProp({ impl: null, approval: '2026-10-01（PR #3）' }),
  });
  const plan = planMigration(root, EGOV);
  assert.deepEqual(
    [...new Set(plan.mismatches.map((m) => m.file))],
    ['specs/releases/v1/c/proposal.md']
  );
  const byId = Object.fromEntries(plan.changes.map((c) => [c.id, c]));
  assert.equal(byId.a.data.implementation, 'required');
  assert.equal(byId.a.note, null);
  assert.equal(byId.b.data.implementation, 'none');
  assert.equal(byId.b.note, 'テストを足すだけ');
});

test('migrate 読み取りの規則: targets は current の行に書かれている <dir> と差分の specs/<dir>/ の和', () => {
  const line = '2026-09-28（PR #50）。差分 `20261002-t1-followups` は 2026-10-01（PR #89）';
  const root = fixture({
    'specs/current/get_toc/spec.md': oldCur(line),
    'specs/current/search_fulltext/spec.md': oldCur(line),
    'specs/current/common_errors/spec.md': oldCur('2026-09-28（PR #50）'),
    'specs/current/get_law_range/spec.md': oldCur('2026-09-28（PR #50）'),
    'specs/releases/v0.16.0/20261002-t1-followups/proposal.md': oldProp(),
    'specs/releases/v0.16.0/20261002-t1-followups/specs/common_errors/spec.md': '## MODIFIED\n',
    'specs/releases/v0.16.0/20261002-t1-followups/specs/get_law_range/spec.md': '## MODIFIED\n',
    'specs/releases/v0.16.0/20261002-t1-followups/specs/get_toc/spec.md': '## MODIFIED\n',
  });
  const j = json(root);
  assert.deepEqual(j.mismatches, []);
  assert.deepEqual(j.changes['20261002-t1-followups'].targets, [
    'common_errors',
    'get_law_range',
    'get_toc',
    'search_fulltext',
  ]);
});

test('migrate 読み取りの規則: targets の和が空なら食い違い（どの current の行にも無く、差分の specs/ も無い）', () => {
  const root = fixture({
    'specs/current/get_toc/spec.md': oldCur('2026-09-28（PR #50）'),
    'specs/releases/v0.22.0/20260930-cli-db-undecided-to-issues/proposal.md': oldProp({
      impl: '不要',
      approval: '2026-09-30（PR #114）',
    }),
  });
  assert.deepEqual(mismatchFiles(root), [
    'specs/releases/v0.22.0/20260930-cli-db-undecided-to-issues/proposal.md',
  ]);
});

test('migrate 読み取りの規則: current の spec_id は「- 機能 ID:」から読む。行が無い、または設定の domain と違えば食い違い', () => {
  const root = fixture({
    'specs/current/get_toc/spec.md': oldCur('2026-09-28（PR #50）'),
    'specs/current/get_law/spec.md': oldCur('2026-09-28（PR #50）', { id: null }),
    'specs/current/search_law/spec.md': oldCur('2026-09-28（PR #50）', { id: '- 機能 ID: NTA' }),
  });
  const plan = planMigration(root, EGOV);
  assert.deepEqual([...new Set(plan.mismatches.map((m) => m.file))].sort(), [
    'specs/current/get_law/spec.md',
    'specs/current/search_law/spec.md',
  ]);
  assert.equal(plan.features.find((f) => f.dir === 'get_toc').data.spec_id, 'EGOV');
});

test('migrate 読み取りの規則: current の kind は「- 種類:」の ツール・CLI・DB・共通 を tool・cli・db・common に。行が無ければ書かず、ほかの値は食い違い', () => {
  const root = fixture({
    'specs/current/a/spec.md': oldCur('2026-09-28（PR #50）', { kind: '- 種類: ツール' }),
    'specs/current/b/spec.md': oldCur('2026-09-28（PR #50）', { kind: '- 種類: CLI' }),
    'specs/current/c/spec.md': oldCur('2026-09-28（PR #50）', { kind: '- 種類: DB' }),
    'specs/current/d/spec.md': oldCur('2026-09-28（PR #50）', { kind: '- 種類: 共通' }),
    'specs/current/e/spec.md': oldCur('2026-09-28（PR #50）', { kind: null }),
    'specs/current/f/spec.md': oldCur('2026-09-28（PR #50）', { kind: '- 種類: API' }),
  });
  const plan = planMigration(root, EGOV);
  assert.deepEqual([...new Set(plan.mismatches.map((m) => m.file))], ['specs/current/f/spec.md']);
  const kinds = Object.fromEntries(plan.features.map((f) => [f.dir, f.data.kind]));
  assert.deepEqual(kinds, {
    a: 'tool',
    b: 'cli',
    c: 'db',
    d: 'common',
    e: undefined,
    f: undefined,
  });
  assert.equal('kind' in plan.features.find((f) => f.dir === 'e').data, false);
});

test('migrate 読み取りの規則: 「- 承認日:」の初版の部分の 5 通りの書き方を読む', () => {
  const root = fixture({
    'specs/current/plain/spec.md': oldCur('2026-09-28（PR #50）'),
    'specs/current/spaced/spec.md': oldCur('2026-09-27 （PR #77）'),
    'specs/current/merged/spec.md': oldCur(
      '2026-09-24（初版。PR #52 のマージ）。差分 `20260926-processing-flow` は 2026-09-26（PR #63）'
    ),
    'specs/current/both/spec.md': oldCur(
      '2026-09-26（初版と差分 `20260926-processing-flow`。PR #63）'
    ),
    'specs/current/born/spec.md': oldCur('2026-10-05（PR #142。差分 `20261004-db-location`）'),
    'specs/releases/v0.21.1/20260926-processing-flow/proposal.md': oldProp({
      impl: '不要',
      approval: '2026-09-26（PR #63）',
    }),
    'specs/releases/v0.25.0/20261004-db-location/proposal.md': oldProp({
      approval: '2026-10-05（PR #142）',
    }),
  });
  const j = json(root);
  assert.deepEqual(j.mismatches, []);
  assert.deepEqual(j.features, {
    born: { introduced_by: '20261004-db-location' },
    both: { approved: '2026-09-26', pr: 63 },
    merged: { approved: '2026-09-24', pr: 52 },
    plain: { approved: '2026-09-28', pr: 50 },
    spaced: { approved: '2026-09-27', pr: 77 },
  });
  assert.deepEqual(j.changes['20260926-processing-flow'].targets, ['both', 'merged']);
  assert.deepEqual(j.changes['20261004-db-location'].targets, ['born']);
});

test('migrate 読み取りの規則: 初版の部分が 5 通りのどれにも合わない、または差分の部分に読めない文が残れば食い違い', () => {
  const root = fixture({
    'specs/current/a/spec.md': oldCur('2026-09-28 頃（PR #50）'),
    'specs/current/b/spec.md': oldCur('2026-09-28（PR #50）。差分 `x` は 9 月の終わり'),
    'specs/current/c/spec.md': oldCur('2026-09-28（PR #50）'),
    'specs/releases/v1/x/proposal.md': oldProp({ approval: '2026-09-30（PR #60）' }),
    'specs/releases/v1/x/specs/c/spec.md': '## MODIFIED\n',
  });
  assert.deepEqual(mismatchFiles(root), ['specs/current/a/spec.md', 'specs/current/b/spec.md']);
});

test('migrate（実装で決めたこと）: current の行に書かれているのに proposal.md が無い差分は食い違い（変換すると履歴から消えるため）', () => {
  const root = fixture({
    'specs/current/get_toc/spec.md': oldCur(
      '2026-09-28（PR #50）。差分 `20261001-ghost` は 2026-10-01（PR #84）'
    ),
  });
  assert.deepEqual(mismatchFiles(root), ['specs/current/get_toc/spec.md']);
});

const SMALL = () =>
  fixture({
    'specs/spec-ids.json': CONFIG_JSON,
    'specs/current/get_toc/spec.md': oldCur(
      '2026-09-28（PR #50）。差分 `20261002-t1-followups` は 2026-10-01（PR #89）'
    ),
    'specs/releases/v0.16.0/20261002-t1-followups/proposal.md': oldProp({
      impl: '要（テストを 1 件足すだけ。下の「実装の変更」）',
    }),
    'specs/changes/20261009-draft/proposal.md': oldProp({
      impl: '不要',
      approval: '2026-10-09（PR #157）',
    }),
    'specs/changes/20261009-draft/specs/get_toc/spec.md': '## MODIFIED\n',
  });

test('migrate --write: 食い違いが無ければ front matter を足し、古い行を消し、括弧書きを「- 実装の変更の補足:」に移す', () => {
  const root = SMALL();
  const written = writeMigration(root, planMigration(root, EGOV));
  assert.deepEqual(written, [
    'specs/changes/20261009-draft/proposal.md',
    'specs/current/get_toc/spec.md',
    'specs/releases/v0.16.0/20261002-t1-followups/proposal.md',
  ]);
  const read = (rel) => readFileSync(join(root, rel), 'utf8');
  assert.equal(
    read('specs/current/get_toc/spec.md'),
    '---\nspec_id: EGOV\nkind: tool\napproved: 2026-09-28\npr: 50\n---\n# 機能: get_toc（目次）\n\n- 版: current\n- 起こした元: v0.15.1\n\n本文。\n'
  );
  assert.equal(
    read('specs/releases/v0.16.0/20261002-t1-followups/proposal.md'),
    [
      '---',
      'approved: 2026-10-01',
      'pr: 89',
      'implementation: required',
      'targets: [get_toc]',
      '---',
      '# 変更: x',
      '',
      '- 対象: `specs/current/get_toc/spec.md`',
      '- 実装の変更の補足: テストを 1 件足すだけ。下の「実装の変更」',
      '- 状態: 取り込み済み（v0.16.0）',
      '',
      '## なぜ変えるか',
      '',
      '本文。',
      '',
    ].join('\n')
  );
  assert.equal(
    read('specs/changes/20261009-draft/proposal.md').split('\n').slice(0, 9).join('\n'),
    '---\napproved: 2026-10-09\npr: 157\nimplementation: none\ntargets: [get_toc]\n---\n# 変更: x\n\n- 対象: `specs/current/get_toc/spec.md`'
  );
});

test('migrate --write の後: check が通り、history --all が変換前の migrate --json と同じ承認を出す', () => {
  const root = SMALL();
  const before = migrationJson(planMigration(root, EGOV));
  writeMigration(root, planMigration(root, EGOV));
  const r = check(root, EGOV);
  assert.equal(r.ok, true, JSON.stringify(r));
  const after = historyAll(root, EGOV);
  assert.deepEqual(
    after.map((h) => [h.dir, h.rows.map((x) => [x.change, x.approved, x.pr])]),
    [
      [
        'get_toc',
        [
          [null, before.features.get_toc.approved, before.features.get_toc.pr],
          ['20261002-t1-followups', '2026-10-01', 89],
          ['20261009-draft', '2026-10-09', 157],
        ],
      ],
    ]
  );
});

test('migrate: front matter のあるファイルは変換済みとして書き換えない（2 回目の --write は何もしない）', () => {
  const root = SMALL();
  writeMigration(root, planMigration(root, EGOV));
  const before = snapshot(root);
  const plan = planMigration(root, EGOV);
  assert.deepEqual(plan.mismatches, []);
  assert.deepEqual(writeMigration(root, plan), []);
  assert.deepEqual(snapshot(root), before);
});

test('migrate --write: 食い違いがあれば何も書き換えず exit 1', () => {
  const root = fixture({
    'specs/spec-ids.json': CONFIG_JSON,
    'specs/current/get_toc/spec.md': oldCur('2026-09-28（PR #50）'),
    'specs/releases/v1/x/proposal.md': oldProp({ approval: null }),
    'specs/releases/v1/x/specs/get_toc/spec.md': '## MODIFIED\n',
  });
  const before = snapshot(root);
  assert.throws(() => writeMigration(root, planMigration(root, EGOV)), /食い違い/);
  const r = run(root, ['migrate', '--write']);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /specs\/releases\/v1\/x\/proposal\.md/);
  assert.deepEqual(snapshot(root), before);
});

test('migrate（オプションなし）: 書き換えずに計画と食い違いを出す。食い違いがあれば exit 1、無ければ exit 0', () => {
  const ok = SMALL();
  const before = snapshot(ok);
  const r = run(ok, ['migrate']);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /specs\/current\/get_toc\/spec\.md/);
  assert.match(r.stdout, /specs\/releases\/v0\.16\.0\/20261002-t1-followups\/proposal\.md/);
  assert.deepEqual(snapshot(ok), before);

  const ng = fixture({
    'specs/spec-ids.json': CONFIG_JSON,
    'specs/current/get_toc/spec.md': oldCur('2026-09-28 頃'),
  });
  const r2 = run(ng, ['migrate']);
  assert.equal(r2.status, 1);
  assert.match(r2.stderr, /specs\/current\/get_toc\/spec\.md/);
});

test('migrate --json: 古い形から読んだ機能ごとの初版の承認と、差分 ID → (承認日, PR, 機能の集合) の表を JSON で出す', () => {
  const root = SMALL();
  const r = run(root, ['migrate', '--json']);
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(JSON.parse(r.stdout), {
    features: { get_toc: { approved: '2026-09-28', pr: 50 } },
    changes: {
      '20261002-t1-followups': {
        approved: '2026-10-01',
        pr: 89,
        targets: ['get_toc'],
        version: 'v0.16.0',
      },
      '20261009-draft': {
        approved: '2026-10-09',
        pr: 157,
        targets: ['get_toc'],
        version: 'changes',
      },
    },
    mismatches: [],
  });
});

test('formatMigration: 食い違いは stderr 用の行に、ファイルごとに出す', () => {
  const root = fixture({
    'specs/current/get_toc/spec.md': oldCur('2026-09-28 頃'),
  });
  const { err } = formatMigration(planMigration(root, EGOV));
  assert.ok(err.some((l) => l.startsWith('  specs/current/get_toc/spec.md: ')));
});
