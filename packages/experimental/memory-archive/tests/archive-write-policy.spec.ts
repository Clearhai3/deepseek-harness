/**
 * The write path's per-call sandbox policy: resolved from the calling session
 * through the optional `sandboxPolicy` service, so a tool context that injects
 * only `fs` can still write inside a confining provider.
 */

import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { LocalFileSystem } from '@deepseek-ai/dsh-fs-local'
import type { FsTarget, FsWriteIntent, FsWriteOutcome } from '@deepseek-ai/dsh-fs'
import type { SandboxExecutionPolicy, SandboxMode } from '@deepseek-ai/dsh-sandbox'
import type { ToolRunContext } from '@deepseek-ai/dsh-tools'
import { commitText } from '../src/archive-commit.ts'

/** A local backend that advertises confinement, so every write carries the policy. */
class ConfiningLocalFileSystem extends LocalFileSystem {
  /** The policy each write received, in order. */
  readonly policies: (SandboxExecutionPolicy | undefined)[] = []

  override get sandboxMode(): SandboxMode {
    return 'workspace-write'
  }

  override async writeText(
    target: FsTarget,
    content: string,
    expected?: FsWriteIntent,
    signal?: AbortSignal,
    sandboxPolicy?: SandboxExecutionPolicy,
  ): Promise<FsWriteOutcome> {
    this.policies.push(sandboxPolicy)
    return super.writeText(target, content, expected, signal)
  }
}

let dir: string
let ctx: Context
let mounted: Awaited<ReturnType<Context['plugin']>>

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'dsh-write-policy-'))
  ctx = new Context()
  mounted = await ctx.plugin(ConfiningLocalFileSystem, { cwd: dir })
})

afterEach(async () => {
  await mounted.dispose()
  await rm(dir, { recursive: true, force: true })
})

/** A tool call whose session cwd is the archive workspace. */
function execForSession(id: string): ToolRunContext {
  return { agent: { session: { id, header: { cwd: dir } } } } as unknown as ToolRunContext
}

describe('commitText sandbox policy', () => {
  it('resolves the session policy through a service the tool context did not inject', async () => {
    const requests: (string | undefined)[] = []
    ctx.provide('sandboxPolicy', {
      resolve: (request: { session?: { id: string } }) => {
        requests.push(request.session?.id)
        return { mode: 'workspace-write', workspaceRoot: dir, sessionId: request.session?.id }
      },
    })
    // The plugin fiber injects `fs` only; the policy service must stay reachable.
    let scope: Context | undefined
    const child = await ctx.inject(['fs'], (inner: Context) => { scope = inner })
    try {
      const result = await commitText(scope!, dir, 'notes/a.md', () => 'hello\n', execForSession('sess-write'))
      expect(result.created).toBe(true)
      expect(requests).toEqual(['sess-write'])
      expect((ctx.fs as ConfiningLocalFileSystem).policies)
        .toEqual([{ mode: 'workspace-write', workspaceRoot: dir, sessionId: 'sess-write' }])
    } finally {
      await child.dispose()
    }
  })

  it('writes without a policy when no sandbox service is mounted', async () => {
    const result = await commitText(ctx, dir, 'notes/a.md', () => 'hello\n', execForSession('sess-plain'))
    expect(result.created).toBe(true)
    expect((ctx.fs as ConfiningLocalFileSystem).policies).toEqual([undefined])
  })
})
