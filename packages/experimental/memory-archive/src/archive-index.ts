/** The structured map that turns an archive's prose navigation into data. */

import { parse } from 'yaml'

/** Section behaviours the archive tools enforce. */
export const SECTION_KINDS = ['always-loaded', 'reference', 'append', 'frozen'] as const

/** One section's allowed behaviour. */
export type SectionKind = typeof SECTION_KINDS[number]

/** One archive section declared by `archive.yaml`. */
export interface ArchiveSection {
  /** Stable identifier the tools accept. */
  readonly name: string
  /** Archive-relative path of the section's file or directory. */
  readonly path: string
  /** What the archive tools may do with this section. */
  readonly kind: SectionKind
  /** Short description shown when listing. */
  readonly description?: string
}

/** A validated `archive.yaml`. */
export interface ArchiveIndex {
  /** Format version; only 1 is understood. */
  readonly version: 1
  /** Declared sections, in declaration order. */
  readonly sections: readonly ArchiveSection[]
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
 * @param value - candidate kind.
 * @returns whether the value is a declared section behaviour.
 */
function isSectionKind(value: unknown): value is SectionKind {
  return typeof value === 'string' && (SECTION_KINDS as readonly string[]).includes(value)
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
  return value
}

/**
 * Parse and validate one `archive.yaml` document.
 * @param text - raw file contents.
 * @returns the validated map.
 * @throws when the document is not a version-1 map with unique sections.
 */
export function parseArchiveIndex(text: string): ArchiveIndex {
  let document: unknown
  try {
    document = parse(text)
  } catch (error) {
    fail(`archive.yaml is not valid YAML: ${error instanceof Error ? error.message : String(error)}`)
  }
  if (!isRecord(document)) fail('archive.yaml must be a mapping with `version` and `sections`')
  if (document.version !== 1) fail(`unsupported version ${JSON.stringify(document.version)}; expected 1`)
  const declared = document.sections
  if (!Array.isArray(declared) || declared.length === 0) fail('`sections` must be a non-empty list')
  const names = new Set<string>()
  const sections = declared.map((entry: unknown, position: number): ArchiveSection => {
    const at = `sections[${position}]`
    if (!isRecord(entry)) fail(`${at} must be a mapping`)
    const { name, path, kind, description } = entry
    if (typeof name !== 'string' || name.length === 0) fail(`${at}.name must be a non-empty string`)
    if (names.has(name)) fail(`duplicate section name ${JSON.stringify(name)}`)
    names.add(name)
    if (!isSectionKind(kind)) fail(`${at}.kind must be one of ${SECTION_KINDS.join(', ')}`)
    if (description !== undefined && typeof description !== 'string') fail(`${at}.description must be a string`)
    return { name, path: relativePath(path, `${at}.path`), kind,
      ...(description === undefined ? {} : { description }) }
  })
  return { version: 1, sections }
}
