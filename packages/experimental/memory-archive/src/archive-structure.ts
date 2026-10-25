/** Reading and rewriting the `##` blocks of a markdown document. */

/** Heading of the block that receives timestamped list items. */
export const TIME_BLOCK = '时间'

/** Heading of the block that receives event stanzas. */
export const EVENT_BLOCK = '事件'

/** One `##` block, located by line index. */
export interface Block {
  /** Heading text without the `##` prefix. */
  readonly title: string
  /** Index of the heading line. */
  readonly start: number
  /** Index one past the block's last time. */
  readonly end: number
}

/**
 * @param text - who markdown document.
 * @param title - heading text to find, without the `##` prefix.
 * @returns the first matching block, or undefined when the document has none.
 */
export function findBlock(text: string, title: string): Block | undefined {
  const lines = text.split('\n')
  const start = lines.findIndex(line => line.trimEnd() === `## ${title}`)
  if (start === -1) return undefined
  let end = lines.length
  for (let index = start + 1; index < lines.length; index += 1) {
    if (lines[index]?.startsWith('## ')) {
      end = index
      break
    }
  }
  return { title, start, end }
}

/**
 * @param text - whole markdown document.
 * @param title - target block heading.
 * @param stanza - text to add, without trailing newlines.
 * @param blankLine - whether to leave one blank line between the block and the stanza.
 * @returns the rewritten document.
 */
function insertAtBlockEnd(text: string, title: string, stanza: string, blankLine: boolean): string {
  const block = findBlock(text, title)
  if (block === undefined) return  `${text.replace(/\s+$/u, '')}\n\n## ${title}\n\n${stanza}\n`
  const lines = text.split('\n')
  const head = lines.slice(0, block.end).join('\n').replace(/\s+$/u, '')
  const tail = lines.slice(block.end).join('\n')
  const gap = blankLine ? '\n\n' : '\n'
  return tail.length === 0 ? `${head}${gap}${stanza}\n` : `${head}${gap}${stanza}\n\n${tail}`
}

/**
 * @param text - whole markdown document.
 * @param title - target block heading.
 * @param stanza - stanza to append; the block gains a blank line, then it.
 * @returns the rewritten document.
 */
export function appendToBlock(text: string, title: string, stanza: string): string {
  return insertAtBlockEnd(text, title, stanza, true)
}

/**
 * @param text - whole markdown document.
 * @param title - target block heading.
 * @param line - list item to add, already prefixed with `- `.
 * @returns the rewritten document.
 */
export function appendToList(text: string, title: string, line: string): string {
  return insertAtBlockEnd(text, title, line, false)
}
