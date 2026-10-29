import { describe, expect, it } from 'vitest'
import {
  APPEND_LAYOUTS, dailyEntryPath, parseArchiveIndex, SECTION_KINDS, SECTION_LEVELS, SECTION_WARNINGS,
} from '../src/archive-index.ts'

const BASE = { name: 'a', path: 'a.md', kind: 'reference', level: 'free', warning: 'none' }

function doc(...entries: Record<string, unknown>[]): string {
  const body = entries
    .map(entry => `  - ${Object.entries(entry).map(([key, value]) => `${key}: ${JSON.stringify(value)}`).join('\n    ')}`)
    .join('\n')
  return `version: 2\nsections:\n${body}\n`
}

function docWithTrail(trail: string, ...entries: Record<string, unknown>[]): string {
  return `${doc(...entries)}trail: ${JSON.stringify(trail)}\n`
}

describe('archive index', () => {
  it('reads sections in declaration order', () => {
    expect(parseArchiveIndex(doc(
      { name: 'identity', path: 'identity.md', kind: 'always-loaded', level: 'soft', warning: 'strong', description: 'who I am' },
      { name: 'journal', path: 'journal/', kind: 'append', level: 'free', warning: 'none', layout: 'daily' },
    ))).toEqual({
      version: 2,
      sections: [
        { name: 'identity', path: 'identity.md', kind: 'always-loaded', level: 'soft', warning: 'strong', description: 'who I am' },
        { name: 'journal', path: 'journal/', kind: 'append', level: 'free', warning: 'none', layout: 'daily' },
      ],
    })
  })

  it('accepts every declared kind, level and warning', () => {
    const declared = SECTION_KINDS.map(kind => ({
      name: kind,
      path: kind === 'append' ? `${kind}/` : kind,
      kind,
      level: 'free',
      warning: 'none',
      ...(kind === 'append' ? { layout: 'daily' } : {}),
    }))
    expect(parseArchiveIndex(doc(...declared)).sections.map(section => section.kind)).toEqual([...SECTION_KINDS])
    for (const level of SECTION_LEVELS) {
      expect(parseArchiveIndex(doc({ ...BASE, level })).sections[0]?.level).toBe(level)
    }
    for (const warning of SECTION_WARNINGS) {
      expect(parseArchiveIndex(doc({ ...BASE, warning })).sections[0]?.warning).toBe(warning)
    }
  })

  it('accepts every append layout at a matching path', () => {
    const declared = APPEND_LAYOUTS.map(layout => ({
      name: layout, path: layout === 'daily' ? 'daily/' : 'single.md', kind: 'append', level: 'free', warning: 'none', layout,
    }))
    expect(parseArchiveIndex(doc(...declared)).sections.map(section => section.layout)).toEqual([...APPEND_LAYOUTS])
  })

  it('rejects YAML that does not parse', () => {
    expect(() => parseArchiveIndex('version: [')).toThrow(/not valid YAML/u)
  })

  it('rejects a document that is not a mapping', () => {
    expect(() => parseArchiveIndex('- 1')).toThrow(/must be a mapping/u)
  })

  it('rejects a missing or unsupported version', () => {
    expect(() => parseArchiveIndex('sections: []')).toThrow(/unsupported version/u)
    expect(() => parseArchiveIndex('version: 1\nsections: []')).toThrow(/unsupported version/u)
    expect(() => parseArchiveIndex('version: 3\nsections: []')).toThrow(/unsupported version/u)
  })

  it('rejects a missing or empty section list', () => {
    expect(() => parseArchiveIndex('version: 2')).toThrow(/non-empty list/u)
    expect(() => parseArchiveIndex('version: 2\nsections: []')).toThrow(/non-empty list/u)
  })

  it('rejects a section that is not a mapping', () => {
    expect(() => parseArchiveIndex('version: 2\nsections: [1]')).toThrow(/sections\[0\] must be a mapping/u)
  })

  it('rejects an empty name and a duplicate name', () => {
    expect(() => parseArchiveIndex(doc({ ...BASE, name: '' })))
      .toThrow(/sections\[0\]\.name must be a non-empty string/u)
    expect(() => parseArchiveIndex(doc(BASE, { ...BASE, path: 'b.md' })))
      .toThrow(/duplicate section name/u)
  })

  it('rejects an unknown kind, level or warning', () => {
    expect(() => parseArchiveIndex(doc({ ...BASE, kind: 'writable' }))).toThrow(/kind must be one of/u)
    expect(() => parseArchiveIndex(doc({ ...BASE, level: 'locked' }))).toThrow(/level must be one of/u)
    expect(() => parseArchiveIndex(doc({ ...BASE, warning: 'loud' }))).toThrow(/warning must be one of/u)
  })

  it('requires a layout for append and forbids it elsewhere', () => {
    expect(() => parseArchiveIndex(doc({ ...BASE, kind: 'append', path: 'j/' }))).toThrow(/layout is required/u)
    expect(() => parseArchiveIndex(doc({ ...BASE, layout: 'daily' }))).toThrow(/only allowed when kind is append/u)
    expect(() => parseArchiveIndex(doc({ ...BASE, kind: 'append', path: 'j/', layout: 'weekly' })))
      .toThrow(/layout must be one of/u)
  })

  it('matches the path shape to the layout', () => {
    expect(() => parseArchiveIndex(doc({ ...BASE, kind: 'append', path: 'j.md', layout: 'daily' })))
      .toThrow(/must be a directory when layout is daily/u)
    expect(() => parseArchiveIndex(doc({ ...BASE, kind: 'append', path: 'j.md', layout: 'single' })))
      .not.toThrow()
    expect(() => parseArchiveIndex(doc({ ...BASE, kind: 'always-loaded', path: 'dir/' })))
      .toThrow(/must be a file, not a directory/u)
  })

  it('rejects the retired timeline layout', () => {
    expect(() => parseArchiveIndex(doc({ ...BASE, kind: 'append', path: 'j/', layout: 'timeline' })))
      .toThrow(/layout must be one of daily, single/u)
  })

  it('rejects a non-string description', () => {
    expect(() => parseArchiveIndex(doc({ ...BASE, description: 1 }))).toThrow(/description must be a string/u)
  })

  it('rejects a path that leaves the archive root', () => {
    for (const path of ['', '/etc/passwd', '..', '../x', 'a\\b']) {
      expect(() => parseArchiveIndex(doc({ ...BASE, path }))).toThrow(/path must/u)
    }
  })

  it('refuses a path that targets the archive map itself', () => {
    expect(() => parseArchiveIndex(doc({ ...BASE, path: 'archive.yaml' }))).toThrow(/may not target the archive map/u)
  })

  it('builds a daily entry path from a calendar date', () => {
    expect(dailyEntryPath('journal/', '2026-10-22')).toBe('journal/2026-10/2026-10-22.md')
    expect(dailyEntryPath('notes', '2026-10-22')).toBe('notes/2026-10/2026-10-22.md')
  })

  it('rejects a date that is not YYYY-MM-DD', () => {
    for (const date of ['2026-10-2', '26-10-22', '2026//10/22', '', '2026-10-22T00:00:00']) {
      expect(() => dailyEntryPath('journal/', date)).toThrow(/YYYY-MM-DD/u)
    }
  })

  it('records a trail target declared at the top level', () => {
    expect(parseArchiveIndex(docWithTrail('journal', BASE,
      { name: 'journal', path: 'journal/', kind: 'append', level: 'free', warning: 'none', layout: 'daily' },
    )).trail).toBe('journal')
  })

  it('rejects a trail that names no declared section', () => {
    expect(() => parseArchiveIndex(docWithTrail('nope', BASE,
      { name: 'journal', path: 'journal/', kind: 'append', level: 'free', warning: 'none', layout: 'daily' },
    ))).toThrow(/`trail` names unknown section/u)
  })

  it('rejects a trail that is not an appendable daily section', () => {
    expect(() => parseArchiveIndex(docWithTrail('a', BASE)))
      .toThrow(/kind: append and layout: daily/u)
    expect(() => parseArchiveIndex(docWithTrail('log',
      { name: 'log', path: 'log.md', kind: 'append', level: 'free', warning: 'none', layout: 'single' },
    ))).toThrow(/kind: append and layout: daily/u)
  })

  it('rejects a trail that is not a section name', () => {
    expect(() => parseArchiveIndex(docWithTrail('', BASE))).toThrow(/must be a non-empty section name/u)
  })
})
