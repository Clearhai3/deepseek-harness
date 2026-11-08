/** Renders the archive initialization result for the model. */

import type { ArchiveInitResult } from './archive-init.ts'

/**
 * @param result - what the skeleton creation produced.
 * @returns the root, the created and already-present paths, and — when the
 *   user's own words are still missing — the interview that fills them.
 */
export function renderArchiveInit(result: ArchiveInitResult): string {
  const lines = [`Initialized the memory archive at ${result.root}.`]
  if (result.created.length > 0) {
    lines.push('', 'Created:', ...result.created.map(path => `- ${path}`))
  }
  if (result.kept.length > 0) {
    lines.push('', 'Already existed, left untouched:', ...result.kept.map(path => `- ${path}`))
  }
  if (result.created.includes('about.md')) {
    lines.push(
      '',
      'Next: this archive is still blank until the user speaks for themselves.',
      'Ask what to call them — one question at a time, and wait for the answer.',
      'Then ask what they are working on and how they want you to work with them,',
      'and fill `about.md` with `archive_edit`. If they would rather not say,',
      'leave the slot empty instead of inventing it.',
    )
  }
  return lines.join('\n')
}
