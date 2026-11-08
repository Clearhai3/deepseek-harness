import { Context } from '@deepseek-ai/cordis'
import LocalFileSystem from '@deepseek-ai/dsh-fs-local'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { loadArchiveIndex } from '../src/archive-source.ts'
import { createInArchive } from '../src/archive-create.ts'

const MAP = `version: 2
sections:
  - name: notes
    path: notes/
    kind: append
    level: free
    warning: none
    layout: daily
  - name: memory
    path: memory/
    kind: reference
    level: free
    warning: none
  - name: about
    path: about.md
    kind: reference
    level: soft
    warning: strong
  - name: archive
    path: old/
    kind: frozen
    level: gated
    warning: none
`

const NOW = new Date(2026, 9, 22, 14, 38, 0)
const HOST = 'mriya-Redimi-Book-14'

let dir: string
let ctx: Context
let fiber: Awaited<ReturnType<Context['plugin']>>

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'dsh-create-'))
  ctx = new Context()
  fiber = await ctx.plugin(LocalFileSystem, { cwd: dir })
  await writeFile(join(dir, 'archive.yaml'), MAP, 'utf8')
})

afterEach(async () => {
  await fiber.dispose()
  await rm(dir, { recursive: true, force: true })
})

describe('createInArchive', () => {
  it('writes the text verbatim into a directory section', async () => {
    const index = await loadArchiveIndex(ctx, dir)
    const result = await createInArchive(ctx, dir, index, { section: 'memory', file: 'topic.md', text: '# 主题\n\n内容' }, NOW, HOST)
    expect(result.path).toBe('memory/topic.md')
    expect(result.lines).toBe(3)
    expect(await readFile(join(dir, 'memory/topic.md'), 'utf8')).toBe('# 主题\n\n内容')
  })

  it('refuses a page that already exists', async () => {
    const index = await loadArchiveIndex(ctx, dir)
    await createInArchive(ctx, dir, index, { section: 'memory', file: 'topic.md', text: '第一版' }, NOW, HOST)
    await expect(createInArchive(ctx, dir, index, { section: 'memory', file: 'topic.md', text: '第二版' }, NOW, HOST)).rejects.toThrow(/already exists/u)
  })

  it('refuses a log section: the first page belongs to append', async () => {
    const index = await loadArchiveIndex(ctx, dir)
    await expect(createInArchive(ctx, dir, index, { section: 'notes', text: '第一天' }, NOW, HOST)).rejects.toThrow(/archive_append/u)
  })

  it('refuses empty text', async () => {
    const index = await loadArchiveIndex(ctx, dir)
    await expect(createInArchive(ctx, dir, index, { section: 'memory', file: 'x.md', text: '' }, NOW, HOST)).rejects.toThrow(/must not be empty/u)
  })

  it('refuses a gated section', async () => {
    const index = await loadArchiveIndex(ctx, dir)
    await expect(createInArchive(ctx, dir, index, { section: 'archive', file: 'x.md', text: '正文' }, NOW, HOST)).rejects.toThrow(/gated/u)
  })

  it('leaves no trail for a free section', async () => {
    const index = await loadArchiveIndex(ctx, dir)
    const result = await createInArchive(ctx, dir, index, { section: 'memory', file: 'topic.md', text: '正文' }, NOW, HOST)
    expect(result.trail).toBeUndefined()
  })

  it('leaves a ⭐ trail for a soft section', async () => {
    const index = await loadArchiveIndex(ctx, dir)
    const result = await createInArchive(ctx, dir, index, { section: 'about', text: '# 关于我' }, NOW, HOST)
    expect(result.trail?.path).toBe('notes/2026-10/2026-10-22.md')
    const page = await readFile(join(dir, result.trail!.path), 'utf8')
    expect(page).toContain('新建了 about')
    expect(page).toContain('⭐')
  })
})
