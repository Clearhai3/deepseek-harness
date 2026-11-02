import { ToolGuard } from '@deepseek-ai/dsh-tools'
import { basename } from 'node:path'
import { INDEX_FILENAME } from './archive-index.ts'

/** 只读工具：看到地图是本职，闸不管。 */
const READ_ONLY_TOOLS: ReadonlySet<string> = new Set(['read', 'grep', 'glob', 'read_image'])

/** 允许碰地图的工具：只有 init，它内部只做 createIfAbsent。将来从 Config 来。 */
const MAP_WRITERS: ReadonlySet<string> = new Set(['archive_init'])

/** 判断只需要这个字段——不假装认识整个 ToolExecution，测试就不用造假对象。 */
export interface ToolCallLike {
  readonly name: string
  readonly arguments: unknown
}

/** 递归捞参数里所有字符串（含数组与嵌套对象）。 */
function argumentStrings(value: unknown, out: string[] = []): string[] {
  if (typeof value === 'string') {
    out.push(value)
  } else if (Array.isArray(value)) {
    for (const item of value) argumentStrings(item, out)
  } else if (typeof value === 'object' && value !== null) {
    for (const item of Object.values(value)) argumentStrings(item, out)
  }
  return out
}

/**
 * 判断一次工具调用是否会碰到档案地图。
 * @param call - 工具名已解析的参数。
 * @returns 拒绝说明；放行时为 undefined。
 */
export function mapCall(call: ToolCallLike): string | undefined {
  if (READ_ONLY_TOOLS.has(call.name) || MAP_WRITERS.has(call.name)) return undefined
  const hit = argumentStrings(call.arguments).find(value => basename(value) === INDEX_FILENAME)
  return hit === undefined ? undefined : refuse(hit)
}

/**
 * 拒绝的话：模型读英文（跟仓库报错语言一致），人读中文。两段必须一起改。
 * @param hit - 命中的那条路径，写进说明里让模型知道自己动了什么。
 * @returns 中英双语的拒绝说明。
 */
export function refuse(hit: string): string {
  return `${hit} is the archive map: it declares every section's path and permission level, `
    + 'so editing it is the same as granting permissions. Only the user may change it. '
    + 'Do not retry, and do not look for another way to write it — tell the user what you '
    + 'wanted to change and why, and let them edit it.'
    + '\n\n'
    + `${hit} 是档案地图：它声明每个区块的路径与权限等级，改它等于改权限。只有用户本人可以改。`
    + '不要重试，也不要换别的写法来绕——把你原本想改什么、为什么想改告诉用户，让他自己动手。'
}

/**
 * 只否认的闸：命中地图的非白名单调用会被挡下，其余原样放行。
 * @returns undefined 表示放行；字符串是拒绝理由。
 */
export function mapGuard(): ToolGuard {
  return exec => mapCall(exec)
}
