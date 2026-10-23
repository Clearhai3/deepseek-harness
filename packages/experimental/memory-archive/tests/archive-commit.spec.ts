import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { LocalFileSystem } from '@deepseek-ai/dsh-fs-local'
import { commitText } from '../src/archive-commit.ts'

let dir: string
let ctx: Context
let fiber: Awaited<ReturnType<Context['plugin']>>

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'dsh-commit-'))
  ctx = new Context()
  fiber = await ctx.plugin(LocalFileSystem, { cwd: dir })
})

afterEach(async () => {
  await fiber.dispose()
  await rm(dir, { recursive: true, force: true })
})

describe('commitText', () => {
  it('creates the file when it is absent', async () => {
    const result = await commitText(ctx, dir, 'notes/a.md', () => 'hello\n')
    expect(result).toEqual({ path: 'notes/a.md', created: true, retries: 0 })
    expect(await readFile(join(dir, 'notes/a.md'), 'utf8')).toBe('hello\n')
  })

  it('rewrites an existing file from its current content', async () => {
    await writeFile(join(dir, 'a.md'), 'one\n', 'utf8')
    const result = await commitText(ctx, dir, 'a.md', current => `${current}two\n`)
    expect(result.created).toBe(false)
    expect(await readFile(join(dir, 'a.md'), 'utf8')).toBe('one\ntwo\n')
  })

  it('skips the write when the transform changes nothing', async () => {
    await writeFile(join(dir, 'a.md'), 'same\n', 'utf8')
    const result = await commitText(ctx, dir, 'a.md', current => current)
    expect(result.retries).toBe(0)
    expect(await readFile(join(dir, 'a.md'), 'utf8')).toBe('same\n')
  })

  it('retries when the file moves between read and write', async () => {
    await writeFile(join(dir, 'a.md'), 'one\n', 'utf8')
    let calls = 0
    const result = await commitText(ctx, dir, 'a.md', (current) => {
      calls += 1
      if (calls === 1) writeFileSync(join(dir, 'a.md'), 'changed elsewhere\n', 'utf8')
      return `${current}${calls}\n`
    })
    expect(result.retries).toBe(1)
    expect(await readFile(join(dir, 'a.md'), 'utf8')).toBe('changed elsewhere\n2\n')
  })

  it('gives up after the attempt budget', async () => {
    await writeFile(join(dir, 'a.md'), 'one\n', 'utf8')
    let calls = 0
    await expect(commitText(ctx, dir, 'a.md', (current) => {
      calls += 1
      writeFileSync(join(dir, 'a.md'), `moved ${calls}\n`, 'utf8')
      return `${current}x\n`
    })).rejects.toThrow(/gave up/u)
  })
})
