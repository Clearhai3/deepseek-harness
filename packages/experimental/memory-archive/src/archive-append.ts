/** Appending one entry to a log section, under the permission and shape gates. */

import type { Context } from '@deepseek-ai/cordis'
import type { ToolRunContext } from '@deepseek-ai/dsh-tools'
import type { ArchiveIndex, ArchiveSection } from './archive-index.ts'
import { readClock } from './archive-clock.ts'
import { commitText } from './archive-commit.ts'
import { ensureDay } from './archive-day.ts'
import { sectionTargetPath } from './archive-locate.ts'
import { decideWrite } from './archive-policy.ts'
import { EVENT_BLOCK, appendToBlock } from './archive-structure.ts'
import { resolveSection } from './archive-source.ts'

/** One entry the caller wants added. */
export interface AppendRequest {
  /** Section declared by the map. */
  readonly section: string
  /** Body of the entry; becomes the text under the heading. */
  readonly text: string
  /** Heading text after the time; omitted leaves just the time. */
  readonly title?: string
  /** Marks the entry with ⭐ so `grep '^### ⭐'` finds it. */
  readonly important?: boolean
  /** Block inside the section; defaults to the event block. */
  readonly block?: string
}

/** The parts of an entry that shape its stanza. */
export type StanzaInput = Omit<AppendRequest, 'section' | 'block'>

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
 * @param text - caller-supplied body.
 * @returns the body with surrounding blank lines removed.
 * @throws when the body is empty or would forge a block or an entry heading.
 */
function checkBody(text: string): string {
  const body = text.replace(/^\s*\n/u, '').trimEnd()
  if (body.trim().length === 0) throw new Error('memory archive: text must not be empty')
  for (const line of body.split('\n')) {
    if (line.startsWith('## ')) {
      throw new Error('memory archive: text may not contain a `## ` heading; it would split the file into new blocks')
    }
    if (line.startsWith('### ')) {
      throw new Error('memory archive: text may not contain a `### ` heading; pass `title` instead')
    }
  }
  return body
}

/**
 * @param entry - entry to render.
 * @param time - `HH:MM` in the archive's zone.
 * @returns the stanza text, without trailing newlines.
 */
export function renderStanza(entry: StanzaInput, time: string): string {
  const star = entry.important === true ? '⭐ ' : ''
  const title = entry.title === undefined ? '' : ` · ${entry.title}`
  return `### ${star}${time}${title}\n\n${checkBody(entry.text)}`
}

/**
 * Append one entry to a log section.
 * @param ctx - context that provides `fs`.
 * @param root - absolute archive root.
 * @param index - validated map.
 * @param request - entry to add.
 * @param now - clock reading; injected so tests can pin both date and time.
 * @returns what was written.
 */
export async function appendToArchive(
  ctx: Context, root: string, index: ArchiveIndex, request: AppendRequest, now: Date, exec?: ToolRunContext,
): Promise<AppendResult> {
  const section = resolveSection(index, request.section)
  requireAppendable(section)
  const clock = readClock(now)
  const stanza = renderStanza(request, clock.time)
  const path = sectionTargetPath(section, clock.date)
  const written = await commitText(ctx, root, path, current =>
    appendToBlock(ensureDay(current, clock), request.block ?? EVENT_BLOCK, stanza), exec)
  return { section: section.name, ...written }
}
