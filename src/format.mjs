/**
 * 仕様 ID の形式。設定では変えられない。形式を変えるときはこのパッケージの版を上げる。
 *
 * 形式: `SPEC-<領域>-<機能>-<3 桁>`
 *   - 領域: リポジトリを表す英大文字（設定 `domain`）
 *   - 機能: `specs/current/<dir>/spec.md` のディレクトリ名から接頭辞（設定 `dirPrefix`）を除き、
 *     大文字にして `_` を `-` にしたもの。例: nta_get_tsutatsu → GET-TSUTATSU
 *   - 3 桁: 機能ごとの通し番号。001 から。機能の中で一度使った番号は再利用しない
 *
 * 例: SPEC-NTA-GET-TSUTATSU-001
 */

/** ID の形（本文のどこにあっても拾う）。機能の部分はハイフンを含んでよく、末尾 3 桁が番号 */
export const ID_RE = /SPEC-[A-Z]+-[A-Z0-9-]+-[0-9]{3}\b/g;

/** 仕様 1 件の見出し。`### SPEC-NTA-GET-TSUTATSU-001 題` の形。採番・重複検知・機能の照合はこの見出しだけを数える */
export const HEADING_RE = /^###\s+(SPEC-[A-Z]+-[A-Z0-9-]+-[0-9]{3})\b/gm;

/** テスト名。describe( / it( / test( の第 1 引数の文字列リテラル */
export const TEST_NAME_RE = /\b(?:describe|it|test)\(\s*(['"`])((?:\\.|(?!\1).)*)\1/g;

/** 領域・機能・番号から ID を組み立てる */
export function formatId(domain, feature, n) {
  return `SPEC-${domain}-${feature}-${String(n).padStart(3, '0')}`;
}

/** ID を領域・機能・番号に分ける。形に合わなければ null */
export function parseId(id) {
  const m = /^SPEC-([A-Z]+)-([A-Z0-9-]+)-([0-9]{3})$/.exec(id);
  return m ? { domain: m[1], feature: m[2], n: Number(m[3]) } : null;
}

/** ディレクトリ名から機能を導く。例: featureOfDir('nta_get_tsutatsu', 'nta_') → 'GET-TSUTATSU' */
export function featureOfDir(dirName, dirPrefix = '') {
  const stripped =
    dirPrefix && dirName.startsWith(dirPrefix) ? dirName.slice(dirPrefix.length) : dirName;
  return stripped.toUpperCase().replaceAll('_', '-');
}

/** 領域として使える文字列か */
export function isDomain(s) {
  return /^[A-Z]+$/.test(s);
}
