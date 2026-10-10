/**
 * PR が触ってよいパスを、ブランチ名の接頭辞で決めて検査する（`spec-ids pr-scope`）。
 *
 * | ブランチ        | 種類         | 変えてよいもの |
 * |-----------------|--------------|----------------|
 * | `spec/*`        | 仕様 PR      | `specs/changes/`。proposal.md の front matter が `implementation: none` なら `specs/current/` も |
 * | `spec-init/*`   | 初版起こし   | `specs/current/<dir>/spec.md` と、テスト名に仕様 ID を足すだけの変更 |
 * | それ以外        | 実装 PR など | `specs/changes/` は `specs/releases/` への移動と、取り込み済みの差分の残りを消すことだけ |
 *
 * ブランチ名の接頭辞（`spec/`・`spec-init/`）は固定で、設定では変えられない。
 * `specs/{current,changes,releases}/.gitkeep`（`spec-ids init` が作る置き場の印）はどの種類でも検査しない。
 *
 * 承認の記録は、ファイルの先頭の front matter で見る。次のどれかが欠けていれば止める。承認日と PR 番号は人がマージの前に書く。
 * - 仕様 PR の proposal.md: `approved` と `pr`（空でないこと）
 * - どの種類でも、変わった `specs/current/<dir>/spec.md`: `approved` と `pr`（初版の承認）、
 *   または `introduced_by`（差分で作った機能）
 * front matter の書式そのもの（キーの打ち間違い、値の形、古い「- 承認日:」の行）は `spec-ids check` が見る。
 *
 * 0.3.0 まで houki-egov-mcp・houki-nta-mcp・houki-abbreviations の `.github/scripts/check-pr-scope.mjs` に
 * あったコピーを、spec-ids#9 の決定でまとめたもの。
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { readFrontMatter } from './frontmatter.mjs';
import { globToRegExp } from './scan.mjs';

/** 仕様 ID とその後ろの空白。テスト名から ID を除いて比べるのに使う */
const ID_WITH_SPACE_RE = /SPEC-[A-Z]+-[A-Z0-9-]+-[0-9]{3}\s*/g;
/** 仕様 ID。テスト名の ID を数えるのに使う */
const ID_RE = /SPEC-[A-Z]+-[A-Z0-9-]+-[0-9]{3}/g;
/** 設定 `tests` に合わなくても、テストファイルとして扱う名前（3 つのコピーと同じ） */
const TEST_FILE_RE = /\.test\.[cm]?[jt]s$/;
const CURRENT_SPEC_RE = /^specs\/current\/[^/]+\/spec\.md$/;
const PROPOSAL_RE = /^specs\/changes\/[^/]+\/proposal\.md$/;
/** `specs/changes/<id>/` の下のパス。<id> を取り出す */
const CHANGE_PATH_RE = /^specs\/changes\/([^/]+)\//;
/** `spec-ids init` が作る置き場の印。どの種類の PR で足しても消してもよい */
const PLACEHOLDER_RE = /^specs\/(current|changes|releases)\/\.gitkeep$/;

/** 比べる基準のコミットの既定値（環境変数 BASE_REF も `--base` も無いとき） */
export const DEFAULT_BASE = 'origin/main';

/** front matter の値。front matter が無いファイルは空のオブジェクト（どのキーも無い）として扱う */
function frontMatterOf(text) {
  return readFrontMatter(text)?.data ?? {};
}

/** 値が空でないか（readFrontMatter は空の値を null で返す） */
function filled(value) {
  return value !== undefined && value !== null && value !== '';
}

/** 仕様 PR の proposal.md に、承認日と PR 番号があるか */
export function proposalApproved(text) {
  const fm = frontMatterOf(text);
  return filled(fm.approved) && filled(fm.pr);
}

/** proposal.md の差分が、実装の変更を要らないとしているか（`implementation: none`） */
export function noImplementation(text) {
  return frontMatterOf(text).implementation === 'none';
}

/** current の spec.md に、初版の承認（approved と pr）か、作った差分（introduced_by）があるか */
export function currentApproved(text) {
  const fm = frontMatterOf(text);
  return (filled(fm.approved) && filled(fm.pr)) || filled(fm.introduced_by);
}

/** ブランチ名から PR の種類を決める。接頭辞は固定 */
export function kindOf(branch) {
  if (branch.startsWith('spec/')) return 'spec';
  if (branch.startsWith('spec-init/')) return 'spec-init';
  return 'impl';
}

/** `git diff --name-status -M` の出力を { status, path, from } の配列にする */
export function parseNameStatus(text) {
  return text
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [status, a, b] = line.split('\t');
      return status.startsWith('R') ? { status: 'R', from: a, path: b } : { status, path: a };
    });
}

/**
 * `git diff -U0` の 1 ファイル分から、変わった行が「テスト名に仕様 ID を足しただけ」かを見る。
 * 消えた行と足された行を順に対にし、次の 3 つを満たせば true。
 * - 両方から ID を除くと同じ行になる（ID 以外の文字は変わっていない）
 * - 消えた行にあった ID は、足された行にもすべて残っている（ID を消していない）
 * - 足された行の ID の方が多い（何か足している）
 * すでに ID の付いたテスト名に、別の ID を足す場合も通す（spec-ids#9 の決定 1）。
 */
export function onlyIdsAdded(unifiedDiff) {
  const removed = [];
  const added = [];
  for (const line of unifiedDiff.split('\n')) {
    if (line.startsWith('---') || line.startsWith('+++')) continue;
    if (line.startsWith('-')) removed.push(line.slice(1));
    else if (line.startsWith('+')) added.push(line.slice(1));
  }
  if (removed.length !== added.length) return false;
  return added.every((a, i) => {
    const r = removed[i];
    if (a.replace(ID_WITH_SPACE_RE, '') !== r.replace(ID_WITH_SPACE_RE, '')) return false;
    const before = r.match(ID_RE) ?? [];
    const after = a.match(ID_RE) ?? [];
    return before.every((id) => after.includes(id)) && after.length > before.length;
  });
}

/**
 * テストファイルかどうかを決める関数を作る。設定 `tests` の glob に合うものと、
 * `*.test.{js,ts,mjs,cjs,mts,cts}` の名前のものをテストファイルとして扱う。
 */
export function testFileMatcher(tests = []) {
  const res = tests.map(globToRegExp);
  return (p) => TEST_FILE_RE.test(p) || res.some((re) => re.test(p));
}

/**
 * 変更の一覧と、ファイルを読む関数から、違反の一覧を返す。
 * `released` は `specs/releases/<tag>/` の下にある差分の <id> の集合。実装 PR では、取り込み済み（releases にある）差分の
 * `specs/changes/<id>/` に残ったファイルを消すことを許す（マージで移動前のコピーが残ったときの片付け。spec-ids#9 の決定 3）。
 * @param {{ kind: string, changes: Array<{status: string, path: string, from?: string}>, read: (p: string) => string, diffOf: (p: string) => string, released?: Set<string>, isTestFile?: (p: string) => boolean }} input
 * @returns {string[]}
 */
export function checkScope({
  kind,
  changes,
  read,
  diffOf,
  released = new Set(),
  isTestFile = testFileMatcher(),
}) {
  const errors = [];
  const touched = (c) => [c.path, c.from].filter(Boolean);
  const scoped = changes.filter((c) => !PLACEHOLDER_RE.test(c.path));

  if (kind === 'spec') {
    const proposals = scoped.filter((c) => c.status !== 'D' && PROPOSAL_RE.test(c.path));
    const noImpl = proposals.some((c) => noImplementation(read(c.path)));
    for (const c of scoped) {
      for (const p of touched(c)) {
        if (p.startsWith('specs/changes/')) continue;
        if (noImpl && CURRENT_SPEC_RE.test(p)) continue;
        const note = CURRENT_SPEC_RE.test(p)
          ? '（specs/current/ を書けるのは、proposal.md の front matter が implementation: none のときだけ）'
          : '';
        errors.push(`仕様 PR（spec/*）は specs/changes/ だけを変えます: ${p}${note}`);
      }
    }
    if (proposals.length === 0) {
      errors.push('仕様 PR（spec/*）に specs/changes/<id>/proposal.md がありません');
    }
    for (const c of proposals) {
      if (!proposalApproved(read(c.path))) {
        errors.push(
          `承認日と PR 番号がありません（マージの前に front matter の approved と pr を書く）: ${c.path}`
        );
      }
    }
  } else if (kind === 'spec-init') {
    for (const c of scoped) {
      if (CURRENT_SPEC_RE.test(c.path) && c.status !== 'D' && c.status !== 'R') continue;
      if (isTestFile(c.path) && c.status === 'M') {
        if (!onlyIdsAdded(diffOf(c.path))) {
          errors.push(
            `初版起こし（spec-init/*）はテスト名に仕様 ID を足すだけです。それ以外の変更があります: ${c.path}`
          );
        }
        continue;
      }
      for (const p of touched(c)) {
        errors.push(
          `初版起こし（spec-init/*）は specs/current/<dir>/spec.md とテスト名だけを変えます: ${p}`
        );
      }
    }
  } else {
    for (const c of scoped) {
      if (
        c.status === 'R' &&
        c.from.startsWith('specs/changes/') &&
        c.path.startsWith('specs/releases/')
      ) {
        continue;
      }
      if (c.status === 'D' && released.has(c.path.match(CHANGE_PATH_RE)?.[1] ?? '')) {
        continue;
      }
      for (const p of touched(c)) {
        if (p.startsWith('specs/changes/')) {
          errors.push(
            `仕様 PR の外で specs/changes/ を変えています（許されるのは specs/releases/ への移動と、取り込み済みの差分の残りを消すことだけ）: ${p}`
          );
        }
      }
    }
  }

  for (const c of scoped) {
    if (c.status === 'D' || !CURRENT_SPEC_RE.test(c.path)) continue;
    if (!currentApproved(read(c.path))) {
      errors.push(
        `承認日と PR 番号がありません（マージの前に front matter の approved と pr を書く。差分で作った機能なら introduced_by）: ${c.path}`
      );
    }
  }
  return [...new Set(errors)];
}

/** `specs/releases/<tag>/<id>/` の <id> を集める */
export function releasedIds(root) {
  const dir = join(root, 'specs', 'releases');
  if (!existsSync(dir)) return new Set();
  const ids = new Set();
  for (const tag of readdirSync(dir, { withFileTypes: true })) {
    if (!tag.isDirectory()) continue;
    for (const id of readdirSync(join(dir, tag.name), { withFileTypes: true })) {
      if (id.isDirectory()) ids.add(id.name);
    }
  }
  return ids;
}

/** git の失敗（基準のコミットが無い、git のリポジトリでない）は exit 2 にする */
function gitIn(root) {
  return (args) => {
    try {
      return execFileSync('git', args, {
        cwd: root,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (err) {
      const detail = String(err.stderr ?? err.message).trim();
      const e = new Error(`git ${args.join(' ')} が失敗しました: ${detail}`);
      e.exitCode = 2;
      throw e;
    }
  };
}

/**
 * 作業ツリーの PR を検査する。
 *
 * - 比べる基準: `base`、無ければ環境変数 `BASE_REF`、無ければ `origin/main`（空の文字列は「無い」とみなす）
 * - ブランチ名: `branch`、無ければ環境変数 `HEAD_REF`、無ければ `git rev-parse --abbrev-ref HEAD`
 * - 変わったファイル: `git diff --name-status -M --relative <base>...HEAD`（root からの相対パス）
 * - ファイルの中身: 作業ツリーの root からの相対パスで読む
 *
 * @param {string} root `specs/spec-ids.json` のあるディレクトリ
 * @param {{ tests?: string[] }} config
 * @param {{ base?: string, branch?: string, env?: Record<string, string | undefined> }} [options]
 * @returns {{ base: string, branch: string, kind: string, changes: Array<{status: string, path: string, from?: string}>, errors: string[] }}
 */
export function prScope(root, config, { base, branch, env = process.env } = {}) {
  const git = gitIn(root);
  // 空の文字列は指定が無いものとして扱う（CI の式が空に展開されたとき）
  const baseRef = base || env.BASE_REF || DEFAULT_BASE;
  const headRef = branch || env.HEAD_REF || git(['rev-parse', '--abbrev-ref', 'HEAD']).trim();
  const kind = kindOf(headRef);
  const range = `${baseRef}...HEAD`;
  const changes = parseNameStatus(git(['diff', '--name-status', '-M', '--relative', range]));
  const errors = checkScope({
    kind,
    changes,
    read: (p) => readFileSync(join(root, p), 'utf8'),
    diffOf: (p) => git(['diff', '-U0', '--relative', range, '--', p]),
    released: releasedIds(root),
    isTestFile: testFileMatcher(config.tests),
  });
  return { base: baseRef, branch: headRef, kind, changes, errors };
}

/** 結果を人が読む行にする。stdout 用と stderr 用に分けて返す（`formatReport` と同じ形） */
export function formatScopeReport(result) {
  const out = [
    `branch: ${result.branch}（${result.kind}）、base: ${result.base}、変更 ${result.changes.length} ファイル`,
  ];
  const err = [];
  if (result.errors.length > 0) {
    err.push('', 'この種類の PR が変えてよい範囲の外の変更、または承認の空欄:');
    for (const e of result.errors) err.push(`  ${e}`);
  } else {
    out.push('OK: この種類の PR が変えてよい範囲に収まっています');
  }
  return { out, err };
}
