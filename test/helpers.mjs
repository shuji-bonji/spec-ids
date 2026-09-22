import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

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

export const CONFIG = {
  domain: 'NTA',
  dirPrefix: 'nta_',
  tests: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
};

export const SPEC_OK = `# 機能: nta_get_tsutatsu

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
