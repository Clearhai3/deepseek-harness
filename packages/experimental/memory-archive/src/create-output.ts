/** Renders one create result for the model. */

import { CreateResult } from './archive-create.ts'

/**
 * @param result - what the page creation produced.
 * @returns a receipt naming the file, its size, and the trail when one was written.
 */
export function renderCreate(result: CreateResult): string {
  const lines = [`Create ${result.section} -> ${result.path} (${result.lines} line${result.lines === 1 ? '' : 's'}).`]
  if (result.trail !== undefined) lines.push(`Trail: ${result.trail.path} (soft section: the creation is logged).`)
  return lines.join('\n')
}
