/**
 * 機能ごとの承認の履歴（`spec-ids history <dir>`）。ファイルは書かない。
 *
 * 集めるもの:
 *   - 初版の承認: `specs/current/<dir>/spec.md` の front matter の approved・pr
 *     （introduced_by のある機能は、初版の行の代わりに、その差分の行を「新設」として出す）
 *   - 差分の承認: `specs/releases/<tag>/<id>/proposal.md` と `specs/changes/<id>/proposal.md` のうち、
 *     targets に `<dir>` を含み、approved と pr のあるもの。版は releases なら `<tag>`、changes なら `changes`
 *
 * 承認日の順に並べ、同じ日は PR 番号の順（同じ PR なら初版が先、次に差分 ID の順）。
 */
import { readFileSync } from 'node:fs';
import { featureOfDir } from './format.mjs';
import { isDate, isPositiveInt, readFrontMatter } from './frontmatter.mjs';
import { dirNameOfTarget } from './next.mjs';
import { currentDirs, currentSpecPath, listProposals } from './proposals.mjs';

/** 承認済みの差分を { id, version, approved, pr, targets } で集める（front matter の読めないものは飛ばす） */
function approvedProposals(root) {
  const out = [];
  for (const p of listProposals(root)) {
    const fm = readFrontMatter(readFileSync(p.file, 'utf8'));
    if (!fm) continue;
    const { approved, pr, targets } = fm.data;
    if (!isDate(approved) || !isPositiveInt(pr) || !Array.isArray(targets)) continue;
    out.push({ id: p.id, version: p.version, approved, pr, targets });
  }
  return out;
}

function compareRows(a, b) {
  if (a.approved !== b.approved) return a.approved < b.approved ? -1 : 1;
  if (a.pr !== b.pr) return a.pr - b.pr;
  if (a.kind === 'initial' && b.kind !== 'initial') return -1;
  if (b.kind === 'initial' && a.kind !== 'initial') return 1;
  return (a.change ?? '').localeCompare(b.change ?? '');
}

function historyOf(root, config, dir, proposals) {
  const fm = readFrontMatter(readFileSync(currentSpecPath(root, dir), 'utf8'));
  const data = fm?.data ?? {};
  const bornBy =
    data.introduced_by !== undefined && data.introduced_by !== null
      ? String(data.introduced_by)
      : null;
  const rows = [];
  if (!bornBy && isDate(data.approved) && isPositiveInt(data.pr)) {
    rows.push({
      kind: 'initial',
      approved: data.approved,
      change: null,
      pr: data.pr,
      version: null,
    });
  }
  for (const p of proposals) {
    if (!p.targets.includes(dir)) continue;
    rows.push({
      kind: p.id === bornBy ? 'introduced' : 'change',
      approved: p.approved,
      change: p.id,
      pr: p.pr,
      version: p.version,
    });
  }
  rows.sort(compareRows);
  return { dir, specId: `SPEC-${config.domain}-${featureOfDir(dir, config.dirPrefix)}`, rows };
}

/**
 * 1 つの機能の履歴。`target` は `<dir>`、`specs/current/<dir>`、`specs/current/<dir>/spec.md` のどれでもよい。
 * `<dir>` が specs/current/ に無いときは例外（exitCode 2）。
 * @returns {{ dir: string, specId: string, rows: Array<{ kind: 'initial' | 'introduced' | 'change', approved: string, change: string | null, pr: number, version: string | null }> }}
 */
export function history(root, config, target) {
  const dir = dirNameOfTarget(target);
  if (!currentDirs(root).includes(dir)) {
    throw Object.assign(new Error(`specs/current/${dir}/spec.md がありません`), { exitCode: 2 });
  }
  return historyOf(root, config, dir, approvedProposals(root));
}

/** すべての機能の履歴（`<dir>` の名前の順） */
export function historyAll(root, config) {
  const proposals = approvedProposals(root);
  return currentDirs(root).map((dir) => historyOf(root, config, dir, proposals));
}

/** 履歴を人が読む行（Markdown の表）にする */
export function formatHistory(h) {
  const lines = [`${h.dir}（${h.specId}）`, '', '| 承認日 | 差分 | PR | 版 |', '|---|---|---|---|'];
  for (const r of h.rows) {
    const label =
      r.kind === 'initial'
        ? '（初版）'
        : r.kind === 'introduced'
          ? `${r.change}（新設）`
          : r.change;
    lines.push(`| ${r.approved} | ${label} | #${r.pr} | ${r.version ?? '-'} |`);
  }
  return lines;
}
