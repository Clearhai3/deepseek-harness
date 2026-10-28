/** 出厂 skill: 告诉模型什么时候该加载档案工具。 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { parse as parseYaml } from 'yaml'

/** 包内自带的 SKILL.md。打包后从 `lib/` 往上找 `assets/`。 */
const ASSET = fileURLToPath(new URL('../assets/memory-archive/SKILL.md', import.meta.url))

/** 一份可注册的 skill。 */
export interface ArchiveSkill {
  readonly name: string
  readonly description: string
  readonly content: string
}

/**
 * @param fields - frontmatter 解析结果。
 * @param key - 要取的非空字符串字段。
 * @returns 该字段的值
 * @throws 字段缺失或不是非空字符串时。
 */
function required(fields: Record<string, unknown>, key: string): string {
  const value = fields[key]
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`memory archive: SKILL.md has no ${key}`)
  }
  return value
}

/**
 * @param raw - SKILL.md 全文。
 * @returns frontmatter 的 name / description，加上去掉 frontmatter 的全文。
 * @throws frontmatter 缺失或字段不全时。
 */
export function parseSkillDocument(raw: string): ArchiveSkill {
  const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/u.exec(raw)
  if (frontmatter?.[1] === undefined) throw new Error('memory archive: SKILL.md has no YAML frontmatter')
  const metadata: unknown = parseYaml(frontmatter[1])
  if (typeof metadata !== 'object' || metadata === null) throw new Error('memory archive: SKILL.md has no YAML frontmatter')
  const fields = metadata as Record<string, unknown>
  return {
    name: required(fields, 'name'),
    description: required(fields, 'description'),
    content: raw.slice(frontmatter[0].length).trim(),
  }
}

/**
 * @returns 打包在 assets 里的那份 skill。
 */
export function loadArchiveSkill(): ArchiveSkill {
  return parseSkillDocument(readFileSync(ASSET, 'utf8'))
}
