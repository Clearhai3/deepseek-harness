import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { LocalFileSystem } from '@deepseek-ai/dsh-fs-local'
import { checkArchive } from '../src/archive-check.ts'
import { loadArchiveIndex } from '../src/archive-source.ts'
import { parse } from '../src/archive-time.ts'

const MAP = `version: 2
sections:
  - name: notes
    path: notes/
    kind: append
    level: free
    warning: none
    layout: daily
  - name: log
    path: log.md
    kind: append
    level: free
    warning: none
    layout: single
  - name: about
    path: about.md
    kind: reference
    level: soft
    warning: strong
`

const DAY = `# 2026-10-26 · 周一

2026-10-26 08:00:00 [上线] · 起来了
2026-10-26 12:00:00 [⭐, 设计] · 定案
`

const LOG = `# 打卡

2026-10-25 22:00:00 [下线] · 收工
`

let dir: string
let ctx: Context
let fiber: Awaited<ReturnType<Context['plugin']>>

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'dsh-check-'))
  ctx = new Context()
  fiber = await ctx.plugin(LocalFileSystem, { cwd: dir })
  await writeFile(join(dir, 'archive.yaml'), MAP, 'utf8')
  await mkdir(join(dir, 'notes/2026-10'), { recursive: true })
  await writeFile(join(dir, 'notes/2026-10/2026-10-26.md'), DAY, 'utf8')
  await writeFile(join(dir, 'log.md'), LOG, 'utf8')
  await writeFile(join(dir, 'about.md'), '介绍\n', 'utf8')
})

afterEach(async () => {
  await fiber.dispose()
  await rm(dir, { recursive: true, force: true })
})

describe('checkArchive', () => {
  it('walks a daily directory and a single file together', async () => {
    const index = await loadArchiveIndex(ctx, dir)
    const result = await checkArchive(ctx, dir, index, { tags: ['下线'] })
    expect(result.hits.map(hit => `${hit.path}:${hit.line}`)).toEqual(['log.md:3'])
    expect(result.skipped).toEqual([])
  })

  it('returns every hit in time order, not file order', async () => {
    const index = await loadArchiveIndex(ctx, dir)
    const result = await checkArchive(ctx, dir, index, { from: new Date(0) })
    expect(result.hits.map(hit => hit.entry.at.toISOString())).toEqual([
      '2026-10-25T14:00:00.000Z',
      '2026-10-26T00:00:00.000Z',
      '2026-10-26T04:00:00.000Z',
    ])
  })

  it('filters by a time range', async () => {
    const index = await loadArchiveIndex(ctx, dir)
    const from = parse('2026-10-26 00:00:00') as Date
    const result = await checkArchive(ctx, dir, index, { from, tags: ['上线'] })
    expect(result.hits.map(hit => hit.line)).toEqual([3])
  })

  it('narrows to one section', async () => {
    const index = await loadArchiveIndex(ctx, dir)
    const result = await checkArchive(ctx, dir, index, { tags: ['⭐'] }, 'notes')
    expect(result.hits.map(hit => hit.path)).toEqual(['notes/2026-10/2026-10-26.md'])
  })

  it('refuses an empty filter', async () => {
    const index = await loadArchiveIndex(ctx, dir)
    await expect(checkArchive(ctx, dir, index, { tags: ['x'] }, 'about')).rejects.toThrow(/not a log/u)
  })

  it('treats an empty tag list as no condition', async () => {
    const index = await loadArchiveIndex(ctx, dir)
    await expect(checkArchive(ctx, dir, index, { tags: [] })).rejects.toThrow(/no default window/u)
  })
})
