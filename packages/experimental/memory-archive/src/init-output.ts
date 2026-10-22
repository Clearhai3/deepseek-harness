/** Renders the archive initialization result for the model. */

import type { ArchiveInitResult } from './archive-init.ts'

/**
 * @param result - what the skeleton creation produced.
 * @returns the root plus the created and already-present paths.
 */
export function renderArchiveInit(result: ArchiveInitResult): string {
  const lines = [`Initialized the memory archive at ${result.root}.`]
  if (result.created.length > 0) {
    lines.push('', 'Created:', ...result.created.map(path => `- ${path}`))
  }
  if (result.kept.length > 0) {
    lines.push('', 'Aleady existed, left untouched:', ...result.kept.map(path => `- ${path}`))
  }
  return lines.join('\n')
}
