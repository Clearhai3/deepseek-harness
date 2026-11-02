import { MapChange } from './archive-map-diff.ts'

/**
 * 把变化渲染成给人看的文字，每行一条。
 * @param changes - 要让用户看的变化列表。
 * @returns 每行一条；空列表时为空字符串。
 */
export function renderMapChanges(changes: readonly MapChange[]): string {
  return changes.map(line).join('\n')
}

/**
 * @param change - 一条变化。
 * @returns 该行文字。
 */
function line(change: MapChange): string {
  switch (change.kind) {
    case 'added': return `+ ${change.section}`
    case 'removed': return `- ${change.section}`
    case 'changed':
      return change.field === 'trail'
        ? `~ trail: ${change.before} -> ${change.after}`
        : `~ ${change.section} · ${change.field}: ${change.before} -> ${change.after}`
    case 'reordered': return `~ order: ${change.before.join(', ')} -> ${change.after.join(', ')}`
  }
}
