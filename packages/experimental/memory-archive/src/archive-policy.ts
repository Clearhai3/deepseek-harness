/** Whether a section may be written, and what the write owes the log. */

import type { ArchiveSection } from './archive-index.ts'

/** The verdict for one attempted write. */
export interface WriteDecision {
  /** Whether the write may proceed. */
  readonly allowed: boolean
  /** Why it was refused, when it was. */
  readonly reason?: string
  /** Whether the write must leave a ⭐ trail in the daily log. */
  readonly needsTrail: boolean
}

/**
 * @param section - declared section about to be written.
 * @returns the verdict for the AI side of the permission matrix.
 */
export function decideWrite(section: ArchiveSection): WriteDecision {
  if (section.level === 'free') return { allowed: true, needsTrail: false }
  if (section.level === 'soft') return { allowed: true, needsTrail: true }
  return {
    allowed: false,
    needsTrail: false,
    reason: `section ${JSON.stringify(section.name)} is gated: the user must authorize this write`,
  }
}
