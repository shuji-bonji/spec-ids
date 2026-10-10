import { spawnSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const BIN = fileURLToPath(new URL('../bin/spec-ids.mjs', import.meta.url));

/** CLI を root で動かす。env を渡すと環境変数に足す。戻り値は { status, stdout, stderr } */
export function run(root, args, env = {}) {
  const r = spawnSync(process.execPath, [BIN, ...args], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, ...env },
  });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}

/** root の下の全ファイルを { 相対パス: 本文 } にする（ファイルを書き換えていないことの確かめに使う） */
export function snapshot(root) {
  const out = {};
  const walk = (dir) => {
    for (const name of readdirSync(dir).sort()) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else out[relative(root, p)] = readFileSync(p, 'utf8');
    }
  };
  walk(root);
  return out;
}

/** 一時ディレクトリに { 相対パス: 本文 } を書いて root を返す */
export function fixture(files) {
  const root = mkdtempSync(join(tmpdir(), 'spec-ids-'));
  for (const [rel, body] of Object.entries(files)) {
    const p = join(root, rel);
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, body);
  }
  return root;
}

/**
 * front matter の文字列を組み立てる。値が null なら「キー:」だけ、配列なら `[a, b]` で書き、
 * undefined のキーは書かない。
 * 例: fm({ approved: '2026-10-01', pr: 89 }) → '---\napproved: 2026-10-01\npr: 89\n---\n'
 */
export function fm(entries) {
  const lines = Object.entries(entries)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => {
      if (v === null) return `${k}:`;
      if (Array.isArray(v)) return `${k}: [${v.join(', ')}]`;
      return `${k}: ${v}`;
    });
  return `---\n${lines.join('\n')}\n---\n`;
}

export const CONFIG = {
  domain: 'NTA',
  dirPrefix: 'nta_',
  tests: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
};

/** 0.3.0 から current の spec.md には front matter が要る（検査 5） */
export const SPEC_OK = `${fm({ spec_id: 'NTA', approved: '2026-09-22', pr: 49 })}# 機能: nta_get_tsutatsu

## できること

### SPEC-NTA-GET-TSUTATSU-001 通達名を解決する

本文。

### SPEC-NTA-GET-TSUTATSU-002 clause が無ければ何もしない

本文。SPEC-NTA-GET-TSUTATSU-001 を参照する。
`;

export const TEST_OK = `import { describe, it } from 'vitest';
describe('getTsutatsu', () => {
  it('SPEC-NTA-GET-TSUTATSU-001 辞書に無い名前はエラー', () => {});
  it("SPEC-NTA-GET-TSUTATSU-002 clause 未指定はエラー", () => {});
});
`;
