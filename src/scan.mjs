/**
 * specs/ とテストファイルの走査。ファイルの置き場（specs/current, specs/changes）は固定で、
 * 設定では変えられない。機能をディレクトリ名から導くので、構造そのものが契約。
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { featureOfDir, HEADING_RE } from './format.mjs';

const SKIP_DIRS = new Set(['node_modules', 'dist', 'coverage', '.git']);

export function walk(dir, pred, out = []) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of entries) {
    if (SKIP_DIRS.has(name)) continue;
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

/** 現行の仕様ファイル（`specs/current/` の下の `spec.md`）。出荷済みの正 */
export function currentSpecFiles(root) {
  return walk(join(root, 'specs', 'current'), (p) => p.endsWith(`${sep}spec.md`));
}

/** 進行中の差分の仕様ファイル（`specs/changes/` の下の `spec.md`）。承認済みでも未出荷 */
export function changesSpecFiles(root) {
  return walk(join(root, 'specs', 'changes'), (p) => p.endsWith(`${sep}spec.md`));
}

/** 現行と進行中の差分を合わせた仕様ファイル（採番が読む範囲）。releases/ は見ない */
export function specFiles(root) {
  return [...currentSpecFiles(root), ...changesSpecFiles(root)];
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

/** `specs/current/<dir>/spec.md` なら、そのディレクトリ名から導いた機能を返す。それ以外は null */
export function featureOfSpecPath(root, specPath, dirPrefix) {
  const rel = relative(root, specPath).split(sep);
  if (rel[0] === 'specs' && rel[1] === 'current' && rel.length === 4 && rel[3] === 'spec.md') {
    return featureOfDir(rel[2], dirPrefix);
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
