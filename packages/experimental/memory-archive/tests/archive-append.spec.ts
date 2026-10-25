import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { LocalFileSystem } from '@deepseek-ai/dsh-fs-local'
import { appendToArchive, renderStanza } from '../src/archive-append.ts'
import { loadArchiveIndex } from '../src/archive-source.ts'

const MAP = `version: 2
sections:
  - name: notes
    path: notes/
    kind: append
    level: free
    warning: none
    layout: daily
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

const NOW = new Date(2026, 9, 22, 14, 38)

let dir: string
let ctx: Context
let fiber: Awaited<ReturnType<Context['plugin']>>

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'dsh-append-'))
  ctx = new Context()
  fiber = await ctx.plugin(LocalFileSystem, { cwd: dir })
})

afterEach(async () => {
  await fiber.dispose()
  await rm(dir, { recursive: true, force: true })
})

describe('renderStanza', () => {
  it('heads the entry with the time', () => {
    expect(renderStanza({ text: '正文' }, '14:38')).toBe('### 14:38\n\n正文')
  })

  it('adds the title and the ⭐ marker', () => {
    expect(renderStanza({ text: '正文', title: '决定', important: true }, '14:38'))
      .toBe('### ⭐ 14:38 · 决定\n\n正文')
  })

  it('refuses a body that would forge a block', () => {
    expect(() => renderStanza({ text: '## 假区块' }, '14:38')).toThrow(/may not contain a `## `/u)
  })

  it('refuses an empty body', () => {
    expect(() => renderStanza({ text: '    ' }, '14:38')).toThrow(/must not be empty/u)
  })
})

describe('appendToArchive', () => {
  it('seeds a new day and writes the entry into the event block', async () => {
    await writeFile(join(dir, 'archive.yaml'), MAP, 'utf8')
    const index = await loadArchiveIndex(ctx, dir)
    const result = await appendToArchive(ctx, dir, index, { section: 'notes', text: '正文', title: '起点' }, NOW)
    expect(result.path).toBe('notes/2026-10/2026-10-22.md')
    expect(result.created).toBe(true)
    const text = await readFile(join(dir, result.path), 'utf8')
    expect(text.startsWith('# 2026-10-22 · 周四')).toBe(true)
    expect(text).toContain('## 时间')
    expect(text.indexOf('## 时间')).toBeLessThan(text.indexOf('## 事件'))
    expect(text).toContain('### 14:38 · 起点\n\n正文')
  })

  it('keeps an existing day intact and appends below it', async () => {
    await writeFile(join(dir, 'archive.yaml'), MAP, 'utf8')
    const index = await loadArchiveIndex(ctx, dir)
    await appendToArchive(ctx, dir, index, { section: 'notes', text: '第一条' }, NOW)
    const again = await appendToArchive(ctx, dir, index, { section: 'notes', text: '第二条' }, NOW)
    expect(again.created).toBe(false)
    const text = await readFile(join(dir, again.path), 'utf8')
    expect(text).toContain('第一条')
    expect(text).toContain('第二条')
    expect(text.indexOf('第一条')).toBeLessThan(text.indexOf('第二条'))
    expect(text.match(/^# /gmu)).toHaveLength(1)
  })

  it('refuses a reference section', async () => {
    await writeFile(join(dir, 'archive.yaml'), MAP, 'utf8')
    const index = await loadArchiveIndex(ctx, dir)
    await expect(appendToArchive(ctx, dir, index, { section: 'about', text: 'x' }, NOW))
      .rejects.toThrow(/not a log/u)
  })

  it('refuses a frozen section on permission grounds', async () => {
    await writeFile(join(dir, 'archive.yaml'), MAP, 'utf8')
    const index = await loadArchiveIndex(ctx, dir)
    await expect(appendToArchive(ctx, dir, index, { section: 'archive', text: 'x' }, NOW))
      .rejects.toThrow(/gated/u)
  })
})
