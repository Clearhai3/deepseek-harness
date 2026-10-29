/** The structured map that turns an archive's prose navigation into data. */

import { parse } from 'yaml'

/** Section behaviours the archive tools enforce. */
export const SECTION_KINDS = ['always-loaded', 'reference', 'append', 'frozen'] as const

/** One section's allowed behaviour. */
export type SectionKind = typeof SECTION_KINDS[number]

/** AI-side write permission. `gated` means the model may only propose the change. */
export const SECTION_LEVELS = ['gated', 'soft', 'free'] as const

/** One section's AI-side write permission. */
export type SectionLevel = typeof SECTION_LEVELS[number]

/** Human-side warning shown before a panel edit. */
export const SECTION_WARNINGS = ['strong', 'light', 'none'] as const

/** One section's human-side warning. */
export type SectionWarning = typeof SECTION_WARNINGS[number]

/** Where an appendable section puts new entries. */
export const APPEND_LAYOUTS = ['daily', 'single'] as const

/** One appendable section's file-selection rule. */
export type AppendLayout = typeof APPEND_LAYOUTS[number]

/** The archive map's filename. The one path no section may claim. */
export const INDEX_FILENAME = 'archive.yaml'

/** Archive-relative paths no section may claim. */
export const RESERVED_PATHS = [INDEX_FILENAME] as const

/** One archive section declared by `archive.yaml`. */
export interface ArchiveSection {
  /** Stable identifier the tools accept. */
  readonly name: string
  /** Archive-relative path of the section's file or directory. */
  readonly path: string
  /** What the archive tools may do with this section. */
  readonly kind: SectionKind
  /** Whether the model may write on its own, and how hard it is to. */
  readonly level: SectionLevel
  /** How loudly the panel warns a human before editing. */
  readonly warning: SectionWarning
  /** File-selection rule; present exactly when `kind` is `append`. */
  readonly layout?: AppendLayout
  /** Short description shown when listing. */
  readonly description?: string
}

/** A validated `archive.yaml`. */
export interface ArchiveIndex {
  /** Format version; only 2 is understood. */
  readonly version: 2
  /** Declared sections, in declaration order. */
  readonly sections: readonly ArchiveSection[]
  /** Section that recesives the trail when a soft section is edited; absent when undeclared. */
  readonly trail?: string
}

/**
 * @param sectionPath - declared path of a `layout: daily` section.
 * @param date - local calendar date, `YYYY-MM-DD`.
 * @returns the archive-relative path of that day's entry.
 * @throws when `date` is not `YYYY-MM-DD`.
 */
export function dailyEntryPath(sectionPath: string, date: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(date)) {
    throw new Error(`memory archive: daily layout needs a YYYY-MM-DD date, got ${JSON.stringify(date)}`)
  }
  return `${sectionPath.replace(/\/+$/u, '')}/${date.slice(0, 7)}/${date}.md`
}

/**
 * @param message - what is wrong with the document.
 * @returns never.
 * @throws always, with the archive prefix that names the owning format.
 */
function fail(message: string): never {
  throw new Error(`memory archive: ${message}`)
}

/**
 * @param value - candidate mapping.
 * @returns whether the value is a non-array object.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * @param values - declared members.
 * @param value - candidate member.
 * @returns whether the value is one of the declared members.
 */
function isMember<T extends string>(values: readonly T[], value: unknown): value is T {
  return typeof value === 'string' && (values as readonly string[]).includes(value)
}

/**
 * @param value - candidate path.
 * @param at - location used in the failure message.
 * @returns the archive-relative path.
 */
function relativePath(value: unknown, at: string): string {
  if (typeof value !== 'string' || value.length === 0) fail(`${at} must be a non-empty string`)
  if (value.startsWith('/') || value.includes('\\') || value.split('/').includes('..')) {
    fail(`${at} must stay inside the archive root, got ${JSON.stringify(value)}`)
  }
  if ((RESERVED_PATHS as readonly string[]).includes(value)) {
    fail(`${at} may not target the archive map itself, got ${JSON.stringify(value)}`)
  }
  return value
}

/**
 * @param at - location used in the failure message.
 * @param path - archive-relative path of the section.
 * @param kind - declared behaviour.
 * @param layout - declared file-selection rule, when the section is appendable.
 */
function checkPathShape(at: string, path: string, kind: SectionKind, layout: AppendLayout | undefined): void {
  const isDirectory = path.endsWith('/')
  if (kind === 'always-loaded' && isDirectory) fail(`${at}.path must be a file, not a directory`)
  if (layout === 'daily' && !isDirectory) fail(`${at}.path must be a directory when layout is daily`)
  if (layout !== undefined && layout !== 'daily' && isDirectory) {
    fail(`${at}.path must be a file when layout is ${layout}`)
  }
}

/**
 * Parse and validate one `archive.yaml` document.
 * @param text - raw file contents.
 * @returns the validated map.
 * @throws when the document is not a version-2 map with unique, self-consistent sections.
 */
export function parseArchiveIndex(text: string): ArchiveIndex {
  let document: unknown
  try {
    document = parse(text)
  } catch (error) {
    fail(`${INDEX_FILENAME} is not valid YAML: ${error instanceof Error ? error.message : String(error)}`)
  }
  if (!isRecord(document)) fail(`${INDEX_FILENAME} must be a mapping with \`version\` and \`sections\``)
  if (document.version !== 2) fail(`unsupported version ${JSON.stringify(document.version)}; expected 2`)
  const declared = document.sections
  if (!Array.isArray(declared) || declared.length === 0) fail('`sections` must be a non-empty list')
  const names = new Set<string>()
  const sections = declared.map((entry: unknown, position: number): ArchiveSection => {
    const at = `sections[${position}]`
    if (!isRecord(entry)) fail(`${at} must be a mapping`)
    const { name, path, kind, level, warning, layout, description } = entry
    if (typeof name !== 'string' || name.length === 0) fail(`${at}.name must be a non-empty string`)
    if (names.has(name)) fail(`duplicate section name ${JSON.stringify(name)}`)
    names.add(name)
    if (!isMember(SECTION_KINDS, kind)) fail(`${at}.kind must be one of ${SECTION_KINDS.join(', ')}`)
    if (!isMember(SECTION_LEVELS, level)) fail(`${at}.level must be one of ${SECTION_LEVELS.join(', ')}`)
    if (!isMember(SECTION_WARNINGS, warning)) fail(`${at}.warning must be one of ${SECTION_WARNINGS.join(', ')}`)
    if (kind === 'append' && layout === undefined) fail(`${at}.layout is required when kind is append`)
    if (kind !== 'append' && layout !== undefined) fail(`${at}.layout is only allowed when kind is append`)
    if (layout !== undefined && !isMember(APPEND_LAYOUTS, layout)) {
      fail(`${at}.layout must be one of ${APPEND_LAYOUTS.join(', ')}`)
    }
    if (description !== undefined && typeof description !== 'string') fail(`${at}.description must be a string`)
    const resolved = relativePath(path, `${at}.path`)
    checkPathShape(at, resolved, kind, layout)
    return { name, path: resolved, kind, level, warning,
      ...(layout === undefined ? {} : { layout }),
      ...(description === undefined ? {} : { description }),
    }
  })
  const trail = resolveTrail(document.trail, sections)
  return { version: 2, sections, ...(trail === undefined ? {} : { trail }) }
}

/**
 * @param declared - the document's top-level `trail`, if any.
 * @param sections - parsed sections, in declaration order.
 * @returns the trail section name, when one is declared.
 * @throws when the declaration does not name an appendable daily section.
 */
function resolveTrail(declared: unknown, section: readonly ArchiveSection[]): string | undefined {
  if (declared === undefined) return undefined
  if (typeof declared !== 'string' || declared.length === 0) {
    fail('`trail` must be a non-empty section name')
  }
  const target = section.find(section => section.name === declared)
  if (target === undefined) fail(`\`trail\` names unknown section ${JSON.stringify(declared)}`)
  if (target.kind !== 'append' || target.layout !== 'daily') {
    const shape = target.layout === undefined ? target.kind : `${target.kind} / ${target.layout}`
    fail(`\`trail\` must name a section with kind: append and layout: daily, but ${JSON.stringify(declared)} is ${shape}`)
  }
  return declared
}
