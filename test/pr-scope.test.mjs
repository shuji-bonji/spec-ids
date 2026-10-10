/**
 * spec-ids pr-scope の判定。
 *
 * houki-egov-mcp（22 件）・houki-nta-mcp（24 件）・houki-abbreviations（20 件）の
 * `.github/scripts/check-pr-scope.test.mjs` をまとめたもの（spec-ids#9 の決定 5）。重なるテストは 1 つにした。
 * 決定 1〜4 のそれぞれについて、止める側と通す側の両方を残している。
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import {
  checkScope,
  currentApproved,
  kindOf,
  noImplementation,
  onlyIdsAdded,
  parseNameStatus,
  proposalApproved,
  releasedIds,
  testFileMatcher,
} from '../src/pr-scope.mjs';
import { fixture, fm, run } from './helpers.mjs';

const APPROVED_PROPOSAL = `${fm({
  approved: '2026-09-25',
  pr: 60,
  implementation: 'required',
  targets: ['resolve_abbreviation'],
})}# 差分\n`;
const NO_IMPL_PROPOSAL = APPROVED_PROPOSAL.replace(
  'implementation: required',
  'implementation: none'
);
const APPROVED_SPEC = `${fm({ spec_id: 'EGOV', kind: 'tool', approved: '2026-09-25', pr: 60 })}# 機能\n`;
const UNAPPROVED_SPEC = `${fm({ spec_id: 'EGOV', kind: 'tool', approved: null, pr: null })}# 機能\n`;

function scope(kind, changes, files = {}, diffs = {}, released = new Set()) {
  return checkScope({
    kind,
    changes,
    read: (p) => files[p] ?? '',
    diffOf: (p) => diffs[p] ?? '',
    released,
  });
}

// ---- 種類と入力の読み取り ----

test('ブランチ名の接頭辞で種類が決まる', () => {
  assert.equal(kindOf('spec/20260925-live-scope'), 'spec');
  assert.equal(kindOf('spec-init/lookup-by-law-id'), 'spec-init');
  assert.equal(kindOf('fix/54-live-scope'), 'impl');
});

test('name-status の rename を from / path に分ける', () => {
  assert.deepEqual(
    parseNameStatus('M\tsrc/a.ts\nR100\tspecs/changes/x/spec.md\tspecs/releases/v1/x/spec.md\n'),
    [
      { status: 'M', path: 'src/a.ts' },
      { status: 'R', from: 'specs/changes/x/spec.md', path: 'specs/releases/v1/x/spec.md' },
    ]
  );
});

test('front matter の判定: 空の値・front matter の無い本文を「無い」とみなす', () => {
  assert.equal(proposalApproved(APPROVED_PROPOSAL), true);
  assert.equal(proposalApproved('# 差分\n'), false);
  assert.equal(noImplementation(NO_IMPL_PROPOSAL), true);
  assert.equal(noImplementation(APPROVED_PROPOSAL), false);
  assert.equal(currentApproved(APPROVED_SPEC), true);
  assert.equal(currentApproved(UNAPPROVED_SPEC), false);
});

// ---- 仕様 PR（spec/*） ----

test('仕様 PR: specs/changes だけで承認日と PR 番号があれば通る', () => {
  const p = 'specs/changes/20260925-x/proposal.md';
  const errors = scope(
    'spec',
    [
      { status: 'A', path: p },
      { status: 'A', path: 'specs/changes/20260925-x/spec.md' },
    ],
    { [p]: APPROVED_PROPOSAL }
  );
  assert.deepEqual(errors, []);
});

test('仕様 PR: src/ を変えると止まる', () => {
  const p = 'specs/changes/20260925-x/proposal.md';
  const errors = scope(
    'spec',
    [
      { status: 'A', path: p },
      { status: 'M', path: 'src/lookup.ts' },
    ],
    { [p]: APPROVED_PROPOSAL }
  );
  assert.equal(errors.length, 1);
  assert.match(errors[0], /src\/lookup\.ts/);
});

test('仕様 PR: proposal.md が無ければ止まる', () => {
  const errors = scope('spec', [{ status: 'A', path: 'specs/changes/20260925-x/spec.md' }]);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /proposal\.md がありません/);
});

test('仕様 PR: front matter の approved と pr が空なら止まる', () => {
  const p = 'specs/changes/20260925-x/proposal.md';
  const draft = `${fm({ approved: null, pr: null, implementation: 'required', targets: ['get_law'] })}# 差分\n`;
  const errors = scope('spec', [{ status: 'A', path: p }], { [p]: draft });
  assert.equal(errors.length, 1);
  assert.match(errors[0], /承認日と PR 番号/);
});

test('仕様 PR: approved があっても pr が空なら止まる', () => {
  const p = 'specs/changes/20260925-x/proposal.md';
  const noPr = APPROVED_PROPOSAL.replace('pr: 60', 'pr:');
  const errors = scope('spec', [{ status: 'A', path: p }], { [p]: noPr });
  assert.equal(errors.length, 1);
});

test('仕様 PR: 古い形（本文の「- 承認日:」の行だけで front matter が無い）の proposal.md は止まる', () => {
  const p = 'specs/changes/20260925-x/proposal.md';
  const legacy = '# 差分\n\n- 承認日: 2026-09-25（PR #60）\n- 実装の変更: 要\n';
  const errors = scope('spec', [{ status: 'A', path: p }], { [p]: legacy });
  assert.equal(errors.length, 1);
  assert.match(errors[0], /front matter の approved と pr/);
});

test('仕様 PR: implementation: none なら specs/current も書いてよい（current の承認は要る）', () => {
  const p = 'specs/changes/20260925-x/proposal.md';
  const cur = 'specs/current/resolve_abbreviation/spec.md';
  const changes = [
    { status: 'A', path: p },
    { status: 'M', path: cur },
  ];
  const files = { [p]: NO_IMPL_PROPOSAL, [cur]: APPROVED_SPEC };
  assert.deepEqual(scope('spec', changes, files), []);
  const noDate = { ...files, [cur]: UNAPPROVED_SPEC };
  assert.equal(scope('spec', changes, noDate).length, 1);
});

test('仕様 PR: implementation: required で specs/current を書くと止まる', () => {
  const p = 'specs/changes/20260925-x/proposal.md';
  const cur = 'specs/current/resolve_abbreviation/spec.md';
  const errors = scope(
    'spec',
    [
      { status: 'A', path: p },
      { status: 'M', path: cur },
    ],
    { [p]: APPROVED_PROPOSAL, [cur]: APPROVED_SPEC }
  );
  assert.equal(errors.length, 1);
  assert.match(errors[0], /implementation: none/);
});

test('仕様 PR: 本文の「- 実装の変更: 不要」の行だけでは specs/current を書けない', () => {
  const p = 'specs/changes/20260925-x/proposal.md';
  const cur = 'specs/current/resolve_abbreviation/spec.md';
  const legacy = `${APPROVED_PROPOSAL}- 実装の変更: 不要\n`;
  const errors = scope(
    'spec',
    [
      { status: 'A', path: p },
      { status: 'M', path: cur },
    ],
    { [p]: legacy, [cur]: APPROVED_SPEC }
  );
  assert.equal(errors.length, 1);
});

// ---- 実装 PR（それ以外のブランチ） ----

test('実装 PR: specs/changes を releases へ移すのはよいが、書き換えると止まる', () => {
  const cur = 'specs/current/resolve_abbreviation/spec.md';
  const ok = scope(
    'impl',
    [
      { status: 'M', path: 'src/lookup.ts' },
      { status: 'M', path: cur },
      { status: 'R', from: 'specs/changes/x/spec.md', path: 'specs/releases/v0.21.0/x/spec.md' },
    ],
    { [cur]: APPROVED_SPEC }
  );
  assert.deepEqual(ok, []);
  const ng = scope('impl', [{ status: 'M', path: 'specs/changes/x/spec.md' }]);
  assert.equal(ng.length, 1);
});

test('実装 PR: 取り込んだ specs/current に初版の承認が無ければ止まる', () => {
  const cur = 'specs/current/resolve_abbreviation/spec.md';
  const errors = scope('impl', [{ status: 'M', path: cur }], { [cur]: UNAPPROVED_SPEC });
  assert.equal(errors.length, 1);
  // 古い形（本文の「- 承認日:」の行だけ）も止める
  const legacy = '# 機能\n\n- 承認日: 2026-09-25（PR #60）\n';
  assert.equal(scope('impl', [{ status: 'M', path: cur }], { [cur]: legacy }).length, 1);
});

test('実装 PR: 差分で作った機能（introduced_by）は approved と pr が無くても通る', () => {
  const cur = 'specs/current/cli_new/spec.md';
  const born = `${fm({ spec_id: 'EGOV', kind: 'cli', introduced_by: '20261004-db-location' })}# 機能\n`;
  assert.deepEqual(scope('impl', [{ status: 'A', path: cur }], { [cur]: born }), []);
});

test('実装 PR: 取り込み済み（releases にある）差分の specs/changes/ に残ったファイルは消してよい（決定 3）', () => {
  const d = { status: 'D', path: 'specs/changes/20260927-x/proposal.md' };
  assert.deepEqual(scope('impl', [d], {}, {}, new Set(['20260927-x'])), []);
  // releases に無い差分を消すのは止める
  assert.equal(scope('impl', [d], {}, {}, new Set(['20260927-y'])).length, 1);
});

test('実装 PR: specs/changes の proposal.md を front matter の形に書き換えると止まる（決定 4。変換の例外は入れない）', () => {
  const p = 'specs/changes/20261009-inspect-pdf-meta-qa-jirei/proposal.md';
  // spec-ids 0.3.0 の migrate が proposal.md を書き換えたときの git diff -U0（houki-nta-mcp #156 の差分と同じ形）
  const migrateDiff = [
    `diff --git a/${p} b/${p}`,
    'index 420e8a5..bce2bd8 100644',
    `--- a/${p}`,
    `+++ b/${p}`,
    '@@ -0,0 +1,6 @@',
    '+---',
    '+approved: 2026-10-09',
    '+pr: 157',
    '+implementation: none',
    '+targets: [db_schema, nta_inspect_pdf_meta]',
    '+---',
    '@@ -4,2 +9,0 @@',
    '-- 実装の変更: 不要',
    '-- 承認日: 2026-10-09（PR #157）',
    '',
  ].join('\n');
  const errors = scope('impl', [{ status: 'M', path: p }], {}, { [p]: migrateDiff });
  assert.equal(errors.length, 1);
  assert.match(errors[0], /specs\/changes\//);
  // 追加（A）も止める
  assert.equal(scope('impl', [{ status: 'A', path: p }], {}, { [p]: migrateDiff }).length, 1);
});

// ---- 初版起こし（spec-init/*） ----

test('初版起こし: spec.md の追加と、テスト名に ID を足すだけの変更は通る', () => {
  const cur = 'specs/current/lookup_by_law_id/spec.md';
  const t = 'src/lookup.test.ts';
  const diff = [
    `--- a/${t}`,
    `+++ b/${t}`,
    '@@ -1 +1 @@',
    "-  it('未知の law_id は null', async () => {",
    "+  it('SPEC-ABBR-LOOKUP-BY-LAW-ID-001 未知の law_id は null', async () => {",
  ].join('\n');
  const errors = scope(
    'spec-init',
    [
      { status: 'A', path: cur },
      { status: 'M', path: t },
    ],
    { [cur]: APPROVED_SPEC },
    { [t]: diff }
  );
  assert.deepEqual(errors, []);
});

test('初版起こし: すでに ID の付いたテスト名に別の ID を足すのは通す（決定 1）', () => {
  const diff = [
    '@@ -1 +1 @@',
    "-  it('SPEC-EGOV-GET-LAW-001 範囲外の名前は OUT_OF_SCOPE', async () => {",
    "+  it('SPEC-EGOV-GET-LAW-001 SPEC-EGOV-COMMON-ERRORS-004 範囲外の名前は OUT_OF_SCOPE', async () => {",
  ].join('\n');
  assert.equal(onlyIdsAdded(diff), true);
  const t = 'src/get-law.test.ts';
  assert.deepEqual(scope('spec-init', [{ status: 'M', path: t }], {}, { [t]: diff }), []);
});

test('初版起こし: テスト名から既存の ID を消す・別の ID に差し替えると止まる（決定 1）', () => {
  const removeOnly = [
    '@@ -1 +1 @@',
    "-  it('SPEC-EGOV-GET-LAW-001 範囲外の名前は OUT_OF_SCOPE', async () => {",
    "+  it('範囲外の名前は OUT_OF_SCOPE', async () => {",
  ].join('\n');
  assert.equal(onlyIdsAdded(removeOnly), false);
  const swap = [
    '@@ -1 +1 @@',
    "-  it('SPEC-EGOV-GET-LAW-001 範囲外の名前は OUT_OF_SCOPE', async () => {",
    "+  it('SPEC-EGOV-GET-LAW-002 範囲外の名前は OUT_OF_SCOPE', async () => {",
  ].join('\n');
  assert.equal(onlyIdsAdded(swap), false);
  const t = 'src/get-law.test.ts';
  assert.equal(scope('spec-init', [{ status: 'M', path: t }], {}, { [t]: swap }).length, 1);
});

test('初版起こし: テストの期待値を変えると止まる', () => {
  const t = 'src/lookup.test.ts';
  const diff = [
    '@@ -1 +1 @@',
    "-    expect(lookupByLawId('999XX0000000000')).toBeNull();",
    "+    expect(lookupByLawId('999XX0000000000')).toBeUndefined();",
  ].join('\n');
  assert.equal(onlyIdsAdded(diff), false);
  const errors = scope('spec-init', [{ status: 'M', path: t }], {}, { [t]: diff });
  assert.equal(errors.length, 1);
});

test('初版起こし: 承認日が無ければ止まる、src/ の実装を変えると止まる', () => {
  const cur = 'specs/current/lookup_by_law_id/spec.md';
  const errors = scope(
    'spec-init',
    [
      { status: 'A', path: cur },
      { status: 'M', path: 'src/lookup.ts' },
    ],
    { [cur]: UNAPPROVED_SPEC }
  );
  assert.equal(errors.length, 2);
});

test('初版起こし: 設定 tests の glob に合うファイル（*.spec.ts など）もテストファイルとして扱う', () => {
  const isTestFile = testFileMatcher(['src/**/*.spec.ts']);
  assert.equal(isTestFile('src/app/a.spec.ts'), true);
  assert.equal(isTestFile('tests/x.test.mjs'), true);
  assert.equal(isTestFile('src/app/a.ts'), false);
  const t = 'src/app/a.spec.ts';
  const diff = [
    '@@ -1 +1 @@',
    "-  it('x', () => {",
    "+  it('SPEC-APP-GET-THING-001 x', () => {",
  ].join('\n');
  const changes = [{ status: 'M', path: t }];
  const input = { kind: 'spec-init', changes, read: () => '', diffOf: () => diff };
  assert.deepEqual(checkScope({ ...input, isTestFile }), []);
  // 設定に無ければ、*.spec.ts はテストファイルではないので止まる
  assert.equal(checkScope(input).length, 1);
});

// ---- どの種類でも ----

test('specs に触れない PR（docs など）はそのまま通る', () => {
  assert.deepEqual(scope('impl', [{ status: 'M', path: 'README.md' }]), []);
});

test('spec-ids init が作る specs/ の .gitkeep は、どの種類の PR でも止めない（決定 2）', () => {
  const keeps = ['current', 'changes', 'releases'].map((d) => ({
    status: 'A',
    path: `specs/${d}/.gitkeep`,
  }));
  for (const kind of ['impl', 'spec-init']) {
    assert.deepEqual(scope(kind, keeps), []);
  }
  // 実装 PR で specs/changes/.gitkeep を消すのも止めない
  assert.deepEqual(scope('impl', [{ status: 'D', path: 'specs/changes/.gitkeep' }]), []);
  // .gitkeep 以外の specs/changes/ の追加は止める
  assert.equal(scope('impl', [{ status: 'A', path: 'specs/changes/x/spec.md' }]).length, 1);
});

// ---- releases の走査 ----

test('releasedIds: specs/releases/<tag>/<id>/ の <id> を集める', () => {
  const root = fixture({
    'specs/releases/v1.0.0/20261001-a/proposal.md': '',
    'specs/releases/v1.1.0/20261002-b/proposal.md': '',
    'specs/releases/.gitkeep': '',
  });
  assert.deepEqual([...releasedIds(root)].sort(), ['20261001-a', '20261002-b']);
  assert.deepEqual([...releasedIds(fixture({}))], []);
});

// ---- CLI（git のリポジトリで動かす） ----

const GIT_ENV = {
  GIT_AUTHOR_NAME: 'spec-ids test',
  GIT_AUTHOR_EMAIL: 'test@example.com',
  GIT_COMMITTER_NAME: 'spec-ids test',
  GIT_COMMITTER_EMAIL: 'test@example.com',
  // 利用者の環境の設定（署名など）を読まない
  GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_CONFIG_NOSYSTEM: '1',
};

function git(root, ...args) {
  const r = spawnSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, ...GIT_ENV },
  });
  if (r.status !== 0) throw new Error(`git ${args.join(' ')}: ${r.stderr}`);
  return r.stdout;
}

/** main に base のファイルをコミットし、branch を切って changes を書き（null は削除）、コミットした root を返す */
function repo(baseFiles, branch, changes) {
  const root = fixture(baseFiles);
  git(root, 'init', '-q', '-b', 'main');
  git(root, 'add', '-A');
  git(root, 'commit', '-q', '-m', 'base');
  git(root, 'switch', '-q', '-c', branch);
  for (const [rel, body] of Object.entries(changes)) {
    const p = join(root, rel);
    if (body === null) {
      rmSync(p);
    } else {
      mkdirSync(dirname(p), { recursive: true });
      writeFileSync(p, body);
    }
  }
  git(root, 'add', '-A');
  git(root, 'commit', '-q', '-m', 'change');
  return root;
}

const BASE_FILES = {
  'specs/spec-ids.json': JSON.stringify({ domain: 'EGOV', tests: ['src/**/*.test.ts'] }),
  'specs/changes/.gitkeep': '',
  'specs/current/get_law/spec.md': `${APPROVED_SPEC}### SPEC-EGOV-GET-LAW-001 x\n`,
  'src/get-law.ts': 'export const x = 1;\n',
};

test('spec-ids pr-scope: 範囲に収まれば exit 0 で、1 行目に branch・種類・base・変更の数を出す', () => {
  const root = repo(BASE_FILES, 'spec/20261010-x', {
    'specs/changes/20261010-x/proposal.md': APPROVED_PROPOSAL,
  });
  const r = run(root, ['pr-scope'], { BASE_REF: 'main', HEAD_REF: '' });
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(r.stdout.split('\n'), [
    'branch: spec/20261010-x（spec）、base: main、変更 1 ファイル',
    'OK: この種類の PR が変えてよい範囲に収まっています',
    '',
  ]);
  assert.equal(r.stderr, '');
});

test('spec-ids pr-scope: 範囲の外の変更があれば exit 1 で、違反を stderr に出す', () => {
  const root = repo(BASE_FILES, 'spec/20261010-x', {
    'specs/changes/20261010-x/proposal.md': APPROVED_PROPOSAL,
    'src/get-law.ts': 'export const x = 2;\n',
  });
  const r = run(root, ['pr-scope'], { BASE_REF: 'main', HEAD_REF: '' });
  assert.equal(r.status, 1);
  assert.equal(r.stdout, 'branch: spec/20261010-x（spec）、base: main、変更 2 ファイル\n');
  assert.match(r.stderr, /この種類の PR が変えてよい範囲の外の変更、または承認の空欄:/);
  assert.match(
    r.stderr,
    / {2}仕様 PR（spec\/\*）は specs\/changes\/ だけを変えます: src\/get-law\.ts/
  );
});

test('spec-ids pr-scope: ブランチ名は --branch → HEAD_REF → 今のブランチ、基準は --base → BASE_REF → origin/main の順', () => {
  const root = repo(BASE_FILES, 'feat/x', { 'src/get-law.ts': 'export const x = 2;\n' });
  // 今のブランチ（feat/x）は実装 PR
  const byHead = run(root, ['pr-scope'], { BASE_REF: 'main', HEAD_REF: '' });
  assert.equal(byHead.status, 0, byHead.stderr);
  assert.match(byHead.stdout, /^branch: feat\/x（impl）、base: main、/);
  // HEAD_REF が今のブランチより優先される（CI では HEAD がマージコミットになるため）
  const byEnv = run(root, ['pr-scope'], { BASE_REF: 'main', HEAD_REF: 'spec/y' });
  assert.equal(byEnv.status, 1);
  assert.match(byEnv.stdout, /^branch: spec\/y（spec）/);
  // --branch と --base が環境変数より優先される
  const byOpt = run(root, ['pr-scope', '--branch', 'fix/z', '--base', 'main'], {
    BASE_REF: 'no-such-ref',
    HEAD_REF: 'spec/y',
  });
  assert.equal(byOpt.status, 0, byOpt.stderr);
  assert.match(byOpt.stdout, /^branch: fix\/z（impl）、base: main、/);
  // どれも無ければ origin/main と比べる（このリポジトリには無いので exit 2）
  const byDefault = run(root, ['pr-scope'], { BASE_REF: '', HEAD_REF: '' });
  assert.equal(byDefault.status, 2);
  assert.match(byDefault.stderr, /origin\/main\.\.\.HEAD/);
});

test('spec-ids pr-scope: 取り込み済みの差分の残りを消す実装 PR は、作業ツリーの specs/releases を見て通す', () => {
  const root = repo(
    {
      ...BASE_FILES,
      'specs/changes/20261001-a/proposal.md': APPROVED_PROPOSAL,
      'specs/releases/v1.0.0/20261001-a/proposal.md': APPROVED_PROPOSAL,
    },
    'fix/leftovers',
    { 'specs/changes/20261001-a/proposal.md': null }
  );
  const r = run(root, ['pr-scope'], { BASE_REF: 'main', HEAD_REF: '' });
  assert.equal(r.status, 0, r.stderr);
});

test('spec-ids pr-scope: 初版起こしのテスト名への ID の追加を git diff で読む', () => {
  const t = 'src/get-law.test.ts';
  const base = { ...BASE_FILES, [t]: "it('x', () => {});\nit('y', () => {});\n" };
  const ok = repo(base, 'spec-init/get-law', {
    [t]: "it('SPEC-EGOV-GET-LAW-001 x', () => {});\nit('y', () => {});\n",
  });
  assert.equal(run(ok, ['pr-scope'], { BASE_REF: 'main', HEAD_REF: '' }).status, 0);
  const ng = repo(base, 'spec-init/get-law', {
    [t]: "it('SPEC-EGOV-GET-LAW-001 x', () => {});\nit('z', () => {});\n",
  });
  const r = run(ng, ['pr-scope'], { BASE_REF: 'main', HEAD_REF: '' });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /テスト名に仕様 ID を足すだけです/);
});

test('spec-ids pr-scope: 知らないオプション・値の無いオプションは exit 2、設定が無ければ exit 2', () => {
  const root = repo(BASE_FILES, 'feat/x', { 'src/get-law.ts': 'export const x = 2;\n' });
  assert.equal(run(root, ['pr-scope', '--json']).status, 2);
  assert.equal(run(root, ['pr-scope', '--base']).status, 2);
  assert.equal(run(root, ['pr-scope', '--base', '--branch', 'x']).status, 2);
  assert.equal(run(root, ['pr-scope', 'extra']).status, 2);
  const noConfig = run(fixture({ 'a.txt': '' }), ['pr-scope'], { BASE_REF: 'main' });
  assert.equal(noConfig.status, 2);
  assert.match(noConfig.stderr, /specs\/spec-ids\.json が見つかりません/);
});
