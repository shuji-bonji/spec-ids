/**
 * 差分（proposal.md）と current の機能の置き場の走査。置き場はレイアウト（src/layout.mjs）で決まり、設定では変えられない。
 *
 *   - current の機能: `<current>/<dir>/spec.md`
 *   - 草案の差分:     `<changes>/<id>/proposal.md`（openspec では `archive/` を除く）
 *   - 取り込み済み:   specs では `<releases>/<tag>/<id>/proposal.md`、openspec では `<releases>/<YYYY-MM-DD-id>/proposal.md`
 *   - 差分が書き換える機能の仕様: `<差分のフォルダー>/specs/<dir>/spec.md`
 *
 * proposal.md の無いフォルダーは差分として数えない（`specs/releases/<tag>/` に置いた版の写しなど）。
 */
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { layoutOf, parseArchiveName } from './layout.mjs';
import { relPath } from './scan.mjs';

const under = (root, rel) => join(root, ...rel.split('/'));

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

/** `<current>/<dir>/spec.md` のある `<dir>` を名前の順に返す */
export function currentDirs(root, layout = 'specs') {
  const base = under(root, layoutOf(layout).current);
  return subdirs(base).filter((d) => existsSync(join(base, d, 'spec.md')));
}

/** `<current>/<dir>/spec.md` の絶対パス */
export function currentSpecPath(root, dir, layout = 'specs') {
  return join(under(root, layoutOf(layout).current), dir, 'spec.md');
}

/** `<current>/<dir>/spec.md` の root からの相対パス（文の中に出すときの形） */
export function currentSpecRel(dir, layout = 'specs') {
  return `${layoutOf(layout).current}/${dir}/spec.md`;
}

/** 差分のフォルダーの `specs/<dir>/spec.md` のある `<dir>` を名前の順に返す */
export function diffSpecDirs(diffDir) {
  const base = join(diffDir, 'specs');
  return subdirs(base).filter((d) => existsSync(join(base, d, 'spec.md')));
}

/**
 * 差分を集める。changes が先、次に releases（版の名前の順、その中は差分 ID の順）。
 * @returns {Array<{ box: 'changes' | 'releases', id: string, version: string | null, dir: string, file: string, rel: string }>}
 *   version は specs の releases なら `<tag>`、openspec の archive ならフォルダー名の先頭の `YYYY-MM-DD`（無ければ null）、
 *   changes なら `changes`。dir は差分のフォルダー、file は proposal.md（どちらも絶対パス）
 */
export function listProposals(root, layout = 'specs') {
  const l = layoutOf(layout);
  const out = [];
  const changes = under(root, l.changes);
  for (const id of subdirs(changes)) {
    if (l.changesExclude.includes(id)) continue;
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
  const releases = under(root, l.releases);
  if (l.flatReleases) {
    for (const name of subdirs(releases)) {
      const file = join(releases, name, 'proposal.md');
      if (existsSync(file)) {
        const { id, version } = parseArchiveName(name);
        out.push({
          box: 'releases',
          id,
          version,
          dir: join(releases, name),
          file,
          rel: relPath(root, file),
        });
      }
    }
    return out;
  }
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
