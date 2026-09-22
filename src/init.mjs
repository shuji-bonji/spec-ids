/**
 * 置き場と設定を作る。既にあるファイルは上書きしない。
 *
 * 作るもの: specs/current, specs/changes, specs/releases（.gitkeep）、specs/spec-ids.json、
 *           .github/workflows/spec-gate.yml
 * 作らないもの: AGENTS.md（貼る段落を表示するだけ）、役割表、承認フロー、spec.md の雛形
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { CONFIG_PATH, DEFAULT_TESTS, normalizeConfig } from './config.mjs';

const TEMPLATES = new URL('../templates/', import.meta.url);

export function init(root, { domain, dirPrefix = '', tests = DEFAULT_TESTS }) {
  const config = normalizeConfig({ domain, dirPrefix, tests });
  const created = [];
  const skipped = [];

  for (const dir of ['specs/current', 'specs/changes', 'specs/releases']) {
    const keep = join(root, dir, '.gitkeep');
    if (existsSync(join(root, dir))) {
      skipped.push(dir);
    } else {
      mkdirSync(join(root, dir), { recursive: true });
      writeFileSync(keep, '');
      created.push(`${dir}/.gitkeep`);
    }
  }

  const configPath = join(root, CONFIG_PATH);
  if (existsSync(configPath)) {
    skipped.push(CONFIG_PATH);
  } else {
    writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);
    created.push(CONFIG_PATH);
  }

  const wf = '.github/workflows/spec-gate.yml';
  const wfPath = join(root, wf);
  if (existsSync(wfPath)) {
    skipped.push(wf);
  } else {
    mkdirSync(dirname(wfPath), { recursive: true });
    writeFileSync(wfPath, readFileSync(new URL('spec-gate.yml', TEMPLATES), 'utf8'));
    created.push(wf);
  }

  const prefixNote = config.dirPrefix
    ? `から接頭辞 \`${config.dirPrefix}\` を除いて大文字にし`
    : 'を大文字にし';
  const agentsSection = readFileSync(new URL('agents-section.md', TEMPLATES), 'utf8')
    .replaceAll('{{domain}}', config.domain)
    .replaceAll('{{prefixNote}}', prefixNote)
    .replaceAll('{{example}}', `SPEC-${config.domain}-GET-THING-001`);

  return { config, created, skipped, agentsSection };
}
