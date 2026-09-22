import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { findRoot, loadConfig, normalizeConfig } from '../src/config.mjs';
import { init } from '../src/init.mjs';
import { globToRegExp } from '../src/scan.mjs';
import { fixture } from './helpers.mjs';

test('normalizeConfig は既定値を埋め、domain の形を検証する', () => {
  assert.deepEqual(normalizeConfig({ domain: 'NTA' }), {
    domain: 'NTA',
    dirPrefix: '',
    tests: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
  });
  assert.throws(() => normalizeConfig({ domain: 'nta' }), /domain/);
  assert.throws(() => normalizeConfig({ domain: 'NTA', tests: 'src' }), /tests/);
});

test('findRoot は cwd から上へ辿って specs/spec-ids.json を見つける', () => {
  const root = fixture({ 'specs/spec-ids.json': '{"domain":"NTA"}', 'src/deep/dir/.keep': '' });
  assert.equal(findRoot(join(root, 'src/deep/dir')), root);
  assert.equal(findRoot(fixture({ 'a.txt': '' })), null);
  assert.equal(loadConfig(root).domain, 'NTA');
});

test('globToRegExp は ** と * と ? を扱う', () => {
  const re = globToRegExp('src/**/*.test.ts');
  assert.equal(re.test('src/a.test.ts'), true);
  assert.equal(re.test('src/x/y/a.test.ts'), true);
  assert.equal(re.test('src/a.ts'), false);
  assert.equal(re.test('lib/a.test.ts'), false);
  assert.equal(globToRegExp('tests/*.spec.ts').test('tests/a/b.spec.ts'), false);
  assert.equal(globToRegExp('src/a?.ts').test('src/ab.ts'), true);
});

test('init は置き場・設定・workflow を作り、既存は変更しない', () => {
  const root = fixture({ 'AGENTS.md': '# existing\n' });
  const r1 = init(root, { domain: 'EGOV', dirPrefix: 'egov_' });
  assert.deepEqual(r1.created, [
    'specs/current/.gitkeep',
    'specs/changes/.gitkeep',
    'specs/releases/.gitkeep',
    'specs/spec-ids.json',
    '.github/workflows/spec-gate.yml',
  ]);
  assert.deepEqual(JSON.parse(readFileSync(join(root, 'specs/spec-ids.json'), 'utf8')), {
    domain: 'EGOV',
    dirPrefix: 'egov_',
    tests: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
  });
  assert.match(r1.agentsSection, /SPEC-EGOV-GET-THING-001/);
  assert.match(r1.agentsSection, /接頭辞 `egov_`/);
  assert.equal(readFileSync(join(root, 'AGENTS.md'), 'utf8'), '# existing\n');
  assert.equal(existsSync(join(root, '.github/workflows/spec-gate.yml')), true);

  const r2 = init(root, { domain: 'EGOV' });
  assert.deepEqual(r2.created, []);
  assert.equal(r2.skipped.length, 5);
});
