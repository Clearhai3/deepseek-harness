/** 改地图的唯一入口：先算差异，再问人，批准后才落盘。 */

import { Context } from '@deepseek-ai/cordis'
import { diffIndex, MapChange } from './archive-map-diff.ts'
import { ToolRunContext } from '@deepseek-ai/dsh-tools'
import { loadArchiveIndex } from './archive-source.ts'
import { INDEX_FILENAME, parseArchiveIndex } from './archive-index.ts'
import { approveMapWrite } from './archive-map-approval'
import { renderMapChanges } from './map-change-text.ts'
import { commitText } from './archive-commit.ts'

/** 一次地图写入的结果。 */
export interface MapWriteResult {
  /** 已落盘的变化；空数组表示新旧一致，什么都没做。 */
  readonly changes: readonly MapChange[]
}

/**
 * 把一份新地图写进去：先算差异，再请人授权，批准后落盘。
 * @param ctx - 提供 `fs` 的上下文。
 * @param root - 档案根。
 * @param content - 完整的新地图文本。
 * @param reason - 模型声明的原因。
 * @param exec - 这次工具调用。
 * @returns 落盘的变化。
 * @throws 新地图不合法、审批未通过、或批准期间地图被改动时。
 */
export async function writeArchiveMap(
  ctx: Context,
  root: string,
  content: string,
  reason: string,
  exec: ToolRunContext,
): Promise<MapWriteResult> {
  const before = await loadArchiveIndex(ctx, root)
  const after = parseArchiveIndex(content)
  const changes = diffIndex(before, after)
  if (changes.length === 0) return { changes }

  await approveMapWrite({ reason, changes: renderMapChanges(changes) }, {
    approver: ctx.get('approval'),
    agent: exec.agent,
    callId: exec.callId,
    toolName: 'archive_map_write',
    signal: exec.signal,
  })

  await commitText(ctx, root, INDEX_FILENAME, (current) => {
    // 批准到落盘之间有一个时间窗：这期间地图若被改动，放弃这次写入。
    if (diffIndex(before, parseArchiveIndex(current)).length > 0) {
      throw new Error('memory archive: the map changed while it was waiting for approval; read it again and retry')
    }
    return content
  }, exec)

  return { changes }
}

/**
 * 把一次地图1写入的结果渲染成模型看到的文字。
 * @param result - 写入结果。
 * @returns 模型看到的文字。
 */
export function renderMapWrite(result: MapWriteResult): string {
  if (result.changes.length === 0) return 'No change: the new map is identical to the current one.'
  return `Map updated.\n\n${renderMapChanges(result.changes)}`
}
