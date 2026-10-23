/** Resolving which file a section's write belongs in. */

import { dailyEntryPath } from './archive-index.ts'
import type { ArchiveSection } from './archive-index.ts'

/**
 * @param section - declared section about to be written.
 * @param date - local calendar date, `YYYY-MM-DD`.
 * @returns the archive-relative path that receives the write.
 */
export function sectionTargetPath(section: ArchiveSection, date: string): string {
  if (section.kind !== 'append') return section.path
  return section.layout === 'daily' ? dailyEntryPath(section.path, date) : section.path
}
