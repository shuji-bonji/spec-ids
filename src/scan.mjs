/**
 * 置き場とテストファイルの走査。置き場はレイアウト（src/layout.mjs）で決まり、設定では変えられない。
 * 機能をディレクトリ名から導くので、構造そのものが契約。
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { featureOfDir, HEADING_RE } from './format.mjs';
import { layoutOf } from './layout.mjs';

const SKIP_DIRS = new Set(['node_modules', 'dist', 'coverage', '.git']);

export function walk(dir, pred, out = [], skipTop = []) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of entries) {
    if (SKIP_DIRS.has(name) || skipTop.includes(name)) continue;
    const p = join(dir, name);
    let st;
    try {
      st = statSync(p);
    } catch {
      continue;
    }
    if (st.isDirectory()) walk(p, pred, out);
    else if (pred(p)) out.push(p);
  }
  return out;
}

const isSpecMd = (p) => p.endsWith(`${sep}spec.md`);

/** 現行の仕様ファイル（current の置き場の下の `spec.md`）。出荷済みの正 */
export function currentSpecFiles(root, layout = 'specs') {
  const l = layoutOf(layout);
  return walk(join(root, ...l.current.split('/')), isSpecMd);
}

/** 進行中の差分の仕様ファイル（changes の置き場の下の `spec.md`。openspec では `archive/` を除く）。承認済みでも未出荷 */
export function changesSpecFiles(root, layout = 'specs') {
  const l = layoutOf(layout);
  return walk(join(root, ...l.changes.split('/')), isSpecMd, [], l.changesExclude);
}

/** 現行と進行中の差分を合わせた仕様ファイル（採番が読む範囲）。releases は見ない */
export function specFiles(root, layout = 'specs') {
  return [...currentSpecFiles(root, layout), ...changesSpecFiles(root, layout)];
}

/**
 * glob（`src/** /*.test.ts` の形）を正規表現にする。対応するのは `**`、`*`、`?` だけ。
 * 相対パスは `/` 区切りで照合する。
 */
export function globToRegExp(glob) {
  let re = '';
  for (let i = 0; i < glob.length; i += 1) {
    const c = glob[i];
    if (c === '*') {
      if (glob[i + 1] === '*') {
        // `**/` は 0 個以上のディレクトリ、末尾の `**` は何でも
        if (glob[i + 2] === '/') {
          re += '(?:.*/)?';
          i += 2;
        } else {
          re += '.*';
          i += 1;
        }
      } else {
        re += '[^/]*';
      }
    } else if (c === '?') {
      re += '[^/]';
    } else {
      re += c.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    }
  }
  return new RegExp(`^${re}$`);
}

/** 設定 tests の glob に合うファイルを集める */
export function testFiles(root, globs) {
  const res = globs.map(globToRegExp);
  return walk(root, (p) => {
    const rel = relative(root, p).split(sep).join('/');
    return res.some((re) => re.test(rel));
  });
}

/** `<current の置き場>/<dir>/spec.md` なら、そのディレクトリ名から導いた機能を返す。それ以外は null */
export function featureOfSpecPath(root, specPath, dirPrefix, layout = 'specs') {
  const base = layoutOf(layout).current.split('/');
  const rel = relative(root, specPath).split(sep);
  const head = rel.slice(0, base.length);
  if (
    head.every((seg, i) => seg === base[i]) &&
    rel.length === base.length + 2 &&
    rel[rel.length - 1] === 'spec.md'
  ) {
    return featureOfDir(rel[base.length], dirPrefix);
  }
  return null;
}

/**
 * ファイル群から ID を集める。戻り値は Map<ID, Set<相対パス>>。
 * `extract(text)` は 1 ファイルの本文から ID の配列を返す（重複を含んでよい）。
 */
export function collect(root, files, extract) {
  const where = new Map();
  for (const f of files) {
    const text = readFileSync(f, 'utf8');
    for (const id of extract(text)) {
      if (!where.has(id)) where.set(id, new Set());
      where.get(id).add(relPath(root, f));
    }
  }
  return where;
}

/** 見出しに現れた ID を、出現回数つきで数える。戻り値は Map<ID, Array<相対パス>>（同じファイルに 2 回あれば 2 要素） */
export function collectHeadings(root, files) {
  const where = new Map();
  for (const f of files) {
    const text = readFileSync(f, 'utf8');
    for (const m of text.matchAll(HEADING_RE)) {
      const id = m[1];
      if (!where.has(id)) where.set(id, []);
      where.get(id).push(relPath(root, f));
    }
  }
  return where;
}

export function relPath(root, p) {
  return relative(root, p).split(sep).join('/');
}
