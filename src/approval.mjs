/**
 * 承認の記録（front matter）の検査。`spec-ids check` の検査 5〜7。
 *
 *   5. front matter の形: `specs/current/<dir>/spec.md` と proposal.md に front matter があり、
 *      キーと値の形が決まりどおりか。知らないキー、設定の domain と違う spec_id、
 *      introduced_by の差分が無い・その差分の targets にこの機能が無い、も止める
 *   6. targets の漏れ: 差分の `specs/<dir>/spec.md` があるのに `<dir>` が targets に無い。
 *      `specs/changes/` の差分で、targets の `<dir>` が `specs/current/` にも差分の `specs/` にも無い
 *   7. 古い行の残り: 検査 5 と同じファイルに「- 承認日:」で始まる行がある
 *
 * 止めないもの: targets にあるのに差分の `specs/<dir>/` が無い（逆向き）、`specs/releases/` の差分の
 * targets が今の `specs/current/` に無い、proposal.md の「- 対象:」の文と targets の食い違い。
 */
import { readFileSync } from 'node:fs';
import { isDate, isPositiveInt, readFrontMatter } from './frontmatter.mjs';
import { currentDirs, currentSpecPath, diffSpecDirs, listProposals } from './proposals.mjs';
import { relPath } from './scan.mjs';

export const PROPOSAL_KEYS = ['approved', 'pr', 'implementation', 'targets'];
export const CURRENT_KEYS = ['spec_id', 'kind', 'approved', 'pr', 'introduced_by'];
export const IMPLEMENTATIONS = ['required', 'none'];
export const KINDS = ['tool', 'cli', 'db', 'common'];

const LEGACY_RE = /^- 承認日:/;

function show(v) {
  if (v === null) return '（空）';
  if (Array.isArray(v)) return `[${v.join(', ')}]`;
  return String(v);
}

function unknownKeys(data, allowed) {
  return Object.keys(data)
    .filter((k) => !allowed.includes(k))
    .map((k) => `知らないキー ${k} があります（使えるキー: ${allowed.join(', ')}）`);
}

/** approved・pr を検査する。required なら空も止める */
function approvalMessages(data, required, emptyNote) {
  const msgs = [];
  for (const key of ['approved', 'pr']) {
    const has = Object.hasOwn(data, key);
    const v = data[key];
    if (!has) {
      if (required) msgs.push(`${key} がありません`);
      continue;
    }
    if (v === null) {
      if (required) msgs.push(`${key} が空です（${emptyNote}）`);
      continue;
    }
    if (key === 'approved' && !isDate(v))
      msgs.push(`approved の値 ${show(v)} は実在する YYYY-MM-DD ではありません`);
    if (key === 'pr' && !isPositiveInt(v))
      msgs.push(`pr の値 ${show(v)} は正の整数ではありません（# は付けない）`);
  }
  return msgs;
}

/** proposal.md の front matter のキーと値の形 */
export function proposalMessages(data, box) {
  const msgs = unknownKeys(data, PROPOSAL_KEYS);
  if (box === 'releases') {
    msgs.push(...approvalMessages(data, true, '取り込み済みの差分には承認日と PR 番号が要ります'));
  } else {
    // 草案は approved・pr が空でよい（人がマージの前に書く）。キーは置いておく
    for (const key of ['approved', 'pr']) {
      if (!Object.hasOwn(data, key))
        msgs.push(`${key} がありません（草案では空の「${key}:」を置く）`);
    }
    msgs.push(...approvalMessages(data, false, ''));
  }
  if (!Object.hasOwn(data, 'implementation')) msgs.push('implementation がありません');
  else if (!IMPLEMENTATIONS.includes(data.implementation))
    msgs.push(
      `implementation の値 ${show(data.implementation)} は required か none にしてください`
    );
  if (!Object.hasOwn(data, 'targets')) msgs.push('targets がありません');
  else if (!Array.isArray(data.targets))
    msgs.push(`targets の値 ${show(data.targets)} は [a, b] の形の配列にしてください`);
  else if (data.targets.length === 0)
    msgs.push(
      'targets が空です（この差分が書き換える specs/current/<dir> の <dir> を 1 つ以上書く）'
    );
  return msgs;
}

/**
 * current の spec.md の front matter のキーと値の形。
 * @param proposalsById Map<差分 ID, Array<front matter の data>>（introduced_by の照合に使う）
 */
export function currentMessages(data, { domain, dir, proposalsById }) {
  const msgs = unknownKeys(data, CURRENT_KEYS);
  if (!Object.hasOwn(data, 'spec_id')) msgs.push('spec_id がありません');
  else if (data.spec_id !== domain)
    msgs.push(`spec_id の値 ${show(data.spec_id)} が設定の domain（${domain}）と違います`);
  if (Object.hasOwn(data, 'kind') && !KINDS.includes(data.kind))
    msgs.push(`kind の値 ${show(data.kind)} は ${KINDS.join('・')} のどれかにしてください`);
  const born = data.introduced_by;
  if (born !== undefined && born !== null) {
    const id = String(born);
    const found = proposalsById.get(id) ?? [];
    if (found.length === 0) {
      msgs.push(`introduced_by の差分 ${id} が specs/changes/ にも specs/releases/ にもありません`);
    } else if (!found.some((d) => Array.isArray(d.targets) && d.targets.includes(dir))) {
      msgs.push(`introduced_by の差分 ${id} の targets に ${dir} がありません`);
    }
    msgs.push(...approvalMessages(data, false, ''));
  } else {
    msgs.push(...approvalMessages(data, true, '初版の承認日と PR 番号を書く'));
  }
  return msgs;
}

/** 「- 承認日:」で始まる行の行番号（1 から） */
function legacyLinesOf(text) {
  const out = [];
  text.split(/\r?\n/).forEach((line, i) => {
    if (LEGACY_RE.test(line)) out.push(i + 1);
  });
  return out;
}

/**
 * 検査 5〜7 をまとめて行う。
 * @returns {{ counts: { changesProposals: number, releasesProposals: number }, frontMatter: Array<{ file: string, message: string }>, missingTargets: Array<{ file: string, dir: string, kind: 'unlisted' | 'unknown' }>, legacyLines: Array<{ file: string, line: number }> }}
 */
export function checkApproval(root, config) {
  const frontMatter = [];
  const missingTargets = [];
  const legacyLines = [];

  const proposals = listProposals(root).map((p) => {
    const text = readFileSync(p.file, 'utf8');
    return { ...p, text, fm: readFrontMatter(text) };
  });
  const proposalsById = new Map();
  for (const p of proposals) {
    if (!p.fm) continue;
    if (!proposalsById.has(p.id)) proposalsById.set(p.id, []);
    proposalsById.get(p.id).push(p.fm.data);
  }
  const dirs = currentDirs(root);

  // 検査 5・7（current）
  for (const dir of dirs) {
    const path = currentSpecPath(root, dir);
    const rel = relPath(root, path);
    const text = readFileSync(path, 'utf8');
    const fm = readFrontMatter(text);
    if (!fm) {
      frontMatter.push({
        file: rel,
        message: 'front matter がありません（1 行目が --- ではありません）',
      });
    } else {
      for (const message of fm.errors) frontMatter.push({ file: rel, message });
      for (const message of currentMessages(fm.data, {
        domain: config.domain,
        dir,
        proposalsById,
      })) {
        frontMatter.push({ file: rel, message });
      }
    }
    for (const line of legacyLinesOf(text)) legacyLines.push({ file: rel, line });
  }

  // 検査 5・6・7（proposal.md）
  for (const p of proposals) {
    if (!p.fm) {
      frontMatter.push({
        file: p.rel,
        message: 'front matter がありません（1 行目が --- ではありません）',
      });
    } else {
      for (const message of p.fm.errors) frontMatter.push({ file: p.rel, message });
      for (const message of proposalMessages(p.fm.data, p.box)) {
        frontMatter.push({ file: p.rel, message });
      }
      const targets = p.fm.data.targets;
      if (Array.isArray(targets)) {
        const specDirs = diffSpecDirs(p.dir);
        for (const d of specDirs) {
          if (!targets.includes(d)) missingTargets.push({ file: p.rel, dir: d, kind: 'unlisted' });
        }
        if (p.box === 'changes') {
          for (const t of targets) {
            if (!dirs.includes(t) && !specDirs.includes(t))
              missingTargets.push({ file: p.rel, dir: t, kind: 'unknown' });
          }
        }
      }
    }
    for (const line of legacyLinesOf(p.text)) legacyLines.push({ file: p.rel, line });
  }

  const byFile = (a, b) => (a.file < b.file ? -1 : a.file > b.file ? 1 : 0);
  frontMatter.sort(byFile);
  missingTargets.sort((a, b) => byFile(a, b) || a.dir.localeCompare(b.dir));
  legacyLines.sort((a, b) => byFile(a, b) || a.line - b.line);

  return {
    counts: {
      changesProposals: proposals.filter((p) => p.box === 'changes').length,
      releasesProposals: proposals.filter((p) => p.box === 'releases').length,
    },
    frontMatter,
    missingTargets,
    legacyLines,
  };
}
