/**
 * 置き場と設定を作る。既にあるファイルは上書きしない。
 *
 * specs レイアウト（既定）:
 *   作るもの: specs/current, specs/changes, specs/releases（.gitkeep）、specs/spec-ids.json、
 *             .github/workflows/spec-gate.yml
 * openspec レイアウト（`--layout openspec`。0.5.0）:
 *   前提: `openspec init` が作った openspec/config.yaml（または .yml）があること。無ければ何も作らず exit 2
 *   作るもの: openspec/spec-ids.json（layout: "openspec" 入り）、openspec 用の .github/workflows/spec-gate.yml
 *   作らないもの: .gitkeep（置き場は openspec init が作る）、specs/
 * どちらも作らないもの: AGENTS.md（貼る段落を表示するだけ）、役割表、承認フロー、spec.md の雛形
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { DEFAULT_TESTS, normalizeConfig } from './config.mjs';
import { LAYOUT_NAMES, layoutOf } from './layout.mjs';

const TEMPLATES = new URL('../templates/', import.meta.url);

export function init(root, { domain, dirPrefix = '', tests = DEFAULT_TESTS, layout = 'specs' }) {
  if (!LAYOUT_NAMES.includes(layout)) {
    throw Object.assign(
      new Error(`--layout は ${LAYOUT_NAMES.join(' か ')} にしてください。今の値: ${layout}`),
      { exitCode: 2 }
    );
  }
  const l = layoutOf(layout);
  const openspec = l.name === 'openspec';
  if (
    openspec &&
    !['openspec/config.yaml', 'openspec/config.yml'].some((f) => existsSync(join(root, f)))
  ) {
    throw Object.assign(
      new Error('openspec/ がありません。先に `openspec init` を実行してください'),
      {
        exitCode: 2,
      }
    );
  }
  const config = normalizeConfig({
    domain,
    dirPrefix,
    tests,
    layout: openspec ? 'openspec' : undefined,
  });
  const created = [];
  const skipped = [];

  if (!openspec) {
    for (const dir of [l.current, l.changes, l.releases]) {
      const keep = join(root, dir, '.gitkeep');
      if (existsSync(join(root, dir))) {
        skipped.push(dir);
      } else {
        mkdirSync(join(root, dir), { recursive: true });
        writeFileSync(keep, '');
        created.push(`${dir}/.gitkeep`);
      }
    }
  }

  const configPath = join(root, l.configPath);
  if (existsSync(configPath)) {
    skipped.push(l.configPath);
  } else {
    mkdirSync(dirname(configPath), { recursive: true });
    writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);
    created.push(l.configPath);
  }

  const wf = '.github/workflows/spec-gate.yml';
  const wfPath = join(root, wf);
  if (existsSync(wfPath)) {
    skipped.push(wf);
  } else {
    mkdirSync(dirname(wfPath), { recursive: true });
    const template = openspec ? 'spec-gate-openspec.yml' : 'spec-gate.yml';
    writeFileSync(wfPath, readFileSync(new URL(template, TEMPLATES), 'utf8'));
    created.push(wf);
  }

  const prefixNote = config.dirPrefix
    ? `から接頭辞 \`${config.dirPrefix}\` を除いて大文字にし`
    : 'を大文字にし';
  const sectionTemplate = openspec ? 'agents-section-openspec.md' : 'agents-section.md';
  const agentsSection = readFileSync(new URL(sectionTemplate, TEMPLATES), 'utf8')
    .replaceAll('{{domain}}', config.domain)
    .replaceAll('{{prefixNote}}', prefixNote)
    .replaceAll('{{example}}', `SPEC-${config.domain}-GET-THING-001`);

  return { config, created, skipped, agentsSection };
}
