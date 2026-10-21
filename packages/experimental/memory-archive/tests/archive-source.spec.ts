import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { LocalFileSystem } from '@deepseek-ai/dsh-fs-local'
import { loadArchiveIndex } from '../src/archive-source.ts'
import { renderArchiveList } from '../src/list-output.ts'

const VALID = `version: 1
sections:
  - name: identity
    path: .github/copilot-instructions.md
    kind: always-loaded
    description: I am who I am
  - name: journal
    path: journal/
    kind: append
`

let dir: string
let ctx: Context
let fiber: Awaited<ReturnType<Context['plugin']>>

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'dsh-archive-'))
  ctx = new Context()
  fiber = await ctx.plugin(LocalFileSystem, { cwd: dir })
})

afterEach(async () => {
  await fiber.dispose()
  await rm(dir, { recursive: true, force: true })
})

describe('loadArchiveIndex', () => {
  it('reads the map through the filesystem service', async () => {
    await writeFile(join(dir, 'archive.yaml'), VALID, 'utf8')
    const index = await loadArchiveIndex(ctx, dir)
    expect(index.sections.map(section => section.name)).toEqual(['identity', 'journal'])
  })

  it('reports a missing map as FS_NOT_FOUND', async () => {
    await expect(loadArchiveIndex(ctx, dir)).rejects.toMatchObject({ code: 'FS_NOT_FOUND' })
  })

  it('reports a map that is not a regular file', async () => {
    await mkdir(join(dir, 'archive.yaml'))
    await expect(loadArchiveIndex(ctx, dir)).rejects.toMatchObject({ code: 'FS_NOT_REGULAR_FILE' })
  })

  it('surfaces a malformed map as a plain error', async () => {
    await writeFile(join(dir, 'archive.yaml'), 'version: 2\nsections: []\n', 'utf8')
    await expect(loadArchiveIndex(ctx, dir)).rejects.toThrow(/unsupported version/u)
  })
})

describe('renderArchiveList', () => {
  it('lists every section in declaration order with its kind and path', () => {
    expect(renderArchiveList({
      version: 1,
      sections: [
        { name: 'identity', path: 'a.md', kind: 'always-loaded', description: 'who I am' },
        { name: 'journal', path: 'journal/', kind: 'append' },
      ],
    })).toBe([
      'memory archive (version 1): 2 sections',
      '- identity [always-loaded] a.md — who I am',
      '- journal [append] journal/',
    ].join('\n'))
  })
})
