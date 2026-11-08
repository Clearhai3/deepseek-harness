/** Creating a declared page that is not on disk yet, under the permission matrix. */

import { Context } from '@deepseek-ai/cordis'
import { ArchiveIndex } from './archive-index.ts'
import { ToolRunContext } from '@deepseek-ai/dsh-tools'
import { containedTarget, resolveSection, sectionPath } from './archive-source.ts'
import { decideWrite } from './archive-policy.ts'
import { commitText } from './archive-commit.ts'
import { appendToArchive } from './archive-append.ts'
import { resolveTrailTarget } from './archive-edit.ts'

/** What one `archive_create` call asks for. */
export interface CreateRequest {
  /** Section declared by the map. */
  readonly section: string
  /** Relative file inside a directory section; omitted for a single-file section. */
  readonly file?: string
  /** Initial text, written verbatim. */
  readonly text: string
}

/** What one `archive_create` call produced. */
export interface CreateResult {
  readonly section: string
  readonly path: string
  /** Lines in the text that was written. */
  readonly lines: number
  /** Where the trail entry landed, for soft sections. */
  readonly trail?: { readonly path: string }
}

/**
 * Create a page the map declares but disk does not have yet.
 * @param ctx - context that provides `fs`.
 * @param root - absolute archive root.
 * @param index - validated map.
 * @param request - section, optional file, and the initial text.
 * @param now - clock reading; injected so tests can pin both date and time.
 * @param host - 机器名; 由调用方注入, 让测试能钉住。
 * @returns what was created, and where the trail went.
 * @throws when the section is a log, the level forbids writing, the page exists, or the trail cannot be written.
 */
export async function createInArchive(
  ctx: Context, root: string, index: ArchiveIndex, request: CreateRequest,
  now: Date, host: string, exec?: ToolRunContext,
): Promise<CreateResult> {
  const section = resolveSection(index, request.section)
  const decision = decideWrite(section)
  if (!decision.allowed) throw new Error(decision.reason)
  if (section.kind === 'append') {
    throw new Error(
      `memory archive: section ${JSON.stringify(section.name)} is a log; its first page is create by `
            + '`archive_append`, which also writes the entry. Use that, or edit the map first.',
    )
  }

  const trail = decision.needsTrail ? resolveTrailTarget(index, section.name) : undefined
  const relative = sectionPath(section.path, request.file)
  const target = await containedTarget(ctx, root, relative)
  const info = await ctx.fs.stat(target)
  if (info !== undefined) {
    throw new Error(`memory archive: ${relative} already exists; use \`archive_edit\` to change it`)
  }
  if (request.text.length == 0) {
    throw new Error('memory archive: `text` must not be empty; an empty page is not a page')
  }

  // 提交一律走 commitText：并发下别人恰好建了同一页时，它会把这一笔判成冲突而重试，
  // 重试后的 stat 会读到新文件、报"已存在"，而不是把别人的字盖掉。
  await commitText(ctx, root, relative, (current) => {
    if (current !== '') {
      throw new Error(`memory archive: ${relative} already exists; use \`archive_edit\` to change it`)
    }
    return request.text
  }, exec)
  const result: CreateResult = { section: section.name, path: relative, lines: countLines(request.text) }
  if (trail === undefined) return result

  const appended = await appendToArchive(ctx, root, index, {
    section: trail.name,
    text: `新建了 ${section.name} (${relative}, ${result.lines} 行): ${firstLine(request.text)}`,
    tags: ['⭐', '档案', 'create'],
  }, now, host, exec)
  return { ...result, trail: { path: appended.path } }
}

/**
 * @param text - the text about to be written.
 * @returns how many lines it occupies.
 */
function countLines(text: string): number {
  return text.split('\n').length
}

/**
 * @param text - the text about to be written.
 * @returns its first line, clipped, for the trail entry.
 */
function firstLine(text: string): string {
  const end = text.indexOf('\n')
  return (end === -1 ? text : text.slice(0, end)).slice(0, 80)
}
