/** Appending one entry to a log section, under the permission and shape gates. */

import { HOST_FIELD } from './archive-host.ts'
import type { Context } from '@deepseek-ai/cordis'
import type { ToolRunContext } from '@deepseek-ai/dsh-tools'
import type { ArchiveIndex, ArchiveSection } from './archive-index.ts'
import { readClock } from './archive-clock.ts'
import { commitText } from './archive-commit.ts'
import { ensureDay } from './archive-day.ts'
import { appendEntry, type Entry } from './archive-entry.ts'
import { sectionTargetPath } from './archive-locate.ts'
import { decideWrite } from './archive-policy.ts'
import { resolveSection } from './archive-source.ts'

/** One entry the caller wants added. */
export interface AppendRequest {
  /** Section declared by the map. */
  readonly section: string
  /** Body of the entry; becomes the text under the heading. */
  readonly text: string
  /** Bare-word tags, searchable by `check`. */
  readonly tags?: readonly string[]
  /** Structured fields such as `设备: 台式机`; every value must be a string. */
  readonly fields?: Readonly<Record<string, unknown>>
}

/** What one append produced. */
export interface AppendResult {
  /** Section that received the entry. */
  readonly section: string
  /** Archive-relative file that was written. */
  readonly path: string
  /** Whether this append created the file. */
  readonly created: boolean
  /** Rounds lost to a conflict before the write landed. */
  readonly retries: number
}

/**
 * @param section - declared section about to receive an entry.
 * @throws when the section is not shaped like a log, or the level forbids writing.
 */
function requireAppendable(section: ArchiveSection): void {
  const decision = decideWrite(section)
  if (!decision.allowed) throw new Error(decision.reason ?? 'memory archive: write refused')
  if (section.kind !== 'append') {
    throw new Error(
      `memory archive: section ${JSON.stringify(section.name)} is ${section.kind}, not a log; `
            + 'appending an entry needs `kind: append` in the map',
    )
  }
}

/**
 * @param request - entry to add.
 * @param now - then instant the entry is stamped with.
 * @returns the record, with the absent metadata filled in.
 * @throws when a field value is not a string; the tool schema cannot say so.
 */
export function toEntry(request: AppendRequest, now: Date, host: string): Entry {
  const fields: Record<string, string> = {}
  for (const [key, value] of Object.entries(request.fields ?? {})) {
    if (typeof value !== 'string') {
      throw new Error(`memory archive: field ${JSON.stringify(key)} must be a string, got ${typeof value}`)
    }
    fields[key] = value
  }
  if (HOST_FIELD in fields) {
    throw new Error(`memory archive: field ${JSON.stringify(HOST_FIELD)} is filled by the tool itself; omit it`)
  }
  fields[HOST_FIELD] = host
  return { at: now, tags: request.tags ?? [], fields, text: request.text }
}

/**
 * Append one entry to a log section.
 * @param ctx - context that provides `fs`.
 * @param root - absolute archive root.
 * @param index - validated map.
 * @param request - entry to add.
 * @param now - clock reading; injected so tests can pin both date and time.
 * @param host - 机器名; 由调用方注入，让测试能钉住。
 * @returns what was written.
 */
export async function appendToArchive(
  ctx: Context, root: string, index: ArchiveIndex, request: AppendRequest, now: Date, host: string, exec?: ToolRunContext,
): Promise<AppendResult> {
  const section = resolveSection(index, request.section)
  requireAppendable(section)
  const entry = toEntry(request, now, host)
  const clock = readClock(now)
  const path = sectionTargetPath(section, clock.date)
  const written = await commitText(ctx, root, path, current =>
    appendEntry(ensureDay(current, clock), entry), exec)
  return { section: section.name, ...written }
}
