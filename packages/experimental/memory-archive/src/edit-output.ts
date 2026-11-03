/** Renders one edit result for the model. */

import type { EditResult } from './archive-edit.ts'
import { describeChange } from './archive-edit.ts'

/**
 * @param result - what the edit produced.
 * @returns a recepit naming the file, the line, and the trail when one was written.
 */
export function renderEdit(result: EditResult): string {
  const lines = [`${result.changed ? 'Edited' : 'Unchanged'} ${result.section} -> ${result.path}:${result.line}.`]
  if (result.changed) {
    const digest = describeChange(result.before, result.after)
    lines.push(`Before: ${digest.left}`)
    lines.push(`After:  ${digest.right}`)
  }
  if (result.trail !== undefined) lines.push(`Trail: ${result.trail.path} (soft section: the edit is logged).`)
  return lines.join('\n')
}
