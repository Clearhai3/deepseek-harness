import { Context } from '@deepseek-ai/cordis'
import LocalFileSystem from '@deepseek-ai/dsh-fs-local'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { loadArchiveIndex } from '../src/archive-source.ts'
import { promoteExpired } from '../src/archive-promote.ts'

const MAP = `version: 2
trail: journal
sections:
  - name: journal
    path: journal/
    kind: append
    level: free
    warning: none
    layout: daily
  - name: temp
    path: temp.md
    kind: append
    level: soft
    warning: light
    layout: single
  - name: longterm
    path: longterm.md
    kind: append
    level: soft
    warning: strong
    layout: single
`

const NOW = new Date(2026, 10, 1, 10, 0, 0)
const HOST = 'test-host'

const THIRTY = '2026-10-02 10:00:00 [限时, 起始: 2026-10-02, 测试] · 三十天前'
const NINE = '2026-10-23 10:00:00 [限时, 起始: 2026-10-23, 测试] · 九天前'
const BROKEN = '2026-10-30 10:00:00 [限时, 测试] · 忘了写起始'

let dir: string
let ctx: Context
let fiber: Awaited<ReturnType<Context['plugin']>>

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'dsh-promote-'))
  ctx = new Context()
  fiber = await ctx.plugin(LocalFileSystem, { cwd: dir })
  await writeFile(join(dir, 'archive.yaml'), MAP, 'utf8')
  await writeFile(join(dir, 'longterm.md'), '# 长期重要记忆\n\n', 'utf8')
})

afterEach(async () => {
  await fiber.dispose()
  await rm(dir, { recursive: true, force: true })
})

/**手写 temp 正文：append 会盖今天的时间戳，而我们要的是指定日期。 */
async function seedTemp(lines: readonly string[]): Promise<void> {
  await writeFile(join(dir, 'temp.md'), `# 限时记忆\n\n${lines.join('\n')}\n`, 'utf8')
}

describe('promoteExpired', () => {
  it('moves an expired entry into longterm and out of temp', async () => {
    await seedTemp([THIRTY, NINE])
    const index = await loadArchiveIndex(ctx, dir)
    const result = await promoteExpired(ctx, dir, index, NOW, HOST)

    expect(result.promoted).toHaveLength(1)
    expect(result.skipped).toBe(1)

    const longterm = await readFile(join(dir, 'longterm.md'), 'utf8')
    expect(longterm).toContain('长期, 迁入')
    expect(longterm).toContain('起始: 2026-10-02')
    expect(longterm).toContain('三十天前')

    const temp = await readFile(join(dir, 'temp.md'), 'utf8')
    expect(temp).not.toContain('三十天前')
    expect(temp).toContain('九天前')
  })

  it('leaves a broken entry alone and reports it', async () => {
    await seedTemp([BROKEN])
    const index = await loadArchiveIndex(ctx, dir)
    const result = await promoteExpired(ctx, dir, index, NOW, HOST)

    expect(result.promoted).toHaveLength(0)
    expect(result.malformed).toBe(1)
    expect(await readFile(join(dir, 'temp.md'), 'utf8')).toContain('忘了写起始')
  })

  it('writes the new home before it removes the old one', async () => {
    await seedTemp([THIRTY, THIRTY])
    const index = await loadArchiveIndex(ctx, dir)

    await expect(promoteExpired(ctx, dir, index, NOW, HOST)).rejects.toThrow(/appears 2 times/u)

    const longterm = await readFile(join(dir, 'longterm.md'), 'utf8')
    expect(longterm).toContain('三十天前')
    expect(await readFile(join(dir, 'temp.md'), 'utf8')).toContain('三十天前')
  })

  it('moves several expired entries in one pass', async () => {
    const older = '2026-09-15 10:00:00 [限时, 起始: 2026-09-15, 测试] · 一个半月前'
    await seedTemp([THIRTY, older, NINE])
    const index = await loadArchiveIndex(ctx, dir)
    const result = await promoteExpired(ctx, dir, index, NOW, HOST)

    expect(result.promoted).toHaveLength(2)
    const longterm = await readFile(join(dir, 'longterm.md'), 'utf8')
    expect(longterm).toContain('三十天前')
    expect(longterm).toContain('一个半月前')
    const temp = await readFile(join(dir, 'temp.md'), 'utf8')
    expect(temp).not.toContain('三十天前')
    expect(temp).not.toContain('一个半月前')
  })

  it('does nothing when nothing has expired', async () => {
    await seedTemp([NINE])
    const index = await loadArchiveIndex(ctx, dir)
    const result = await promoteExpired(ctx, dir, index, NOW, HOST)
    expect(result.promoted).toHaveLength(0)
    expect(result.skipped).toBe(1)
    expect(await readFile(join(dir, 'longterm.md'), 'utf8')).toBe('# 长期重要记忆\n\n')
  })
})
