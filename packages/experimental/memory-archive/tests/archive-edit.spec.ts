import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { LocalFileSystem } from '@deepseek-ai/dsh-fs-local'
import { applyEdit, editArchive, firstLine, lineOf } from '../src/archive-edit.ts'
import { loadArchiveIndex } from '../src/archive-source.ts'

const PAGE = `# 2026-10-25

08:00:00 [想法] · 第一段
09:30:00 [想法] · 第二段
`

describe('applyEdit', () => {
  it('replaces the only occurrence and reports where it started', () => {
    const search = '08:00:00 [想法] · 第一段'
    expect(applyEdit(PAGE, search, '08:00:00 [想法] · 改过的第一段'))
      .toBe('# 2026-10-25\n\n08:00:00 [想法] · 改过的第一段\n09:30:00 [想法] · 第二段\n')
    expect(lineOf(PAGE, PAGE.indexOf(search))).toBe(3)
  })

  it('refuses text that is absent', () => {
    expect(() => applyEdit(PAGE, '不存在的段落', 'x')).toThrow(/`old` was not found/u)
  })

  it('refuses text that appears more than once', () => {
    expect(() => applyEdit(PAGE, '[想法]', 'x')).toThrow(/`old` appears 2 times/u)
  })

  it('deletes the matched text when the replacement is empty', () => {
    expect(applyEdit(PAGE, '09:30:00 [想法] · 第二段\n', ''))
      .toBe('# 2026-10-25\n\n08:00:00 [想法] · 第一段\n')
  })

  it('refuses an empty search', () => {
    expect(() => applyEdit(PAGE, '', 'x')).toThrow(/`old` must not be empty/u)
  })

  it('replaces a multi-line block as one unit', () => {
    const search = '08:00:00 [想法] · 第一段\n09:30:00 [想法] · 第二段'
    expect(applyEdit(PAGE, search, '08:00:00 [想法] · 合并后的条')).toBe('# 2026-10-25\n\n08:00:00 [想法] · 合并后的条\n')
  })
})

describe('firstLine', () => {
  it('keeps the first line only, capped at 80 characters', () => {
    expect(firstLine('第一行\n第二行')).toBe('第一行')
    expect(firstLine('x'.repeat(100))).toHaveLength(80)
    expect(firstLine('')).toBe('')
  })
})

describe('lineOf', () => {
  it('counts lines from one', () => {
    expect(lineOf('a\nb\nc', 0)).toBe(1)
    expect(lineOf('a\nb\nc', 4)).toBe(3)
  })
})

const MAP = `version: 2
trail: notes
sections:
  - name: notes
    path: notes/
    kind: append
    level: free
    warning: none
    layout: daily
  - name: identity
    path: identity.md
    kind: always-loaded
    level: soft
    warning: strong
  - name: memory
    path: memory.md
    kind: reference
    level: free
    warning: none
  - name: archive
    path: old/
    kind: frozen
    level: gated
    warning: none
`

const NOW = new Date(2026, 9, 22, 14, 38, 0)
const HOST = 'mriya-Redmi-Book-14'
const MEMORY = '# 记忆\n\n第一条\n第二条\n'

describe('editArchive', () => {
  let dir: string
  let ctx: Context
  let fiber: Awaited<ReturnType<Context['plugin']>>

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'dsh-edit-'))
    ctx = new Context()
    fiber = await ctx.plugin(LocalFileSystem, { cwd: dir })
    await writeFile(join(dir, 'archive.yaml'), MAP, 'utf8')
    await writeFile(join(dir, 'memory.md'), MEMORY, 'utf8')
    await writeFile(join(dir, 'identity.md'), '# 人格\n\n我是小鲸鱼\n', 'utf8')
  })

  afterEach(async () => {
    await fiber.dispose()
    await rm(dir, { recursive: true, force: true })
  })

  it('edits a free section and reports the line, the old text and the new text', async () => {
    const index = await loadArchiveIndex(ctx, dir)
    const result = await editArchive(ctx, dir, index, { section: 'memory', old: '第一条\n', new: '改过的第一条\n' }, NOW, HOST)
    expect(result).toEqual({
      section: 'memory', path: 'memory.md', line: 3, before: '第一条\n', after: '改过的第一条\n', changed: true,
    })
    expect(await readFile(join(dir, 'memory.md'), 'utf8')).toBe('# 记忆\n\n改过的第一条\n第二条\n')
  })

  it('leaves the file untouched when the replacement equals the original', async () => {
    const index = await loadArchiveIndex(ctx, dir)
    const result = await editArchive(ctx, dir, index, { section: 'memory', old: '第一条\n', new: '第一条\n' }, NOW, HOST)
    expect(result.changed).toBe(false)
    expect(await readFile(join(dir, 'memory.md'), 'utf8')).toBe(MEMORY)
  })

  it('refuses a gated section', async () => {
    const index = await loadArchiveIndex(ctx, dir)
    await expect(editArchive(ctx, dir, index, { section: 'archive', old: 'x', new: 'y' }, NOW, HOST))
      .rejects.toThrow(/gated/u)
  })

  it('refuses a directory section when no file is named', async () => {
    await mkdir(join(dir, 'notes'), { recursive: true })
    const index = await loadArchiveIndex(ctx, dir)
    await expect(editArchive(ctx, dir, index, { section: 'notes', old: 'x', new: 'y' }, NOW, HOST))
      .rejects.toThrow(/pass `file`/u)
  })

  it('leave a ⭐ trail in the declared daily log after a soft edit', async () => {
    const index = await loadArchiveIndex(ctx, dir)
    const result = await editArchive(ctx, dir, index, { section: 'identity', old: '我是小鲸鱼', new: '我是会记帐的小鲸鱼' }, NOW, HOST)
    expect(result.trail).toEqual({ path: 'notes/2026-10/2026-10-22.md' })
    expect(await readFile(join(dir, 'notes/2026-10/2026-10-22.md'), 'utf8'))
      .toContain(`[⭐, 档案, edit, 主机: ${HOST}]`)
  })

  it('falls back to the only daily log when no trail is declared', async () => {
    await writeFile(join(dir, 'archive.yaml'), MAP.replace('trail: notes\n', ''), 'utf8')
    const index = await loadArchiveIndex(ctx, dir)
    expect(index.trail).toBeUndefined()
    const result = await editArchive(ctx, dir, index, { section: 'identity', old: '我是小鲸鱼', new: '我是会记帐的小鲸鱼' }, NOW, HOST)
    expect(result.trail).toEqual({ path: 'notes/2026-10/2026-10-22.md' })
  })

  it('leaves no trail when a free section is edited', async () => {
    const index = await loadArchiveIndex(ctx, dir)
    const result = await editArchive(ctx, dir, index, { section: 'memory', old: '第一条\n', new: '改过的第一条\n' }, NOW, HOST)
    expect(result.trail).toBeUndefined()
    await expect(readFile(join(dir, 'notes/2026-10/2026-10-22.md'), 'utf8')).rejects.toThrow()
  })

  it('refuses to edit a soft section when no daily log exists', async () => {
    await writeFile(join(dir, 'archive.yaml'), `version: 2
sections:
  - name: identity
    path: identity.md
    kind: always-loaded
    level: soft
    warning: strong
`, 'utf8')
    const index = await loadArchiveIndex(ctx, dir)
    await expect(editArchive(ctx, dir, index, { section: 'identity', old: '我是小鲸鱼', new: 'x' }, NOW, HOST))
      .rejects.toThrow(/must leave a trail/u)
    expect(await readFile(join(dir, 'identity.md'), 'utf8')).toBe('# 人格\n\n我是小鲸鱼\n')
  })

  it('refuses to guess when several daily logs exist', async () => {
    await writeFile(join(dir, 'archive.yaml'), `version: 2
sections:
  - name: notes
    path: notes/
    kind: append
    level: free
    warning: none
    layout: daily
  - name: diary
    path: diary/
    kind: append
    level: free
    warning: none
    layout: daily
  - name: identity
    path: identity.md
    kind: always-loaded
    level: soft
    warning: strong
`, 'utf8')
    const index = await loadArchiveIndex(ctx, dir)
    await expect(editArchive(ctx, dir, index, { section: 'identity', old: '我是小鲸鱼', new: 'x' }, NOW, HOST))
      .rejects.toThrow(/must leave a trail/u)
  })

  it('refuses when the target file does not exist', async () => {
    await writeFile(join(dir, 'archive.yaml'), `version: 2
sections:
  - name: memory
    path: gone.md
    kind: reference
    level: free
    warning: none
`, 'utf8')
    const index = await loadArchiveIndex(ctx, dir)
    await expect(editArchive(ctx, dir, index, { section: 'memory', old: 'x', new: 'y' }, NOW, HOST))
      .rejects.toThrow(/does not exist/u)
  })

  it('refuses to edit a soft section when its trail target cannot be written', async () => {
    await writeFile(join(dir, 'archive.yaml'), `version: 2
trail: locked
sections:
  - name: locked
    path: locked/
    kind: append
    level: gated
    warning: strong
    layout: daily
  - name: identity
    path: identity.md
    kind: always-loaded
    level: soft
    warning: strong
`, 'utf8')
    const index = await loadArchiveIndex(ctx, dir)
    await expect(editArchive(ctx, dir, index, { section: 'identity', old: '我是小鲸鱼', new: 'x' }, NOW, HOST))
      .rejects.toThrow(/trail target "locked" cannot be written/u)
    expect(await readFile(join(dir, 'identity.md'), 'utf8')).toBe('# 人格\n\n我是小鲸鱼\n')
  })
})
