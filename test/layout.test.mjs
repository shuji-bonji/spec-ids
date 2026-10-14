/**
 * openspec レイアウト（差分 20261014-openspec-layout、spec-ids 0.5.0）。
 *
 * OpenSpec 1.14.1 の置き場（openspec/specs・openspec/changes・openspec/changes/archive）と
 * 見出し（### Requirement: <名前>）を、spec レイアウトと同じ検査の意味で読む。
 * ここでは openspec レイアウトの fixture を `openspec/` の下に組む。specs レイアウトの既存テストは変えない
 * （SPEC-SPECIDS-CHECK-023: 1 行目を除いて 0.4.0 と同じ）。
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { check, formatReport } from '../src/check.mjs';
import { findConfig, findRoot, loadConfig, normalizeConfig } from '../src/config.mjs';
import { HEADING_RE } from '../src/format.mjs';
import { formatHistory, history, historyAll } from '../src/history.mjs';
import { init } from '../src/init.mjs';
import { parseArchiveName } from '../src/layout.mjs';
import { nextIds } from '../src/next.mjs';
import { checkScope, releasedIds } from '../src/pr-scope.mjs';
import { fixture, fm, itLine, run } from './helpers.mjs';

const READER = { domain: 'READER', dirPrefix: '', tests: ['tests/**/*.test.ts'] };
const READER_JSON = JSON.stringify(READER);

/** OpenSpec の正本 spec.md（front matter 付き・## Purpose / ## Requirements・### Requirement: SPEC-…） */
const req = (id, title) => `### Requirement: ${id} ${title}`;
const CURRENT_READ_TEXT = `${fm({ spec_id: 'READER', kind: 'tool', approved: '2026-10-20', pr: 57 })}# read-text

## Purpose

read_text ツールが返すテキストと、ページ指定の振る舞いを定めます。

## Requirements

${req('SPEC-READER-READ-TEXT-001', 'pages で指定したページだけを返す')}

本文（SHALL）。

#### Scenario: 2 ページ目だけを指定する
- **WHEN** pages: [2]
- **THEN** 2 ページ目だけ
`;
const DELTA_READ_TEXT = `## ADDED Requirements

${req('SPEC-READER-READ-TEXT-002', '範囲外のページ番号はエラーにする')}

本文（SHALL）。

#### Scenario: 5 を渡す
- **WHEN** pages: [5]
- **THEN** PAGE_OUT_OF_RANGE
`;
const prop = (data = {}) =>
  `${fm({
    approved: '2026-10-22',
    pr: 58,
    implementation: 'required',
    targets: ['read-text'],
    ...data,
  })}# 変更\n`;
const TEST_READ_TEXT = `import { it } from 'vitest';
${itLine('SPEC-READER-READ-TEXT-001 2 ページ目だけを指定する')}
`;

/** openspec レイアウトの最小のリポジトリ */
function openspecRepo(extra = {}) {
  return fixture({
    'openspec/config.yaml': 'schema: spec-driven\n',
    'openspec/spec-ids.json': READER_JSON,
    'openspec/specs/read-text/spec.md': CURRENT_READ_TEXT,
    'tests/read-text.test.ts': TEST_READ_TEXT,
    ...extra,
  });
}

// ---- config ----

test('SPEC-SPECIDS-CONFIG-001 SPEC-SPECIDS-CONFIG-007 findConfig は openspec/spec-ids.json → specs/spec-ids.json の順に探し、場所でレイアウトを決める', () => {
  const os = fixture({ 'openspec/spec-ids.json': READER_JSON, 'src/deep/dir/.keep': '' });
  assert.equal(findRoot(join(os, 'src/deep/dir')), os);
  assert.deepEqual(findConfig(join(os, 'src/deep/dir')), {
    root: os,
    layout: 'openspec',
    configPath: 'openspec/spec-ids.json',
  });
  assert.equal(loadConfig(os).layout, 'openspec');
  assert.equal(loadConfig(os).domain, 'READER');

  const sp = fixture({ 'specs/spec-ids.json': '{"domain":"NTA"}' });
  assert.deepEqual(findConfig(sp), {
    root: sp,
    layout: 'specs',
    configPath: 'specs/spec-ids.json',
  });
  assert.equal(loadConfig(sp).layout, 'specs');

  // 同じディレクトリに両方あれば openspec/ を使う
  const both = fixture({
    'openspec/spec-ids.json': READER_JSON,
    'specs/spec-ids.json': '{"domain":"NTA"}',
  });
  assert.equal(loadConfig(both).domain, 'READER');
  assert.equal(loadConfig(both).layout, 'openspec');

  // 親に specs/、子に openspec/ があれば、近い子を使う
  const nested = fixture({
    'specs/spec-ids.json': '{"domain":"NTA"}',
    'sub/openspec/spec-ids.json': READER_JSON,
    'sub/x/.keep': '',
  });
  assert.equal(findConfig(join(nested, 'sub/x')).root, join(nested, 'sub'));
  assert.equal(findConfig(fixture({ 'a.txt': '' })), null);
});

test('SPEC-SPECIDS-CONFIG-008 layout キーは場所と同じならよく、違う・知らない値ならエラー', () => {
  const ok = fixture({
    'openspec/spec-ids.json': JSON.stringify({ ...READER, layout: 'openspec' }),
  });
  assert.equal(loadConfig(ok).layout, 'openspec');
  const ng1 = fixture({ 'openspec/spec-ids.json': JSON.stringify({ ...READER, layout: 'specs' }) });
  assert.throws(() => loadConfig(ng1), /layout.*openspec/);
  const ng2 = fixture({
    'specs/spec-ids.json': JSON.stringify({ domain: 'NTA', layout: 'openspec' }),
  });
  assert.throws(() => loadConfig(ng2), /layout.*specs/);
  assert.throws(() => normalizeConfig({ domain: 'NTA', layout: 'other' }), /layout/);
  // layout を書かず、場所も渡さなければ、0.4.0 と同じ 3 つのキーだけ（既存テストの deepEqual を保つ）
  assert.deepEqual(Object.keys(normalizeConfig({ domain: 'NTA' })), [
    'domain',
    'dirPrefix',
    'tests',
  ]);
  assert.equal(normalizeConfig({ domain: 'NTA' }, 'specs').layout, 'specs');
});

test('SPEC-SPECIDS-CONFIG-006 設定が見つからないときの文は 2 つのファイル名と --layout openspec を含み exit 2', () => {
  const r = run(fixture({ 'a.txt': '' }), ['check']);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /specs\/spec-ids\.json も openspec\/spec-ids\.json も見つかりません/);
  assert.match(r.stderr, /--layout openspec/);
});

test('SPEC-SPECIDS-CONFIG-010 parseArchiveName は先頭の YYYY-MM-DD- を版、残りを ID にする', () => {
  assert.deepEqual(parseArchiveName('2026-10-14-add-pages'), {
    id: 'add-pages',
    version: '2026-10-14',
  });
  assert.deepEqual(parseArchiveName('add-pages'), { id: 'add-pages', version: null });
  assert.deepEqual(parseArchiveName('2026-10-14'), { id: '2026-10-14', version: null });
});

// ---- format ----

test('SPEC-SPECIDS-FORMAT-003 SPEC-SPECIDS-FORMAT-006 HEADING_RE は ### Requirement: の直後の ID も拾い、空白が無い・小文字・語が先のものは拾わない', () => {
  const text = [
    req('SPEC-READER-READ-TEXT-001', 'pages で指定したページだけを返す'),
    '### Requirement:SPEC-READER-READ-TEXT-002 x',
    '### requirement: SPEC-READER-READ-TEXT-003 x',
    '### Requirement: 題 SPEC-READER-READ-TEXT-004',
    '### SPEC-READER-READ-TEXT-005 y',
    '## Requirement: SPEC-READER-READ-TEXT-006 z',
  ].join('\n');
  assert.deepEqual(
    [...text.matchAll(HEADING_RE)].map((m) => m[1]),
    ['SPEC-READER-READ-TEXT-001', 'SPEC-READER-READ-TEXT-005']
  );
});

// ---- check ----

test('SPEC-SPECIDS-CHECK-001 SPEC-SPECIDS-CHECK-021 SPEC-SPECIDS-CONFIG-009 openspec レイアウト: openspec/specs を current、changes（archive を除く）を changes、archive を releases として読み、1 行目に layout を出す', () => {
  const root = openspecRepo({
    'openspec/changes/add-pages/proposal.md': prop({ approved: null, pr: null }),
    'openspec/changes/add-pages/specs/read-text/spec.md': DELTA_READ_TEXT,
    'openspec/changes/archive/2026-10-10-first/proposal.md': prop({
      approved: '2026-10-10',
      pr: 50,
    }),
    'openspec/changes/archive/2026-10-10-first/specs/read-text/spec.md': DELTA_READ_TEXT.replace(
      '002',
      '001'
    ),
  });
  const r = check(root, loadConfig(root));
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.layout, 'openspec');
  assert.deepEqual(formatReport(r), {
    out: [
      'layout: openspec',
      'current: 1 files, 1 IDs / changes: 1 files, 1 IDs',
      'proposals: changes 1, releases 1',
      'tests: 1 files, 1 IDs',
      'OK: 仕様 ID とテストが一致しています',
    ],
    err: [],
  });
  const cli = run(root, ['check']);
  assert.equal(cli.status, 0, cli.stderr);
  assert.equal(cli.stdout.split('\n')[0], 'layout: openspec');
});

test('SPEC-SPECIDS-CHECK-021 openspec レイアウト: 検査 4 の <dir> は openspec/specs のディレクトリ名', () => {
  const root = openspecRepo({
    'openspec/specs/read-text/spec.md': CURRENT_READ_TEXT.replace(
      'READ-TEXT-001',
      'SEARCH-TEXT-001'
    ),
    'tests/read-text.test.ts': TEST_READ_TEXT.replace('READ-TEXT-001', 'SEARCH-TEXT-001'),
  });
  const r = check(root, loadConfig(root));
  assert.equal(r.ok, false);
  assert.deepEqual(r.misplaced, [
    {
      id: 'SPEC-READER-SEARCH-TEXT-001',
      file: 'openspec/specs/read-text/spec.md',
      expected: 'SPEC-READER-READ-TEXT-###',
    },
  ]);
});

test('SPEC-SPECIDS-CHECK-020 openspec レイアウト: 食い違いの行のパスは openspec/ の置き場で出し、1 行目を含めて標準出力は 4 行', () => {
  const root = openspecRepo({
    'openspec/specs/read-text/spec.md': `# read-text\n- 承認日: 2026-09-22（PR #49）\n\n## Requirements\n\n${req('SPEC-READER-READ-TEXT-001', 'x')}\n`,
    'openspec/changes/archive/2026-10-14-add-pages/proposal.md': prop({ targets: ['other'] }),
    'openspec/changes/archive/2026-10-14-add-pages/specs/read-text/spec.md':
      '## MODIFIED Requirements\n',
  });
  const r = check(root, loadConfig(root));
  const { out, err } = formatReport(r);
  assert.equal(out.length, 4);
  assert.equal(out[0], 'layout: openspec');
  assert.ok(err.some((l) => l.startsWith('  openspec/specs/read-text/spec.md: ')));
  assert.ok(
    err.some(
      (l) =>
        l.startsWith('  openspec/changes/archive/2026-10-14-add-pages/proposal.md: ') &&
        l.includes('read-text')
    )
  );
  assert.ok(err.includes('  openspec/specs/read-text/spec.md:2'));
  assert.ok(err.includes('openspec/specs にあってテストに無い ID:') === false);
});

test('SPEC-SPECIDS-CHECK-022 openspec レイアウトでは specs/ を読まず、specs レイアウトでは openspec/ を読まない', () => {
  const os = openspecRepo({
    'specs/current/old/spec.md': `${fm({ spec_id: 'READER', approved: '2026-01-01', pr: 1 })}### SPEC-READER-OLD-001 x\n`,
  });
  const r1 = check(os, loadConfig(os));
  assert.equal(r1.ok, true);
  assert.equal(r1.counts.currentFiles, 1);

  const sp = fixture({
    'specs/spec-ids.json': READER_JSON,
    'specs/current/read-text/spec.md': CURRENT_READ_TEXT,
    'openspec/specs/x/spec.md': `${fm({ spec_id: 'READER', approved: '2026-01-01', pr: 1 })}### SPEC-READER-X-001 x\n`,
    'tests/read-text.test.ts': TEST_READ_TEXT,
  });
  const r2 = check(sp, loadConfig(sp));
  assert.equal(r2.ok, true);
  assert.equal(r2.layout, 'specs');
  assert.equal(r2.counts.currentFiles, 1);
});

test('SPEC-SPECIDS-CHECK-023 specs レイアウトの check() は layout が増えるだけで、0.4.0 の戻り値のキーと値を保つ', () => {
  const root = fixture({
    'specs/spec-ids.json': '{"domain":"NTA","dirPrefix":"nta_"}',
    'specs/current/nta_get_tsutatsu/spec.md': `${fm({ spec_id: 'NTA', approved: '2026-09-22', pr: 49 })}### SPEC-NTA-GET-TSUTATSU-001 x\n`,
    'src/x.test.ts': itLine('SPEC-NTA-GET-TSUTATSU-001 x'),
  });
  const config = { domain: 'NTA', dirPrefix: 'nta_', tests: ['src/**/*.test.ts'] }; // layout 無し = specs
  const r = check(root, config);
  assert.equal(r.layout, 'specs');
  assert.deepEqual(Object.keys(r).sort(), [
    'counts',
    'duplicated',
    'frontMatter',
    'layout',
    'legacyLines',
    'misplaced',
    'missingSpecs',
    'missingTargets',
    'missingTests',
    'ok',
  ]);
  assert.equal(formatReport(r).out[0], 'layout: specs');
  assert.equal(formatReport(r).out[1], 'current: 1 files, 1 IDs / changes: 0 files, 0 IDs');
});

// ---- next ----

test('SPEC-SPECIDS-NEXT-002 openspec レイアウト: current と changes（archive を除く）の見出しの最大の次を返す', () => {
  const root = openspecRepo({
    'openspec/changes/add-pages/specs/read-text/spec.md': DELTA_READ_TEXT,
    'openspec/changes/archive/2026-10-10-first/specs/read-text/spec.md': DELTA_READ_TEXT.replace(
      '002',
      '009'
    ),
  });
  const config = loadConfig(root);
  assert.deepEqual(nextIds(root, config, 'read-text'), ['SPEC-READER-READ-TEXT-003']);
  assert.deepEqual(nextIds(root, config, 'openspec/specs/read-text/spec.md'), [
    'SPEC-READER-READ-TEXT-003',
  ]);
});

// ---- history ----

test('SPEC-SPECIDS-HISTORY-012 openspec レイアウト: archive の差分は YYYY-MM-DD- を除いた ID と YYYY-MM-DD の版、草案は changes', () => {
  const root = openspecRepo({
    'openspec/changes/archive/2026-10-24-add-pages/proposal.md': prop(),
    'openspec/changes/archive/manual/proposal.md': prop({ approved: '2026-10-23', pr: 59 }),
    'openspec/changes/limit-pages/proposal.md': prop({ approved: '2026-10-25', pr: 60 }),
    'openspec/changes/draft/proposal.md': prop({ approved: null, pr: null }),
  });
  const config = loadConfig(root);
  const h = history(root, config, 'read-text');
  assert.deepEqual(formatHistory(h), [
    'read-text（SPEC-READER-READ-TEXT）',
    '',
    '| 承認日 | 差分 | PR | 版 |',
    '|---|---|---|---|',
    '| 2026-10-20 | （初版） | #57 | - |',
    '| 2026-10-22 | add-pages | #58 | 2026-10-24 |',
    '| 2026-10-23 | manual | #59 | - |',
    '| 2026-10-25 | limit-pages | #60 | changes |',
  ]);
  assert.deepEqual(h.rows[1], {
    kind: 'change',
    approved: '2026-10-22',
    change: 'add-pages',
    pr: 58,
    version: '2026-10-24',
  });
  assert.equal(h.rows[2].version, null);
  const cli = run(root, ['history', 'read-text', '--json']);
  assert.equal(cli.status, 0, cli.stderr);
  assert.deepEqual(JSON.parse(cli.stdout), h);
});

test('SPEC-SPECIDS-HISTORY-013 openspec レイアウト: 文のパスと --all の走査は openspec/specs', () => {
  const root = openspecRepo({
    'specs/current/old/spec.md': `${fm({ spec_id: 'READER', approved: '2026-01-01', pr: 1 })}# old\n`,
  });
  const config = loadConfig(root);
  assert.throws(
    () => history(root, config, 'read-txt'),
    /openspec\/specs\/read-txt\/spec\.md がありません/
  );
  const r = run(root, ['history', 'read-txt']);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /openspec\/specs\/read-txt/);
  assert.deepEqual(
    history(root, config, 'openspec/specs/read-text/spec.md'),
    history(root, config, 'read-text')
  );
  assert.deepEqual(
    historyAll(root, config).map((h) => h.dir),
    ['read-text']
  );
});

// ---- init ----

test('SPEC-SPECIDS-INIT-005 init --layout openspec は openspec/ が無ければ何も作らずに exit 2、知らない layout も exit 2', () => {
  const empty = fixture({});
  const r = run(empty, ['init', '--domain', 'READER', '--layout', 'openspec']);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /openspec\/ がありません。先に `openspec init` を実行してください/);
  assert.equal(existsSync(join(empty, 'openspec/spec-ids.json')), false);
  assert.equal(existsSync(join(empty, '.github')), false);
  assert.throws(() => init(empty, { domain: 'READER', layout: 'openspec' }), /openspec init/);
  assert.equal(run(empty, ['init', '--domain', 'READER', '--layout', 'other']).status, 2);
});

test('SPEC-SPECIDS-INIT-006 SPEC-SPECIDS-INIT-007 init --layout openspec は openspec/spec-ids.json と openspec 用の spec-gate.yml を作り、節は openspec の置き場と Requirement: の形', () => {
  const root = fixture({
    'openspec/config.yaml': 'schema: spec-driven\n',
    'AGENTS.md': '# existing\n',
  });
  const r1 = init(root, { domain: 'READER', tests: ['tests/**/*.test.ts'], layout: 'openspec' });
  assert.deepEqual(r1.created, ['openspec/spec-ids.json', '.github/workflows/spec-gate.yml']);
  assert.deepEqual(JSON.parse(readFileSync(join(root, 'openspec/spec-ids.json'), 'utf8')), {
    domain: 'READER',
    dirPrefix: '',
    tests: ['tests/**/*.test.ts'],
    layout: 'openspec',
  });
  assert.equal(existsSync(join(root, 'specs')), false);
  const wf = readFileSync(join(root, '.github/workflows/spec-gate.yml'), 'utf8');
  assert.match(
    wf,
    /- run: npm ci\n\s+- run: npx openspec validate --all\n\s+- run: npx spec-ids check\n/
  );
  const prScope = wf.slice(wf.indexOf('  pr-scope:'));
  assert.match(prScope, /if: github\.event_name == 'pull_request'/);
  assert.match(prScope, /fetch-depth: 0/);
  assert.match(prScope, /- run: npm ci\n\s+- run: npx spec-ids pr-scope\n/);
  assert.match(prScope, /BASE_REF: origin\/\$\{\{ github\.base_ref \}\}/);
  assert.match(r1.agentsSection, /openspec\/specs\//);
  assert.match(r1.agentsSection, /openspec\/changes\//);
  assert.match(r1.agentsSection, /Requirement: SPEC-READER-GET-THING-001/);
  assert.equal(readFileSync(join(root, 'AGENTS.md'), 'utf8'), '# existing\n');

  const r2 = init(root, { domain: 'READER', layout: 'openspec' });
  assert.deepEqual(r2.created, []);
  assert.deepEqual(r2.skipped, ['openspec/spec-ids.json', '.github/workflows/spec-gate.yml']);

  const cli = run(fixture({ 'openspec/config.yml': '' }), [
    'init',
    '--domain',
    'READER',
    '--layout',
    'openspec',
  ]);
  assert.equal(cli.status, 0, cli.stderr);
  assert.match(cli.stdout, /作成: openspec\/spec-ids\.json/);
});

// ---- pr-scope ----

function scope(kind, changes, files = {}, released = new Set()) {
  return checkScope({
    kind,
    changes,
    read: (p) => files[p] ?? '',
    diffOf: () => '',
    released,
    layout: 'openspec',
  });
}
const APPROVED = prop();
const UNAPPROVED_SPEC = `${fm({ spec_id: 'READER', approved: null, pr: null })}# x\n`;

test('SPEC-SPECIDS-PR-SCOPE-024 openspec レイアウト: 仕様 PR は openspec/changes/（archive を除く）だけ、current は openspec/specs/<dir>/spec.md', () => {
  const files = { 'openspec/changes/add-pages/proposal.md': APPROVED };
  assert.deepEqual(
    scope(
      'spec',
      [
        { status: 'A', path: 'openspec/changes/add-pages/proposal.md' },
        { status: 'A', path: 'openspec/changes/add-pages/specs/read-text/spec.md' },
      ],
      files
    ),
    []
  );
  const e1 = scope(
    'spec',
    [
      { status: 'A', path: 'openspec/changes/add-pages/proposal.md' },
      { status: 'M', path: 'openspec/specs/read-text/spec.md' },
    ],
    { ...files, 'openspec/specs/read-text/spec.md': CURRENT_READ_TEXT }
  );
  assert.equal(e1.length, 1);
  assert.match(e1[0], /openspec\/specs\/ を書けるのは/);
  const e2 = scope(
    'spec',
    [
      { status: 'A', path: 'openspec/changes/add-pages/proposal.md' },
      { status: 'M', path: 'openspec/config.yaml' },
    ],
    files
  );
  assert.deepEqual(e2, [
    '仕様 PR（spec/*）は openspec/changes/ だけを変えます: openspec/config.yaml',
  ]);
  // archive の下は仕様 PR の範囲の外
  const e3 = scope(
    'spec',
    [
      { status: 'A', path: 'openspec/changes/add-pages/proposal.md' },
      { status: 'M', path: 'openspec/changes/archive/2026-10-10-first/proposal.md' },
    ],
    files
  );
  assert.equal(e3.length, 1);
  assert.match(e3[0], /openspec\/changes\/archive\/2026-10-10-first\/proposal\.md/);
  // 初版起こし
  assert.deepEqual(
    scope('spec-init', [{ status: 'A', path: 'openspec/specs/read-text/spec.md' }], {
      'openspec/specs/read-text/spec.md': CURRENT_READ_TEXT,
    }),
    []
  );
  const e4 = scope('spec-init', [{ status: 'A', path: 'openspec/specs/read-text/spec.md' }], {
    'openspec/specs/read-text/spec.md': UNAPPROVED_SPEC,
  });
  assert.equal(e4.length, 1);
  assert.match(e4[0], /承認日と PR 番号がありません.*openspec\/specs\/read-text\/spec\.md/);
  // .gitkeep は止めない
  assert.deepEqual(
    scope('impl', [
      { status: 'A', path: 'openspec/specs/.gitkeep' },
      { status: 'A', path: 'openspec/changes/.gitkeep' },
      { status: 'D', path: 'openspec/changes/archive/.gitkeep' },
    ]),
    []
  );
});

test('SPEC-SPECIDS-PR-SCOPE-025 openspec レイアウト: 実装 PR は changes → archive の移動と、archive 済みの残りの削除を通し、それ以外の changes の変更は止める', () => {
  assert.deepEqual(
    scope(
      'impl',
      [
        { status: 'M', path: 'src/read-text.ts' },
        {
          status: 'R',
          from: 'openspec/changes/add-pages/proposal.md',
          path: 'openspec/changes/archive/2026-10-24-add-pages/proposal.md',
        },
        { status: 'M', path: 'openspec/specs/read-text/spec.md' },
      ],
      { 'openspec/specs/read-text/spec.md': CURRENT_READ_TEXT }
    ),
    []
  );
  assert.deepEqual(
    scope(
      'impl',
      [{ status: 'D', path: 'openspec/changes/add-pages/tasks.md' }],
      {},
      new Set(['add-pages'])
    ),
    []
  );
  const e1 = scope('impl', [{ status: 'M', path: 'openspec/changes/limit-pages/proposal.md' }]);
  assert.deepEqual(e1, [
    '仕様 PR の外で openspec/changes/ を変えています（許されるのは openspec/changes/archive/ への移動と、archive 済みの差分の残りを消すことだけ）: openspec/changes/limit-pages/proposal.md',
  ]);
  assert.equal(
    scope('impl', [{ status: 'D', path: 'openspec/changes/other/proposal.md' }]).length,
    1
  );

  const root = fixture({
    'openspec/changes/archive/2026-10-24-add-pages/proposal.md': '',
    'openspec/changes/archive/manual/proposal.md': '',
    'openspec/changes/archive/.gitkeep': '',
    'openspec/changes/limit-pages/proposal.md': '',
  });
  assert.deepEqual([...releasedIds(root, 'openspec')].sort(), ['add-pages', 'manual']);
});

test('SPEC-SPECIDS-PR-SCOPE-024 spec-ids pr-scope: openspec レイアウトの git リポジトリで、仕様 PR と実装 PR を検査する', () => {
  const root = openspecRepo();
  const git = (...args) =>
    spawnSync('git', args, {
      cwd: root,
      encoding: 'utf8',
      env: {
        ...process.env,
        GIT_AUTHOR_NAME: 't',
        GIT_AUTHOR_EMAIL: 't@example.com',
        GIT_COMMITTER_NAME: 't',
        GIT_COMMITTER_EMAIL: 't@example.com',
        GIT_CONFIG_GLOBAL: '/dev/null',
        GIT_CONFIG_NOSYSTEM: '1',
      },
    });
  git('init', '-q', '-b', 'main');
  git('add', '-A');
  git('commit', '-q', '-m', 'base');
  git('switch', '-q', '-c', 'spec/add-pages');
  fixtureInto(root, {
    'openspec/changes/add-pages/proposal.md': APPROVED,
    'openspec/changes/add-pages/specs/read-text/spec.md': DELTA_READ_TEXT,
  });
  git('add', '-A');
  git('commit', '-q', '-m', 'spec');
  const ok = run(root, ['pr-scope'], { BASE_REF: 'main' });
  assert.equal(ok.status, 0, ok.stderr);
  assert.match(ok.stdout, /^branch: spec\/add-pages（spec）、base: main、変更 2 ファイル/);

  git('switch', '-q', '-c', 'feat/add-pages');
  fixtureInto(root, { 'src/x.ts': '' });
  git('add', '-A');
  git('mv', 'openspec/changes/add-pages', 'openspec/changes/archive/2026-10-24-add-pages');
  git('commit', '-q', '-m', 'impl');
  const impl = run(root, ['pr-scope'], { BASE_REF: 'spec/add-pages' });
  assert.equal(impl.status, 0, impl.stderr);
});

function fixtureInto(root, files) {
  for (const [rel, body] of Object.entries(files)) {
    const p = join(root, rel);
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, body);
  }
}
