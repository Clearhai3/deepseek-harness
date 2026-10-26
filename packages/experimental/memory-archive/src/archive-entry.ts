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
 * @param text - 一整篇正文 (可以是整个文件)。
 * @returns 按行首时间戳切出来的条目，顺序不变。
 */
export function splitEntries(text: string): Entry[] {
  const entries: Entry[] = []
  let head: Entry | undefined
  const body: string[] = []

  const flush = (): void => {
    if (head === undefined) return
    entries.push({ ...head, text: body.join('\n').trim() })
    body.length = 0
  }

  for (const line of text.split('\n')) {
    const next = parseEntryLine(line)
    if (next === undefined) {
      if (head !== undefined) body.push(line)
      continue
    }
    flush()
    head = next
    body.push(next.text)
  }
  flush()
  return entries
}

/** 元数据里不许出现的字符: 会拆错括号内容，或伪造一个字段。 */
const FORBIDDEN_IN_META = /[[\],]/u

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
  const items = [
    ...entry.tags.map(tag => tag.trim()).filter(tag => tag.length > 0),
    ...Object.entries(entry.fields).map(([key, value]) => `${key.trim()}: ${value.trim()}`),
  ]
  for (const item of items) {
    if (FORBIDDEN_IN_META.test(item)) {
      throw new Error(`memory archive: metadata item ${JSON.stringify(item)} may not contain brackets or commas`)
    }
  }
  const meta = items.length === 0 ? '[]' : `[${items.join(', ')}]`
  return `${format(entry.at)} ${meta} · ${text}`
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
