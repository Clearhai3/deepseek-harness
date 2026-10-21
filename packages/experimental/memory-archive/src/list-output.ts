/** Renders the archive map for the model. */

import type { ArchiveIndex } from './archive-index.ts'

/**
 * @param index - validated archive map.
 * @returns one header line plus one line per section, in declaration order.
 */
export function renderArchiveList(index: ArchiveIndex): string {
  const lines = [`memory archive (version ${index.version}): ${index.sections.length} sections`]
  for (const section of index.sections) {
    const description = section.description === undefined ? '' : ` — ${section.description}`
    lines.push(`- ${section.name} [${section.kind}] ${section.path}${description}`)
  }
  return lines.join('\n')
}
