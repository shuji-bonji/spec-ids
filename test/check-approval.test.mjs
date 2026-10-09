import assert from 'node:assert/strict';
import { test } from 'node:test';
import { check, formatReport } from '../src/check.mjs';
import { CONFIG, fixture, fm, SPEC_OK, TEST_OK } from './helpers.mjs';

/** 見出しの無い current の spec.md（テストを求めないので、検査 5〜7 だけを見られる） */
const cur = (dir, data = {}) =>
  `${fm({ spec_id: 'NTA', approved: '2026-09-22', pr: 49, ...data })}# 機能: ${dir}\n\n- 版: current\n`;

/** proposal.md。既定は取り込み済みの形（approved・pr あり） */
const prop = (data = {}) =>
  `${fm({ approved: '2026-10-01', pr: 89, implementation: 'required', targets: ['nta_get_tsutatsu'], ...data })}# 変更: x\n\n- 対象: \`specs/current/nta_get_tsutatsu/spec.md\`\n- 状態: 草案\n`;

const base = (extra = {}) =>
  fixture({
    'specs/current/nta_get_tsutatsu/spec.md': cur('nta_get_tsutatsu'),
    'specs/current/nta_search_qa/spec.md': cur('nta_search_qa'),
    ...extra,
  });

const files = (list) => [...new Set(list.map((x) => x.file))].sort();

test('出力の 2 行目に proposals: の行を足す。1・3 行目と OK の行は 0.2.0 と同じ形', () => {
  const root = fixture({
    'specs/current/nta_get_tsutatsu/spec.md': SPEC_OK,
    'specs/changes/20261009-a/proposal.md': prop({ approved: null, pr: null }),
    'specs/releases/v1.0.0/20261001-b/proposal.md': prop(),
    'specs/releases/v1.1.0/20261002-c/proposal.md': prop({ pr: 90 }),
    'src/x.test.ts': TEST_OK,
  });
  const r = check(root, CONFIG);
  assert.equal(r.ok, true);
  assert.deepEqual(formatReport(r), {
    out: [
      'current: 1 files, 2 IDs / changes: 0 files, 0 IDs',
      'proposals: changes 1, releases 2',
      'tests: 1 files, 2 IDs',
      'OK: 仕様 ID とテストが一致しています',
    ],
    err: [],
  });
});

test('check() の戻り値: counts に changesProposals・releasesProposals を足し、frontMatter・missingTargets・legacyLines を足す。既存のキーは残す', () => {
  const root = base({
    'specs/changes/20261009-a/proposal.md': prop({ approved: null, pr: null }),
    'specs/releases/v1.0.0/20261001-b/proposal.md': prop(),
  });
  const r = check(root, CONFIG);
  for (const key of ['ok', 'counts', 'duplicated', 'missingTests', 'missingSpecs', 'misplaced']) {
    assert.ok(key in r, key);
  }
  assert.deepEqual(r.counts, {
    currentFiles: 2,
    currentHeadings: 0,
    changesFiles: 0,
    changesHeadings: 0,
    testFiles: 0,
    testIds: 0,
    changesProposals: 1,
    releasesProposals: 1,
  });
  assert.deepEqual(r.frontMatter, []);
  assert.deepEqual(r.missingTargets, []);
  assert.deepEqual(r.legacyLines, []);
  assert.equal(r.ok, true);
});

test('検査 5 front matter の形: current の spec.md に front matter が無ければ止める', () => {
  const root = base({ 'specs/current/nta_search_qa/spec.md': '# 機能: nta_search_qa\n' });
  const r = check(root, CONFIG);
  assert.equal(r.ok, false);
  assert.deepEqual(files(r.frontMatter), ['specs/current/nta_search_qa/spec.md']);
});

test('検査 5 front matter の形: proposal.md に front matter が無ければ止める（changes と releases の両方）', () => {
  const root = base({
    'specs/changes/20261009-a/proposal.md': '# 変更: a\n\n- 実装の変更: 要\n',
    'specs/releases/v1.0.0/20261001-b/proposal.md': '# 変更: b\n',
  });
  const r = check(root, CONFIG);
  assert.equal(r.ok, false);
  assert.deepEqual(files(r.frontMatter), [
    'specs/changes/20261009-a/proposal.md',
    'specs/releases/v1.0.0/20261001-b/proposal.md',
  ]);
});

test('検査 5 front matter の形: 草案（changes）は approved と pr が空でよく、取り込み済み（releases）は必須', () => {
  const ok = base({ 'specs/changes/20261009-a/proposal.md': prop({ approved: null, pr: null }) });
  assert.equal(check(ok, CONFIG).ok, true);

  const root = base({
    'specs/releases/v1.0.0/20261001-a/proposal.md': prop({ approved: null }),
    'specs/releases/v1.0.0/20261001-b/proposal.md': prop({ pr: null }),
    'specs/releases/v1.0.0/20261001-c/proposal.md': prop({ approved: undefined }),
    'specs/changes/20261009-d/proposal.md': prop({ pr: undefined }),
  });
  const r = check(root, CONFIG);
  assert.deepEqual(files(r.frontMatter), [
    'specs/changes/20261009-d/proposal.md',
    'specs/releases/v1.0.0/20261001-a/proposal.md',
    'specs/releases/v1.0.0/20261001-b/proposal.md',
    'specs/releases/v1.0.0/20261001-c/proposal.md',
  ]);
});

test('検査 5 front matter の形: implementation は required か none、targets は 1 つ以上の配列（草案でも必須）', () => {
  const okRoot = base({
    'specs/changes/20261009-a/proposal.md': prop({
      approved: null,
      pr: null,
      implementation: 'none',
    }),
  });
  assert.equal(check(okRoot, CONFIG).ok, true);

  const root = base({
    'specs/changes/20261009-a/proposal.md': prop({ implementation: 'yes' }),
    'specs/changes/20261009-b/proposal.md': prop({ implementation: undefined }),
    'specs/changes/20261009-c/proposal.md': prop({ targets: [] }),
    'specs/releases/v1.0.0/20261001-d/proposal.md': prop({ targets: undefined }),
    'specs/releases/v1.0.0/20261001-e/proposal.md': prop({ targets: 'nta_get_tsutatsu' }),
    'specs/releases/v1.0.0/20261001-f/proposal.md': prop({ implementation: null }),
  });
  const r = check(root, CONFIG);
  assert.deepEqual(files(r.frontMatter), [
    'specs/changes/20261009-a/proposal.md',
    'specs/changes/20261009-b/proposal.md',
    'specs/changes/20261009-c/proposal.md',
    'specs/releases/v1.0.0/20261001-d/proposal.md',
    'specs/releases/v1.0.0/20261001-e/proposal.md',
    'specs/releases/v1.0.0/20261001-f/proposal.md',
  ]);
});

test('検査 5 front matter の形: approved は実在する YYYY-MM-DD、pr は正の整数でなければ止める', () => {
  const root = base({
    'specs/releases/v1.0.0/20261001-a/proposal.md': prop({ approved: '2026-13-01' }),
    'specs/releases/v1.0.0/20261001-b/proposal.md': prop({ approved: '2026-02-30' }),
    'specs/releases/v1.0.0/20261001-c/proposal.md': prop({ pr: 0 }),
    'specs/releases/v1.0.0/20261001-d/proposal.md': prop({ pr: 'abc' }),
    'specs/releases/v1.0.0/20261001-e/proposal.md': prop({ approved: 20261001 }),
    'specs/current/nta_search_qa/spec.md': cur('nta_search_qa', { pr: '#49' }),
  });
  const r = check(root, CONFIG);
  assert.deepEqual(files(r.frontMatter), [
    'specs/current/nta_search_qa/spec.md',
    'specs/releases/v1.0.0/20261001-a/proposal.md',
    'specs/releases/v1.0.0/20261001-b/proposal.md',
    'specs/releases/v1.0.0/20261001-c/proposal.md',
    'specs/releases/v1.0.0/20261001-d/proposal.md',
    'specs/releases/v1.0.0/20261001-e/proposal.md',
  ]);
});

test('検査 5 front matter の形: 知らないキーがあれば止める（打ち間違い）', () => {
  const root = base({
    'specs/releases/v1.0.0/20261001-a/proposal.md': prop({ aproved: '2026-10-01' }),
    'specs/current/nta_search_qa/spec.md': cur('nta_search_qa', { targets: ['x'] }),
  });
  const r = check(root, CONFIG);
  assert.deepEqual(files(r.frontMatter), [
    'specs/current/nta_search_qa/spec.md',
    'specs/releases/v1.0.0/20261001-a/proposal.md',
  ]);
  assert.ok(r.frontMatter.some((f) => f.message.includes('aproved')));
});

test('検査 5 front matter の形: current の spec_id が無い、または設定の domain と違えば止める', () => {
  const root = base({
    'specs/current/nta_get_tsutatsu/spec.md': cur('nta_get_tsutatsu', { spec_id: 'EGOV' }),
    'specs/current/nta_search_qa/spec.md': cur('nta_search_qa', { spec_id: undefined }),
  });
  const r = check(root, CONFIG);
  assert.deepEqual(files(r.frontMatter), [
    'specs/current/nta_get_tsutatsu/spec.md',
    'specs/current/nta_search_qa/spec.md',
  ]);
});

test('検査 5 front matter の形: kind は任意で、値は tool・cli・db・common のどれか', () => {
  const ok = fixture({
    'specs/current/a/spec.md': cur('a'),
    'specs/current/b/spec.md': cur('b', { kind: 'tool' }),
    'specs/current/c/spec.md': cur('c', { kind: 'cli' }),
    'specs/current/d/spec.md': cur('d', { kind: 'db' }),
    'specs/current/e/spec.md': cur('e', { kind: 'common' }),
  });
  assert.equal(check(ok, CONFIG).ok, true);

  const root = base({
    'specs/current/nta_search_qa/spec.md': cur('nta_search_qa', { kind: 'api' }),
    'specs/current/nta_get_tsutatsu/spec.md': cur('nta_get_tsutatsu', { kind: 'ツール' }),
  });
  assert.deepEqual(files(check(root, CONFIG).frontMatter), [
    'specs/current/nta_get_tsutatsu/spec.md',
    'specs/current/nta_search_qa/spec.md',
  ]);
});

test('検査 5 front matter の形: current は introduced_by が無ければ approved と pr が必須', () => {
  const root = base({
    'specs/current/nta_get_tsutatsu/spec.md': cur('nta_get_tsutatsu', { approved: undefined }),
    'specs/current/nta_search_qa/spec.md': cur('nta_search_qa', { pr: null }),
  });
  assert.deepEqual(files(check(root, CONFIG).frontMatter), [
    'specs/current/nta_get_tsutatsu/spec.md',
    'specs/current/nta_search_qa/spec.md',
  ]);
});

test('検査 5 front matter の形: introduced_by があれば approved と pr は要らない', () => {
  const root = base({
    'specs/current/cli_status/spec.md': cur('cli_status', {
      kind: 'cli',
      approved: undefined,
      pr: undefined,
      introduced_by: '20261004-db-location',
    }),
    'specs/releases/v0.25.0/20261004-db-location/proposal.md': prop({
      approved: '2026-10-05',
      pr: 142,
      targets: ['cli_entry', 'cli_status', 'db_schema'],
    }),
  });
  const r = check(root, CONFIG);
  assert.deepEqual(r.frontMatter, []);
  assert.equal(r.ok, true);
});

test('検査 5 front matter の形: introduced_by の差分が無い、またはその差分の targets にこの機能が無ければ止める', () => {
  const born = (id) =>
    cur('x', { approved: undefined, pr: undefined, introduced_by: id }).replace('# 機能: x', '');
  const root = base({
    'specs/current/cli_status/spec.md': born('20261004-db-location'),
    'specs/current/cli_sync/spec.md': born('20261001-nowhere'),
    'specs/releases/v0.25.0/20261004-db-location/proposal.md': prop({ targets: ['db_schema'] }),
  });
  const r = check(root, CONFIG);
  assert.deepEqual(files(r.frontMatter), [
    'specs/current/cli_status/spec.md',
    'specs/current/cli_sync/spec.md',
  ]);
});

test('検査 5 front matter の形: 読み方に合わない書式（引用符・コメント・複数行）は止める', () => {
  const root = base({
    'specs/current/nta_search_qa/spec.md':
      '---\nspec_id: "NTA"\napproved: 2026-09-22 # 初版\npr: 49\n---\n# 機能\n',
    'specs/releases/v1.0.0/20261001-a/proposal.md':
      '---\napproved: 2026-10-01\npr: 89\nimplementation: required\ntargets:\n  - nta_get_tsutatsu\n---\n',
  });
  assert.deepEqual(files(check(root, CONFIG).frontMatter), [
    'specs/current/nta_search_qa/spec.md',
    'specs/releases/v1.0.0/20261001-a/proposal.md',
  ]);
});

test('検査 6 targets の漏れ: 差分の specs/<dir>/spec.md があるのに targets に <dir> が無ければ止める（changes と releases）', () => {
  const root = base({
    'specs/changes/20261009-a/proposal.md': prop({ approved: null, pr: null }),
    'specs/changes/20261009-a/specs/nta_get_tsutatsu/spec.md': '## MODIFIED\n',
    'specs/changes/20261009-a/specs/nta_search_qa/spec.md': '## MODIFIED\n',
    'specs/releases/v1.0.0/20261001-b/proposal.md': prop(),
    'specs/releases/v1.0.0/20261001-b/specs/nta_search_qa/spec.md': '## MODIFIED\n',
  });
  const r = check(root, CONFIG);
  assert.equal(r.ok, false);
  assert.deepEqual(r.missingTargets, [
    { file: 'specs/changes/20261009-a/proposal.md', dir: 'nta_search_qa', kind: 'unlisted' },
    {
      file: 'specs/releases/v1.0.0/20261001-b/proposal.md',
      dir: 'nta_search_qa',
      kind: 'unlisted',
    },
  ]);
});

test('検査 6 targets の漏れ: changes の差分の targets の <dir> が specs/current/ にも差分の specs/ にも無ければ止める（打ち間違い）', () => {
  const root = base({
    'specs/changes/20261009-a/proposal.md': prop({
      approved: null,
      pr: null,
      targets: ['nta_get_tsutasu', 'nta_new_tool'],
    }),
    'specs/changes/20261009-a/specs/nta_new_tool/spec.md': '## ADDED\n',
  });
  const r = check(root, CONFIG);
  assert.equal(r.ok, false);
  assert.deepEqual(r.missingTargets, [
    { file: 'specs/changes/20261009-a/proposal.md', dir: 'nta_get_tsutasu', kind: 'unknown' },
  ]);
});

test('検査 6 止めないもの: targets にあるのに差分の specs/<dir>/ が無い（逆向き。「実装の変更: 不要」や未決の直し）', () => {
  const root = base({
    'specs/changes/20261009-a/proposal.md': prop({
      implementation: 'none',
      targets: ['nta_get_tsutatsu', 'nta_search_qa'],
    }),
    'specs/releases/v1.0.0/20261001-b/proposal.md': prop({
      targets: ['nta_get_tsutatsu', 'nta_search_qa'],
    }),
    'specs/releases/v1.0.0/20261001-b/specs/nta_get_tsutatsu/spec.md': '## MODIFIED\n',
  });
  const r = check(root, CONFIG);
  assert.deepEqual(r.missingTargets, []);
  assert.equal(r.ok, true);
});

test('検査 6 止めないもの: releases の差分の targets の <dir> が今の specs/current/ に無い（後の差分で消した機能）', () => {
  const root = base({
    'specs/releases/v1.0.0/20261001-a/proposal.md': prop({ targets: ['nta_removed_tool'] }),
  });
  const r = check(root, CONFIG);
  assert.deepEqual(r.missingTargets, []);
  assert.equal(r.ok, true);
});

test('検査 6 止めないもの: proposal.md の「- 対象:」の文と targets の食い違い', () => {
  const body = prop({ targets: ['nta_search_qa'] }).replace(
    '- 対象: `specs/current/nta_get_tsutatsu/spec.md`',
    '- 対象: `specs/current/nta_get_tsutatsu/spec.md`（SPEC-NTA-GET-TSUTATSU-003）'
  );
  const root = base({ 'specs/releases/v1.0.0/20261001-a/proposal.md': body });
  assert.equal(check(root, CONFIG).ok, true);
});

test('検査 7 古い行の残り: 「- 承認日:」で始まる行があれば、ファイルと行番号を出して止める', () => {
  const root = base({
    'specs/current/nta_search_qa/spec.md': `${cur('nta_search_qa')}- 承認日: 2026-09-22（PR #49）\n`,
    'specs/releases/v1.0.0/20261001-a/proposal.md': prop().replace(
      '- 状態: 草案',
      '- 承認日: 2026-10-01（PR #89）\n- 状態: 草案'
    ),
    'specs/changes/20261009-b/proposal.md': prop({ approved: null, pr: null }).replace(
      '- 状態: 草案',
      '- 承認日:\n- 状態: 草案'
    ),
  });
  const r = check(root, CONFIG);
  assert.equal(r.ok, false);
  assert.deepEqual(r.legacyLines, [
    { file: 'specs/changes/20261009-b/proposal.md', line: 10 },
    { file: 'specs/current/nta_search_qa/spec.md', line: 9 },
    { file: 'specs/releases/v1.0.0/20261001-a/proposal.md', line: 10 },
  ]);
  assert.deepEqual(r.frontMatter, []);
});

test('検査 7 古い行の残り: 行の途中の「- 承認日:」や、差分の specs/ の下の spec.md は見ない', () => {
  const root = base({
    'specs/current/nta_search_qa/spec.md': `${cur('nta_search_qa')}本文で「- 承認日:」の書き方に触れる。\n`,
    'specs/changes/20261009-a/proposal.md': prop({ approved: null, pr: null }),
    'specs/changes/20261009-a/specs/nta_get_tsutatsu/spec.md': '- 承認日: 2026-09-22（PR #49）\n',
  });
  const r = check(root, CONFIG);
  assert.deepEqual(r.legacyLines, []);
});

test('formatReport: 検査 5〜7 の食い違いを stderr 用の行に、種類ごとに見出しを付けて出す', () => {
  const root = base({
    'specs/current/nta_search_qa/spec.md':
      '# 機能: nta_search_qa\n- 承認日: 2026-09-22（PR #49）\n',
    'specs/releases/v1.0.0/20261001-a/proposal.md': prop(),
    'specs/releases/v1.0.0/20261001-a/specs/nta_search_qa/spec.md': '## MODIFIED\n',
  });
  const r = check(root, CONFIG);
  const { out, err } = formatReport(r);
  assert.equal(out[1], 'proposals: changes 0, releases 1');
  assert.equal(out.length, 3);
  const at = (heading) => err.indexOf(heading);
  assert.ok(at('front matter が無い、または形が違う:') >= 0);
  assert.ok(at('targets の漏れ:') >= 0);
  assert.ok(at('古い「- 承認日:」の行が残っている:') >= 0);
  assert.ok(err.some((l) => l.startsWith('  specs/current/nta_search_qa/spec.md: ')));
  assert.ok(
    err.some(
      (l) =>
        l.startsWith('  specs/releases/v1.0.0/20261001-a/proposal.md: ') &&
        l.includes('nta_search_qa')
    )
  );
  assert.ok(err.includes('  specs/current/nta_search_qa/spec.md:2'));
});

test('proposal.md の無いディレクトリは差分として数えない（releases の版の写しなど）', () => {
  const root = base({
    'specs/releases/v0.9.0/nta_get_tsutatsu/spec.md': '### SPEC-NTA-GET-TSUTATSU-099 古い版\n',
    'specs/releases/v1.0.0/20261001-x/specs/nta_search_qa/spec.md': '## MODIFIED\n',
  });
  const r = check(root, CONFIG);
  assert.equal(r.ok, true);
  assert.equal(r.counts.releasesProposals, 0);
});
