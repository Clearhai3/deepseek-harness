/** Renders one append result for the model. */

import type { AppendResult } from './archive-append.ts'

/**
 * @param result - what the append produced.
 * @returns a receipt naming the file, whether it was created, and any trail.
 */
export function renderAppend(result: AppendResult): string {
  const lines = [`Appended to ${result.section} -> ${result.path}${result.created ? ' (created)' : ''}.`]
  if (result.retries > 0) lines.push(`Retried ${result.retries} time(s): the file changed while writing.`)
  return lines.join('\n')
}
