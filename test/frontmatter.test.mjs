import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFrontMatter as fromIndex } from '../src/index.mjs';
import { readFrontMatter } from '../src/frontmatter.mjs';

test('front matter の読み方: 1 行目の --- から次の --- までを読み、値の 5 つの形を型に分ける', () => {
  const text = [
    '---',
    'approved: 2026-10-01',
    'pr: 89',
    'implementation: required',
    'introduced_by: 20261004-db-location',
    'targets: [common_errors, get_law_range, get_toc, search_fulltext]',
    'empty:',
    '---',
    '# 変更: 本文',
    '',
  ].join('\n');
  const r = readFrontMatter(text);
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.data, {
    approved: '2026-10-01',
    pr: 89,
    implementation: 'required',
    introduced_by: '20261004-db-location',
    targets: ['common_errors', 'get_law_range', 'get_toc', 'search_fulltext'],
    empty: null,
  });
  assert.equal(r.lines, 8);
});

test('front matter の読み方: 1 行目が --- でなければ null を返す', () => {
  assert.equal(readFrontMatter('# 機能: get_toc\n\n- 承認日: 2026-09-28（PR #50）\n'), null);
  assert.equal(readFrontMatter('\n---\napproved: 2026-10-01\n---\n'), null);
  assert.equal(readFrontMatter(''), null);
});

test('front matter の読み方: 改行が CRLF でも同じに読む', () => {
  const r = readFrontMatter('---\r\napproved: 2026-10-01\r\npr: 89\r\n---\r\n# x\r\n');
  assert.deepEqual(r.data, { approved: '2026-10-01', pr: 89 });
  assert.deepEqual(r.errors, []);
});

test('front matter の読み方: 次の --- が無ければ errors に入る', () => {
  const r = readFrontMatter('---\napproved: 2026-10-01\n# 変更: 本文\n');
  assert.ok(r.errors.length > 0);
  assert.ok(r.errors.some((e) => e.includes('---')));
});

test('front matter の読み方: コメント・引用符・複数行の値は受け付けない', () => {
  for (const line of [
    'approved: 2026-10-01 # 承認日',
    'implementation: "required"',
    "implementation: 'required'",
    'targets: [get_toc, "search_law"]',
  ]) {
    const r = readFrontMatter(`---\n${line}\n---\n`);
    assert.equal(r.errors.length, 1, line);
    assert.equal(Object.keys(r.data).length, 0, line);
  }
  const multi = readFrontMatter('---\ntargets:\n  - get_toc\n  - search_law\n---\n');
  assert.equal(multi.errors.length, 2);
  assert.deepEqual(multi.data, { targets: null });
});

test('front matter の読み方: キーは英小文字と _ だけで、同じキーは 1 回だけ', () => {
  const r = readFrontMatter('---\nApproved: 2026-10-01\nspec-id: EGOV\npr: 1\npr: 2\n---\n');
  assert.equal(r.errors.length, 3);
  assert.deepEqual(r.data, { pr: 1 });
});

test('front matter の読み方: 1 行に「キー: 値」が 1 つ。空の行や値だけの行は受け付けない', () => {
  const r = readFrontMatter('---\napproved: 2026-10-01\n\njust-a-value\n---\n');
  assert.equal(r.errors.length, 2);
  assert.deepEqual(r.data, { approved: '2026-10-01' });
});

test('front matter の読み方: 配列は 1 行で、要素は英数字と _ - だけ', () => {
  assert.deepEqual(readFrontMatter('---\ntargets: [a_b, c-d, E9]\n---\n').data, {
    targets: ['a_b', 'c-d', 'E9'],
  });
  assert.deepEqual(readFrontMatter('---\ntargets: []\n---\n').data, { targets: [] });
  for (const bad of ['[a b]', '[a,,b]', '[a', '[a/b]']) {
    const r = readFrontMatter(`---\ntargets: ${bad}\n---\n`);
    assert.equal(r.errors.length, 1, bad);
  }
});

test('front matter の読み方: 0 や先頭が 0 の数は正の整数にしない（文字列のまま）', () => {
  assert.deepEqual(readFrontMatter('---\npr: 0\nx: 007\n---\n').data, { pr: '0', x: '007' });
});

test('Node の API: readFrontMatter を index から import できる', () => {
  assert.equal(fromIndex, readFrontMatter);
});
