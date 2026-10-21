/** Archive-map loading through the harness filesystem service. */

import { join } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import { FsError } from '@deepseek-ai/dsh-fs'
import { parseArchiveIndex } from './archive-index.ts'
import type { ArchiveIndex } from './archive-index.ts'

/** Name of the map file inside the archive root. */
export const INDEX_FILENAME = 'archive.yaml'

/**
 * Read and validate the archive map.
 * @param ctx - context that provides `fs`.
 * @param root - absolute archive root.
 * @returns the validated map.
 * @throws {FsError} when the map is missing or not a regular file.
 * @throws {Error} when the map exists but is malformed.
 */
export async function loadArchiveIndex(ctx: Context, root: string): Promise<ArchiveIndex> {
  const path = join(root, INDEX_FILENAME)
  const target = await ctx.fs.resolve(path)
  const info = await ctx.fs.stat(target)
  if (info === undefined) {
    throw new FsError(`memory archive: no ${INDEX_FILENAME} under ${root}`, 'FS_NOT_FOUND')
  }
  if (info.type !== 'file') {
    throw new FsError(`memory archive: ${path} is a ${info.type}, not a file`, 'FS_NOT_REGULAR_FILE')
  }
  return parseArchiveIndex(await ctx.fs.readText(target))
}
