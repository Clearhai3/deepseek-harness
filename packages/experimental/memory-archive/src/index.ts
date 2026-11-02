/**
 * Model-facing tools over a structured personal memory archive.
 * @module @deepseek-ai/dsh-experimental-memory-archive
 */

import { isAbsolute } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { ToolDefinition } from '@deepseek-ai/dsh-tools'
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
import { assertSkillListsTools, loadArchiveSkill } from './archive-skill.ts'
import { editArchive } from './archive-edit.ts'
import { renderEdit } from './edit-output.ts'
import { renderTime } from './time-output.ts'
import { answerTime } from './archive-time-query.ts'
import { readClock } from './archive-clock.ts'
import { dueEntries } from './archive-due.ts'
import { renderDue } from './due-output.ts'
import { renderPromote } from './promote-output.ts'
import { promoteExpired } from './archive-promote.ts'
import { mapGuard } from './archive-map-guard.ts'

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
  ctx.effect(() => ctx.tools.guard(mapGuard()), 'memory-archive: map guard')
  /** `## Tools` 是给模型看的目录：漏登记的工具，模型眼里等于不存在。末尾自动对账，不靠人记。 */
  const skill = loadArchiveSkill()
  ctx.skills.register({ ...skill, source: 'bundled' })
  /** `## Tools` 是给模型看的目录：注册了什么就得登记什么。末尾对账，漏一个当场起不来。 */
  const registered: string[] = []
  const registerTool = (definition: ToolDefinition): void => {
    registered.push(definition.name)
    ctx.tools.register(definition)
  }
  registerTool(defineTool({
    name: 'archive_list',
    description: 'List the sections declared by the memory archive map, in declaration order.',
    parameters: {},
    output: TEXT_OUTPUT,
    isConcurrencySafe: () => true,
    async execute() {
      return renderArchiveList(await loadArchiveIndex(ctx, root))
    },
  }))
  registerTool(defineTool({
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
  registerTool(defineTool({
    name: 'archive_init',
    description: 'Create the minimal archive skeleton (archive.yaml, about.md, and the first note) in an empty archive root. Refuses when a map already exists.',
    parameters: {},
    output: TEXT_OUTPUT,
    isConcurrencySafe: () => false,
    async execute() {
      return renderArchiveInit(await initArchive(ctx, root, now()))
    },
  }))
  registerTool(defineTool({
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
  registerTool(defineTool({
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
  registerTool(defineTool({
    name: 'archive_edit',
    description: 'Replace one exact piece of text in a declared archive section. `old` must apper exactly once; the edit is refused otherwise. Soft sections leave a ⭐ trail in the daily log.',
    parameters: {
      section: { type: 'string', required: true, description: 'Section name declared by archive.yaml.' },
      file: { type: 'string', description: 'Relative file inside a directory section. Required when the section is a directory.' },
      old: { type: 'string', required: true, description: 'Exact text to replace, copied from archive_read, Must be unique in the file.' },
      new: { type: 'string', required: true, description: 'Replacement text. Empty string deletes the matched text.' },
    },
    output: TEXT_OUTPUT,
    isConcurrencySafe: () => false,
    async execute(args, exec) {
      const index = await loadArchiveIndex(ctx, root)
      return renderEdit(await editArchive(ctx, root, index, args, now(), readHost(), exec))
    },
  }))
  registerTool(defineTool({
    name: 'archive_due',
    description: 'List the `temp` entries whose 3/9/15/30-day level has come up, plus and entry whose `起始` is missing, unreadable, or in the future. Fresh entries are counted, never listed as due.',
    parameters: {},
    output: TEXT_OUTPUT,
    isConcurrencySafe: () => true,
    async execute() {
      const index = await loadArchiveIndex(ctx, root)
      const read = await readArchiveTarget(ctx, root, index, 'temp')
      if (read.kind !== 'file') {
        throw new Error(`memory archive: ${read.path} is a directory, but \`temp\` must be a single file`)
      }
      return renderDue(dueEntries(read.text, readClock(now()).date))
    },
  }))
  registerTool(defineTool({
    name: 'archive_promote',
    description: 'Move every `temp` entry that has lived 30 days into `longterm`, keeping its original `起始`. Writes the new entry before removing the old one: a failure leaves a duplicate, never a hole. Call archive_due first if you want to see the list before it moves.',
    parameters: {},
    output: TEXT_OUTPUT,
    isConcurrencySafe: () => false,
    async execute(_args, exec) {
      const index = await loadArchiveIndex(ctx, root)
      return renderPromote(await promoteExpired(ctx, root, index, now(), readHost(), exec))
    },
  }))
  registerTool(defineTool({
    name: 'archive_time',
    description: 'Read the archive clock and, when asked, the interval from a past moment to now (or between two moments). Never reads the archive; pass a timestamp you already read from it.',
    parameters: {
      since: { type: 'string', description: 'Past timestamp (`YYYY-MM-DD HH:MM:SS`); returns how long ago it was.' },
      from: { type: 'string', description: 'Start of a span; must be paired with `to`.' },
      to: { type: 'string', description: 'End of a span; must be paired with `from`.' },
    },
    output: TEXT_OUTPUT,
    isConcurrencySafe: () => true,
    execute(args) {
      return Promise.resolve(renderTime(answerTime(args, now())))
    },
  }))
  assertSkillListsTools(skill.content, registered)
}
