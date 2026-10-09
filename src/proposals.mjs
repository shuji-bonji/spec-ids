/**
 * 差分（proposal.md）と current の機能の置き場の走査。置き場は固定で、設定では変えられない。
 *
 *   - current の機能: `specs/current/<dir>/spec.md`
 *   - 草案の差分:     `specs/changes/<id>/proposal.md`
 *   - 取り込み済み:   `specs/releases/<tag>/<id>/proposal.md`
 *   - 差分が書き換える機能の仕様: `<差分のフォルダー>/specs/<dir>/spec.md`
 *
 * proposal.md の無いフォルダーは差分として数えない（`specs/releases/<tag>/` に置いた版の写しなど）。
 */
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { relPath } from './scan.mjs';

function subdirs(dir) {
  let names;
  try {
    names = readdirSync(dir);
  } catch {
    return [];
  }
  return names
    .filter((name) => {
      try {
        return statSync(join(dir, name)).isDirectory();
      } catch {
        return false;
      }
    })
    .sort();
}

/** `specs/current/<dir>/spec.md` のある `<dir>` を名前の順に返す */
export function currentDirs(root) {
  const base = join(root, 'specs', 'current');
  return subdirs(base).filter((d) => existsSync(join(base, d, 'spec.md')));
}

/** `specs/current/<dir>/spec.md` の絶対パス */
export function currentSpecPath(root, dir) {
  return join(root, 'specs', 'current', dir, 'spec.md');
}

/** 差分のフォルダーの `specs/<dir>/spec.md` のある `<dir>` を名前の順に返す */
export function diffSpecDirs(diffDir) {
  const base = join(diffDir, 'specs');
  return subdirs(base).filter((d) => existsSync(join(base, d, 'spec.md')));
}

/**
 * 差分を集める。changes が先、次に releases（版の名前の順、その中は差分 ID の順）。
 * @returns {Array<{ box: 'changes' | 'releases', id: string, version: string, dir: string, file: string, rel: string }>}
 *   version は releases なら `<tag>`、changes なら `changes`。dir は差分のフォルダー、file は proposal.md（どちらも絶対パス）
 */
export function listProposals(root) {
  const out = [];
  const changes = join(root, 'specs', 'changes');
  for (const id of subdirs(changes)) {
    const file = join(changes, id, 'proposal.md');
    if (existsSync(file)) {
      out.push({
        box: 'changes',
        id,
        version: 'changes',
        dir: join(changes, id),
        file,
        rel: relPath(root, file),
      });
    }
  }
  const releases = join(root, 'specs', 'releases');
  for (const tag of subdirs(releases)) {
    for (const id of subdirs(join(releases, tag))) {
      const file = join(releases, tag, id, 'proposal.md');
      if (existsSync(file)) {
        out.push({
          box: 'releases',
          id,
          version: tag,
          dir: join(releases, tag, id),
          file,
          rel: relPath(root, file),
        });
      }
    }
  }
  return out;
}
