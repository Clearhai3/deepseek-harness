import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { LocalFileSystem } from '@deepseek-ai/dsh-fs-local'
import { loadArchiveIndex, MAX_READ_BYTES, readArchiveTarget } from '../src/archive-source.ts'
import { MAX_READ_CHARACTERS, renderArchiveRead } from '../src/read-output.ts'

const INDEX = `version: 2
sections:
  - name: identity
    path: identity.md
    kind: always-loaded
    level: soft
    warning: strong
  - name: journal
    path: journal/
    kind: append
    level: free
    warning: none
    layout: daily
`

let dir: string
let ctx: Context
let fiber: Awaited<ReturnType<Context['plugin']>>

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'dsh-archive-'))
  ctx = new Context()
  fiber = await ctx.plugin(LocalFileSystem, { cwd: dir })
  await writeFile(join(dir, 'archive.yaml'), INDEX, 'utf8')
  await writeFile(join(dir, 'identity.md'), 'I am who I am\n', 'utf8')
  await mkdir(join(dir, 'journal'))
  await writeFile(join(dir, 'journal', '2026-10.md'), 'october\n', 'utf8')
})

afterEach(async () => {
  await fiber.dispose()
  await rm(dir, { recursive: true, force: true })
})

async function archived() {
  return loadArchiveIndex(ctx, dir)
}

describe('readArchiveTarget', () => {
  it('reads a file section', async () => {
    expect(await readArchiveTarget(ctx, dir, await archived(), 'identity'))
      .toEqual({ kind: 'file', path: 'identity.md', text: 'I am who I am\n' })
  })

  it('reads one file inside a directory section', async () => {
    expect(await readArchiveTarget(ctx, dir, await archived(), 'journal', '2026-10.md'))
      .toEqual({ kind: 'file', path: 'journal/2026-10.md', text: 'october\n' })
  })

  it('lists the entries of a directory section without assuming their order', async () => {
    const read = await readArchiveTarget(ctx, dir, await archived(), 'journal')
    expect(read.kind).toBe('directory')
    if (read.kind !== 'directory') return
    expect(read.entries.map(entry => entry.name)).toContain('2026-10.md')
  })

  it('names the known sections when the requetsed one is unknown', async () => {
    await expect(readArchiveTarget(ctx, dir, await archived(), 'nope'))
      .rejects.toThrow(/unknown section.*identity, journal/u)
  })

  it('refuses a file part that leaves the section', async () => {
    for (const file of ['../identity.md', 'a/../../identity.md', '/etc/passwd', 'a\\b']) {
      await expect(readArchiveTarget(ctx, dir, await archived(), 'journal', file))
        .rejects.toThrow(/must stay inside/u)
    }
  })

  it('reports a missing file as FS_NOT_FOUND', async () => {
    await expect(readArchiveTarget(ctx, dir, await archived(), 'journal', 'missing.md'))
      .rejects.toMatchObject({ code: 'FS_NOT_FOUND' })
  })

  it('refuses a file above the hard limit without reading it', async () => {
    await writeFile(join(dir, 'journal', 'huge.md'), 'x'.repeat(MAX_READ_BYTES + 1), 'utf8')
    await expect(readArchiveTarget(ctx, dir, await archived(), 'journal', 'huge.md'))
      .rejects.toMatchObject({ code: 'FS_TOO_LARGE' })
  })
})

describe('renderArchiveRead', () => {
  it('returns the body unchanged below the soft limit', () => {
    expect(renderArchiveRead({ kind: 'file', path: 'a.md', text: 'hello' })).toBe('hello')
  })

  it('truncates past the soft limit and reports both lengths', () => {
    const text = 'x'.repeat(MAX_READ_CHARACTERS + 10)
    const rendered = renderArchiveRead({ kind: 'file', path: 'a.md', text })
    expect(rendered).toBe(
      `${text.slice(0, MAX_READ_CHARACTERS)}\n\n[truncated: showing ${MAX_READ_CHARACTERS} of ${text.length} characters]`,
    )
  })

  it('renders a directory listing with a trailing slash on subdirectories', () => {
    expect(renderArchiveRead({
      kind: 'directory',
      path: 'journal/',
      entries: [{ name: '2026-10.md', type: 'file' }, { name: 'nested', type: 'directory' }],
    })).toBe(['journal/ — 2 entries', '- 2026-10.md', '- nested/'].join('\n'))
  })
})
