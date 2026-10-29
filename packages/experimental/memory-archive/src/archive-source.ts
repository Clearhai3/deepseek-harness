/** Archive-map loading through the harness filesystem service. */

import { join } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import { FsError } from '@deepseek-ai/dsh-fs'
import { INDEX_FILENAME, parseArchiveIndex } from './archive-index.ts'
import type { ArchiveIndex, ArchiveSection } from './archive-index.ts'

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

/** One section resolved by name. */
export function resolveSection(index: ArchiveIndex, name: string): ArchiveSection {
  const section = index.sections.find(candidate => candidate.name === name)
  if (section === undefined) {
    const known = index.sections.map(candidate => candidate.name).join(', ')
    throw new Error(`memory archive: unknown section ${JSON.stringify(name)}; known sections: ${known}`)
  }
  return section
}

/** Largest file the tool will load at all; beyond this the caller must narrow the target. */
export const MAX_READ_BYTES = 1024 * 1024

/** A file read from the archive. */
export interface ArchiveFileRead {
  readonly kind: 'file'
  readonly path: string
  readonly text: string
}

/** A section directory's direct entries. */
export interface ArchiveDirectoryRead {
  readonly kind: 'directory'
  readonly path: string
  readonly entries: readonly { readonly name: string; readonly type: 'file' | 'directory' | 'other' }[]
}

/** What one `archive_read` call resolved to. */
export type ArchiveRead = ArchiveFileRead | ArchiveDirectoryRead

/**
 * @param section - declared section path.
 * @param file - caller-supplied relative file inside it.
 * @returns the archive-relative path to read.
 * @throws when the file part leaves the archive root.
 */
export function sectionPath(section: string, file: string | undefined): string {
  if (file === undefined) return section
  if (file.length === 0) throw new Error('memory archive: file must be a non-empty string')
  if (file.startsWith('/') || file.includes('\\') || file.split('/').includes('..')) {
    throw new Error(`memory archive: file must stay inside the section, got ${JSON.stringify(file)}`)
  }
  return `${section.replace(/\/+$/u, '')}/${file}`
}

/**
 * Read one declared section, or one file inside a directory section.
 * @param ctx - context that provides `fs`.
 * @param root - absolute archive root.
 * @param index - validated map naming the sections.
 * @param name - section to read.
 * @param file - optional relative file inside a directory section.
 * @returns the file text or the directory's entries.
 * @throws {FsError} when the target is absent, too large, or not readable as text.
 */
export async function readArchiveTarget(
  ctx: Context, root: string, index: ArchiveIndex, name: string, file?: string,
): Promise<ArchiveRead> {
  const section = resolveSection(index, name)
  const relative = sectionPath(section.path, file)
  const target = await ctx.fs.resolve(join(root, relative))
  const info = await ctx.fs.stat(target)
  if (info === undefined) {
    throw new FsError(`memory archive: ${relative} does not exist`, 'FS_NOT_FOUND')
  }
  if (info.type === 'directory') {
    const entries = await ctx.fs.listDir(target)
    return {
      kind: 'directory',
      path: relative,
      entries: entries.map(entry => ({ name: entry.name, type: entry.type })),
    }
  }
  if (info.type !== 'file') {
    throw new FsError(`memory archive: ${relative} is not a regular file`, 'FS_NOT_REGULAR_FILE')
  }
  if (info.size !== undefined && info.size > MAX_READ_BYTES) {
    throw new FsError(`memory archive: ${relative} is ${info.size} bytes, above the ${MAX_READ_BYTES} limit`, 'FS_TOO_LARGE')
  }
  return { kind: 'file', path: relative, text: await ctx.fs.readText(target) }
}
