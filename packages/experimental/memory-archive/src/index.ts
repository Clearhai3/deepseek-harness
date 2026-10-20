/**
 * Model-facing tools over a structured personal memory archive.
 * @module @deepseek-ai/dsh-experimental-memory-archive
 */

import { isAbsolute } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'

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
 * @param _ctx - registrant context; tools are registered once their definitions land.
 * @param config - resolved archive configuration.
 */
export function apply(_ctx: Context, config: Config): void {
  if (!isAbsolute(config.root)) {
    throw new Error(`memory archive: root must be an absolute path, got ${JSON.stringify(config.root)}`)
  }
}
