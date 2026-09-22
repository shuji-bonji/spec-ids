#!/usr/bin/env node
/**
 * spec-ids — 仕様 ID（SPEC-<領域>-<機能>-<3 桁>）の突合と採番。
 *
 *   spec-ids check                                   仕様とテストの ID を突き合わせる。不一致なら exit 1
 *   spec-ids next <spec.md のパス | ディレクトリ名> [--count N]   次の ID を表示する
 *   spec-ids init --domain NTA [--dir-prefix nta_] [--tests "src/**\/*.test.ts,tests/**\/*.test.ts"]
 *                                                    置き場と設定と CI を作る
 */
import { readFileSync } from 'node:fs';
import { check, formatReport } from '../src/check.mjs';
import { CONFIG_PATH, DEFAULT_TESTS, findRoot, loadConfig } from '../src/config.mjs';
import { init } from '../src/init.mjs';
import { nextIds } from '../src/next.mjs';

const USAGE = `使い方:
  spec-ids check
  spec-ids next <specs/current/<dir>/spec.md | <dir>> [--count N]
  spec-ids init --domain <領域> [--dir-prefix <接頭辞>] [--tests <glob,glob>]
  spec-ids --version

設定は ${CONFIG_PATH}（cwd から上へ辿って探す）。`;

function opt(args, name) {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] !== undefined ? args[i + 1] : undefined;
}
function positionals(args) {
  const out = [];
  for (let i = 0; i < args.length; i += 1) {
    if (args[i].startsWith('--')) {
      i += 1;
      continue;
    }
    out.push(args[i]);
  }
  return out;
}

function requireRoot() {
  const root = findRoot();
  if (!root) {
    console.error(
      `${CONFIG_PATH} が見つかりません。リポジトリのルートで \`spec-ids init --domain <領域>\` を実行してください`
    );
    process.exit(2);
  }
  return root;
}

function main(argv) {
  const [cmd, ...args] = argv;
  switch (cmd) {
    case 'check': {
      const root = requireRoot();
      const result = check(root, loadConfig(root));
      const { out, err } = formatReport(result);
      for (const line of out) console.log(line);
      for (const line of err) console.error(line);
      process.exit(result.ok ? 0 : 1);
      break;
    }
    case 'next': {
      const root = requireRoot();
      const [target] = positionals(args);
      const count = Number(opt(args, '--count') ?? '1');
      if (!target || !Number.isInteger(count) || count < 1) {
        console.error(USAGE);
        process.exit(2);
      }
      console.log(nextIds(root, loadConfig(root), target, count).join(' '));
      break;
    }
    case 'init': {
      const domain = opt(args, '--domain');
      if (!domain) {
        console.error(USAGE);
        process.exit(2);
      }
      const dirPrefix = opt(args, '--dir-prefix') ?? '';
      const testsOpt = opt(args, '--tests');
      const tests = testsOpt
        ? testsOpt
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        : DEFAULT_TESTS;
      const { created, skipped, agentsSection } = init(process.cwd(), { domain, dirPrefix, tests });
      for (const f of created) console.log(`作成: ${f}`);
      for (const f of skipped) console.log(`既存のため変更なし: ${f}`);
      console.log('\nAGENTS.md（または CONTRIBUTING.md）に次の節を貼ってください:\n');
      console.log(agentsSection);
      break;
    }
    case '--version':
    case '-v': {
      const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
      console.log(pkg.version);
      break;
    }
    default:
      console.log(USAGE);
      process.exit(cmd === undefined || cmd === '--help' || cmd === '-h' ? 0 : 2);
  }
}

try {
  main(process.argv.slice(2));
} catch (err) {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
}
