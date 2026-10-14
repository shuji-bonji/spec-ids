/**
 * 設定 `specs/spec-ids.json` または `openspec/spec-ids.json` の探索と読み込み。
 *
 * 基点ディレクトリ（root）は、このパッケージの位置ではなく、設定ファイルを見つけたディレクトリ。
 * `npx` で配ると import.meta.url は node_modules の中を指すため。
 *
 * 0.5.0 から設定は 2 か所のどちらかにあり、見つかった場所でレイアウト（置き場）が決まる（src/layout.mjs）。
 * 各ディレクトリでは `openspec/spec-ids.json` を先に、次に `specs/spec-ids.json` を見る（SPEC-SPECIDS-CONFIG-007）。
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { isDomain } from './format.mjs';
import { LAYOUT_NAMES, LAYOUTS } from './layout.mjs';

export const CONFIG_PATH = LAYOUTS.specs.configPath;
export const OPENSPEC_CONFIG_PATH = LAYOUTS.openspec.configPath;
/** 探す順（同じディレクトリでは openspec/ が先） */
const SEARCH = [LAYOUTS.openspec, LAYOUTS.specs];

export const DEFAULT_TESTS = ['src/**/*.test.ts', 'tests/**/*.test.ts'];

/**
 * cwd から上へ辿り、設定ファイルを持つディレクトリとレイアウトを返す。無ければ null。
 * @returns {{ root: string, layout: 'specs' | 'openspec', configPath: string } | null}
 */
export function findConfig(from = process.cwd()) {
  let dir = resolve(from);
  for (;;) {
    for (const layout of SEARCH) {
      if (existsSync(join(dir, layout.configPath))) {
        return { root: dir, layout: layout.name, configPath: layout.configPath };
      }
    }
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

/** cwd から上へ辿り、設定ファイルを持つディレクトリを返す。無ければ null（0.4.0 からの API） */
export function findRoot(from = process.cwd()) {
  return findConfig(from)?.root ?? null;
}

/** 設定を読み、既定値を埋め、形を検証して返す。root の下の設定ファイルの場所でレイアウトを決める */
export function loadConfig(root) {
  const found = SEARCH.find((l) => existsSync(join(root, l.configPath))) ?? LAYOUTS.specs;
  const path = join(root, found.configPath);
  let raw;
  try {
    raw = JSON.parse(readFileSync(path, 'utf8'));
  } catch (err) {
    throw new Error(`${found.configPath} を読めません: ${err.message}`);
  }
  return normalizeConfig(raw, found.name);
}

/**
 * 既定値を埋め、形を検証する。`layoutFromLocation`（設定ファイルの場所から決めたレイアウト）を渡すか、
 * raw に `layout` があれば、戻り値に `layout` を含める。どちらも無ければ 0.4.0 と同じ 3 つのキーだけを返す。
 */
export function normalizeConfig(raw, layoutFromLocation) {
  if (typeof raw !== 'object' || raw === null)
    throw new Error(`${CONFIG_PATH} はオブジェクトである必要があります`);
  const { domain, dirPrefix = '', tests = DEFAULT_TESTS, layout } = raw;
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
  if (layout !== undefined) {
    if (!LAYOUT_NAMES.includes(layout)) {
      throw new Error(
        `spec-ids.json の layout は ${LAYOUT_NAMES.join(' か ')} にしてください。今の値: ${JSON.stringify(layout)}`
      );
    }
    if (layoutFromLocation && layout !== layoutFromLocation) {
      throw new Error(
        `spec-ids.json の layout（${layout}）が設定ファイルの場所（${LAYOUTS[layoutFromLocation].configPath} = ${layoutFromLocation}）と違います`
      );
    }
  }
  const resolved = layoutFromLocation ?? layout;
  return resolved ? { domain, dirPrefix, tests, layout: resolved } : { domain, dirPrefix, tests };
}
