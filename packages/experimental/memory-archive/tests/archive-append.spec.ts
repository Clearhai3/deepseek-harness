import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { LocalFileSystem } from '@deepseek-ai/dsh-fs-local'
import { appendToArchive, toEntry } from '../src/archive-append.ts'
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

const NOW = new Date(2026, 9, 22, 14, 38, 0)
const HOST = 'mriya-Redmi-Book-14'

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

describe('toEntry', () => {
  it('fills in empty metadata', () => {
    expect(toEntry({ section: 'notes', text: '正文' }, NOW, HOST))
      .toEqual({ at: NOW, tags: [], fields: { 主机: HOST }, text: '正文' })
  })

  it('refuses a field whose value is not a string', () => {
    expect(() => toEntry({ section: 'notes', text: '正文', fields: { 设备: 7 } }, NOW, HOST)).toThrow(/must be a string/u)
  })

  it('stamps the machine name itself', () => {
    expect(toEntry({ section: 'notes', text: '正文' }, NOW, HOST).fields).toEqual({ 主机: HOST })
  })

  it('refuses a caller-supplied machine name', () => {
    expect(() => toEntry({ section: 'notes', text: '正文', fields: { 主机: '台式机' } }, NOW, HOST))
      .toThrow(/filled by the tool/u)
  })
})

describe('appendToArchive', () => {
  it('seeds a new day and writes one record line', async () => {
    await writeFile(join(dir, 'archive.yaml'), MAP, 'utf8')
    const index = await loadArchiveIndex(ctx, dir)
    const result = await appendToArchive(ctx, dir, index, { section: 'notes', text: '起点', tags: ['上线'] }, NOW, HOST)
    expect(result.path).toBe('notes/2026-10/2026-10-22.md')
    expect(result.created).toBe(true)
    const text = await readFile(join(dir, result.path), 'utf8')
    expect(text).toBe(`# 2026-10-22 · 周四\n\n2026-10-22 14:38:00 [上线, 主机: ${HOST}] · 起点\n`)
  })

  it('writes the tags and the fields into one slot', async () => {
    await writeFile(join(dir, 'archive.yaml'), MAP, 'utf8')
    const index = await loadArchiveIndex(ctx, dir)
    const result = await appendToArchive(ctx, dir, index, {
      section: 'notes', text: '拆骨架', tags: ['⭐', '档案插件'], fields: { 设备: '台式机' },
    }, NOW, HOST)
    const text = await readFile(join(dir, result.path), 'utf8')
    expect(text).toContain(`2026-10-22 14:38:00 [⭐, 档案插件, 设备: 台式机, 主机: ${HOST}] · 拆骨架\n`)
  })

  it('keeps an existing day intact and appends below it', async () => {
    await writeFile(join(dir, 'archive.yaml'), MAP, 'utf8')
    const index = await loadArchiveIndex(ctx, dir)
    await appendToArchive(ctx, dir, index, { section: 'notes', text: '第一条' }, NOW, HOST)
    const again = await appendToArchive(ctx, dir, index, { section: 'notes', text: '第二条' }, NOW, HOST)
    expect(again.created).toBe(false)
    const text = await readFile(join(dir, again.path), 'utf8')
    expect(text.indexOf('第一条')).toBeLessThan(text.indexOf('第二条'))
    expect(text.match(/^# /gmu)).toHaveLength(1)
  })

  it('refuses a body that would split into two entries', async () => {
    await writeFile(join(dir, 'archive.yaml'), MAP, 'utf8')
    const index = await loadArchiveIndex(ctx, dir)
    await expect(appendToArchive(ctx, dir, index, { section: 'notes', text: '2026-10-22 15:00:00 [] · 假' }, NOW, HOST))
      .rejects.toThrow(/timestamp/u)
  })

  it('refuses a reference section', async () => {
    await writeFile(join(dir, 'archive.yaml'), MAP, 'utf8')
    const index = await loadArchiveIndex(ctx, dir)
    await expect(appendToArchive(ctx, dir, index, { section: 'about', text: 'x' }, NOW, HOST))
      .rejects.toThrow(/not a log/u)
  })

  it('refuses a frozen section on permission grounds', async () => {
    await writeFile(join(dir, 'archive.yaml'), MAP, 'utf8')
    const index = await loadArchiveIndex(ctx, dir)
    await expect(appendToArchive(ctx, dir, index, { section: 'archive', text: 'x' }, NOW, HOST))
      .rejects.toThrow(/gated/u)
  })
})
