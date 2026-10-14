/**
 * 置き場のレイアウト。0.5.0 から 2 つある（差分 20261014-openspec-layout）。どちらもパスは固定で、設定では変えられない。
 *
 * | 役割                    | specs レイアウト                 | openspec レイアウト（OpenSpec 1.14.1 の置き場）          |
 * |-------------------------|----------------------------------|----------------------------------------------------------|
 * | 設定                    | `specs/spec-ids.json`            | `openspec/spec-ids.json`                                 |
 * | 出荷済みの正（current） | `specs/current/<dir>/spec.md`    | `openspec/specs/<dir>/spec.md`                           |
 * | 差分の草案（changes）   | `specs/changes/<id>/`            | `openspec/changes/<id>/`（`archive/` を除く）            |
 * | 取り込み済み（releases）| `specs/releases/<tag>/<id>/`     | `openspec/changes/archive/<YYYY-MM-DD-id>/`              |
 *
 * レイアウトは設定ファイルの場所で決まる（SPEC-SPECIDS-CONFIG-008）。openspec レイアウトの取り込み済みの差分は
 * `<tag>` の階層を持たず、フォルダー名の先頭の `YYYY-MM-DD-` が版、残りが差分の ID（SPEC-SPECIDS-CONFIG-010）。
 */

export const LAYOUT_NAMES = ['specs', 'openspec'];

export const LAYOUTS = {
  specs: {
    name: 'specs',
    configPath: 'specs/spec-ids.json',
    current: 'specs/current',
    changes: 'specs/changes',
    releases: 'specs/releases',
    /** releases の下が `<tag>/<id>/` の 2 段か、`<フォルダー名>/` の 1 段か */
    flatReleases: false,
    /** changes の下で、差分として読まないフォルダー名 */
    changesExclude: [],
    placeholders: ['specs/current/.gitkeep', 'specs/changes/.gitkeep', 'specs/releases/.gitkeep'],
  },
  openspec: {
    name: 'openspec',
    configPath: 'openspec/spec-ids.json',
    current: 'openspec/specs',
    changes: 'openspec/changes',
    releases: 'openspec/changes/archive',
    flatReleases: true,
    changesExclude: ['archive'],
    placeholders: [
      'openspec/specs/.gitkeep',
      'openspec/changes/.gitkeep',
      'openspec/changes/archive/.gitkeep',
    ],
  },
};

/** 名前（または設定オブジェクト）からレイアウトの定義を返す。無ければ specs */
export function layoutOf(nameOrConfig) {
  const name = typeof nameOrConfig === 'string' ? nameOrConfig : (nameOrConfig?.layout ?? 'specs');
  const layout = LAYOUTS[name];
  if (!layout)
    throw new Error(`layout は ${LAYOUT_NAMES.join(' か ')} にしてください。今の値: ${name}`);
  return layout;
}

/**
 * openspec レイアウトの取り込み済みの差分のフォルダー名を、差分の ID と版に分ける（SPEC-SPECIDS-CONFIG-010）。
 * `2026-10-14-add-pages` → { id: 'add-pages', version: '2026-10-14' }。`YYYY-MM-DD-` で始まらなければ版は無い。
 */
export function parseArchiveName(name) {
  const m = /^(\d{4}-\d{2}-\d{2})-(.+)$/.exec(name);
  return m ? { id: m[2], version: m[1] } : { id: name, version: null };
}

/** `archive/` のパスか（openspec レイアウトの changes の走査で除く） */
export function isUnderReleases(layout, relPath) {
  return relPath === layout.releases || relPath.startsWith(`${layout.releases}/`);
}
