/**
 * 次の仕様 ID（採番）。対象の機能について、specs/current と specs/changes の見出しにある
 * 最大番号 +1 から count 個を返す。ファイルは書き換えない。番号の予約もしない。
 */
import { basename } from 'node:path';
import { featureOfDir, formatId, parseId } from './format.mjs';
import { collectHeadings, specFiles } from './scan.mjs';

/** `specs/current/<dir>/spec.md` のパス、`specs/current/<dir>`、または `<dir>` からディレクトリ名を取る */
export function dirNameOfTarget(target) {
  const trimmed = target.replace(/[\\/]+$/, '');
  if (/(^|[\\/])spec\.md$/.test(trimmed)) return basename(trimmed.replace(/[\\/]spec\.md$/, ''));
  return basename(trimmed);
}

export function nextIds(root, config, target, count = 1) {
  const feature = featureOfDir(dirNameOfTarget(target), config.dirPrefix);
  let max = 0;
  for (const id of collectHeadings(root, specFiles(root)).keys()) {
    const p = parseId(id);
    if (p && p.domain === config.domain && p.feature === feature && p.n > max) max = p.n;
  }
  if (max + count > 999) {
    throw new Error(
      `${feature} の番号が 3 桁を超えます（最大 ${max}）。機能を分けるか、ID の形式を見直してください`
    );
  }
  return Array.from({ length: count }, (_, i) => formatId(config.domain, feature, max + 1 + i));
}
