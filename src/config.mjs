/**
 * 設定 `specs/spec-ids.json` の探索と読み込み。
 *
 * 基点ディレクトリ（root）は、このパッケージの位置ではなく、設定ファイルを見つけたディレクトリ。
 * `npx` で配ると import.meta.url は node_modules の中を指すため。
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { isDomain } from './format.mjs';

export const CONFIG_PATH = 'specs/spec-ids.json';

export const DEFAULT_TESTS = ['src/**/*.test.ts', 'tests/**/*.test.ts'];

/** cwd から上へ辿り、specs/spec-ids.json を持つディレクトリを返す。無ければ null */
export function findRoot(from = process.cwd()) {
  let dir = resolve(from);
  for (;;) {
    if (existsSync(join(dir, CONFIG_PATH))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

/** 設定を読み、既定値を埋め、形を検証して返す */
export function loadConfig(root) {
  const path = join(root, CONFIG_PATH);
  let raw;
  try {
    raw = JSON.parse(readFileSync(path, 'utf8'));
  } catch (err) {
    throw new Error(`${CONFIG_PATH} を読めません: ${err.message}`);
  }
  return normalizeConfig(raw);
}

export function normalizeConfig(raw) {
  if (typeof raw !== 'object' || raw === null)
    throw new Error(`${CONFIG_PATH} はオブジェクトである必要があります`);
  const { domain, dirPrefix = '', tests = DEFAULT_TESTS } = raw;
  if (typeof domain !== 'string' || !isDomain(domain)) {
    throw new Error(
      `${CONFIG_PATH} の domain は英大文字の文字列にしてください（例: "NTA"）。今の値: ${JSON.stringify(domain)}`
    );
  }
  if (typeof dirPrefix !== 'string')
    throw new Error(`${CONFIG_PATH} の dirPrefix は文字列にしてください`);
  if (!Array.isArray(tests) || tests.some((t) => typeof t !== 'string' || t.length === 0)) {
    throw new Error(`${CONFIG_PATH} の tests は glob 文字列の配列にしてください`);
  }
  return { domain, dirPrefix, tests };
}
