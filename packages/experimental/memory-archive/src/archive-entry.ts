/** 档案正文的一条记录: 时间 + 元数据 + 正文。 */

import { parse, format } from './archive-time.ts'

/** 一条记录的第一行。标题行 (`# …`) 和空行都匹配不上。 */
const ENTRY = /^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}) \[([^\]]*)\] · (.*)$/u

/** 拆出来的一条记录。 */
export interface Entry {
  readonly at: Date
  /** 裸词标签: `[上线，归档]`。 */
  readonly tags: readonly string[]
  /** 结构化字段: `[设备: 手机]`。 */
  readonly fields: Readonly<Record<string, string>>
  /** `· ` 之后的内容，可能多行，末尾空白已去掉。 */
  readonly text: string
}

/**
 * @param line - 可能是一条记录的第一行
 * @returns 拆好的三部分；不是记录行 (或时间不合法) 时返回 undefined。
 */
export function parseEntryLine(line: string): Entry | undefined {
  const match = ENTRY.exec(line)
  if (match === null) return undefined
  const at = parse(match[1] as string)
  if (at === undefined) return undefined

  const tags: string[] = []
  const fields: Record<string, string> = {}
  for (const item of (match[2] as string).split(', ')) {
    const part = item.trim()
    if (part.length === 0) continue
    const colon = part.indexOf(': ')
    if (colon === -1) tags.push(part)
    else fields[part.slice(0, colon)] = part.slice(colon + 2)
  }
  return { at, tags, fields, text: match[3] as string }
}

/**
 * @param text - 一整篇正文 (可以是整个文件) 。
 * @returns 按行首时间戳切出来的条目，各自带着首行行号 (从 1 开始) ，顺序不变。
 */
export function splitEntriesWithLines(text: string): EntryHit[] {
  const hits: EntryHit[] = []
  let head: Entry | undefined
  let line = 0
  const body: string[] = []

  const flush = (): void => {
    if (head === undefined) return
    hits.push({ line, entry: { ...head, text: body.join('\n').trim() } })
    body.length = 0
  }

  const lines = text.split('\n')
  for (let index = 0; index < lines.length; index += 1) {
    const next = parseEntryLine(lines[index] as string)
    if (next === undefined) {
      if (head !== undefined) body.push(lines[index] as string)
      continue
    }
    flush()
    head = next
    line = index + 1
    body.push(next.text)
  }
  flush()
  return hits
}

/**
 * @param text - 一整篇正文 (可以是整个文件)。
 * @returns 按行首时间戳切出来的条目，顺序不变。
 */
export function splitEntries(text: string): Entry[] {
  return splitEntriesWithLines(text).map(hit => hit.entry)
}

/** 元数据里不许出现的字符: 会拆错括号内容，或伪造一个字段。 */
const FORBIDDEN_IN_META = /[[\],]/u

/**
 * @param tags - 裸词标签。
 * @param fields - 结构化字段。
 * @returns `[⭐, 档案插件，设备: 台式机]`；两者都空时是 `[]`。只拼不校验，读路径也要用。
 */
export function renderMeta(tags: readonly string[], fields: Readonly<Record<string, string>>): string {
  const items = [...tags, ...Object.entries(fields).map(([key, value]) => `${key}: ${value}`)]
  return items.length === 0 ? '[]' : `[${items.join(', ')}]`
}

/**
 * @param entry - 一条记录。
 * @returns 一行文本，多行正文时续行原样跟在后面，末尾无换行。
 * @throws 正文为空、正文伪造记录行或页面标题、元数据含括号或逗号时。
 */
export function renderEntry(entry: Entry): string {
  const text = entry.text.replace(/^\s*\s/u, '').trimEnd()
  if (text.trim().length === 0) throw new Error('memory archive: text must not be empty')
  for (const line of text.split('\n')) {
    if (ENTRY.test(line)) {
      throw new Error('memory archive: text may not start a line with a timestamp; it would split the entry in two')
    }
    if (line.startsWith('# ')) {
      throw new Error('memory archive: text may not contain a `# ` heading; it would forge the page title')
    }
  }
  const tags = entry.tags.map(tag => tag.trim()).filter(tag => tag.length > 0)
  const fields = Object.fromEntries(
    Object.entries(entry.fields).map(([key, value]) => [key.trim(), value.trim()]),
  )
  for (const item of [...tags, ...Object.entries(fields).map(([key, value]) => `${key}: ${value}`)]) {
    if (FORBIDDEN_IN_META.test(item)) {
      throw new Error(`memory archive: metadata item ${JSON.stringify(item)} may not contain brackets or commas`)
    }
  }
  return `${format(entry.at)} ${renderMeta(tags, fields)} · ${text}`
}

/**
 * @param text - 当前文件内容，可能为空
 * @param entry - 要加的一条记录。
 * @returns 全文: 已有内容 + 新记录。
 */
export function appendEntry(text: string, entry: Entry): string {
  const line = renderEntry(entry)
  const body = text.replace(/\s+$/u, '')
  return body.length === 0 ? `${line}\n` : `${body}\n\n${line}\n`
}

/** 一次查找的条件；缺的项不参与筛选。 */
export interface EntryFilter {
  /** 起点，含。 */
  readonly from?: Date
  /** 终点，含。 */
  readonly to?: Date
  /** 必须全部命中的标签。 */
  readonly tags?: readonly string[]
}

/** 一条命中: 它在文档里的位置，以及那条记录本身。 */
export interface EntryHit {
  /** 记录首行的行号，从 1 开始。 */
  readonly line: number
  readonly entry: Entry
}

/**
 * @param text - 一篇文档（可以是整个文件）。
 * @param filter - 时间区间与标签条件；缺的项不参与筛选。
 * @returns 命中，按行号升序。只按行首时间与元数据筛选，**不看正文**。
 */
export function findEntries(text: string, filter: EntryFilter): EntryHit[] {
  return splitEntriesWithLines(text).filter((hit) => {
    const { entry } = hit
    if (filter.from !== undefined && entry.at.getTime() < filter.from.getTime()) return false
    if (filter.to !== undefined && entry.at.getTime() > filter.to.getTime()) return false
    if (filter.tags !== undefined && !filter.tags.every(tag => entry.tags.includes(tag))) return false
    return true
  })
}
