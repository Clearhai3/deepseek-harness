/** Writing a document safely: stage in memory, guard freshness, retry on conflict. */

import { join } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import type { FsErrorCode } from '@deepseek-ai/dsh-fs'

/** How many read-transform-write rounds before giving up. */
export const MAX_COMMIT_ATTEMPTS = 3

/**
 * Filesystem codes that mean "someone else changed this between your read and your write".
 * Both are worth retrying; every other error is not.
 */
const CONFLICT_CODES: readonly FsErrorCode[] = ['FS_STALE_VERSION', 'FS_NOT_OBSERVED']

/** What one commit produced. */
export interface commitResult {
  /** Archive-relative path that was written. */
  readonly path: string
  /** Whether this commit is what brought the file into existence. */
  readonly created: boolean
  /** How many rounds were lost to a conflict before the write landed. */
  readonly retries: number
}

/**
 * @param error - throw value.
 * @returns whether the write lost a race and should be retried.
 */
function isConflict(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false
  const code = (error as { code?: unknown }).code
  return typeof code === 'string' && (CONFLICT_CODES as readonly string[]).includes(code)
}

/**
 * Read a document, transform it, and write it back only if it has not moved underneath.
 * @param ctx - context that provides `fs`.
 * @param root - absolute archive root.
 * @param relative - archive-relative path to write.
 * @param mutate - pure text transform; receives the current content (`''` when absent).
 * @returns what was written and how many retries it took.
 * @throws when every attempt lost the race, or the write fails for a non-conflict reason.
 */
export async function commitText(
  ctx: Context,
  root: string,
  relative: string,
  mutate: (current: string) => string,
): Promise<commitResult> {
  const target = await ctx.fs.resolve(join(root, relative))
  for (let attempt = 0; attempt < MAX_COMMIT_ATTEMPTS; attempt += 1) {
    const info = await ctx.fs.stat(target)
    const before = info === undefined ? '' : await ctx.fs.readText(target)
    const after = mutate(before)
    if (after === before) return { path: relative, created: false, retries: attempt }
    try {
      await ctx.fs.writeText(target, after, info === undefined
        ? { kind: 'createIfAbsent' }
        : { kind: 'replaceIfVersion', version: info.version })
      return { path: relative, created: info === undefined, retries: attempt }
    } catch (error) {
      if (!isConflict(error)) throw error
    }
  }
  throw new Error(`memory archive: ${relative} changed on every attempt; gave up after ${MAX_COMMIT_ATTEMPTS}`)
}
