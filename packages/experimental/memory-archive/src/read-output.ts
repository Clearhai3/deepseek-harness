/** Renders one archive read for the model. */

import type { ArchiveRead } from './archive-source.ts'

/** Longest text the model receives from one read; the rest is cut with a notice. */
export const MAX_READ_CHARACTERS = 100_000

/**
 * @param read - resolved file or directory read.
 * @returns the file body, truncated past the soft limit, or a directory listing.
 */
export function renderArchiveRead(read: ArchiveRead): string {
  if (read.kind === 'directory') {
    const lines = [`${read.path} — ${read.entries.length} entries`]
    for (const entry of read.entries) {
      lines.push(`- ${entry.name}${entry.type === 'directory' ? '/' : ''}`)
    }
    return lines.join('\n')
  }
  if (read.text.length <= MAX_READ_CHARACTERS) return read.text
  return `${read.text.slice(0, MAX_READ_CHARACTERS)}\n\n[truncated: showing ${MAX_READ_CHARACTERS} of ${read.text.length} characters]`
}
