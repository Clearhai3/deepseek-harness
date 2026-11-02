import type { ArchiveIndex, ArchiveSection } from './archive-index.ts'

/** 整份文档级别的改动，`section` 记为 `(map)`。 */
export const MAP_SCOPE = '(map)'

/** 参与对比的字段，顺序固定 —— 输出顺序因此稳定。 */
const SECTION_FIELDS = ['path', 'kind', 'level', 'warning', 'layout', 'description'] as const

/** 缺省字段的显示文本。 */
const ABSENT = '—'

/** 地图的一条变化。`before` / `after` 都是给人看的字符串。 */
export type MapChange =
  | { readonly kind: 'added'; readonly section: string }
  | { readonly kind: 'removed'; readonly section: string }
  | { readonly kind: 'changed'; readonly section: string; readonly field: string; readonly before: string; readonly after: string }
  | { readonly kind: 'reordered'; readonly before: readonly string[]; readonly after: readonly string[] }

/**
 * 逐条对比两份地图，找出区块的增删、字段变化与顺序变化。
 * @param before - 旧地图。
 * @param after - 新地图。
 * @returns 逐条变化；无变化为空数组。
 */
export function diffIndex(before: ArchiveIndex, after: ArchiveIndex): MapChange[] {
  const changes: MapChange[] = []

  // 整份文档：trail
  if (before.trail !== after.trail) {
    changes.push({
      kind: 'changed',
      section: MAP_SCOPE,
      field: 'trail',
      before: show(before.trail),
      after: show(after.trail),
    })
  }

  // 按 name 配对，找出 removed 和 changed
  const oldByName = new Map(before.sections.map(section => [section.name, section]))
  const newByName = new Map(after.sections.map(section => [section.name, section]))

  for (const [name, section] of oldByName) {
    const next = newByName.get(name)
    if (next === undefined) {
      changes.push({ kind: 'removed', section: name })
      continue
    }
    changes.push(...diffSection(section, next))
  }

  // 新地图里多出来的 -> added
  for (const name of newByName.keys()) {
    if (!oldByName.has(name)) changes.push({ kind: 'added', section: name })
  }

  // 集合相同、只是排列不同 -> reordered
  const oldOrder = before.sections.map(section => section.name)
  const newOrder = after.sections.map(section => section.name)
  const sameSet = oldByName.size === newByName.size
      && [...oldByName.keys()].every(name => newByName.has(name))
  if (sameSet && oldOrder.some((name, at) => newOrder[at] !== name)) {
    changes.push({ kind: 'reordered', before: oldOrder, after: newOrder })
  }
  return changes
}

/**
 * @param before - 旧区块。
 * @param after - 新区块。
 * @returns 该区块的字段变化，按 `SECTION_FIELDS` 的固定顺序。
 */
function diffSection(before: ArchiveSection, after: ArchiveSection): MapChange[] {
  const changes: MapChange[] = []
  for (const field of SECTION_FIELDS) {
    const from = before[field]
    const to = after[field]
    if (from === to) continue
    changes.push({
      kind: 'changed',
      section: after.name,
      field,
      before: show(from),
      after: show(to),
    })
  }
  return changes
}

/**
 * @param value - 可能缺失的字段值。
 * @returns 给人看的文本，缺失时是 `—`。
 */
function show(value: string | undefined): string {
  return value ?? ABSENT
}
