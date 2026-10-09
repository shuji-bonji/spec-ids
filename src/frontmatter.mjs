/**
 * front matter の読み取り。YAML のパーサーは使わず（依存パッケージを持たない方針）、次の書式だけを読む。
 *
 *   - ファイルの 1 行目が `---`、次の `---` の行までが front matter
 *   - 1 行に `キー: 値` が 1 つ。キーは英小文字と `_`
 *   - 値は、空・`YYYY-MM-DD`・正の整数・英数字と `_` `-` の文字列・`[a, b, c]`（1 行の配列。
 *     要素は英数字と `_` `-`）のどれか
 *   - コメント（`#` 以降）、複数行の値、引用符は受け付けない
 *
 * これ以外の書式は errors に入れて返す。`spec-ids check` の検査 5 がそれを止める。
 */

const LINE_RE = /^([^:\s][^:]*):(.*)$/;
const KEY_RE = /^[a-z_]+$/;
const WORD_RE = /^[A-Za-z0-9_-]+$/;
const INT_RE = /^[1-9][0-9]*$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * 1 つの値を読む。読めなければ undefined。
 * 空は null、正の整数は number、配列は string[]、それ以外（日付を含む）は string。
 */
function parseValue(raw) {
  if (raw === '') return null;
  if (INT_RE.test(raw)) return Number(raw);
  if (DATE_RE.test(raw) || WORD_RE.test(raw)) return raw;
  const arr = /^\[(.*)\]$/.exec(raw);
  if (arr) {
    const inner = arr[1].trim();
    if (inner === '') return [];
    const items = inner.split(',').map((s) => s.trim());
    return items.every((s) => WORD_RE.test(s)) ? items : undefined;
  }
  return undefined;
}

/**
 * 本文から front matter を読む。
 *
 * @param {string} text ファイルの本文
 * @returns {null | { data: Record<string, null | string | number | string[]>, errors: string[], lines: number }}
 *   1 行目が `---` でなければ null。`lines` は閉じる `---` の行までの行数（閉じていなければ全行数）
 */
export function readFrontMatter(text) {
  const lines = text.split(/\r?\n/);
  if (lines[0] !== '---') return null;
  const data = {};
  const errors = [];
  for (let i = 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (line === '---') return { data, errors, lines: i + 1 };
    const n = i + 1;
    const m = LINE_RE.exec(line);
    if (!m) {
      errors.push(`${n} 行目: 「キー: 値」の形ではありません（${JSON.stringify(line)}）`);
      continue;
    }
    const key = m[1];
    const raw = m[2].trim();
    if (!KEY_RE.test(key)) {
      errors.push(`${n} 行目: キー ${JSON.stringify(key)} は英小文字と _ だけで書いてください`);
      continue;
    }
    if (Object.hasOwn(data, key)) {
      errors.push(`${n} 行目: キー ${key} が 2 回あります`);
      continue;
    }
    const value = parseValue(raw);
    if (value === undefined) {
      errors.push(
        `${n} 行目: ${key} の値 ${JSON.stringify(raw)} を読めません（空・YYYY-MM-DD・正の整数・英数字と _ - の文字列・[a, b] の配列のどれかにし、引用符とコメントは書かない）`
      );
      continue;
    }
    data[key] = value;
  }
  errors.push('front matter を閉じる --- の行がありません');
  return { data, errors, lines: lines.length };
}

/** front matter を書く。値が null なら「キー:」だけ、配列は `[a, b]`、undefined のキーは書かない */
export function formatFrontMatter(data) {
  const body = Object.entries(data)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => {
      if (v === null) return `${k}:`;
      if (Array.isArray(v)) return `${k}: [${v.join(', ')}]`;
      return `${k}: ${v}`;
    });
  return `---\n${body.join('\n')}\n---\n`;
}

/** 実在する日付の YYYY-MM-DD か */
export function isDate(v) {
  if (typeof v !== 'string' || !DATE_RE.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

/** 正の整数か */
export function isPositiveInt(v) {
  return Number.isInteger(v) && v > 0;
}
