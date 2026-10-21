/**
 * Model-facing tools over a structured personal memory archive.
 * @module @deepseek-ai/dsh-experimental-memory-archive
 */

import { isAbsolute } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { loadArchiveIndex } from './archive-source.ts'
import { renderArchiveList } from './list-output.ts'

const TEXT_OUTPUT = {
  schema: { type: 'string' as const },
  render: (_args: unknown, value: string) => [{ type: 'text' as const, text: value }],
}

export const name = 'tool-memory-archive'
export const inject = ['tools', 'fs']

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
}
