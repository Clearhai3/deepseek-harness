import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { LocalFileSystem } from '@deepseek-ai/dsh-fs-local'
import { readClock } from '../src/archive-clock.ts'
import { initArchive } from '../src/archive-init.ts'
import { loadArchiveIndex } from '../src/archive-source.ts'
import { dailyEntryPath } from '../src/archive-index.ts'

let dir: string
let ctx: Context
let fiber: Awaited<ReturnType<Context['plugin']>>

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'dsh-init-'))
  ctx = new Context()
  fiber = await ctx.plugin(LocalFileSystem, { cwd: dir })
})

afterEach(async () => {
  await fiber.dispose()
  await rm(dir, { recursive: true, force: true })
})

const NOW = new Date(2026, 9, 22, 12, 0, 0)

describe('initArchive', () => {
  it('creates the skeleton in an empty root', async () => {
    const result = await initArchive(ctx, dir, NOW)
    expect(result.created).toEqual(['about.md', 'notes/2026-10/2026-10-22.md', 'archive.yaml'])
    expect(result.kept).toEqual([])
  })

  it('writes a map the archive reader accepts', async () => {
    await initArchive(ctx, dir, NOW)
    const index = await loadArchiveIndex(ctx, dir)
    expect(index.sections.map(s => [s.name, s.kind, s.level, s.warning, s.layout])).toEqual([
      ['about', 'reference', 'soft', 'strong', undefined],
      ['notes', 'append', 'free', 'none', 'daily'],
    ])
  })

  it('writes no trailing whitespace into any skeleton file', async () => {
    const result = await initArchive(ctx, dir, NOW)
    for (const path of result.created) {
      const text = await readFile(join(dir, path), 'utf8')
      for (const line of text.split('\n')) expect(line).toBe(line.trimEnd())
    }
  })

  it('refuses to overwrite an existing archive', async () => {
    await initArchive(ctx, dir, NOW)
    await expect(initArchive(ctx, dir, NOW)).rejects.toThrow(/already exists/u)
  })

  it('keeps a file the user already wrote', async () => {
    await writeFile(join(dir, 'about.md'), '我自己的介绍\n', 'utf8')
    const result = await initArchive(ctx, dir, NOW)
    expect(result.kept).toEqual(['about.md'])
    expect(result.created).toEqual(['notes/2026-10/2026-10-22.md', 'archive.yaml'])
    expect(await readFile(join(dir, 'about.md'), 'utf8')).toBe('我自己的介绍\n')
  })

  it('lands the first note in the month folder of the injected date', async () => {
    const date = readClock(NOW).date
    const result = await initArchive(ctx, dir, NOW)
    expect(result.created).toContain(dailyEntryPath('notes/', date))
  })

  it('lays out the day blocks in order before anything writes them', async () => {
    await initArchive(ctx, dir, NOW)
    const text = await readFile(join(dir, 'notes/2026-10/2026-10-22.md'), 'utf8')
    expect(text.indexOf('## 时间')).toBeGreaterThan(-1)
    expect(text.indexOf('## 时间')).toBeLessThan(text.indexOf('## 事件'))
  })
})
