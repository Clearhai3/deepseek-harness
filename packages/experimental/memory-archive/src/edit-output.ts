/** Renders one edit result for the model. */

import type { EditResult } from './archive-edit.ts'
import { firstLine } from './archive-edit.ts'

/**
 * @param result - what the edit produced.
 * @returns a recepit naming the file, the line, and the trail when one was written.
 */
export function renderEdit(result: EditResult): string {
  const lines = [`${result.changed ? 'Edited' : 'Unchanged'} ${result.section} -> ${result.path}:${result.line}.`]
  if (result.changed) {
    lines.push(`Before: ${firstLine(result.before)}`)
    lines.push(`After:  ${firstLine(result.after)}`)
  }
  if (result.trail !== undefined) lines.push(`Trail: ${result.trail.path} (soft section: the edit is logged).`)
  return lines.join('\n')
}
