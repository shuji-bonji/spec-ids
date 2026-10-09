/**
 * 古い形（本文の「- 承認日:」などの行）から front matter への変換（`spec-ids migrate`）。
 *
 * spec-ids 0.3.0 だけに置く一時的なサブコマンドで、0.4.0 で外す。0.2.0 までの形で書いた
 * リポジトリ（houki-egov-mcp・houki-nta-mcp・houki-abbreviations）を一度だけ変換するためのもので、
 * 新しく導入するリポジトリは最初から front matter で書く。
 *
 * 読み取りの規則（設計 docs/proposals/20261009-approval-front-matter.md の「変換の手順」）:
 *
 * | 書くもの                                   | 読む元                                                                 | 食い違いとして止める場合                 |
 * | ------------------------------------------ | ---------------------------------------------------------------------- | ---------------------------------------- |
 * | proposal.md の approved・pr                | proposal.md の「- 承認日:」。無ければ current の行の「差分 `<id>` は …」 | 両方にあって値が違う。どちらにも無い     |
 * | proposal.md の implementation              | 「- 実装の変更: 要」→ required、「不要」→ none。括弧書きは補足の行へ    | 行が無い                                 |
 * | proposal.md の targets                     | current の行にその差分が書かれている `<dir>` と、差分の specs/<dir>/ の和 | 和が空                                   |
 * | current の spec_id                         | 「- 機能 ID:」                                                         | 行が無い、または設定の domain と違う     |
 * | current の kind                            | 「- 種類:」（ツール・CLI・DB・共通）                                    | 4 つ以外の値（行が無ければ書かない）     |
 * | current の approved・pr・introduced_by     | 「- 承認日:」の初版の部分（5 通りの書き方）                             | 5 通りのどれにも合わない                 |
 *
 * 設計の表に加えて、次も食い違いとして止める（変換すると記録が消えるため）:
 *   - 「- 承認日:」の行の差分の部分に、読めない文が残っている
 *   - current の行に書かれている差分の proposal.md が無い
 *   - current の行どうしで、同じ差分の承認の値が違う
 *
 * front matter が既にあるファイルは変換済みとして読まず、書き換えない。
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { formatFrontMatter, readFrontMatter } from './frontmatter.mjs';
import { currentDirs, currentSpecPath, diffSpecDirs, listProposals } from './proposals.mjs';
import { relPath } from './scan.mjs';

const KIND_OF = { ツール: 'tool', CLI: 'cli', DB: 'db', 共通: 'common' };

// current の「- 承認日:」の初版の部分（5 通り）
//   1. 2026-09-28（PR #50）   2. 2026-09-27 （PR #77）   3. 2026-09-24（初版。PR #52 のマージ）
//   4. 2026-09-26（初版と差分 `20260926-processing-flow`。PR #63）
//   5. 2026-10-05（PR #142。差分 `20261004-db-location`）
const INIT_RE = /^(\d{4}-\d{2}-\d{2})\s*（(?:初版。)?PR #(\d+)(?: のマージ)?）/;
const BOTH_RE = /^(\d{4}-\d{2}-\d{2})\s*（初版と差分 `([^`]+)`。PR #(\d+)）/;
const BORN_RE = /^(\d{4}-\d{2}-\d{2})\s*（PR #(\d+)。差分 `([^`]+)`）/;
// 差分の部分。`（PR #53 のマージ）` の形も読む
const DIFF_RE = /^。差分 `([^`]+)` は (\d{4}-\d{2}-\d{2})\s*（PR #(\d+)(?: のマージ)?）/;
// proposal.md の「- 承認日:」と「- 実装の変更:」
const PROPOSAL_APPROVAL_RE = /^(\d{4}-\d{2}-\d{2})\s*（PR #(\d+)(?: のマージ)?）$/;
const IMPL_RE = /^(要|不要)(?:（(.*)）)?$/;

/** 本文の箇条書き「- <label>: 値」の最初の 1 行の値。無ければ null */
function headerValue(text, label) {
  const m = new RegExp(`^- ${label}:[ \\t]*(.*?)[ \\t]*$`, 'm').exec(text);
  return m ? m[1] : null;
}

/**
 * current の「- 承認日:」の値を読む。
 * @returns {{ initial: { approved: string, pr: number } | null, introducedBy: string | null, diffs: Array<{ id: string, approved: string, pr: number }>, error: string | null }}
 */
export function parseCurrentApproval(value) {
  const diffs = [];
  let initial = null;
  let introducedBy = null;
  let rest;
  const both = BOTH_RE.exec(value);
  const born = BORN_RE.exec(value);
  const init = INIT_RE.exec(value);
  if (both) {
    initial = { approved: both[1], pr: Number(both[3]) };
    diffs.push({ id: both[2], approved: both[1], pr: Number(both[3]) });
    rest = value.slice(both[0].length);
  } else if (born) {
    introducedBy = born[3];
    diffs.push({ id: born[3], approved: born[1], pr: Number(born[2]) });
    rest = value.slice(born[0].length);
  } else if (init) {
    initial = { approved: init[1], pr: Number(init[2]) };
    rest = value.slice(init[0].length);
  } else {
    return {
      initial,
      introducedBy,
      diffs,
      error: `初版の部分が 5 通りの書き方のどれにも合いません（${value.slice(0, 60)}）`,
    };
  }
  for (let m = DIFF_RE.exec(rest); m; m = DIFF_RE.exec(rest)) {
    diffs.push({ id: m[1], approved: m[2], pr: Number(m[3]) });
    rest = rest.slice(m[0].length);
  }
  if (!/^。?$/.test(rest)) {
    return {
      initial,
      introducedBy,
      diffs,
      error: `読めない部分があります（${rest.slice(0, 60)}）`,
    };
  }
  return { initial, introducedBy, diffs, error: null };
}

const key = (a) => `${a.approved}（PR #${a.pr}）`;

/**
 * 変換の計画を立てる。ファイルは書かない。
 * @returns {{ features: Array, changes: Array, mismatches: Array<{ file: string, message: string }> }}
 *   features[] は { dir, file, converted, data }、changes[] は { id, box, version, file, converted, data, note }。
 *   data は書く front matter（converted のときは空）。note は「- 実装の変更の補足:」に移す括弧書き
 */
export function planMigration(root, config) {
  const mismatches = [];
  const miss = (file, message) => mismatches.push({ file, message });

  // current
  const features = [];
  const mentions = new Map(); // 差分 ID → Array<{ dir, file, approved, pr }>
  for (const dir of currentDirs(root)) {
    const path = currentSpecPath(root, dir);
    const file = relPath(root, path);
    const text = readFileSync(path, 'utf8');
    if (readFrontMatter(text)) {
      features.push({ dir, file, path, converted: true, data: {} });
      continue;
    }
    const data = {};
    const id = headerValue(text, '機能 ID');
    if (id === null) miss(file, '「- 機能 ID:」の行がありません');
    else if (id !== config.domain)
      miss(file, `「- 機能 ID:」の値 ${id} が設定の domain（${config.domain}）と違います`);
    else data.spec_id = id;
    const kind = headerValue(text, '種類');
    if (kind !== null) {
      if (Object.hasOwn(KIND_OF, kind)) data.kind = KIND_OF[kind];
      else miss(file, `「- 種類:」の値 ${kind} は ツール・CLI・DB・共通 のどれでもありません`);
    }
    const approval = headerValue(text, '承認日');
    if (approval === null) {
      miss(file, '「- 承認日:」の行がありません');
    } else {
      const parsed = parseCurrentApproval(approval);
      if (parsed.error) miss(file, `「- 承認日:」の${parsed.error}`);
      if (parsed.initial) {
        data.approved = parsed.initial.approved;
        data.pr = parsed.initial.pr;
      }
      if (parsed.introducedBy) data.introduced_by = parsed.introducedBy;
      for (const d of parsed.diffs) {
        if (!mentions.has(d.id)) mentions.set(d.id, []);
        mentions.get(d.id).push({ dir, file, approved: d.approved, pr: d.pr });
      }
    }
    features.push({ dir, file, path, converted: false, data, text });
  }

  // proposal.md
  const changes = [];
  const proposalIds = new Set();
  for (const p of listProposals(root)) {
    proposalIds.add(p.id);
    const text = readFileSync(p.file, 'utf8');
    const base = { id: p.id, box: p.box, version: p.version, file: p.rel, path: p.file };
    if (readFrontMatter(text)) {
      changes.push({ ...base, converted: true, data: {}, note: null });
      continue;
    }

    let own = null;
    const approvalLine = headerValue(text, '承認日');
    if (approvalLine !== null) {
      const m = PROPOSAL_APPROVAL_RE.exec(approvalLine);
      if (m) own = { approved: m[1], pr: Number(m[2]) };
      else miss(p.rel, `「- 承認日:」の値を読めません（${approvalLine}）`);
    }
    const fromCurrent = mentions.get(p.id) ?? [];
    const currentValues = [...new Set(fromCurrent.map(key))];
    if (currentValues.length > 1) {
      miss(p.rel, `current の行どうしで承認の値が違います（${currentValues.join('、')}）`);
    }
    let approved = null;
    if (own) {
      if (currentValues.length > 0 && !currentValues.includes(key(own))) {
        miss(
          p.rel,
          `承認の値が proposal.md（${key(own)}）と current の行（${currentValues.join('、')}）で違います`
        );
      }
      approved = own;
    } else if (currentValues.length === 1) {
      approved = { approved: fromCurrent[0].approved, pr: fromCurrent[0].pr };
    } else if (currentValues.length === 0 && approvalLine === null) {
      miss(p.rel, '承認日と PR 番号が、proposal.md の「- 承認日:」にも current の行にもありません');
    }

    let implementation;
    let note = null;
    const implLine = headerValue(text, '実装の変更');
    if (implLine === null) {
      miss(p.rel, '「- 実装の変更:」の行がありません');
    } else {
      const m = IMPL_RE.exec(implLine);
      if (!m) miss(p.rel, `「- 実装の変更:」の値を読めません（${implLine.slice(0, 60)}）`);
      else {
        implementation = m[1] === '要' ? 'required' : 'none';
        note = m[2] ?? null;
      }
    }

    const targets = [...new Set([...fromCurrent.map((x) => x.dir), ...diffSpecDirs(p.dir)])].sort();
    if (targets.length === 0) {
      miss(
        p.rel,
        'targets が空になります（どの current の「- 承認日:」の行にもこの差分が無く、差分の specs/<dir>/ もありません）'
      );
    }

    changes.push({
      ...base,
      converted: false,
      data: { approved: approved?.approved, pr: approved?.pr, implementation, targets },
      note,
      text,
    });
  }

  // current の行にあるのに proposal.md が無い差分
  for (const [id, list] of mentions) {
    if (proposalIds.has(id)) continue;
    for (const file of [...new Set(list.map((x) => x.file))]) {
      miss(
        file,
        `「- 承認日:」の行にある差分 ${id} の proposal.md が specs/changes/ にも specs/releases/ にもありません`
      );
    }
  }

  mismatches.sort((a, b) => (a.file < b.file ? -1 : a.file > b.file ? 1 : 0));
  return { features, changes, mismatches };
}

/** `--json` の形。古い形から読んだ、機能ごとの初版の承認と、差分 ID → (承認日, PR, 機能の集合) */
export function migrationJson(plan) {
  const features = {};
  for (const f of plan.features) {
    if (f.converted) continue;
    features[f.dir] = f.data.introduced_by
      ? { introduced_by: f.data.introduced_by }
      : { approved: f.data.approved, pr: f.data.pr };
  }
  const changes = {};
  for (const c of plan.changes) {
    if (c.converted) continue;
    changes[c.id] = {
      approved: c.data.approved,
      pr: c.data.pr,
      targets: c.data.targets,
      version: c.version,
    };
  }
  return { features, changes, mismatches: plan.mismatches };
}

function removeFirst(lines, prefix) {
  const i = lines.findIndex((l) => l.startsWith(prefix));
  if (i >= 0) lines.splice(i, 1);
}

function currentText(f) {
  const lines = f.text.split('\n');
  for (const label of ['機能 ID', '種類', '承認日']) removeFirst(lines, `- ${label}:`);
  const { spec_id, kind, approved, pr, introduced_by } = f.data;
  return `${formatFrontMatter({ spec_id, kind, approved, pr, introduced_by })}${lines.join('\n')}`;
}

function proposalText(c) {
  const lines = c.text.split('\n');
  removeFirst(lines, '- 承認日:');
  const i = lines.findIndex((l) => l.startsWith('- 実装の変更:'));
  if (i >= 0) {
    if (c.note) lines[i] = `- 実装の変更の補足: ${c.note}`;
    else lines.splice(i, 1);
  }
  const { approved, pr, implementation, targets } = c.data;
  return `${formatFrontMatter({ approved, pr, implementation, targets })}${lines.join('\n')}`;
}

/**
 * 計画どおりに書き換える。食い違いが 1 件でもあれば何も書かずに例外。
 * @returns {string[]} 書き換えたファイル（相対パス、名前の順）
 */
export function writeMigration(root, plan) {
  if (plan.mismatches.length > 0) {
    throw new Error(`食い違いが ${plan.mismatches.length} 件あるので、書き換えません`);
  }
  const outputs = [
    ...plan.features.filter((f) => !f.converted).map((f) => [f, currentText(f)]),
    ...plan.changes.filter((c) => !c.converted).map((c) => [c, proposalText(c)]),
  ];
  for (const [item, text] of outputs) writeFileSync(join(root, item.file), text);
  return outputs.map(([item]) => item.file).sort();
}

function showData(data) {
  return Object.entries(data)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${k}: ${Array.isArray(v) ? `[${v.join(', ')}]` : (v ?? '（空）')}`)
    .join(', ');
}

/** 計画を人が読む行にする。stdout 用と stderr 用に分けて返す */
export function formatMigration(plan) {
  const count = (list, pred = () => true) => list.filter(pred).length;
  const conv = (x) => x.converted;
  const out = [
    `current: ${plan.features.length} files（変換済み ${count(plan.features, conv)}） / proposals: changes ${count(plan.changes, (c) => c.box === 'changes')}, releases ${count(plan.changes, (c) => c.box === 'releases')}（変換済み ${count(plan.changes, conv)}）`,
  ];
  const features = plan.features.filter((f) => !f.converted);
  if (features.length > 0) {
    out.push(
      '',
      'current の spec.md に書く front matter（「- 機能 ID:」「- 種類:」「- 承認日:」の行は消す）:'
    );
    for (const f of features) out.push(`  ${f.file}  ${showData(f.data)}`);
  }
  const changes = plan.changes.filter((c) => !c.converted);
  if (changes.length > 0) {
    out.push(
      '',
      'proposal.md に書く front matter（「- 承認日:」の行は消し、「- 実装の変更:」の括弧書きは「- 実装の変更の補足:」に移す）:'
    );
    for (const c of changes) out.push(`  ${c.file}  ${showData(c.data)}`);
  }
  const err = [];
  if (plan.mismatches.length > 0) {
    err.push('', `食い違い（${plan.mismatches.length} 件。--write は書き換えません）:`);
    for (const m of plan.mismatches) err.push(`  ${m.file}: ${m.message}`);
  } else {
    out.push('', 'OK: 食い違いはありません');
  }
  return { out, err };
}
