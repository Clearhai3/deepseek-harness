/** Whether a section may be written, and what the write owes the log. */

import type { ArchiveSection } from './archive-index.ts'

/** The verdict for one attempted write. A refusal always carries its reason. */
export type WriteDecision =
  | { readonly allowed: true; readonly needsTrail: boolean }
  | { readonly allowed: false; readonly needsTrail: false; readonly reason: string }

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
