/**
 * Model-facing tools over a structured personal memory archive.
 * @module @deepseek-ai/dsh-experimental-memory-archive
 */

import { isAbsolute } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type {} from '@deepseek-ai/dsh-skill'
import { loadArchiveIndex, readArchiveTarget } from './archive-source.ts'
import { renderArchiveList } from './list-output.ts'
import { renderArchiveRead } from './read-output.ts'
import { initArchive } from './archive-init.ts'
import { appendToArchive } from './archive-append.ts'
import { renderArchiveInit } from './init-output.ts'
import { renderAppend } from './append-output.ts'
import { checkArchive } from './archive-check.ts'
import { renderCheck } from './check-output.ts'
import { now, parseBoundary, type TimeEdge } from './archive-time.ts'
import type { EntryFilter } from './archive-entry.ts'
import { readHost } from './archive-host.ts'
import { loadArchiveSkill } from './archive-skill.ts'

const TEXT_OUTPUT = {
  schema: { type: 'string' as const },
  render: (_args: unknown, value: string) => [{ type: 'text' as const, text: value }],
}

export const name = 'tool-memory-archive'
export const inject = ['tools', 'fs', 'skills']

/** Deployment-chosen archive location. */
export interface Config {
  /** Absolute path to the archive root that holds `archive.yaml`. */
  root: string
}

/** Schemastery configuration for the archive tools. */
export const Config: z<Config> = z.object({
  root: z.string().required(),
})

/**
 * @param ctx - registrant context that receives the tool registrations.
 * @param config - resolved archive configuration.
 */
export function apply(ctx: Context, config: Config): void {
  if (!isAbsolute(config.root)) {
    throw new Error(`memory archive: root must be an absolute path, got ${JSON.stringify(config.root)}`)
  }
  const root = config.root
  /** 增删工具后，同步更新 `assets/memory-archive/SKILL.md` 的 `## Tools` —— 那份清单是给模型看的目录。 */
  ctx.skills.register({ ...loadArchiveSkill(), source: 'bundled' })
  ctx.tools.register(defineTool({
    name: 'archive_list',
    description: 'List the sections declared by the memory archive map, in declaration order.',
    parameters: {},
    output: TEXT_OUTPUT,
    isConcurrencySafe: () => true,
    async execute() {
      return renderArchiveList(await loadArchiveIndex(ctx, root))
    },
  }))
  ctx.tools.register(defineTool({
    name: 'archive_read',
    description: 'Read one declared archive section, or one file inside a directory section.',
    parameters: {
      section: { type: 'string', required: true, description: 'Section name declared by archive.yaml.' },
      file: { type: 'string', description: 'Relative file inside a directory section. Omit to read the section itself.' },
    },
    output: TEXT_OUTPUT,
    isConcurrencySafe: () => true,
    async execute(args) {
      const index = await loadArchiveIndex(ctx, root)
      return renderArchiveRead(await readArchiveTarget(ctx, root, index, args.section, args.file))
    },
  }))
  ctx.tools.register(defineTool({
    name: 'archive_init',
    description: 'Create the minimal archive skeleton (archive.yaml, about.md, and the first note) in an empty archive root. Refuses when a map already exists.',
    parameters: {},
    output: TEXT_OUTPUT,
    isConcurrencySafe: () => false,
    async execute() {
      return renderArchiveInit(await initArchive(ctx, root, now()))
    },
  }))
  ctx.tools.register(defineTool({
    name: 'archive_append',
    description: 'Append one entry to a log section (`kind: append`) of the memory archive. Each entry becomes one line `<time> [tags, 键: 值] · text`, stamped with the archive zone and landed on that section\'s page for the day.',
    parameters: {
      section: { type: 'string', required: true, description: 'Log section declared by archive.yaml (kind: append).' },
      text: { type: 'string', required: true, description: 'Entry body. The first line follows `· `; later lines go below it, separated by blank lines. No line may start with a timestamp or with `# `·' },
      tags: { type: 'array', items: { type: 'string' }, description: 'Bare-word tags written inside the brackets, searchable by `check`. Put `⭐` first for an important entry.' },
      fields: { type: 'object', additionalProperties: true, description: 'Structured string fields such as { "来源": "手改" }, rendered as `键: 值` after the tags. `主机` is filled by the tool itself; do not pass it.' },
    },
    output: TEXT_OUTPUT,
    isConcurrencySafe: () => false,
    async execute(args, exec) {
      const index = await loadArchiveIndex(ctx, root)
      return renderAppend(await appendToArchive(ctx, root, index, args, now(), readHost(),exec))
    },
  }))
  ctx.tools.register(defineTool({
    name: 'archive_check',
    description: 'Find entries in the archive log sections by time range and tags. Returns file, line number, timestamp and a short summary per hit; body text is never searched. Use archive_read to read a hit in full.',
    parameters: {
      from: { type: 'string', description: 'Start of the range, inclusive: `YYYY-MM-DD` or `YYYY-MM-DD HH:MM:SS` in the archive zone.' },
      to: { type: 'string', description: 'End of the range, inclusive; same formats as `from`.' },
      tags: { type: 'array', items: { type: 'string' }, description: 'Every tag must match. Metadata only, never body text.' },
      section: { type: 'string', description: 'Restrict to one log section. Omit to search every `kind: append` section.' },
    },
    output: TEXT_OUTPUT,
    isConcurrencySafe: () => true,
    async execute(args) {
      const index = await loadArchiveIndex(ctx, root)
      const edge = (text: string, kind: TimeEdge): Date => {
        const at = parseBoundary(text, kind)
        if (at === undefined) {
          throw new Error(`memory archive: ${JSON.stringify(text)} is not a valid ${kind === 'start' ? 'range start' : 'range end'}; use \`YYYY-MM-DD\` or \`YYYY-MM-DD HH:MM:SS\``)
        }
        return at
      }
      const filter: EntryFilter = {
        ...(args.from === undefined ? {} : { from: edge(args.from, 'start') }),
        ...(args.to === undefined ? {} : { to: edge(args.to, 'end') }),
        ...(args.tags === undefined ? {} : { tags: args.tags }),
      }
      const result = await checkArchive(ctx, root, index, filter, args.section)
      return renderCheck(result)
    },
  }))
}
