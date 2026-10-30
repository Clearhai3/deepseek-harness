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

/**
 * @returns `## Tools` 小节里登记的工具名，按出现顺序；没有该小节时返回空数组。
 */
export function skillToolNames(content: string): string[] {
  const tools = content.split(/^## /mu).find(part => part.startsWith('Tools'))
  return tools === undefined ? [] : [...tools.matchAll(/^- `([a-z0-9_-]+)`/gmu)].map(match => match[1] as string)
}

/**
 * @param content - SKILL.md body without frontmatter.
 * @param registered - tool names actually registered, in order.
 * @throws when the catalog and the registration disagree: the model reads the
 *   catalog, so a tool missing from it does not exist as far as the model knows.
 */
export function assertSkillListsTools(content: string, registered: readonly string[]): void {
  const listed = skillToolNames(content)
  const missing = registered.filter(name => !listed.includes(name))
  const unknown = listed.filter(name => !registered.includes(name))
  if (missing.length === 0 && unknown.length === 0) return
  throw new Error(
    'memory archive: SKILL.md `## Tools` does not match the registered tools'
      + (missing.length === 0 ? '' : `; missing ${missing.join(', ')}`)
      + (unknown.length === 0 ? '' : `; unknown ${unknown.join(', ')}`),
  )
}
